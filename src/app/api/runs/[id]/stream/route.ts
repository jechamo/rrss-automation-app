import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { subscribe, type RunEvent, type NodeState } from "@/core/pipeline/bus";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: RunEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };

      // Estado inicial persistido (por si el run ya avanzo o termino).
      const run = await prisma.run.findUnique({ where: { id } });
      if (run) {
        const nodes = JSON.parse(run.nodes) as { id: string; state: string; detail?: string }[];
        for (const n of nodes) {
          send({ type: "node", nodeId: n.id, state: n.state as NodeState, detail: n.detail });
        }
        if (run.status === "ok" || run.status === "error") {
          send({ type: "done", ok: run.status === "ok" });
          controller.close();
          return;
        }
      }

      const unsub = subscribe(id, (e) => {
        send(e);
        if (e.type === "done") {
          unsub();
          controller.close();
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
