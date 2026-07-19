import fs from "node:fs";
import path from "node:path";
import type { LoginCreds } from "@/core/secrets/login";

const DATA_DIR = path.join(process.cwd(), "data");

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

async function firstVisible(
  page: import("playwright").Page,
  selectors: string[],
): Promise<import("playwright").Locator | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count().catch(() => 0)) > 0 && (await locator.isVisible().catch(() => false))) {
      return locator;
    }
  }
  return null;
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
  const hasSession = fs.existsSync(sessionPath);
  let browser: import("playwright").Browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
  } catch {
    throw new Error(
      "Playwright no tiene Chromium instalado. Ejecuta 'npx playwright install chromium'.",
    );
  }

  try {
    let context: import("playwright").BrowserContext;
    try {
      context = await browser.newContext({
        ...playwright.devices["iPhone 13"],
        storageState: hasSession ? sessionPath : undefined,
      });
    } catch {
      context = await browser.newContext({ ...playwright.devices["iPhone 13"] });
      logs.push("La sesión anterior no era reutilizable; se inició una sesión limpia.");
    }

    try {
      const page = await context.newPage();
      await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1200);

      const password = await firstVisible(page, PASS_SELECTORS);
      if (password) {
        const user = await firstVisible(page, USER_SELECTORS);
        if (!user) throw new Error("Se detectó contraseña, pero no el campo de usuario/email.");
        await user.fill(args.login.user);
        await password.fill(args.login.pass);
        const submit = await firstVisible(page, SUBMIT_SELECTORS);
        if (!submit) throw new Error("No se encontró el botón para iniciar sesión.");
        await submit.click();
        await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2500);
        logs.push("Login completado para inspeccionar la superficie privada.");
      } else {
        logs.push(hasSession ? "Sesión cifrada reutilizada." : "La URL ya estaba autenticada.");
      }

      const stillAtLogin = Boolean(await firstVisible(page, PASS_SELECTORS));
      if (stillAtLogin) throw new Error("El login no abrió la zona privada; revisa las credenciales.");

      fs.mkdirSync(sessionsDir, { recursive: true });
      await context.storageState({ path: sessionPath }).catch(() => {});

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
