import type { Lead, Leads } from "./types.js";

const EXPLICIT_INTENT =
  /\b(?:busca(?:ndo)?|comparando|solicit(?:a|ando|ó)|pid(?:e|iendo|ió)|presupuesto|cotizaci[oó]n|contratar|compra inmediata|cambiar de proveedor|licitaci[oó]n|urgente)\b/i;
const SPECIFIC_FIT =
  /\b(?:sin|carece|manual|no (?:tiene|dispone|ofrece)|reserva|agenda|seguimiento|automatiz|gesti[oó]n|nutrici[oó]n|entrenamiento|software|app)\b/i;

function hasExplicitIntent(lead: Lead): boolean {
  return EXPLICIT_INTENT.test(`${lead.motivo} ${lead.scoreRazon}`);
}

function scoreReason(lead: Lead, intent: number): string {
  if (lead.scoreRazon.trim()) return lead.scoreRazon.trim();
  const fitEvidence = lead.motivo.trim()
    ? lead.motivo.trim().replace(/\s+/g, " ").slice(0, 150)
    : "El negocio encaja de forma general con el perfil objetivo";
  return intent >= 4
    ? `${fitEvidence}; existe una señal pública explícita de búsqueda o compra.`
    : `${fitEvidence}; no se observó una señal pública explícita de compra activa.`;
}

/** Recalibración conservadora: no inventa señales y no vuelve a buscar en la web. */
export function calibrateLeads(input: Leads): Leads {
  const leads = input.leads.map((lead) => {
    const explicitIntent = hasExplicitIntent(lead);
    let fitScore = lead.fitScore;
    let intentScore = explicitIntent ? lead.intentScore : Math.min(3, lead.intentScore);

    if (!lead.motivo.trim()) fitScore = Math.min(3, fitScore);
    if (fitScore === 5 && (!lead.scoreRazon.trim() || !SPECIFIC_FIT.test(`${lead.motivo} ${lead.scoreRazon}`))) {
      fitScore = 4;
    }
    if (explicitIntent && intentScore < 4 && lead.intentScore >= 4) intentScore = lead.intentScore;

    const temperatura =
      fitScore >= 4 && intentScore >= 4
        ? "caliente"
        : fitScore >= 3 || intentScore >= 3
          ? "templado"
          : "frio";

    return {
      ...lead,
      fitScore,
      intentScore,
      temperatura,
      scoreRazon: scoreReason(lead, intentScore),
    } satisfies Lead;
  });

  const maxHot = Math.ceil(leads.length * 0.25);
  const hotIndexes = leads
    .map((lead, index) => ({ lead, index }))
    .filter(({ lead }) => lead.temperatura === "caliente")
    .sort((a, b) => b.lead.fitScore + b.lead.intentScore - (a.lead.fitScore + a.lead.intentScore));
  const allowedHot = new Set(hotIndexes.slice(0, maxHot).map(({ index }) => index));

  return {
    ...input,
    leads: leads.map((lead, index) => {
      if (lead.temperatura !== "caliente" || allowedHot.has(index)) return lead;
      return {
        ...lead,
        intentScore: Math.min(3, lead.intentScore),
        temperatura: "templado",
        scoreRazon: `${lead.scoreRazon} Recalibrado para comparar la prioridad dentro del lote.`,
      };
    }),
  };
}

export function auditLeadCalibration(leads: Leads): string[] {
  if (leads.leads.length === 0) return [];
  const warnings: string[] = [];
  if (leads.leads.every((lead) => lead.fitScore === 5 && lead.intentScore === 5)) {
    warnings.push("Todos los negocios tienen 5/5; el lote no está discriminando encaje e intención.");
  }
  if (leads.leads.some((lead) => !lead.scoreRazon.trim())) {
    warnings.push("Hay puntuaciones sin una justificación observable.");
  }
  if (leads.leads.some((lead) => lead.intentScore > 3 && !hasExplicitIntent(lead))) {
    warnings.push("Hay intención 4–5 sin una señal explícita de compra o búsqueda.");
  }
  const hotCount = leads.leads.filter((lead) => lead.temperatura === "caliente").length;
  if (hotCount > Math.ceil(leads.leads.length * 0.25)) {
    warnings.push("Más del 25% del lote está marcado como caliente.");
  }
  return warnings;
}
