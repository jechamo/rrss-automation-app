import { prisma } from "@/lib/prisma";
import { DashboardHub } from "@/components/DashboardHub";
import { rowToPiece } from "@/core/content/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [projectCount, pieceCount, recentProjects, recentPieces] = await Promise.all([
    prisma.project.count(),
    prisma.contentPiece.count(),
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { dossier: true },
    }),
    prisma.contentPiece.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { project: { select: { id: true, name: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="animate-in mb-8 flex justify-center py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/img/logo-lockup.png"
          alt="LeadView"
          className="w-full max-w-sm drop-shadow-[0_8px_30px_rgba(34,211,238,0.32)]"
        />
      </header>

      <DashboardHub
        projectCount={projectCount}
        pieceCount={pieceCount}
        projects={recentProjects.map((project) => ({
          id: project.id,
          name: project.name,
          url: project.url,
          logoPath: project.logoPath,
          dossierStatus:
            (project.dossier?.status as "approved" | "draft" | undefined) ?? null,
        }))}
        pieces={recentPieces.map((piece) => ({
          ...rowToPiece(piece),
          projectId: piece.project.id,
          projectName: piece.project.name,
        }))}
      />
    </div>
  );
}
