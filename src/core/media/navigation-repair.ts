import type { Page } from "playwright";
import type { NavStep } from "@/core/content/types";
import {
  observeNavigationSurface,
  selectorForObservedElement,
  type ObservedElement,
} from "./navigation-inspector";
import {
  navigationTargetScore,
  normalizeNavigationText,
  selectorTextHint,
} from "./navigation-repair-rules";

const UNSAFE_ACTION = /\b(?:borrar|eliminar|guardar|enviar|generar|crear|pagar|comprar|publicar|confirmar|salir|cerrar sesi[oó]n|delete|remove|save|submit|send|generate|create|pay|purchase|publish|confirm|logout)\b/i;

function targetScore(element: ObservedElement, hint: string): number {
  const values = [element.text, element.placeholder, element.name, element.testId, element.tutorial]
    .filter(Boolean);
  let score = navigationTargetScore(values, hint);
  if (element.testId || element.tutorial) score += 15;
  if (element.tag === "button" || element.role === "button" || element.role === "tab") score += 8;
  if (element.cursorPointerIndex >= 0) score += 5;
  return score;
}

function selectorForTarget(element: ObservedElement, hint: string): string {
  if (element.testId || element.tutorial || element.id || element.name || element.placeholder || element.href) {
    return selectorForObservedElement(element);
  }
  const text = JSON.stringify(hint || element.text);
  if (element.tag === "button") return `button:has-text(${text})`;
  if (element.role === "button" || element.role === "tab") {
    return `[role="${element.role}"]:has-text(${text})`;
  }
  if (element.cursorPointerIndex >= 0) return `${element.tag}.cursor-pointer:has-text(${text})`;
  return `${element.tag}:has-text(${text})`;
}

export function findObservedTarget(
  elements: Array<ObservedElement & { selector: string }>,
  hint: string,
): { element: ObservedElement; selector: string; score: number } | null {
  const ranked = elements
    .map((element) => ({ element, score: targetScore(element, hint) }))
    .filter((item) => item.score >= 55)
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  return best ? { ...best, selector: selectorForTarget(best.element, hint) } : null;
}

function safeStateCandidates(
  elements: Array<ObservedElement & { selector: string }>,
  targetHint: string,
  scoped: boolean,
) {
  const target = normalizeNavigationText(targetHint);
  return elements
    .filter((element) => {
      if (element.disabled || element.href) return false;
      if (!(element.tag === "button" || element.role === "button" || element.role === "tab")) return false;
      if (element.type === "submit") return false;
      if (!scoped && !(element.role === "tab" || element.ariaControls || element.ariaPressed || element.ariaExpanded)) {
        return false;
      }
      const text = element.text.trim();
      if (!text || text.length > 70 || UNSAFE_ACTION.test(text)) return false;
      const normalized = normalizeNavigationText(text);
      return !target || (!normalized.includes(target) && !target.includes(normalized));
    })
    .sort((a, b) => {
      const stableA = Number(Boolean(a.testId || a.tutorial || a.role === "tab"));
      const stableB = Number(Boolean(b.testId || b.tutorial || b.role === "tab"));
      return stableB - stableA;
    });
}

async function locatorVisible(page: Page, selector: string, timeoutMs = 500): Promise<boolean> {
  try {
    await page.locator(selector).first().waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

export interface TapResolution {
  selector: string;
  inserted: NavStep[];
  repaired: boolean;
}

export async function resolveVisibleSelector(
  page: Page,
  selector: string,
  timeoutMs = 2500,
): Promise<{ selector: string; repaired: boolean }> {
  if (await locatorVisible(page, selector, timeoutMs)) return { selector, repaired: false };
  const hint = selectorTextHint(selector);
  const alternative = findObservedTarget(await observeNavigationSurface(page), hint);
  if (alternative && await locatorVisible(page, alternative.selector, 500)) {
    return { selector: alternative.selector, repaired: true };
  }
  throw new Error(`No se encontro un elemento visible para ${selector}`);
}

/**
 * Repara un tap contra el DOM real. Si el objetivo aun no existe, explora de
 * forma acotada controles de estado seguros (tabs/filtros) y vuelve a buscarlo.
 * Nunca pulsa acciones con semantica de mutacion.
 */
export async function resolveTapStep(args: {
  page: Page;
  step: NavStep;
  log: (message: string) => void;
  maxExplorations?: number;
  contextSelector?: string;
}): Promise<TapResolution> {
  const { page, step, log } = args;
  const selector = step.selector ?? "";
  if (!selector) throw new Error("falta selector");
  if (await locatorVisible(page, selector, Math.min(step.timeoutMs ?? 15000, 2500))) {
    return { selector, inserted: [], repaired: false };
  }

  const hint = selectorTextHint(selector);
  let observed = await observeNavigationSurface(page);
  const directAlternative = findObservedTarget(observed, hint);
  if (directAlternative && await locatorVisible(page, directAlternative.selector)) {
    log(`Selector reparado: ${selector} → ${directAlternative.selector}`);
    return { selector: directAlternative.selector, inserted: [], repaired: true };
  }

  const initialUrl = page.url();
  let candidateSurface = observed;
  const scoped = Boolean(args.contextSelector && await locatorVisible(page, args.contextSelector, 300));
  if (scoped && args.contextSelector) {
    candidateSurface = await observeNavigationSurface(page.locator(args.contextSelector).first(), 60);
  }
  const candidates = safeStateCandidates(candidateSurface, hint, scoped).slice(0, args.maxExplorations ?? 10);
  for (const candidate of candidates) {
    const candidateSelector = selectorForObservedElement(candidate);
    try {
      await page.locator(candidateSelector).first().tap({ timeout: 2500 });
      await page.waitForTimeout(650);
      observed = await observeNavigationSurface(page);
      const target = (await locatorVisible(page, selector, 300))
        ? { selector }
        : findObservedTarget(observed, hint);
      if (target && await locatorVisible(page, target.selector, 500)) {
        log(`Paso intermedio descubierto: ${candidate.text || candidateSelector}`);
        if (target.selector !== selector) log(`Selector reparado: ${selector} → ${target.selector}`);
        return {
          selector: target.selector,
          inserted: [{ action: "tap", selector: candidateSelector, pauseMs: 650 }],
          repaired: true,
        };
      }
      if (page.url() !== initialUrl) {
        await page.goto(initialUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
        await page.waitForTimeout(500);
      }
    } catch {
      // Un candidato que desaparece o no responde no invalida el resto de la exploracion.
    }
  }

  throw new Error(`No se encontro ni se pudo descubrir un control seguro para ${selector}`);
}
