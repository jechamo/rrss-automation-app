import fs from "node:fs";
import path from "node:path";
import type { LoginCreds } from "@/core/secrets/login";
import { inspectNavigationSurface } from "@/core/media/navigation-inspector";
import {
  coerceNavigationMap,
  flattenNavigation,
  type NavigationMap,
  type NavigationNode,
} from "./types";
import { getDataDir } from "../runtime/e2e-profile";
import { isMockE2E } from "../runtime/e2e-profile";
import { installLoopbackRouteGuard } from "../runtime/egress-policy";

const DATA_DIR = getDataDir();
const DYNAMIC_ROUTE = /:\w+|\{[^}]+\}|\[[^\]]+\]|\*/;
const AUTH_ROUTE = /\/(?:auth|login|signin|sign-in|iniciar)(?:\/|$)/i;

function routeKey(value: string, baseUrl: string): string {
  try {
    const url = new URL(value, baseUrl);
    return `${url.origin}${url.pathname.replace(/\/$/, "") || "/"}${url.search}`;
  } catch {
    return value;
  }
}

function runtimeId(label: string, route: string): string {
  return `runtime-${label}-${route}`
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function verifyNavigationMap(args: {
  projectId: string;
  baseUrl: string;
  map: NavigationMap;
  login?: LoginCreds | null;
}): Promise<NavigationMap> {
  if (args.login) {
    // Autentica sin navegar por funciones y guarda un storageState reutilizable.
    await inspectNavigationSurface({
      projectId: args.projectId,
      url: args.baseUrl,
      login: args.login,
    });
  }

  const playwright = await import("playwright").catch(() => null);
  if (!playwright) throw new Error("Playwright no está disponible para verificar el mapa.");
  let browser: import("playwright").Browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
  } catch {
    throw new Error("Playwright no tiene Chromium instalado. Ejecuta 'npx playwright install chromium'.");
  }

  const map = coerceNavigationMap(JSON.parse(JSON.stringify(args.map)));
  const base = new URL(args.baseUrl);
  const safeProjectId = args.projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const sessionPath = path.join(DATA_DIR, "sessions", `${safeProjectId}.json`);
  const storageState = fs.existsSync(sessionPath) ? sessionPath : undefined;
  const knownRoutes = new Set(
    flattenNavigation(map.roots)
      .map((node) => node.route)
      .filter(Boolean)
      .map((route) => routeKey(route, args.baseUrl)),
  );
  const visited = new Map<string, { verification: NavigationNode["verification"]; finalUrl?: string }>();
  let visitCount = 0;

  const context = await browser.newContext({
    ...playwright.devices["iPhone 13"],
    storageState,
  });
  if (isMockE2E()) await installLoopbackRouteGuard(context);
  try {
    const page = await context.newPage();
    const visitNodes = async (nodes: NavigationNode[]): Promise<void> => {
      for (const node of nodes) {
        if (node.route && visitCount < 36) {
          if (DYNAMIC_ROUTE.test(node.route)) {
            node.verification = "conditional";
            if (!node.conditions.some((condition) => /din[aá]mic|dato real/i.test(condition))) {
              node.conditions.push("Ruta dinámica: necesita un dato real para verificarse.");
            }
          } else {
            let target: URL | null = null;
            try {
              target = new URL(node.route, args.baseUrl);
            } catch {
              node.verification = "pending";
            }
            if (target && target.origin !== base.origin) {
              node.verification = "pending";
            } else if (target) {
              const key = routeKey(target.href, args.baseUrl);
              const cached = visited.get(key);
              if (cached) {
                node.verification = cached.verification;
                node.finalUrl = cached.finalUrl;
              } else {
                visitCount += 1;
                try {
                  await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 20_000 });
                  await page.waitForTimeout(600);
                  const finalUrl = page.url();
                  const final = new URL(finalUrl);
                  const sentToLogin = AUTH_ROUTE.test(final.pathname) && !AUTH_ROUTE.test(target.pathname);
                  const verification: NavigationNode["verification"] = sentToLogin
                    ? "unavailable"
                    : routeKey(finalUrl, args.baseUrl) === key
                      ? "verified"
                      : "redirected";
                  node.verification = verification;
                  node.finalUrl = finalUrl;
                  visited.set(key, { verification, finalUrl });

                  if (node.depth < 3 && !sentToLogin) {
                    const links = await page.locator("a[href]").evaluateAll((elements) =>
                      elements.slice(0, 100).map((element) => ({
                        label: ((element as HTMLElement).innerText || element.getAttribute("aria-label") || "")
                          .trim()
                          .replace(/\s+/g, " ")
                          .slice(0, 100),
                        href: element.getAttribute("href") || "",
                      })),
                    ) as Array<{ label: string; href: string }>;
                    for (const link of links) {
                      if (!link.href || /^(?:mailto:|tel:|javascript:|#)/i.test(link.href)) continue;
                      let observed: URL;
                      try {
                        observed = new URL(link.href, finalUrl);
                      } catch {
                        continue;
                      }
                      if (observed.origin !== base.origin) continue;
                      if (/no admin|exclu.*admin|cliente normal/i.test(map.audience + " " + map.summary) && /\/admin(?:\/|$)/i.test(observed.pathname)) continue;
                      const observedKey = routeKey(observed.href, args.baseUrl);
                      if (knownRoutes.has(observedKey)) continue;
                      knownRoutes.add(observedKey);
                      node.children.push({
                        id: runtimeId(link.label || observed.pathname, observedKey),
                        label: link.label || observed.pathname,
                        description: "Enlace observado durante la verificación Playwright.",
                        route: `${observed.pathname}${observed.search}${observed.hash}`,
                        surface: "page",
                        depth: node.depth + 1,
                        actions: [],
                        requiresLogin: Boolean(args.login),
                        roles: [],
                        conditions: [],
                        evidence: [`Playwright: enlace visible desde ${finalUrl}`],
                        verification: "pending",
                        children: [],
                      });
                      if (flattenNavigation(map.roots).length >= 120) break;
                    }
                  }
                } catch {
                  node.verification = "unavailable";
                  visited.set(key, { verification: "unavailable" });
                }
              }
            }
          }
        }
        if (node.children.length) await visitNodes(node.children);
      }
    };

    await visitNodes(map.roots);
  } finally {
    await context.close();
    await browser.close();
  }

  map.verifiedAt = new Date().toISOString();
  if (!args.login) {
    map.warnings = [
      ...map.warnings,
      "Verificación ejecutada sin credenciales: las zonas privadas pueden aparecer como no accesibles.",
    ];
  }
  return coerceNavigationMap(map);
}
