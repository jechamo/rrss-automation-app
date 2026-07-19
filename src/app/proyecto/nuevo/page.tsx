"use client";

import { useState } from "react";

type CodeType = "none" | "local" | "github_public" | "github_private";

const CODE_OPTIONS: { id: CodeType; label: string; hint: string }[] = [
  { id: "none", label: "Solo web", hint: "Analizar unicamente la appweb" },
  { id: "local", label: "Ruta local", hint: "Carpeta del codigo en este equipo" },
  { id: "github_public", label: "GitHub publico", hint: "URL del repositorio publico" },
  { id: "github_private", label: "GitHub privado", hint: "Requiere token de GitHub en Ajustes" },
];

export default function NuevoProyectoPage() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [codeType, setCodeType] = useState<CodeType>("none");
  const [codePath, setCodePath] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsPath = codeType !== "none";
  const pathLabel =
    codeType === "local" ? "Ruta local del codigo" : "URL del repositorio GitHub";
  const pathPlaceholder =
    codeType === "local" ? "C:\\ruta\\a\\tu\\proyecto" : "https://github.com/usuario/repo";

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          url,
          codeType,
          codePath: needsPath ? codePath : undefined,
          context: context.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? "No se pudo crear el proyecto.");
        setBusy(false);
        return;
      }
      // Navegacion dura: garantiza llegar siempre a la vista del pipeline.
      window.location.href = `/proyecto/${d.projectId}`;
    } catch {
      setError("Error de red al crear el proyecto.");
      setBusy(false);
    }
  }

  const canSubmit = name.trim() && url.trim() && (!needsPath || codePath.trim());

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Nuevo proyecto</h1>
        <p className="mt-1 text-sm text-white/50">
          Analizamos la appweb y, opcionalmente, su código para generar el dossier de negocio
          que alimenta al resto de funcionalidades.
        </p>
      </header>

      <div className="glass glow-border flex flex-col gap-5 p-6">
        <Field label="Nombre del proyecto">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mi appweb"
            className="input"
          />
        </Field>

        <Field label="URL de la appweb">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://miapp.com"
            className="input"
          />
        </Field>

        <Field label="Fuente de codigo">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CODE_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setCodeType(o.id)}
                className={[
                  "rounded-lg border px-3 py-2 text-left text-sm transition",
                  codeType === o.id
                    ? "border-[var(--color-accent-2)] bg-white/10"
                    : "border-white/10 hover:bg-white/5",
                ].join(" ")}
              >
                <div className="font-medium">{o.label}</div>
                <div className="text-xs text-white/40">{o.hint}</div>
              </button>
            ))}
          </div>
        </Field>

        {needsPath && (
          <Field label={pathLabel}>
            <input
              value={codePath}
              onChange={(e) => setCodePath(e.target.value)}
              placeholder={pathPlaceholder}
              className="input"
            />
            {codeType === "github_private" && (
              <p className="mt-1 text-xs text-white/40">
                Configura el token de GitHub en Ajustes para clonar repos privados.
              </p>
            )}
          </Field>
        )}

        <Field label="Contexto para el análisis (opcional)">
          <textarea
            value={context}
            onChange={(event) => setContext(event.target.value)}
            maxLength={8000}
            placeholder="Ej.: La zona privada permite generar dietas con IA para clientes. Prioriza nutrición, seguimiento y automatizaciones aunque no aparezcan en la landing."
            className="input min-h-28 resize-y"
          />
          <p className="mt-1 text-xs text-white/40">
            Orienta el rastreo y la búsqueda en el código. El dossier distinguirá lo que indicas de
            lo que pueda verificar en la web o el repositorio.
          </p>
          <div className="mt-1 text-right text-[10px] text-white/30">{context.length}/8000</div>
        </Field>

        {error && (
          <div className="text-sm text-[var(--color-state-error)]">{error}</div>
        )}

        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={!canSubmit || busy}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {busy ? "Creando y analizando…" : "Crear y analizar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
