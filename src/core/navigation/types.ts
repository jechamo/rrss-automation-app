export type NavigationSurface =
  | "navbar"
  | "bottom-nav"
  | "sidebar-left"
  | "sidebar-right"
  | "drawer"
  | "tabs"
  | "breadcrumbs"
  | "card-grid"
  | "page"
  | "unknown";

export type NavigationVerification =
  | "code"
  | "verified"
  | "redirected"
  | "conditional"
  | "pending"
  | "unavailable";

export interface NavigationAction {
  label: string;
  target: string;
  kind: "navigate" | "tab" | "modal" | "external" | "action";
}

export interface NavigationNode {
  id: string;
  label: string;
  description: string;
  route: string;
  surface: NavigationSurface;
  depth: number;
  actions: NavigationAction[];
  requiresLogin: boolean;
  roles: string[];
  conditions: string[];
  evidence: string[];
  verification: NavigationVerification;
  finalUrl?: string;
  children: NavigationNode[];
}

export interface NavigationMap {
  summary: string;
  audience: string;
  maxDepth: number;
  roots: NavigationNode[];
  warnings: string[];
  generatedAt: string;
  verifiedAt?: string;
}

const SURFACES = new Set<NavigationSurface>([
  "navbar",
  "bottom-nav",
  "sidebar-left",
  "sidebar-right",
  "drawer",
  "tabs",
  "breadcrumbs",
  "card-grid",
  "page",
  "unknown",
]);
const VERIFICATIONS = new Set<NavigationVerification>([
  "code",
  "verified",
  "redirected",
  "conditional",
  "pending",
  "unavailable",
]);

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function strings(value: unknown, max = 20): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(str).filter(Boolean))].slice(0, max);
}

function bool(value: unknown): boolean {
  return value === true || value === "true";
}

function slug(value: string): string {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "seccion";
}

function coerceAction(raw: unknown): NavigationAction | null {
  const value = (raw ?? {}) as Record<string, unknown>;
  const kindRaw = str(value.kind);
  const kind: NavigationAction["kind"] =
    kindRaw === "tab" || kindRaw === "modal" || kindRaw === "external" || kindRaw === "action"
      ? kindRaw
      : "navigate";
  const label = str(value.label);
  const target = str(value.target);
  if (!label && !target) return null;
  return { label: label || target, target, kind };
}

interface CoerceState {
  count: number;
  ids: Set<string>;
}

function coerceNode(
  raw: unknown,
  depth: number,
  parentId: string,
  state: CoerceState,
): NavigationNode | null {
  if (depth > 3 || state.count >= 120 || !raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const label = str(value.label ?? value.nombre ?? value.section);
  const route = str(value.route ?? value.ruta ?? value.url);
  if (!label && !route) return null;

  const requestedId = slug(str(value.id) || `${parentId}-${label || route}`);
  let id = requestedId;
  let suffix = 2;
  while (state.ids.has(id)) id = `${requestedId}-${suffix++}`;
  state.ids.add(id);
  state.count += 1;

  const surfaceRaw = str(value.surface ?? value.superficie) as NavigationSurface;
  const verificationRaw = str(value.verification ?? value.estado) as NavigationVerification;
  const rawActions = value.actions ?? value.acciones;
  const node: NavigationNode = {
    id,
    label: label || route,
    description: str(value.description ?? value.descripcion),
    route,
    surface: SURFACES.has(surfaceRaw) ? surfaceRaw : "unknown",
    depth,
    actions: Array.isArray(rawActions)
      ? rawActions
          .map(coerceAction)
          .filter((action): action is NavigationAction => action !== null)
          .slice(0, 30)
      : [],
    requiresLogin: bool(value.requiresLogin ?? value.requiereLogin),
    roles: strings(value.roles, 10),
    conditions: strings(value.conditions ?? value.condiciones, 15),
    evidence: strings(value.evidence ?? value.evidencias, 30),
    verification: VERIFICATIONS.has(verificationRaw) ? verificationRaw : "code",
    children: [],
  };
  const finalUrl = str(value.finalUrl);
  if (finalUrl) node.finalUrl = finalUrl;

  const children = Array.isArray(value.children ?? value.hijos)
    ? (value.children ?? value.hijos) as unknown[]
    : [];
  node.children = children
    .map((child) => coerceNode(child, depth + 1, id, state))
    .filter((child): child is NavigationNode => child !== null);
  return node;
}

export function coerceNavigationMap(raw: unknown): NavigationMap {
  const value = (raw ?? {}) as Record<string, unknown>;
  const state: CoerceState = { count: 0, ids: new Set() };
  const rootsRaw = Array.isArray(value.roots ?? value.secciones) ? (value.roots ?? value.secciones) as unknown[] : [];
  const roots = rootsRaw
    .map((root) => coerceNode(root, 1, "root", state))
    .filter((root): root is NavigationNode => root !== null);
  return {
    summary: str(value.summary ?? value.resumen),
    audience: str(value.audience ?? value.audiencia) || "Usuarios de la aplicación",
    maxDepth: 3,
    roots,
    warnings: strings(value.warnings ?? value.avisos, 30),
    generatedAt: str(value.generatedAt) || new Date().toISOString(),
    ...(str(value.verifiedAt) ? { verifiedAt: str(value.verifiedAt) } : {}),
  };
}

export function flattenNavigation(nodes: NavigationNode[]): NavigationNode[] {
  return nodes.flatMap((node) => [node, ...flattenNavigation(node.children)]);
}

export function navigationToMarkdown(map: NavigationMap): string {
  const lines = [
    "# Mapa de la aplicación",
    "",
    `Audiencia: ${map.audience}`,
    `Profundidad: ${map.maxDepth}`,
    "",
  ];
  const render = (nodes: NavigationNode[]) => {
    for (const node of nodes) {
      lines.push(`${"#".repeat(Math.min(6, node.depth + 1))} ${node.label}`);
      if (node.route) lines.push(`Ruta: \`${node.route}\``);
      lines.push(`Superficie: ${node.surface}`);
      if (node.description) lines.push(`Descripción: ${node.description}`);
      if (node.actions.length) {
        lines.push("Navegación de botones:");
        for (const action of node.actions) {
          lines.push(`- ${action.label}${action.target ? ` → ${action.target}` : ""}`);
        }
      }
      if (node.roles.length) lines.push(`Roles: ${node.roles.join(", ")}`);
      if (node.conditions.length) lines.push(`Condiciones: ${node.conditions.join("; ")}`);
      lines.push("");
      render(node.children);
    }
  };
  render(map.roots);
  return lines.join("\n").trim();
}
