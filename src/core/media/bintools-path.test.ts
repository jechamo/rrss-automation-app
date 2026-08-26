import path from "node:path";
import { describe, expect, it } from "vitest";

import { executableCandidatesFromPath } from "./bintools";

describe("executableCandidatesFromPath", () => {
  it("descarta una entrada PATH ejecutable en vez de recorrerla", () => {
    const executableEntry = path.resolve(
      "synthetic",
      "WindowsApps",
      "ActionsMcpHost.exe",
    );
    const toolsDirectory = path.resolve("synthetic", "Tools");

    expect(
      executableCandidatesFromPath(
        [executableEntry, toolsDirectory].join(path.delimiter),
        ["ffmpeg.exe"],
      ),
    ).toEqual([
      path.join(toolsDirectory, "ffmpeg.exe"),
    ]);
  });

  it("descarta entradas PATH relativas", () => {
    expect(
      executableCandidatesFromPath("relative-tools", ["ffmpeg"]),
    ).toEqual([]);
  });
});
