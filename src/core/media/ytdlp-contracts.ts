const VIDEO_EXTENSIONS = "mp4|webm|mov|mkv|m4v";

export function clipDownloadFormatSelector(maxFilesizeMb: number): string {
  const totalBudget = Math.max(500, Math.round(maxFilesizeMb));
  const audioBudget = Math.min(200, Math.max(80, Math.round(totalBudget * 0.12)));
  const videoBudget = Math.max(350, totalBudget - audioBudget);
  return [
    `bv*[height<=720][filesize<=${videoBudget}M]+ba[ext=m4a][filesize<=${audioBudget}M]`,
    `b[height<=720][filesize<=${totalBudget}M]`,
    "bv*[height<=480]+ba[ext=m4a]",
    "b[height<=480]",
    "b",
  ].join("/");
}

export function isClipDownloadCandidate(name: string): boolean {
  return new RegExp(`^source(?:\\.f\\d+)?\\.(?:${VIDEO_EXTENSIONS})$`, "i").test(name);
}

export function isClipDownloadArtifact(name: string): boolean {
  const withoutPart = name.toLowerCase().endsWith(".part") ? name.slice(0, -5) : name;
  return isClipDownloadCandidate(withoutPart);
}
