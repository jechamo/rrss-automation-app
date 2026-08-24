"use client";

import { useEffect, useState } from "react";

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
  src: customSrc,
  size = 56,
  className = "",
}: {
  name: string;
  web?: string;
  src?: string;
  size?: number;
  className?: string;
}) {
  const domain = domainOf(web ?? "");
  // step -1 = imagen manual, 0 = clearbit, 1 = favicon, 2 = iniciales
  const [step, setStep] = useState(customSrc ? -1 : domain ? 0 : 2);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setStep(customSrc ? -1 : domain ? 0 : 2);
    setLoaded(false);
  }, [customSrc, domain]);

  const imageSrc =
    step === -1
      ? customSrc
      : step === 0
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

  const hue = hueOf(name || domain || "?");
  const fallback = (
    <div
      className="absolute inset-0 flex items-center justify-center font-bold text-white"
      style={{
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 70% 35%))`,
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );

  if (step >= 2 || (step >= 0 && !domain)) {
    return (
      <div
        className={`relative overflow-hidden ${className}`}
        style={box}
        aria-label={name}
      >
        {fallback}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={box} aria-label={name}>
      {fallback}
      {/* La fuente puede ser local/remota y ya tiene fallback; no pasa por el optimizador. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        alt=""
        width={size}
        height={size}
        loading={customSrc ? "eager" : "lazy"}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setStep((current) => {
            if (current === -1) return domain ? 0 : 2;
            return current < 1 ? current + 1 : 2;
          });
        }}
        className="absolute inset-0 bg-white/90 object-contain p-1 transition-opacity duration-200"
        style={{ width: size, height: size, opacity: loaded ? 1 : 0 }}
      />
    </div>
  );
}
