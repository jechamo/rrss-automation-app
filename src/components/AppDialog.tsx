"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DialogTone = "default" | "danger";

type DialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  initialValue?: string;
  inputLabel?: string;
};

type DialogRequest = DialogOptions & {
  id: number;
  kind: "alert" | "confirm" | "prompt";
  resolve: (value: boolean | string | null) => void;
};

export function useAppDialog() {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const nextId = useRef(0);
  const requestRef = useRef<DialogRequest | null>(null);

  const present = useCallback((next: DialogRequest) => {
    requestRef.current = next;
    setRequest(next);
  }, []);

  const finish = useCallback((value: boolean | string | null) => {
    const current = requestRef.current;
    requestRef.current = null;
    setRequest(null);
    current?.resolve(value);
  }, []);

  const showAlert = useCallback((options: DialogOptions) => new Promise<void>((resolve) => {
    present({ ...options, id: ++nextId.current, kind: "alert", resolve: () => resolve() });
  }), [present]);

  const showConfirm = useCallback((options: DialogOptions) => new Promise<boolean>((resolve) => {
    present({ ...options, id: ++nextId.current, kind: "confirm", resolve: (value) => resolve(value === true) });
  }), [present]);

  const showPrompt = useCallback((options: DialogOptions) => new Promise<string | null>((resolve) => {
    present({ ...options, id: ++nextId.current, kind: "prompt", resolve: (value) => resolve(typeof value === "string" ? value : null) });
  }), [present]);

  return {
    alert: showAlert,
    confirm: showConfirm,
    prompt: showPrompt,
    dialog: request ? <AppDialog key={request.id} request={request} onFinish={finish} /> : null,
  };
}

function AppDialog({
  request,
  onFinish,
}: {
  request: DialogRequest;
  onFinish: (value: boolean | string | null) => void;
}) {
  const [value, setValue] = useState(request.initialValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => (request.kind === "prompt" ? inputRef.current : confirmRef.current)?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onFinish(request.kind === "alert" ? true : null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onFinish, request.kind]);

  const dangerous = request.tone === "danger";
  const confirm = () => onFinish(request.kind === "prompt" ? value.trim() : true);
  const cancel = () => onFinish(request.kind === "confirm" ? false : null);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && request.kind !== "alert") cancel(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby={`app-dialog-${request.id}`} className="glass-strong my-auto w-full max-w-md overflow-hidden border border-white/12 shadow-2xl">
        <div className={`h-1 ${dangerous ? "bg-gradient-to-r from-red-600 to-rose-400" : "bg-gradient-to-r from-purple-600 to-cyan-400"}`} />
        <div className="p-5 sm:p-6">
          <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-lg ${dangerous ? "bg-red-500/15 text-red-200" : "bg-cyan-400/10 text-cyan-200"}`} aria-hidden="true">
            {dangerous ? "!" : "i"}
          </div>
          <h2 id={`app-dialog-${request.id}`} className="text-lg font-bold">{request.title}</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/55">{request.message}</p>
          {request.kind === "prompt" && (
            <label className="mt-5 block text-xs text-white/55">
              {request.inputLabel ?? "Valor"}
              <input
                ref={inputRef}
                className="input mt-1"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && value.trim()) confirm(); }}
              />
            </label>
          )}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-white/10 bg-black/15 p-4">
          {request.kind !== "alert" && (
            <button type="button" onClick={cancel} className="rounded-xl border border-white/12 px-4 py-2.5 text-sm text-white/65 hover:bg-white/5">
              {request.cancelLabel ?? "Cancelar"}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            onClick={confirm}
            disabled={request.kind === "prompt" && !value.trim()}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-35 ${dangerous ? "bg-red-500 text-white hover:bg-red-400" : "bg-[var(--color-accent)] text-white hover:brightness-110"}`}
          >
            {request.confirmLabel ?? (request.kind === "alert" ? "Entendido" : "Confirmar")}
          </button>
        </footer>
      </section>
    </div>
  );
}
