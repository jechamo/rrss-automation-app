import { NextResponse } from "next/server";

import { checkDatabaseReadiness, checkReadiness } from "@/core/health/readiness";
import { inspectVaultReadiness } from "@/core/secrets/vault";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await checkReadiness({
    databaseProbe: async () => {
      await checkDatabaseReadiness(prisma);
    },
    vaultProbe: inspectVaultReadiness,
  });
  return NextResponse.json(report, {
    status: report.status === "ready" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
