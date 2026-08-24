import { PrismaClient } from "@prisma/client";

process.env.DATABASE_URL ??= "file:./dev.db";

const prisma = new PrismaClient();

try {
  const counts = await Promise.all([
    prisma.project.count(),
    prisma.navigationMap.count(),
    prisma.dossier.count(),
    prisma.competencia.count(),
    prisma.leads.count(),
    prisma.virales.count(),
    prisma.run.count(),
    prisma.contentPiece.count(),
    prisma.mediaAsset.count(),
    prisma.mixComposition.count(),
    prisma.connectorState.count(),
  ]);
  if (counts.some((count) => count !== 0)) {
    throw new Error("La instalación limpia contiene filas de negocio.");
  }
  process.stdout.write("SQLite limpia: 0 filas de negocio.\n");
} finally {
  await prisma.$disconnect();
}
