import { NextResponse } from "next/server";
import {
  isE2EEgressError,
  isGlobalEgressGuardInstalled,
} from "@/core/runtime/egress-policy";
import { resolveRuntimeProfile } from "@/core/runtime/e2e-profile";

export const dynamic = "force-dynamic";

export async function POST() {
  if (resolveRuntimeProfile().mode !== "mock") {
    return NextResponse.json({ error: "No disponible." }, { status: 404 });
  }
  if (!isGlobalEgressGuardInstalled()) {
    return NextResponse.json({ error: "La barrera global no está instalada." }, { status: 500 });
  }
  try {
    await fetch("https://example.com/no-debe-conectar");
    return NextResponse.json({ error: "La protección no bloqueó el egreso." }, { status: 500 });
  } catch (error) {
    if (isE2EEgressError(error)) {
      return NextResponse.json({ blocked: true, code: error.code }, { status: 409 });
    }
    throw error;
  }
}
