export type MockProviderAsset = "fal-video" | "heygen-video" | "elevenlabs-audio";
export type MockProviderOptions = "heygen-voices" | "heygen-avatars" | "elevenlabs-voices";

export class MockProviderMissingError extends Error {
  readonly code = "E2E_CAPABILITY_UNMOCKED";

  constructor() {
    super("E2E_CAPABILITY_UNMOCKED: proveedor sin fixture local.");
    this.name = "MockProviderMissingError";
  }
}

export function mockProviderOptions(capability: MockProviderOptions) {
  switch (capability) {
    case "heygen-voices":
    case "elevenlabs-voices":
      return [{ id: "voice-e2e", label: "Voz E2E local", hint: "fixture" }];
    case "heygen-avatars":
      return [{ id: "avatar-e2e", label: "Avatar E2E local", hint: "fixture" }];
    default:
      throw new MockProviderMissingError();
  }
}

export function mockProviderAsset(
  capability: MockProviderAsset,
  pieceId: string,
  index = 0,
): { name: string; bytes: Buffer } {
  const marker = Buffer.from(`RRSS-E2E:${capability}:${pieceId}:${index}`, "utf8");
  switch (capability) {
    case "fal-video":
      return { name: `clip-${index}.mp4`, bytes: Buffer.concat([mp4Header(), marker]) };
    case "heygen-video":
      return { name: "avatar.mp4", bytes: Buffer.concat([mp4Header(), marker]) };
    case "elevenlabs-audio":
      return { name: "locucion.mp3", bytes: Buffer.concat([Buffer.from("ID3\u0004\u0000\u0000\u0000\u0000\u0000\u0000", "binary"), marker]) };
    default:
      throw new MockProviderMissingError();
  }
}

function mp4Header(): Buffer {
  return Buffer.from("000000186674797069736f6d0000020069736f6d69736f32", "hex");
}
