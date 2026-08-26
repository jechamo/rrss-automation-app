import path from "node:path";
import { describe, expect, it } from "vitest";

import { executableCandidatesFromPath } from "./bintools";

describe("executableCandidatesFromPath", () => {
  it("trata una entrada PATH ejecutable como candidato fallable, no como directorio recorrible", () => {
    const executableEntry = path.join("synthetic", "WindowsApps", "ActionsMcpHost.exe");
    const toolsDirectory = path.join("synthetic", "Tools");

    expect(
      executableCandidatesFromPath(
        [executableEntry, toolsDirectory].join(path.delimiter),
        ["ffmpeg.exe"],
      ),
    ).toEqual([
      path.join(executableEntry, "ffmpeg.exe"),
      path.join(toolsDirectory, "ffmpeg.exe"),
    ]);
  });
});
