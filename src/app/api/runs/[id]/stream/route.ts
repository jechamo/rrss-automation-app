import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { subscribe, type RunEvent, type NodeState } from "@/core/pipeline/bus";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const encoder = new TextEncoder();
  let closed = false;
  let unsub: (() => void) | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: RunEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      const finish = (ok: boolean) => {
        if (closed) return;
        send({ type: "done", ok });
        closed = true;
        if (unsub) unsub();
        if (poll) clearInterval(poll);
        controller.close();
      };

      const sendPersisted = (run: { nodes: string }) => {
        const nodes = JSON.parse(run.nodes) as { id: string; state: string; detail?: string }[];
        for (const n of nodes) {
          send({ type: "node", nodeId: n.id, state: n.state as NodeState, detail: n.detail });
        }
      };

      // Suscribimos ANTES de leer el estado para no perder el evento "done"
      // si el run termina mientras consultamos la BD (condicion de carrera).
      unsub = subscribe(id, (e) => {
        if (e.type === "done") finish(e.ok);
        else send(e);
      });

      const run = await prisma.run.findUnique({ where: { id } });
      if (!run) {
        finish(false);
        return;
      }
      sendPersisted(run);
      if (run.status === "ok" || run.status === "error") {
        finish(run.status === "ok");
        return;
      }

      // Red de seguridad: aunque el bus en memoria falle (p.ej. modulos
      // separados en dev), sondeamos la BD para detectar el fin del run y
      // reflejar el estado final de los nodos. Garantiza que la UI se refresca.
      poll = setInterval(async () => {
        if (closed) return;
        const r = await prisma.run.findUnique({ where: { id } });
        if (!r) return;
        sendPersisted(r);
        if (r.status === "ok" || r.status === "error") {
          finish(r.status === "ok");
        }
      }, 1500);
    },
    cancel() {
      closed = true;
      if (unsub) unsub();
      if (poll) clearInterval(poll);
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
