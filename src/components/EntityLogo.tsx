"use client";

import { useState } from "react";

// Logo de una entidad (competidor/lead/proyecto) a partir de su web.
// Cascada de fallback sin API key: Clearbit → Google favicon → iniciales.
// Requiere red del navegador; si no hay, cae a iniciales.

function domainOf(web: string): string {
  const raw = web.trim();
  if (!raw) return "";
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^www\./, "").split("/")[0];
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Color estable derivado del nombre (hue por hash simple).
function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function EntityLogo({
  name,
  web,
  size = 56,
  className = "",
}: {
  name: string;
  web?: string;
  size?: number;
  className?: string;
}) {
  const domain = domainOf(web ?? "");
  // step 0 = clearbit, 1 = favicon, 2 = iniciales
  const [step, setStep] = useState(domain ? 0 : 2);

  const src =
    step === 0
      ? `https://logo.clearbit.com/${domain}`
      : step === 1
        ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
        : "";

  const box = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: size * 0.28,
  } as const;

  if (step >= 2 || !domain) {
    const hue = hueOf(name || domain || "?");
    return (
      <div
        className={`flex items-center justify-center font-bold text-white ${className}`}
        style={{
          ...box,
          fontSize: size * 0.36,
          background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 70% 35%))`,
        }}
        aria-label={name}
      >
        {initials(name)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setStep((s) => s + 1)}
      className={`bg-white/90 object-contain p-1 ${className}`}
      style={box}
    />
  );
}
