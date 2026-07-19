import fs from "node:fs";
import path from "node:path";
import { pieceDir } from "./storage";
import type { LoginCreds } from "@/core/secrets/login";
import type { NavStep } from "@/core/content/types";
import { hasFfmpeg, runFfmpeg } from "./ffmpeg";
import { dismissTransientDialogs, prepareAuthenticatedSession } from "./auth-session";

/**
 * REQ-006 — Grabacion de la propia app con Playwright en modo movil.
 * Import DINAMICO de playwright: el paquete es devDependency y los navegadores
 * pueden no estar instalados; si falta algo, se lanza un error claro para que la
 * pieza caiga al modo manual (subir screencast). Devuelve la ruta RELATIVA a data/.
 *
 * NOTA: la automatizacion de login/pasos es best-effort (selectores comunes).
 * La shell del agente no tiene navegadores instalados; esto se verifica en la
 * maquina del usuario (`npx playwright install chromium`).
 */

const DATA_DIR = path.join(process.cwd(), "data");

export interface RecordArgs {
  projectId: string;
  pieceId: string;
  url: string;
  pasos: string[];
  navSteps?: NavStep[];
  login?: LoginCreds | null;
  log: (m: string) => void;
  dryRun?: boolean;
}

export class RecordStepError extends Error {
  constructor(
    message: string,
    public readonly failedStep: number,
  ) {
    super(message);
    this.name = "RecordStepError";
  }
}

interface NavLogStep extends NavStep {
  t_inicio: number;
  t_fin: number;
}

interface FinalNavLogStep {
  action: "final";
  t_inicio: number;
  t_fin: number;
}

export async function recordDemo(args: RecordArgs): Promise<string> {
  const { projectId, pieceId, url, pasos, navSteps, login, log, dryRun = false } = args;

  // Import dinamico: si playwright/navegador no estan, degradamos a modo manual.
  let chromium: typeof import("playwright").chromium;
  let devices: typeof import("playwright").devices;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
    devices = pw.devices;
  } catch {
    throw new Error(
      "Playwright no esta disponible. Instala con 'npm i -D playwright' o usa el modo manual (subir video).",
    );
  }

  const dir = pieceDir(pieceId);
  const device = devices["iPhone 13"];
  const sessionsDir = path.join(DATA_DIR, "sessions");
  const safeProjectId = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const sessionPath = path.join(sessionsDir, `${safeProjectId}.json`);

  let browser: import("playwright").Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    throw new Error(
      "Playwright no tiene el navegador instalado. Ejecuta 'npx playwright install chromium' o usa el modo manual (subir video).",
    );
  }

  let context: import("playwright").BrowserContext | null = null;
  let contextClosed = false;
  try {
    if (login) {
      await prepareAuthenticatedSession({
        browser,
        device,
        sessionPath,
        url,
        login,
        log,
      });
    }
    const sessionReady = Boolean(login) && fs.existsSync(sessionPath);
    const contextOptions: import("playwright").BrowserContextOptions = {
      ...device,
      recordVideo: dryRun ? undefined : { dir, size: { width: 390, height: 844 } },
      storageState: sessionReady ? sessionPath : undefined,
    };
    context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    log(`Abriendo ${url} en modo movil…`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    } catch (error) {
      if (dryRun) throw error;
      log("La carga inicial no termino a tiempo; se intenta continuar con la pagina disponible.");
    }
    await page.waitForTimeout(1500);

    const t0 = Date.now();
    const now = () => Math.round(((Date.now() - t0) / 1000) * 100) / 100;
    const navLog: Array<NavLogStep | FinalNavLogStep> = [];

    if (navSteps?.length) {
      let stoppedBeforeCommit = false;
      for (let i = 0; i < navSteps.length; i++) {
        const step = navSteps[i];
        const started = now();
        log(`Paso ${i + 1}: ${step.action}`);
        try {
          await dismissTransientDialogs(page, log);
          switch (step.action) {
            case "goto":
              if (!step.url) throw new Error("falta url");
              await page.goto(step.url, {
                waitUntil: "networkidle",
                timeout: step.timeoutMs ?? 30000,
              });
              break;
            case "tap":
              if (!step.selector) throw new Error("falta selector");
              if (dryRun && step.commit) {
                await page
                  .locator(step.selector)
                  .first()
                  .waitFor({ state: "visible", timeout: step.timeoutMs ?? 15000 });
                stoppedBeforeCommit = true;
                log(`Control final localizado; dry-run detenido antes de ejecutar: ${step.selector}`);
              } else {
                await page.locator(step.selector).first().tap({ timeout: step.timeoutMs ?? 15000 });
              }
              break;
            case "fill":
              if (!step.selector) throw new Error("falta selector");
              await page
                .locator(step.selector)
                .first()
                .fill(step.value ?? "", { timeout: step.timeoutMs ?? 15000 });
              break;
            case "wait":
              if (!step.selector) throw new Error("falta selector");
              await page.waitForSelector(step.selector, { timeout: step.timeoutMs ?? 15000 });
              break;
            case "scroll":
              await page.mouse.wheel(0, step.pixels ?? 500);
              break;
          }
          navLog.push({ t_inicio: started, t_fin: now(), ...step });
          if (stoppedBeforeCommit) break;
          await page.waitForTimeout(step.pauseMs ?? 1500);
        } catch (error) {
          await page.screenshot({ path: path.join(dir, "error.jpg"), fullPage: false }).catch(() => {});
          const detail = error instanceof Error ? error.message : String(error);
          throw new RecordStepError(`Fallo en el paso ${i + 1} (${step.action}): ${detail}`, i + 1);
        }
      }
    } else {
      // Compatibilidad con piezas antiguas: conserva el scroll guiado actual,
      // pero registra tiempos para que el montaje pueda recortar la grabacion.
      const total = Math.max(pasos.length, 3);
      for (let i = 0; i < total; i++) {
        if (pasos[i]) log(`Paso ${i + 1}: ${pasos[i]}`);
        const started = now();
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.7)).catch(() => {});
        navLog.push({
          action: "scroll",
          pixels: 590,
          t_inicio: started,
          t_fin: now(),
        });
        await page.waitForTimeout(1800);
      }
    }

    const finalStart = now();
    await page.waitForTimeout(2000);
    navLog.push({ action: "final", t_inicio: finalStart, t_fin: now() });
    const duration = navLog.at(-1)?.t_fin ?? now();
    fs.writeFileSync(
      path.join(dir, "nav_log.json"),
      JSON.stringify({ duracion: duration, pasos: navLog }, null, 2),
      "utf8",
    );

    const video = page.video();
    await context.close(); // finaliza y vuelca el video
    contextClosed = true;

    if (dryRun) {
      log("Pasos validados correctamente (sin grabar video).");
      return "";
    }

    let rel = "";
    if (video) {
      const src = await video.path();
      const dest = path.join(dir, "screencast.webm");
      try {
        if (fs.existsSync(src) && src !== dest) fs.renameSync(src, dest);
        rel = path.relative(DATA_DIR, dest).replace(/\\/g, "/");
      } catch {
        rel = path.relative(DATA_DIR, src).replace(/\\/g, "/");
      }
    }
    if (!rel) throw new Error("Playwright no genero el video de la grabacion.");

    if (hasFfmpeg()) {
      try {
        runFfmpeg(
          ["-y", "-i", "screencast.webm", "-r", "30", "-pix_fmt", "yuv420p", "screen.mp4"],
          dir,
        );
        const normalized = path.join(dir, "screen.mp4");
        if (fs.existsSync(normalized)) {
          const webm = path.join(dir, "screencast.webm");
          if (fs.existsSync(webm)) fs.unlinkSync(webm);
          rel = path.relative(DATA_DIR, normalized).replace(/\\/g, "/");
          log("Grabacion normalizada a MP4 (30 fps).");
        }
      } catch {
        log("No se pudo normalizar la grabacion; se conserva el WebM original.");
      }
    }

    log("Grabacion de la app completada.");
    return rel;
  } finally {
    if (context && !contextClosed) await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
