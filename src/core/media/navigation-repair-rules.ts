export function normalizeNavigationText(value: string): string {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function selectorTextHint(selector = ""): string {
  const hasText = selector.match(/has-text\(("(?:\\.|[^"])*"|'(?:\\.|[^'])*')\)/i)?.[1];
  if (hasText) {
    try {
      return hasText.startsWith('"')
        ? JSON.parse(hasText)
        : hasText.slice(1, -1).replace(/\\'/g, "'");
    } catch {
      return hasText.slice(1, -1);
    }
  }
  const textSelector = selector.match(/(?:^|>>)\s*text\s*=\s*(.+)$/i)?.[1]?.trim();
  return textSelector?.replace(/^["']|["']$/g, "") ?? "";
}

export function navigationTargetScore(values: string[], hint: string): number {
  const target = normalizeNavigationText(hint);
  if (!target) return 0;
  let score = 0;
  for (const raw of values) {
    const value = normalizeNavigationText(raw);
    if (!value) continue;
    if (value === target) score = Math.max(score, 100);
    else if (value.startsWith(target)) score = Math.max(score, 85);
    else if (value.includes(target)) score = Math.max(score, 70);
    else if (target.includes(value) && value.length >= 4) score = Math.max(score, 45);
  }
  return score;
}

