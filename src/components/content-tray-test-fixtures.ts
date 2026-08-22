import { DEFAULT_CONFIG, type ContentPiece } from "@/core/content/types";

export function createTestPiece(
  id: string,
  titulo: string,
  extras: Partial<ContentPiece> = {},
): ContentPiece {
  return {
    id,
    origin: "viral",
    sourceUrl: `https://example.test/${id}`,
    titulo,
    plataforma: "youtube",
    status: "listo",
    content: {
      plataforma: "youtube",
      guion: {
        gancho: `Gancho ${titulo}`,
        desarrollo: "Desarrollo",
        cta: "CTA",
        locucion: "Locucion",
        hashtags: [],
        duracionTotal: 15,
      },
      escaleta: [],
      patronAplicado: "",
      notaLegal: "",
    },
    config: { ...DEFAULT_CONFIG },
    assets: {
      videoPath: "",
      audioPath: "",
      recordingPath: "",
      presenterPath: "",
      clips: [],
      clipManifest: [],
      brandOutroPath: "",
      externalUrl: "",
      logs: [],
      publishedTo: "",
      publishedAt: "",
    },
    runId: null,
    version: 1,
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
    ...extras,
  };
}
