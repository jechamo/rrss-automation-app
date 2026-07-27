"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PipelineGraph, type GraphNode, type NodeState } from "@/components/PipelineGraph";
import { ViralesEditor } from "@/components/ViralesEditor";
import { CardArt } from "@/components/CardArt";
import type {
  ViralDiscoverySource,
  ViralEnrichmentLevel,
  Virales,
} from "@/core/virales/types";

type RunEvent =
  | { type: "node"; nodeId: string; state: NodeState; detail?: string }
  | { type: "run"; state: NodeState }
  | { type: "done"; ok: boolean }
  | { type: "log"; message: string };

// Nodos estaticos para pintar el grafo antes/durante el run (evita importar el
// modulo de servidor req004.ts en el cliente).
const REQ004_STEPS: { id: string; label: string }[] = [
  { id: "input", label: "Entrada" },
  { id: "discover", label: "Buscar virales (web)" },
  { id: "rank", label: "Ranking" },
  { id: "enrich", label: "Verificar ratio por autor" },
  { id: "analyze", label: "Análisis de patrones" },
];

const VENTANAS: { dias: number; label: string }[] = [
  { dias: 7, label: "7 días" },
  { dias: 14, label: "14 días" },
  { dias: 30, label: "30 días" },
  { dias: 0, label: "Histórico" },
];

const sourceStepLabel = (fuente: ViralDiscoverySource): string =>
  fuente === "scrapecreators"
    ? "Buscar virales (Scrape Creators)"
    : fuente === "hybrid"
      ? "Buscar virales (híbrido)"
      : "Buscar virales (web)";

const initialNodes = (
  cantidad = 20,
  modo: "reemplazar" | "ampliar" = "reemplazar",
  fuente: ViralDiscoverySource = "web",
  nivel: ViralEnrichmentLevel = "rapido",
): GraphNode[] =>
  REQ004_STEPS.map((s) => ({
    id: s.id,
    label:
      s.id === "rank"
        ? modo === "ampliar"
          ? `Ranking +${cantidad} nuevos`
          : `Ranking Top ${cantidad}`
        : s.id === "discover"
          ? sourceStepLabel(fuente)
          : s.id === "enrich"
            ? fuente !== "web" && nivel === "preciso"
              ? "Verificar ratio por autor"
              : "Métricas rápidas"
          : s.label,
    state: "pending" as NodeState,
  }));

export function ViralesPanel({
  projectId,
  dossierReady,
}: {
  projectId: string;
  dossierReady: boolean;
}) {
  const [virales, setVirales] = useState<Virales | null>(null);
  const [status, setStatus] = useState<string>("draft");
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string>("idle");
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ventanaDias, setVentanaDias] = useState(30);
  const [cantidad, setCantidad] = useState(20);
  const [fuente, setFuente] = useState<ViralDiscoverySource>("web");
  const [nivel, setNivel] = useState<ViralEnrichmentLevel>("preciso");
  const [maxCreditos, setMaxCreditos] = useState(20);
  const [scrapeCreatorsReady, setScrapeCreatorsReady] = useState(false);
  const [startError, setStartError] = useState("");
  const esRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    const [r, connectorsResponse] = await Promise.all([
      fetch(`/api/virales/${projectId}`),
      fetch("/api/connectors"),
    ]);
    if (!r.ok) return;
    const d = await r.json();
    const connectorsData = connectorsResponse.ok
      ? ((await connectorsResponse.json()) as { providers?: Array<{ id: string; hasKey: boolean }> })
      : {};
    const hasScrapeCreators =
      connectorsData.providers?.some((provider) => provider.id === "scrapecreators" && provider.hasKey) ?? false;
    setScrapeCreatorsReady(hasScrapeCreators);
    setVirales(d.virales);
    setStatus(d.status);
    const storedSource = d.virales?.discovery?.source as ViralDiscoverySource | undefined;
    setFuente(storedSource ?? (hasScrapeCreators ? "hybrid" : "web"));
    const storedLevel = d.virales?.discovery?.enrichmentLevel as ViralEnrichmentLevel | undefined;
    setNivel(storedLevel ?? "preciso");
    if (d.virales?.discovery?.maxCredits >= 3) {
      setMaxCreditos(d.virales.discovery.maxCredits);
    }
    if (d.virales?.criterio?.ventanaDias != null) setVentanaDias(d.virales.criterio.ventanaDias);
    if (d.lastRun) {
      setNodes(JSON.parse(d.lastRun.nodes) as GraphNode[]);
      setRunStatus(d.lastRun.status);
      if (d.lastRun.status === "running" || d.lastRun.status === "pending") {
        setRunId(d.lastRun.id);
      }
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Suscripcion SSE al run activo.
  useEffect(() => {
    if (!runId) return;
    setLogs([]);
    const es = new EventSource(`/api/runs/${runId}/stream`);
    esRef.current = es;
    es.onmessage = (ev) => {
      const e: RunEvent = JSON.parse(ev.data);
      if (e.type === "node") {
        setNodes((prev) => prev.map((n) => (n.id === e.nodeId ? { ...n, state: e.state, detail: e.detail } : n)));
      } else if (e.type === "run") {
        setRunStatus(e.state);
      } else if (e.type === "log") {
        setLogs((prev) => [...prev, e.message]);
      } else if (e.type === "done") {
        setRunStatus(e.ok ? "ok" : "error");
        es.close();
        esRef.current = null;
        setRunId(null);
        if (e.ok) load();
      }
    };
    es.onerror = () => {
      // EventSource reconecta solo. Cerrar aquí dejaba el grafo congelado en gris
      // mientras el run seguía avanzando en el servidor.
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [runId, load]);

  async function startRun(modo: "reemplazar" | "ampliar" = "reemplazar") {
    if (fuente !== "web" && !scrapeCreatorsReady) {
      setStartError("Configura primero la API key de Scrape Creators en Ajustes.");
      return;
    }
    const effectiveQuantity = modo === "ampliar" ? 10 : cantidad;
    setStarting(true);
    setStartError("");
    setLogs([]);
    setNodes(initialNodes(effectiveQuantity, modo, fuente, nivel));
    setRunStatus("running");
    const r = await fetch(`/api/projects/${projectId}/virales/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ventanaDias,
        modo,
        cantidad: effectiveQuantity,
        fuente,
        nivel: fuente === "web" ? "rapido" : nivel,
        maxCreditos,
      }),
    });
    if (r.ok) {
      const d = await r.json();
      setRunId(d.runId);
    } else {
      setRunStatus("error");
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      setStartError(data.error ?? "No se pudo iniciar la búsqueda de virales.");
    }
    setStarting(false);
  }

  async function saveVirales(v: Virales, approve: boolean) {
    setSaving(true);
    await fetch(`/api/virales/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ virales: v, approve }),
    });
    if (approve) setStatus("approved");
    setVirales(v);
    setSaving(false);
  }

  const running = runStatus === "running" || runStatus === "pending";
  const showGraph = nodes.length > 0;
  const sourceAvailable = fuente === "web" || scrapeCreatorsReady;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-xl p-4">
        <CardArt name="bg-virales.webp" fallback="linear-gradient(120deg, rgba(244,114,182,0.28), rgba(34,211,238,0.22))" />
        <h2 className="relative text-lg font-bold">Virales del nicho</h2>
        <div className="relative flex flex-wrap items-center justify-end gap-2">
          <select
            className="input min-w-44"
            value={fuente}
            onChange={(event) => {
              setFuente(event.target.value as ViralDiscoverySource);
              setStartError("");
            }}
            disabled={!dossierReady || running || starting}
            title="Fuente utilizada para localizar y medir los virales"
          >
            <option value="hybrid">Híbrido · recomendado</option>
            <option value="scrapecreators">Scrape Creators</option>
            <option value="web">IA + web</option>
          </select>
          {fuente !== "web" && (
            <>
              <select
                className="input min-w-40"
                value={nivel}
                onChange={(event) => setNivel(event.target.value as ViralEnrichmentLevel)}
                disabled={!dossierReady || running || starting}
                title="Rápido usa solo las búsquedas base. Preciso compara cada viral con el histórico público de su autor."
              >
                <option value="preciso">Preciso · ratio real</option>
                <option value="rapido">Rápido · 3 créditos</option>
              </select>
              {nivel === "preciso" && (
                <select
                  className="input min-w-36"
                  value={maxCreditos}
                  onChange={(event) => setMaxCreditos(parseInt(event.target.value, 10))}
                  disabled={!dossierReady || running || starting}
                  title="Tope total de créditos para esta ejecución, incluidas las 3 búsquedas base"
                >
                  {[10, 20, 40, 60].map((credits) => (
                    <option key={credits} value={credits}>
                      Máx. {credits} créditos
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
          {!virales && (
            <>
              <select
                className="input w-28"
                value={ventanaDias}
                onChange={(e) => setVentanaDias(parseInt(e.target.value, 10))}
                disabled={!dossierReady || running || starting}
              >
                {VENTANAS.map((v) => (
                  <option key={v.dias} value={v.dias}>
                    {v.label}
                  </option>
                ))}
              </select>
              <select
                className="input w-28"
                value={cantidad}
                onChange={(e) => setCantidad(parseInt(e.target.value, 10))}
                disabled={!dossierReady || running || starting}
                title="Nº de virales a buscar"
              >
                {[10, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} virales
                  </option>
                ))}
              </select>
              <button
                onClick={() => startRun()}
                disabled={!dossierReady || !sourceAvailable || running || starting}
                className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium disabled:opacity-40"
                title={dossierReady ? undefined : "Genera primero el dossier."}
              >
                {running || starting ? "Buscando…" : "Buscar virales"}
              </button>
            </>
          )}
          {virales && (
            <button
              onClick={() => startRun("ampliar")}
              disabled={!sourceAvailable || running || starting}
              className="rounded-lg border border-[var(--color-accent-2)]/50 px-3 py-2 text-sm font-medium text-[var(--color-accent-2)] hover:bg-[var(--color-accent-2)]/10 disabled:opacity-40"
              title="Busca 10 virales NUEVOS y los añade a los actuales"
            >
              {running || starting ? "Buscando…" : "+ Buscar más"}
            </button>
          )}
        </div>
      </div>

      <div className="glass flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
        <div className="text-white/55">
          {fuente === "web"
            ? "IA + web: no consume créditos de Scrape Creators; las métricas pueden ser aproximadas."
            : nivel === "preciso"
              ? `Preciso: busca en las tres plataformas y compara el Top con la mediana reciente de cada autor. Nunca superará ${maxCreditos} créditos; la caché local reduce llamadas.`
            : fuente === "hybrid"
              ? "Híbrido rápido: la IA amplía el descubrimiento y Scrape Creators aporta métricas estructuradas sin consultar históricos."
              : "Scrape Creators: 3 consultas base por ejecución, una para cada plataforma."}
        </div>
        {fuente !== "web" && !scrapeCreatorsReady ? (
          <Link href="/ajustes" className="font-medium text-amber-200 hover:underline">
            Configurar API key en Ajustes →
          </Link>
        ) : fuente !== "web" ? (
          <span className="text-[var(--color-state-ok)]">
            API configurada · {nivel === "preciso" ? `tope ${maxCreditos}` : "estimación base: 3"} créditos
          </span>
        ) : null}
      </div>

      {startError && (
        <div className="glass border border-[var(--color-state-error)]/40 p-3 text-sm text-[var(--color-state-error)]">
          {startError}
        </div>
      )}

      {!dossierReady && (
        <div className="glass p-4 text-sm text-white/50">
          Genera el dossier para poder buscar virales del nicho.
        </div>
      )}

      {showGraph && (
        <div>
          <PipelineGraph nodes={nodes} />
        </div>
      )}

      {(running || logs.length > 0) && (
        <div className="glass max-h-48 overflow-auto p-4 font-mono text-xs text-white/60">
          {logs.length === 0 && <div className="text-white/30">Esperando eventos… (la búsqueda web puede tardar)</div>}
          {logs.map((l, i) => (
            <div key={i}>› {l}</div>
          ))}
        </div>
      )}

      {runStatus === "error" && !virales && (
        <div className="glass border border-[var(--color-state-error)]/40 p-4 text-sm text-[var(--color-state-error)]">
          La búsqueda de virales falló. Revisa el nodo en error y pulsa «Buscar virales» de nuevo.
          <div className="mt-3">
            <button
              onClick={() => startRun()}
              disabled={starting}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-40"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {virales && (
        <ViralesEditor
          initial={virales}
          status={status}
          onSave={saveVirales}
          onRegenerate={() => startRun("reemplazar")}
          saving={saving}
          regenerating={running || starting}
        />
      )}
    </div>
  );
}
