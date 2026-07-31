import type { ClipMoment } from "./contracts.js";

export type ClipPublishRanking = "viral" | "controversial";

export interface ClipTikTokCopy {
  title: string;
  caption: string;
  hashtags: string[];
}

const STOP_WORDS = new Set([
  "para", "porque", "pero", "como", "cuando", "donde", "desde", "hasta", "sobre",
  "entre", "tiene", "tienes", "esto", "esta", "este", "estas", "estos", "unos",
  "unas", "algo", "todo", "todos", "todas", "solo", "puede", "hacer", "hecho",
  "dicho", "quien", "cual", "cuanto", "muy", "más", "mas", "menos", "con", "sin",
  "una", "uno", "del", "las", "los", "que", "por", "qué", "sus", "eres",
]);

export function composeTikTokCopy(
  moment: ClipMoment,
  ranking: ClipPublishRanking,
): ClipTikTokCopy {
  const title = (moment.hook || moment.title).trim().slice(0, 120);
  const cta = ranking === "controversial"
    ? "¿Estás de acuerdo o no? Te leo en comentarios."
    : "¿Te lo esperabas? Guarda el vídeo y cuéntame qué opinas.";
  const base = ranking === "controversial"
    ? ["TikTok", "ParaTi", "Debate", "Opinion", "Polemica"]
    : ["TikTok", "ParaTi", "Viral", "Podcast", "Entrevista"];
  const topics = topicHashtags(`${moment.title} ${moment.hook}`, 3);
  const hashtags = [...new Set([...base, ...topics])].map((tag) => `#${tag}`);
  return {
    title,
    caption: [title, cta, hashtags.join(" ")].filter(Boolean).join("\n\n"),
    hashtags,
  };
}

function topicHashtags(value: string, limit: number): string[] {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-zA-Z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 5 && !STOP_WORDS.has(word.toLowerCase()))
    .filter((word, index, all) =>
      all.findIndex((candidate) => candidate.toLowerCase() === word.toLowerCase()) === index
    )
    .slice(0, limit)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}
