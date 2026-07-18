export function ProjectLoading() {
  return (
    <div
      className="mx-auto flex min-h-[65vh] max-w-5xl flex-col items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-r-fuchsia-500 border-t-cyan-400 shadow-[0_0_28px_rgba(34,211,238,0.3)]" />
        <div className="absolute inset-3 rounded-full border border-white/10 bg-black/35 backdrop-blur" />
        <div className="absolute inset-[26px] rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.9)]" />
      </div>
      <p className="mt-5 text-sm font-medium text-white/70">Cargando proyecto…</p>
      <p className="mt-1 text-xs text-white/35">Preparando análisis y contenido</p>
    </div>
  );
}
