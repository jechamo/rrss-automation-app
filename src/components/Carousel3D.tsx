"use client";

import { useEffect, useState, type ReactNode } from "react";

// Carrusel 360 (cover-flow) genérico. La card central se ve al 100%; las
// laterales rotan en 3D y se atenúan. Extraído de PieceCarousel (REQ-009) para
// reusarlo en dashboard, competencia, leads y virales.
export function Carousel3D<T>({
  items,
  active: activeProp,
  onActive,
  renderCard,
  onSelectCenter,
  getKey,
  height = "h-72",
  cardWidth = 208,
}: {
  items: T[];
  active?: number;
  onActive?: (i: number) => void;
  renderCard: (item: T, isCenter: boolean, index: number) => ReactNode;
  onSelectCenter?: (item: T, index: number) => void;
  getKey: (item: T, index: number) => string;
  height?: string;
  cardWidth?: number;
}) {
  const [inner, setInner] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const active = activeProp ?? inner;
  const total = items.length;
  const setActive = (i: number) => {
    const c = Math.max(0, Math.min(items.length - 1, i));
    if (onActive) onActive(c);
    else setInner(c);
  };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="coverflow relative">
      <div className={`relative mx-auto w-full max-w-xl ${height}`}>
        {items.map((item, i) => {
          const offset = i - active;
          const abs = Math.abs(offset);
          if (abs > 2) return null;
          const isCenter = offset === 0;
          return (
            <button
              key={getKey(item, i)}
              type="button"
              aria-current={isCenter ? "true" : undefined}
              aria-label={`${isCenter ? "Pieza activa" : "Seleccionar pieza"} ${i + 1} de ${total}`}
              onClick={() => (isCenter ? onSelectCenter?.(item, i) : setActive(i))}
              className="coverflow-item glass glow-hover absolute left-1/2 top-1/2 flex flex-col overflow-hidden text-left"
              style={{
                width: cardWidth,
                height: "16rem",
                transform: reduceMotion
                  ? `translate(-50%, -50%) translateX(${offset * 58}%)`
                  : `translate(-50%, -50%) translateX(${offset * 58}%) rotateY(${-offset * 34}deg) scale(${isCenter ? 1 : 0.82})`,
                opacity: isCenter ? 1 : 0.4,
                filter: isCenter || reduceMotion ? "none" : "saturate(0.7)",
                zIndex: 10 - abs,
                cursor: "pointer",
              }}
            >
              {renderCard(item, isCenter, i)}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setActive(active - 1)}
          disabled={active === 0}
          className="min-h-8 min-w-8 rounded-full border border-white/15 px-3 py-1 text-sm hover:bg-white/5 disabled:opacity-30"
          aria-label={`Anterior, pieza ${Math.max(1, active)} de ${total}`}
        >
          ‹
        </button>
        <div className="flex items-center gap-1.5">
          {items.map((item, i) => (
            <button
              key={getKey(item, i)}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ir a pieza ${i + 1} de ${total}`}
              aria-current={i === active ? "true" : undefined}
              className="min-h-6 min-w-6 rounded-full transition-all"
              style={{
                width: i === active ? 18 : 6,
                background: i === active ? "var(--color-accent-2)" : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setActive(active + 1)}
          disabled={active === items.length - 1}
          className="min-h-8 min-w-8 rounded-full border border-white/15 px-3 py-1 text-sm hover:bg-white/5 disabled:opacity-30"
          aria-label={`Siguiente, pieza ${Math.min(total, active + 2)} de ${total}`}
        >
          ›
        </button>
      </div>
    </div>
  );
}
