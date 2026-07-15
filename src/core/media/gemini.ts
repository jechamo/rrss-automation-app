import { getSecret } from "@/core/secrets/vault";
import { fetchJson } from "./http";

// Conector Gemini: comprension del viral fuente (opcion de REQ-005).
// NOTA: la comprension frame-a-frame requiere subir el binario via Files API
// (mejora futura). Aqui se hace una llamada de texto (generateContent) que
// enriquece la descripcion a partir de la URL + los datos ya capturados en REQ-004.

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function describeViral(sourceUrl: string, contexto: string): Promise<string> {
  const key = getSecret("gemini");
  if (!key) throw new Error("Falta la API key de Gemini (Ajustes).");
  const prompt = `Analiza este video viral y describe su estructura, ritmo, recursos visuales y por que
funciona, para reinterpretar el CONCEPTO (no copiar) en otro nicho.
URL: ${sourceUrl}
Datos ya conocidos del video: ${contexto}
Responde en espanol, conciso y accionable (5-8 frases).`;

  const data = await fetchJson<{
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  }>(
    `${BASE}/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
