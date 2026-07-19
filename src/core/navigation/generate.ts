import { getEngine } from "@/core/ai";
import { getSettings } from "@/core/settings";
import type { CrawlResult } from "@/core/crawler";
import type { RepoSummary } from "@/core/repo";
import { coerceNavigationMap, type NavigationMap } from "./types";

const SYSTEM = `Eres un arquitecto de informacion experto en aplicaciones web. Reconstruyes mapas
de navegacion desde rutas, componentes y evidencia web sin asumir que exista un tipo concreto de menu.
Respondes SIEMPRE en espanol y SOLO con JSON valido, sin markdown.`;

function repoBlock(repo: RepoSummary | null): string {
  if (!repo) return "No se aportó código fuente.";
  const chunks: string[] = [];
  let total = 0;
  for (const file of repo.navigationFiles) {
    const chunk = `### ${file.path}\n${file.content}`;
    if (total + chunk.length > 75_000) break;
    chunks.push(chunk);
    total += chunk.length;
  }
  return [
    `Fuente: ${repo.source}`,
    `Árbol parcial:\n${repo.tree}`,
    "Evidencias de navegación con números de línea:",
    chunks.length ? chunks.join("\n\n") : "No se detectaron ficheros de navegación.",
  ].join("\n\n");
}

function webBlock(crawl: CrawlResult): string {
  return crawl.pages
    .map((page) => [
      `URL: ${page.url}`,
      page.title && `Título: ${page.title}`,
      page.headings.length && `Secciones: ${page.headings.join(" | ")}`,
      page.ctas.length && `Botones/CTAs: ${page.ctas.join(" | ")}`,
    ].filter(Boolean).join("\n"))
    .join("\n---\n");
}

export function navigationMapFromCrawl(
  crawl: CrawlResult,
  context = "",
  warning = "Mapa provisional basado solo en páginas web accesibles.",
): NavigationMap {
  return coerceNavigationMap({
    summary: "Inventario provisional de las páginas que el crawler pudo leer.",
    audience: context.trim() || "Usuarios de la aplicación",
    warnings: [warning],
    roots: crawl.pages.map((page) => ({
      label: page.title || new URL(page.url).pathname || "Inicio",
      description: page.description || page.headings.slice(0, 3).join(" · "),
      route: page.url,
      surface: "page",
      actions: page.ctas.map((cta) => ({ label: cta, target: "", kind: "action" })),
      requiresLogin: false,
      evidence: [`Web: ${page.url}`],
      verification: "pending",
      children: [],
    })),
  });
}

export async function generateNavigationMap(args: {
  appUrl: string;
  crawl: CrawlResult;
  repo: RepoSummary | null;
  context?: string | null;
}): Promise<NavigationMap> {
  const context = args.context?.trim() ?? "";
  if (!args.repo?.navigationFiles.length) {
    return navigationMapFromCrawl(
      args.crawl,
      context,
      args.repo
        ? "No se detectaron componentes/rutas suficientes en el código; revisa la fuente configurada."
        : "Sin código fuente: el mapa no puede reconstruir menús privados o programáticos.",
    );
  }

  const prompt = `Construye el mapa funcional de esta app hasta TRES niveles de profundidad.

## URL base
${args.appUrl}

## Contexto aportado por el usuario
${context || "Sin instrucciones adicionales de audiencia. Incluye la experiencia normal de usuario y separa las áreas restringidas."}

## Web accesible
${webBlock(args.crawl)}

## Código
${repoBlock(args.repo)}

## Contrato de salida
Devuelve exclusivamente:
{
  "summary": "resumen del sistema de navegación",
  "audience": "audiencia realmente mapeada",
  "maxDepth": 3,
  "warnings": ["limitaciones o zonas condicionales"],
  "roots": [
    {
      "id": "estable",
      "label": "sección visible",
      "description": "qué contiene y para qué sirve",
      "route": "/ruta o patrón /item/:id",
      "surface": "navbar|bottom-nav|sidebar-left|sidebar-right|drawer|tabs|breadcrumbs|card-grid|page|unknown",
      "actions": [{ "label": "botón/pestaña", "target": "/destino o efecto", "kind": "navigate|tab|modal|external|action" }],
      "requiresLogin": true,
      "roles": ["client"],
      "conditions": ["feature flag, permiso o dato necesario"],
      "evidence": ["src/fichero.tsx:123"],
      "verification": "code|conditional|pending",
      "children": []
    }
  ]
}

Reglas obligatorias:
- No asumas un único menú ni nombres concretos de componentes. Detecta navbar, barras inferiores,
  sidebars, drawers, tabs, tarjetas y navegación programática; una app puede usar varias a la vez.
- Nivel 1 = entradas principales; nivel 2 = pantallas/submenús; nivel 3 = pestañas, subrutas o bloques
  internos navegables. No añadas un cuarto nivel.
- Respeta la audiencia del contexto. Si pide cliente normal, omite admin pero deja un aviso de exclusión.
- No inventes rutas, botones, roles ni IDs. Conserva parámetros dinámicos como :id y márcalos condicionales.
- Deduplica rutas/entradas y evita ciclos (Inicio no vuelve a incluir todo el árbol).
- Las evidencias de código deben incluir fichero y línea presentes literalmente arriba.
- "verification" es "code" si está sustentado, "conditional" si depende de rol/flag/dato y "pending"
  cuando solo se infiere desde web. No uses "verified": lo reserva Playwright.
- Describe acciones mutantes, pero el mapa nunca debe ejecutarlas.
- Máximo 120 nodos. JSON solamente.`;

  const settings = getSettings();
  const engine = getEngine(settings.aiEngine);
  const result = await engine.run({
    system: SYSTEM,
    prompt,
    json: true,
    model: settings.aiModel,
    timeoutMs: 240_000,
  });
  const data = result.data ?? tryParse(result.text);
  if (!data) throw new Error("La IA no devolvió un mapa funcional JSON válido.");
  const map = coerceNavigationMap(data);
  if (map.roots.length === 0) {
    return navigationMapFromCrawl(args.crawl, context, "La IA no pudo reconstruir un árbol desde el código.");
  }
  return map;
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
