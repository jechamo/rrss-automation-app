import path from "node:path";

export function executableCandidatesFromPath(
  pathValue: string,
  executableNames: readonly string[],
): string[] {
  return String(pathValue)
    .split(path.delimiter)
    .map((rawDirectory) => rawDirectory.replace(/^"|"$/g, "").trim())
    .filter(Boolean)
    .flatMap((directory) =>
      executableNames.map((executable) => path.join(directory, executable)),
    );
}
