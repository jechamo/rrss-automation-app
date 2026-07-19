import path from "node:path";
import type { LoginCreds } from "@/core/secrets/login";
import { prepareAuthenticatedSession } from "./auth-session";

const DATA_DIR = path.join(process.cwd(), "data");

interface ObservedElement {
  tag: string;
  text: string;
  href: string;
  id: string;
  name: string;
  placeholder: string;
  role: string;
  testId: string;
  tutorial: string;
  cursorPointerIndex: number;
}

export interface RuntimeNavigationSnapshot {
  url: string;
  title: string;
  authenticated: boolean;
  elements: Array<ObservedElement & { selector: string }>;
  logs: string[];
}

function attributeSelector(attribute: string, value: string): string {
  return `[${attribute}=${JSON.stringify(value)}]`;
}

function selectorFor(element: ObservedElement): string {
  if (element.testId) return attributeSelector("data-testid", element.testId);
  if (element.tutorial) return attributeSelector("data-tutorial", element.tutorial);
  if (element.id) return attributeSelector("id", element.id);
  if (element.name) return `${element.tag}${attributeSelector("name", element.name)}`;
  if (element.placeholder) return `${element.tag}${attributeSelector("placeholder", element.placeholder)}`;
  if (element.href) return `a${attributeSelector("href", element.href)}`;
  if (element.text && element.tag === "button") return `button:has-text(${JSON.stringify(element.text)})`;
  if (element.text && element.tag === "a") return `a:has-text(${JSON.stringify(element.text)})`;
  if (element.text && element.role === "button") {
    return `[role="button"]:has-text(${JSON.stringify(element.text)})`;
  }
  if (element.cursorPointerIndex >= 0) {
    return `${element.tag}.cursor-pointer >> nth=${element.cursorPointerIndex}`;
  }
  return element.tag;
}

/**
 * Inspecciona únicamente la primera superficie privada tras autenticar. No hace clic en la
 * funcionalidad ni ejecuta acciones de negocio. La contraseña nunca forma parte del resultado.
 */
export async function inspectNavigationSurface(args: {
  projectId: string;
  url: string;
  login: LoginCreds;
}): Promise<RuntimeNavigationSnapshot> {
  const playwright = await import("playwright").catch(() => null);
  if (!playwright) throw new Error("Playwright no está disponible para inspeccionar la zona privada.");

  const logs: string[] = [];
  const safeProjectId = args.projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const sessionsDir = path.join(DATA_DIR, "sessions");
  const sessionPath = path.join(sessionsDir, `${safeProjectId}.json`);
  let browser: import("playwright").Browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
  } catch {
    throw new Error(
      "Playwright no tiene Chromium instalado. Ejecuta 'npx playwright install chromium'.",
    );
  }

  try {
    const device = playwright.devices["iPhone 13"];
    await prepareAuthenticatedSession({
      browser,
      device,
      sessionPath,
      url: args.url,
      login: args.login,
      log: (message) => logs.push(message),
    });
    const context = await browser.newContext({ ...device, storageState: sessionPath });

    try {
      const page = await context.newPage();
      await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1200);

      const observed = await page.locator(
        'a[href], button, input:not([type="password"]), select, textarea, [role="button"], [data-testid], [data-tutorial], .cursor-pointer',
      ).evaluateAll((nodes) => {
        const cursorCounts = new Map<string, number>();
        return nodes.slice(0, 120).map((node) => {
          const element = node as HTMLElement;
          const tag = element.tagName.toLowerCase();
          const classList = Array.from(element.classList);
          let cursorPointerIndex = -1;
          if (classList.includes("cursor-pointer")) {
            cursorPointerIndex = cursorCounts.get(tag) ?? 0;
            cursorCounts.set(tag, cursorPointerIndex + 1);
          }
          return {
            tag,
            text: (element.innerText || element.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 120),
            href: element.getAttribute("href") || "",
            id: element.id || "",
            name: element.getAttribute("name") || "",
            placeholder: element.getAttribute("placeholder") || "",
            role: element.getAttribute("role") || "",
            testId: element.getAttribute("data-testid") || "",
            tutorial: element.getAttribute("data-tutorial") || "",
            cursorPointerIndex,
          };
        });
      }) as ObservedElement[];

      return {
        url: page.url(),
        title: await page.title(),
        authenticated: true,
        elements: observed.map((element) => ({ ...element, selector: selectorFor(element) })),
        logs,
      };
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

export function runtimeSnapshotPrompt(snapshot: RuntimeNavigationSnapshot): string {
  const rows = snapshot.elements.map((element) => {
    const details = [
      element.text && `texto=${JSON.stringify(element.text)}`,
      element.href && `href=${JSON.stringify(element.href)}`,
      `selector=${JSON.stringify(element.selector)}`,
    ].filter(Boolean);
    return `- <${element.tag}> ${details.join(" | ")}`;
  });
  return [
    "## Superficie observada por Playwright después del login",
    `URL real: ${snapshot.url}`,
    `Título: ${snapshot.title}`,
    "Elementos visibles/accionables (selectores observados, no credenciales):",
    ...(rows.length ? rows : ["- No se detectaron elementos accionables."]),
  ].join("\n");
}
