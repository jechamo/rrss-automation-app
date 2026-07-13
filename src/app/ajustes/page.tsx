"use client";

import { useEffect, useState, useCallback } from "react";

type Provider = {
  id: string;
  name: string;
  description: string;
  needsKey: boolean;
  docsUrl?: string;
  hasKey: boolean;
  masked: string | null;
  status: "ok" | "error" | "unset";
  detail: string | null;
  lastChecked: string | null;
};

export default function AjustesPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [aiEngine, setAiEngine] = useState<string>("claude-cli");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await fetch("/api/connectors");
    const d = await r.json();
    setProviders(d.providers);
    setAiEngine(d.aiEngine);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="text-white/50">Cargando…</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="mt-1 text-sm text-white/50">
          Configura el motor de IA y las APIs. Cada conexion tiene su boton de prueba. Las keys se
          guardan cifradas en local.
        </p>
      </header>

      <EngineSelector value={aiEngine} onChange={setAiEngine} />

      <div className="mt-6 flex flex-col gap-4">
        {providers.map((p) => (
          <ProviderCard key={p.id} p={p} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

function EngineSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [saving, setSaving] = useState(false);
  const options = [
    { id: "claude-cli", label: "Claude Code CLI", hint: "Recomendado · usa tu plan Pro (sin coste API)" },
    { id: "claude-agent-sdk", label: "Claude Agent SDK", hint: "Proximamente" },
  ];
  async function select(engine: string) {
    setSaving(true);
    await fetch("/api/ai-engine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engine }),
    });
    onChange(engine);
    setSaving(false);
  }
  return (
    <div className="glass glow-border p-5">
      <div className="text-sm font-semibold">Motor de IA</div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.id}
            disabled={saving}
            onClick={() => select(o.id)}
            className={[
              "rounded-lg border px-3 py-2 text-left text-sm transition",
              value === o.id
                ? "border-[var(--color-accent-2)] bg-white/10"
                : "border-white/10 hover:bg-white/5",
            ].join(" ")}
          >
            <div className="font-medium">{o.label}</div>
            <div className="text-xs text-white/40">{o.hint}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProviderCard({ p, onChanged }: { p: Provider; onChanged: () => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<null | "save" | "test">(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(
    p.detail ? { ok: p.status === "ok", text: p.detail } : null,
  );

  async function save() {
    setBusy("save");
    const r = await fetch(`/api/connectors/${p.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const d = await r.json();
    setMsg(r.ok ? { ok: true, text: "Key guardada." } : { ok: false, text: d.error });
    setKey("");
    setBusy(null);
    onChanged();
  }

  async function test() {
    setBusy("test");
    const r = await fetch(`/api/connectors/${p.id}/test`, { method: "POST" });
    const d = await r.json();
    setMsg({ ok: !!d.ok, text: d.detail });
    setBusy(null);
    onChanged();
  }

  const dot =
    p.status === "ok" ? "bg-[var(--color-state-ok)]" : p.status === "error" ? "bg-[var(--color-state-error)]" : "bg-white/20";

  return (
    <div className="glass p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
            <span className="font-semibold">{p.name}</span>
          </div>
          <p className="mt-1 text-xs text-white/50">{p.description}</p>
        </div>
        {p.docsUrl && (
          <a
            href={p.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[var(--color-accent-2)] hover:underline"
          >
            Obtener key ↗
          </a>
        )}
      </div>

      {p.needsKey && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={p.hasKey ? `Guardada: ${p.masked}` : "Pega tu API key"}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--color-accent-2)]"
          />
          <button
            onClick={save}
            disabled={!key || busy !== null}
            className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium disabled:opacity-40"
          >
            {busy === "save" ? "Guardando…" : "Guardar"}
          </button>
          <button
            onClick={test}
            disabled={busy !== null}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            {busy === "test" ? "Probando…" : "Probar"}
          </button>
        </div>
      )}

      {!p.needsKey && (
        <div className="mt-3">
          <button
            onClick={test}
            disabled={busy !== null}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            {busy === "test" ? "Probando…" : "Probar conexion"}
          </button>
        </div>
      )}

      {msg && (
        <div className={`mt-3 text-xs ${msg.ok ? "text-[var(--color-state-ok)]" : "text-[var(--color-state-error)]"}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
