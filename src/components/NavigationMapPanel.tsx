"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  flattenNavigation,
  navigationToMarkdown,
  type NavigationMap,
  type NavigationNode,
  type NavigationSurface,
  type NavigationVerification,
} from "@/core/navigation/types";

const SURFACE_LABELS: Record<NavigationSurface, string> = {
  navbar: "Navbar superior",
  "bottom-nav": "Barra inferior",
  "sidebar-left": "Menú izquierdo",
  "sidebar-right": "Menú derecho",
  drawer: "Drawer / hamburguesa",
  tabs: "Pestañas",
  breadcrumbs: "Breadcrumbs",
  "card-grid": "Tarjetas",
  page: "Página",
  unknown: "Sin clasificar",
};

const VERIFY_META: Record<NavigationVerification, { label: string; color: string }> = {
  code: { label: "Código", color: "#a78bfa" },
  verified: { label: "Verificado", color: "#34d399" },
  redirected: { label: "Redirigido", color: "#fbbf24" },
  conditional: { label: "Condicional", color: "#fb923c" },
  pending: { label: "Pendiente", color: "#94a3b8" },
  unavailable: { label: "No accesible", color: "#fb7185" },
};

function filterNodes(
  nodes: NavigationNode[],
  surface: string,
  verification: string,
): NavigationNode[] {
  return nodes.flatMap((node) => {
    const children = filterNodes(node.children, surface, verification);
    const matchesSurface = !surface || node.surface === surface;
    const matchesVerification = !verification || node.verification === verification;
    return matchesSurface && matchesVerification || children.length
      ? [{ ...node, children }]
      : [];
  });
}

export function NavigationMapPanel({
  projectId,
  runStatus,
}: {
  projectId: string;
  runStatus: string;
}) {
  const [map, setMap] = useState<NavigationMap | null>(null);
  const [status, setStatus] = useState("draft");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [surfaceFilter, setSurfaceFilter] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/navigation/${projectId}`, { cache: "no-store" });
    if (!response.ok) {
      setLoading(false);
      return;
    }
    const data = await response.json() as { map?: NavigationMap | null; status?: string };
    setMap(data.map ?? null);
    setStatus(data.status ?? "draft");
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load, runStatus]);

  const allNodes = useMemo(() => map ? flattenNavigation(map.roots) : [], [map]);
  const visibleRoots = useMemo(
    () => map ? filterNodes(map.roots, surfaceFilter, verificationFilter) : [],
    [map, surfaceFilter, verificationFilter],
  );
  const surfaces = useMemo(
    () => [...new Set(allNodes.map((node) => node.surface))],
    [allNodes],
  );

  async function verify() {
    setVerifying(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/navigation/verify`, { method: "POST" });
      const data = await response.json() as { map?: NavigationMap; status?: string; error?: string };
      if (!response.ok || !data.map) throw new Error(data.error || `HTTP ${response.status}`);
      setMap(data.map);
      setStatus(data.status ?? "verified");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setVerifying(false);
    }
  }

  async function copyMarkdown() {
    if (!map) return;
    await navigator.clipboard.writeText(navigationToMarkdown(map));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <div className="glass p-4 text-sm text-white/40">Cargando mapa de la aplicación…</div>;
  }
  if (!map) {
    return (
      <div className="glass p-4 text-sm text-white/45">
        {runStatus === "running" || runStatus === "pending"
          ? "El mapa funcional aparecerá cuando termine su nodo del pipeline."
          : "Todavía no hay mapa funcional. Regenera el análisis para crearlo."}
      </div>
    );
  }

  const verified = allNodes.filter((node) => node.verification === "verified").length;
  return (
    <div className="glass overflow-hidden">
      <div className="border-b border-white/10 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold">Mapa de la aplicación</h2>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/55">
                {status === "verified" ? "Verificado" : "Generado desde código/web"}
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-white/50">{map.summary}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-white/40">
              <span>Audiencia: <b className="text-white/65">{map.audience}</b></span>
              <span>{allNodes.length} secciones</span>
              <span>Profundidad {map.maxDepth}</span>
              {map.verifiedAt && <span>{verified}/{allNodes.length} rutas verificadas</span>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {expanded && (
              <>
                <button
                  type="button"
                  onClick={copyMarkdown}
                  className="rounded-lg border border-white/15 px-3 py-2 text-xs hover:bg-white/5"
                >
                  {copied ? "Copiado ✓" : "Copiar Markdown"}
                </button>
                <button
                  type="button"
                  onClick={verify}
                  disabled={verifying}
                  className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-medium disabled:opacity-40"
                >
                  {verifying ? "Verificando rutas…" : "Verificar con Playwright"}
                </button>
              </>
            )}
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls="navigation-map-content"
              onClick={() => setExpanded((current) => !current)}
              className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium hover:bg-white/5"
            >
              {expanded ? "Plegar mapa ↑" : "Desplegar mapa ↓"}
            </button>
          </div>
        </div>

        {expanded && (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <select className="input w-auto min-w-44 text-xs" value={surfaceFilter} onChange={(event) => setSurfaceFilter(event.target.value)}>
                <option value="">Todas las superficies</option>
                {surfaces.map((surface) => <option key={surface} value={surface}>{SURFACE_LABELS[surface]}</option>)}
              </select>
              <select className="input w-auto min-w-40 text-xs" value={verificationFilter} onChange={(event) => setVerificationFilter(event.target.value)}>
                <option value="">Todos los estados</option>
                {Object.entries(VERIFY_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
              </select>
            </div>

            {map.warnings.length > 0 && (
              <details className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-2 text-xs text-amber-100/75">
                <summary className="cursor-pointer font-medium text-amber-100">Avisos del análisis ({map.warnings.length})</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">{map.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </details>
            )}
            {error && <div className="mt-3 text-xs text-[var(--color-state-error)]">{error}</div>}
          </>
        )}
      </div>

      {expanded && (
        <div id="navigation-map-content" className="space-y-2 p-4">
          {visibleRoots.length > 0
            ? visibleRoots.map((node) => <NavigationTreeNode key={node.id} node={node} />)
            : <div className="py-5 text-center text-xs text-white/35">No hay secciones con estos filtros.</div>}
        </div>
      )}
    </div>
  );
}

function NavigationTreeNode({ node }: { node: NavigationNode }) {
  const meta = VERIFY_META[node.verification];
  return (
    <div style={{ marginLeft: `${Math.max(0, node.depth - 1) * 18}px` }}>
      <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{node.label}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
                {SURFACE_LABELS[node.surface]}
              </span>
              <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ color: meta.color, background: `${meta.color}18` }}>
                {meta.label}
              </span>
              {node.requiresLogin && <span className="text-[10px] text-cyan-300/70">requiere login</span>}
            </div>
            {node.description && <p className="mt-1 text-xs text-white/55">{node.description}</p>}
          </div>
          {node.route && <code className="max-w-full break-all rounded bg-black/30 px-2 py-1 text-[10px] text-cyan-200/75">{node.route}</code>}
        </div>

        {(node.actions.length > 0 || node.conditions.length > 0 || node.roles.length > 0 || node.evidence.length > 0) && (
          <details className="mt-2 text-[11px] text-white/45">
            <summary className="cursor-pointer text-[var(--color-accent-2)]">Navegación, condiciones y evidencias</summary>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {node.actions.length > 0 && <InfoList label="Botones / destinos" values={node.actions.map((action) => `${action.label}${action.target ? ` → ${action.target}` : ""}`)} />}
              {node.roles.length > 0 && <InfoList label="Roles" values={node.roles} />}
              {node.conditions.length > 0 && <InfoList label="Condiciones" values={node.conditions} />}
              {node.evidence.length > 0 && <InfoList label="Evidencias" values={node.evidence} mono />}
              {node.finalUrl && <InfoList label="URL final observada" values={[node.finalUrl]} mono />}
            </div>
          </details>
        )}
      </div>
      {node.children.length > 0 && <div className="mt-2 space-y-2">{node.children.map((child) => <NavigationTreeNode key={child.id} node={child} />)}</div>}
    </div>
  );
}

function InfoList({ label, values, mono = false }: { label: string; values: string[]; mono?: boolean }) {
  return (
    <div>
      <div className="font-medium text-white/60">{label}</div>
      <ul className={`mt-1 list-disc space-y-0.5 pl-4 ${mono ? "font-mono text-[10px]" : ""}`}>
        {values.map((value) => <li key={value} className="break-all">{value}</li>)}
      </ul>
    </div>
  );
}
