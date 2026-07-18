"use client";

import { useState } from "react";

// Fondo de card/sección: intenta usar arte generado en /img/<name>; si el
// fichero no existe todavía, cae al gradiente CSS (fallback). Así se puede
// enchufar el arte más tarde sin tocar código.
export function CardArt({
  name,
  fallback,
  className = "",
  overlay = true,
}: {
  name: string; // p.ej. "bg-virales.webp" (en public/img/)
  fallback: string; // CSS background (gradiente) mientras no exista la imagen
  className?: string;
  overlay?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`pointer-events-none absolute inset-0 z-0 ${className}`} style={{ background: fallback }}>
      {!broken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/img/${name}`}
          alt=""
          aria-hidden
          className="card-art"
          onError={() => setBroken(true)}
        />
      )}
      {overlay && <div className="absolute inset-0 bg-black/40" />}
    </div>
  );
}
