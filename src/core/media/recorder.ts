import fs from "node:fs";
import path from "node:path";
import { pieceDir } from "./storage";
import type { LoginCreds } from "@/core/secrets/login";

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
  pieceId: string;
  url: string;
  pasos: string[];
  login?: LoginCreds | null;
  log: (m: string) => void;
}

// Selectores habituales para un login generico.
const USER_SELECTORS = [
  'input[type="email"]',
  'input[name="email"]',
  'input[name="username"]',
  'input[name="user"]',
  'input[id*="email" i]',
  'input[id*="user" i]',
];
const PASS_SELECTORS = ['input[type="password"]', 'input[name="password"]', 'input[id*="pass" i]'];
const SUBMIT_SELECTORS = [
  'button[type="submit"]',
  'input[type="submit"]',
  'button:has-text("Entrar")',
  'button:has-text("Iniciar")',
  'button:has-text("Log in")',
  'button:has-text("Sign in")',
];

async function tryFill(page: unknown, selectors: string[], value: string): Promise<boolean> {
  const p = page as {
    locator: (s: string) => { first: () => { fill: (v: string) => Promise<void>; count: () => Promise<number> } };
  };
  for (const sel of selectors) {
    try {
      const loc = p.locator(sel).first();
      if ((await loc.count()) > 0) {
        await loc.fill(value);
        return true;
      }
    } catch {
      /* siguiente selector */
    }
  }
  return false;
}

async function tryClick(page: unknown, selectors: string[]): Promise<boolean> {
  const p = page as {
    locator: (s: string) => { first: () => { click: () => Promise<void>; count: () => Promise<number> } };
  };
  for (const sel of selectors) {
    try {
      const loc = p.locator(sel).first();
      if ((await loc.count()) > 0) {
        await loc.click();
        return true;
      }
    } catch {
      /* siguiente selector */
    }
  }
  return false;
}

export async function recordDemo(args: RecordArgs): Promise<string> {
  const { pieceId, url, pasos, login, log } = args;

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

  let browser: import("playwright").Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    throw new Error(
      "Playwright no tiene el navegador instalado. Ejecuta 'npx playwright install chromium' o usa el modo manual (subir video).",
    );
  }

  try {
    const context = await browser.newContext({
      ...device,
      recordVideo: { dir, size: { width: 390, height: 844 } },
    });
    const page = await context.newPage();

    log(`Abriendo ${url} en modo movil…`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);

    if (login) {
      const okUser = await tryFill(page, USER_SELECTORS, login.user);
      const okPass = await tryFill(page, PASS_SELECTORS, login.pass);
      if (okUser && okPass) {
        await tryClick(page, SUBMIT_SELECTORS);
        await page.waitForTimeout(3000);
        log("Login enviado (best-effort).");
      } else {
        log("No se encontro el formulario de login; se graba sin autenticar.");
      }
    }

    // Recorre los pasos como guia: scroll progresivo para capturar la funcionalidad.
    const total = Math.max(pasos.length, 3);
    for (let i = 0; i < total; i++) {
      if (pasos[i]) log(`Paso ${i + 1}: ${pasos[i]}`);
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.7)).catch(() => {});
      await page.waitForTimeout(1800);
    }

    const video = page.video();
    await context.close(); // finaliza y vuelca el video

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
    log("Grabacion de la app completada.");
    return rel;
  } finally {
    await browser.close().catch(() => {});
  }
}
