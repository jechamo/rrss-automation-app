import { prisma } from "@/lib/prisma";
import { coerceDossier, type Dossier } from "@/core/dossier/types";
import { coerceCompetencia, type Competencia } from "@/core/competencia/types";
import { coerceLeads, type Lead, type Leads } from "@/core/leads/types";
import { researchTarget, type LeadResearch } from "@/core/leads/research";
import { discoverLeads, type LeadDescubierto } from "@/core/leads/discover";
import { generateStrategy, type StrategyLeadInput } from "@/core/leads/strategy";
import type { PipelineDef, PipelineNode } from "./engine";

export const REQ003_NODES = [
  { id: "input", label: "Entrada" },
  { id: "research", label: "Perfil de cliente" },
  { id: "discover", label: "Buscar negocios (web)" },
  { id: "strategy", label: "Estrategia IA" },
] as const;

/** Pasa un Lead a los datos publicos de negocio (para conservar los manuales). */
function toDescubierto(l: Lead): LeadDescubierto {
  return {
    nombre: l.nombre,
    tipo: l.tipo,
    direccion: l.direccion,
    web: l.web,
    telefono: l.telefono,
    email: l.email,
    motivo: l.motivo,
  };
}

export type ReqMode = "reemplazar" | "ampliar";
export interface Req003Opts {
  zona?: string;
  modo?: ReqMode;
}

/** REQ-003: leads (negocios locales reales via IA+web) + estrategia de captacion. */
export function buildReq003Pipeline(opts: Req003Opts = {}): PipelineDef {
  const zona = opts.zona ?? "";
  const modo: ReqMode = opts.modo === "ampliar" ? "ampliar" : "reemplazar";

  const input: PipelineNode = {
    id: "input",
    label: "Entrada",
    run: async (ctx) => {
      const dossierRow = await prisma.dossier.findUnique({
        where: { projectId: ctx.project.id },
      });
      if (!dossierRow) {
        throw new Error("Genera primero el dossier (REQ-001) antes de buscar clientes potenciales.");
      }
      ctx.artifacts.dossier = coerceDossier(JSON.parse(dossierRow.content));

      // Competencia (REQ-002) es opcional: si existe, afina el perfil.
      const compRow = await prisma.competencia.findUnique({ where: { projectId: ctx.project.id } });
      ctx.artifacts.competencia = compRow
        ? coerceCompetencia(JSON.parse(compRow.content))
        : null;

      const prev = await prisma.leads.findUnique({ where: { projectId: ctx.project.id } });
      const prevLeads = prev ? coerceLeads(JSON.parse(prev.content)) : null;
      const todos: Lead[] = prevLeads?.leads ?? [];
      const manual = todos.filter((l) => l.origen === "manual");
      ctx.artifacts.manual = manual;
      ctx.artifacts.prevLeads = prevLeads;
      ctx.artifacts.existentes = todos;
      ctx.log(
        modo === "ampliar"
          ? `Modo ampliar: se conservan ${todos.length} leads y se buscan otros nuevos.`
          : `Dossier cargado. Competencia: ${compRow ? "si" : "no"}. Leads manuales: ${manual.length}.`,
      );
    },
  };

  const research: PipelineNode = {
    id: "research",
    label: "Perfil de cliente",
    run: async (ctx) => {
      const dossier = ctx.artifacts.dossier as Dossier;
      const competencia = ctx.artifacts.competencia as Competencia | null;
      const perfil = await researchTarget(dossier, competencia, zona);
      ctx.artifacts.research = perfil;
      ctx.log(`Perfil objetivo: ${perfil.perfilObjetivo || "n/d"} · Zona: ${perfil.zona || "n/d"}.`);
    },
  };

  const discover: PipelineNode = {
    id: "discover",
    label: "Buscar negocios (web)",
    run: async (ctx) => {
      const perfil = ctx.artifacts.research as LeadResearch;
      const manual = (ctx.artifacts.manual as Lead[]) ?? [];
      const existentes = (ctx.artifacts.existentes as Lead[]) ?? [];
      // ampliar: manual ya conservado → no re-sembrar; excluir TODO lo existente.
      const seed = modo === "ampliar" ? [] : manual.map(toDescubierto);
      const excluir =
        modo === "ampliar"
          ? existentes.map((l) => l.web || l.nombre).filter(Boolean)
          : [];
      const encontrados = await discoverLeads(perfil, seed, excluir);
      ctx.artifacts.descubiertos = encontrados;
      ctx.log(`Negocios localizados: ${encontrados.length}.`);
    },
  };

  const strategy: PipelineNode = {
    id: "strategy",
    label: "Estrategia IA",
    run: async (ctx) => {
      const dossier = ctx.artifacts.dossier as Dossier;
      const perfil = ctx.artifacts.research as LeadResearch;
      const descubiertos = (ctx.artifacts.descubiertos as LeadDescubierto[]) ?? [];
      const manual = (ctx.artifacts.manual as Lead[]) ?? [];
      const existentes = (ctx.artifacts.existentes as Lead[]) ?? [];
      const manualKeys = new Set(manual.map((l) => keyOf(l.nombre, l.web)));
      const existentesKeys = new Set(existentes.map((l) => keyOf(l.nombre, l.web)));

      // En ampliar, procesa sólo los negocios NUEVOS (no en lo existente).
      const aProcesar =
        modo === "ampliar"
          ? descubiertos.filter((d) => !existentesKeys.has(keyOf(d.nombre, d.web)))
          : descubiertos;
      const inputs: StrategyLeadInput[] = aProcesar.map((d) => ({
        ...d,
        origen: manualKeys.has(keyOf(d.nombre, d.web)) ? "manual" : "ia",
      }));

      const generados = await generateStrategy({ dossier, research: perfil, leads: inputs });

      let leads = generados;
      if (modo === "ampliar") {
        const prevLeads = ctx.artifacts.prevLeads as Leads | null;
        if (prevLeads) {
          const seen = new Set(prevLeads.leads.map((l) => keyOf(l.nombre, l.web)));
          const nuevos = generados.leads.filter((l) => !seen.has(keyOf(l.nombre, l.web)));
          leads = { ...prevLeads, leads: [...prevLeads.leads, ...nuevos] };
        }
      }

      await prisma.leads.upsert({
        where: { projectId: ctx.project.id },
        create: {
          projectId: ctx.project.id,
          content: JSON.stringify(leads),
          status: "draft",
        },
        update: {
          content: JSON.stringify(leads),
          status: "draft",
          version: { increment: 1 },
        },
      });
      ctx.artifacts.leads = leads;
      ctx.log(`Estrategia generada (${leads.leads.length} clientes potenciales).`);
    },
  };

  return {
    requisito: "REQ-003",
    nodes: [input, research, discover, strategy],
    edges: [
      ["input", "research"],
      ["research", "discover"],
      ["discover", "strategy"],
    ],
  };
}

function keyOf(nombre: string, web: string): string {
  const w = web
    ? web.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase()
    : "";
  return w || nombre.toLowerCase().trim();
}
