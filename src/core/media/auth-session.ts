import fs from "node:fs";
import path from "node:path";
import type { LoginCreds } from "@/core/secrets/login";

type Scope = import("playwright").Page | import("playwright").Frame;

const USER_SELECTORS = [
  'input[type="email"]',
  'input[autocomplete="email" i]',
  'input[autocomplete="username" i]',
  'input[name="email" i]',
  'input[name="username" i]',
  'input[name="user" i]',
  'input[name="identifier" i]',
  'input[name="login" i]',
  'input[id*="email" i]',
  'input[id*="user" i]',
  'input[id*="identifier" i]',
  'input[placeholder*="email" i]',
  'input[placeholder*="correo" i]',
  'input[placeholder*="usuario" i]',
  'input[aria-label*="email" i]',
  'input[aria-label*="correo" i]',
  'input[aria-label*="usuario" i]',
];

const PASS_SELECTORS = [
  'input[type="password"]',
  'input[autocomplete="current-password" i]',
  'input[name="password" i]',
  'input[id*="pass" i]',
];

const SUBMIT_SELECTORS = [
  'button[type="submit"]',
  'input[type="submit"]',
  'button:has-text("Iniciar sesión")',
  'button:has-text("Iniciar sesion")',
  'button:has-text("Entrar")',
  'button:has-text("Acceder")',
  'button:has-text("Ingresar")',
  'button:has-text("Continuar")',
  'button:has-text("Log in")',
  'button:has-text("Login")',
  'button:has-text("Sign in")',
];

const LOGIN_LAUNCHERS = [
  'a[href*="/auth"]',
  'a[href*="login" i]',
  'a:has-text("Iniciar sesión")',
  'a:has-text("Iniciar sesion")',
  'a:has-text("Entrar")',
  'a:has-text("Acceder")',
  'button:has-text("Iniciar sesión")',
  'button:has-text("Iniciar sesion")',
  'button:has-text("Entrar")',
  'button:has-text("Acceder")',
  'button:has-text("Login")',
  'button:has-text("Sign in")',
];

const SAFE_DIALOG_DISMISSERS = [
  '[role="dialog"] button:has-text("Saltar")',
  '[role="dialog"] button:has-text("Cerrar")',
  '[role="dialog"] button:has-text("Entendido")',
  '[role="dialog"] button:has-text("Ahora no")',
  '[role="dialog"] button:has-text("Omitir")',
  '[role="dialog"] button[aria-label="Close" i]',
  '[role="dialog"] button[aria-label="Cerrar" i]',
];

async function firstVisible(scope: Scope, selectors: string[]) {
  for (const selector of selectors) {
    const locator = scope.locator(selector).first();
    if ((await locator.count().catch(() => 0)) > 0 && (await locator.isVisible().catch(() => false))) {
      return locator;
    }
  }
  return null;
}

async function findVisible(page: import("playwright").Page, selectors: string[]) {
  for (const frame of page.frames()) {
    const locator = await firstVisible(frame, selectors);
    if (locator) return { scope: frame as Scope, locator };
  }
  return null;
}

async function waitForVisible(
  page: import("playwright").Page,
  selectors: string[],
  timeoutMs: number,
) {
  const until = Date.now() + timeoutMs;
  do {
    const match = await findVisible(page, selectors);
    if (match) return match;
    await page.waitForTimeout(250);
  } while (Date.now() < until);
  return null;
}

/** Cierra únicamente diálogos informativos con acciones no mutantes conocidas. */
export async function dismissTransientDialogs(
  page: import("playwright").Page,
  log?: (message: string) => void,
): Promise<number> {
  let dismissed = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const control = await findVisible(page, SAFE_DIALOG_DISMISSERS);
    if (!control) break;
    await control.locator.click({ timeout: 5_000 });
    dismissed += 1;
    await page.waitForTimeout(250);
  }
  if (dismissed > 0) log?.(`Se cerraron ${dismissed} aviso(s) informativo(s) antes del recorrido.`);
  return dismissed;
}

async function loginWithCredentials(
  page: import("playwright").Page,
  login: LoginCreds,
): Promise<void> {
  const passwordMatch = await waitForVisible(page, PASS_SELECTORS, 6_000);
  if (!passwordMatch) {
    throw new Error(`No se encontró el campo de contraseña en ${page.url()}.`);
  }

  let user = await firstVisible(passwordMatch.scope, USER_SELECTORS);
  if (!user) {
    // Fallback acotado al mismo frame que contiene la contraseña. Cubre formularios
    // que llaman al campo "identifier" u otros nombres no convencionales.
    user = await firstVisible(passwordMatch.scope, [
      'input[type="text"]:not([disabled])',
      'input:not([type]):not([disabled])',
    ]);
  }
  if (!user) {
    throw new Error("Se detectó la contraseña, pero no el campo de usuario, email o identificador.");
  }

  await user.fill(login.user);
  await passwordMatch.locator.fill(login.pass);
  const submit = await firstVisible(passwordMatch.scope, SUBMIT_SELECTORS);
  if (!submit) throw new Error("No se encontró el botón para iniciar sesión.");
  await submit.click();
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => {});

  const until = Date.now() + 15_000;
  while (Date.now() < until) {
    if (!(await findVisible(page, PASS_SELECTORS))) return;
    await page.waitForTimeout(300);
  }
  throw new Error("El formulario siguió visible después del login; revisa usuario y contraseña.");
}

/**
 * Prepara una sesión autenticada en un contexto SIN grabación. Así la captura
 * posterior nunca incluye el formulario ni la escritura de credenciales.
 */
export async function prepareAuthenticatedSession(args: {
  browser: import("playwright").Browser;
  device: import("playwright").BrowserContextOptions;
  sessionPath: string;
  url: string;
  login: LoginCreds;
  log: (message: string) => void;
}): Promise<void> {
  const hadSession = fs.existsSync(args.sessionPath);
  let sessionLoaded = hadSession;
  let context: import("playwright").BrowserContext;
  try {
    context = await args.browser.newContext({
      ...args.device,
      storageState: hadSession ? args.sessionPath : undefined,
    });
  } catch {
    sessionLoaded = false;
    context = await args.browser.newContext({ ...args.device });
    args.log("La sesión guardada no era reutilizable; se autenticará de nuevo.");
  }

  try {
    const page = await context.newPage();
    await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(1_200);

    let password = await waitForVisible(page, PASS_SELECTORS, 4_000);
    if (!password && sessionLoaded) {
      args.log("Sesión guardada comprobada correctamente.");
    } else {
      if (!password) {
        const launcher = await findVisible(page, LOGIN_LAUNCHERS);
        if (launcher) {
          await launcher.locator.click();
          password = await waitForVisible(page, PASS_SELECTORS, 8_000);
        }
      }
      if (!password) {
        throw new Error(
          `Hay credenciales guardadas, pero Playwright no encontró el formulario ni un acceso de login en ${page.url()}.`,
        );
      }
      await loginWithCredentials(page, args.login);
      args.log("Login completado antes de iniciar la grabación.");
    }

    await page.waitForTimeout(900);
    await dismissTransientDialogs(page, args.log);
    fs.mkdirSync(path.dirname(args.sessionPath), { recursive: true });
    await context.storageState({ path: args.sessionPath });
    args.log("Sesión autenticada guardada para futuras grabaciones.");
  } finally {
    await context.close();
  }
}
