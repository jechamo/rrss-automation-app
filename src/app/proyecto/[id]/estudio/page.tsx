import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MediaStudio } from "@/components/MediaStudio";

export const dynamic = "force-dynamic";

export default async function EstudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, name: true, url: true, logoPath: true } });
  if (!project) notFound();
  return <MediaStudio projectId={project.id} projectName={project.name} projectUrl={project.url} hasLogo={Boolean(project.logoPath)} />;
}
