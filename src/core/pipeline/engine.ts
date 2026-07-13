import { prisma } from "@/lib/prisma";
import { publish, closeBus, type NodeState } from "./bus";

export interface NodeCtx {
  runId: string;
  project: { id: string; name: string; url: string; codeType: string | null; codePath: string | null };
  artifacts: Record<string, unknown>;
  log: (message: string) => void;
}

export interface PipelineNode {
  id: string;
  label: string;
  run: (ctx: NodeCtx) => Promise<void>;
}

export interface PipelineDef {
  requisito: string;
  nodes: PipelineNode[];
  edges: [string, string][];
}

interface NodeStatus {
  id: string;
  label: string;
  state: NodeState;
  detail?: string;
}

export function initialNodeStatus(def: PipelineDef): NodeStatus[] {
  return def.nodes.map((n) => ({ id: n.id, label: n.label, state: "pending" as NodeState }));
}

/** Ejecuta un run de forma asincrona; emite eventos y persiste el estado. */
export async function executeRun(runId: string, def: PipelineDef, project: NodeCtx["project"]) {
  const statuses = initialNodeStatus(def);
  const artifacts: Record<string, unknown> = {};
  const logs: string[] = [];

  const persist = async (status: string) => {
    await prisma.run.update({
      where: { id: runId },
      data: { status, nodes: JSON.stringify(statuses), logs: JSON.stringify(logs) },
    });
  };

  const ctx: NodeCtx = {
    runId,
    project,
    artifacts,
    log: (m) => {
      logs.push(`[${new Date().toISOString()}] ${m}`);
      publish(runId, { type: "log", message: m });
    },
  };

  publish(runId, { type: "run", state: "running" });
  await persist("running");

  for (const node of def.nodes) {
    const st = statuses.find((s) => s.id === node.id)!;
    st.state = "running";
    publish(runId, { type: "node", nodeId: node.id, state: "running" });
    await persist("running");

    try {
      await node.run(ctx);
      st.state = "ok";
      publish(runId, { type: "node", nodeId: node.id, state: "ok" });
      await persist("running");
    } catch (e) {
      const detail = (e as Error).message;
      st.state = "error";
      st.detail = detail;
      publish(runId, { type: "node", nodeId: node.id, state: "error", detail });
      await persist("error");
      publish(runId, { type: "done", ok: false });
      closeBus(runId);
      return;
    }
  }

  await persist("ok");
  publish(runId, { type: "run", state: "ok" });
  publish(runId, { type: "done", ok: true });
  closeBus(runId);
}
