"use client";

import { useState, type ReactNode } from "react";
import { Carousel3D } from "@/components/Carousel3D";

// Patrón común de las secciones (competencia/leads/virales): carrusel 360
// siempre visible + panel de detalle del ítem activo debajo. Clic en la card
// central despliega/actualiza el detalle; las laterales solo cambian el foco.
export function ExpandableCarousel<T>({
  items,
  getKey,
  renderCard,
  renderDetail,
  height,
  cardWidth,
}: {
  items: T[];
  getKey: (item: T, index: number) => string;
  renderCard: (item: T, isCenter: boolean, index: number) => ReactNode;
  renderDetail: (item: T, index: number) => ReactNode;
  height?: string;
  cardWidth?: number;
}) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(true);

  if (items.length === 0) return null;
  const idx = Math.min(active, items.length - 1);

  return (
    <div className="flex flex-col gap-4">
      <Carousel3D
        items={items}
        active={idx}
        onActive={(i) => {
          setActive(i);
          setOpen(true);
        }}
        onSelectCenter={() => setOpen((o) => !o)}
        getKey={getKey}
        renderCard={renderCard}
        height={height}
        cardWidth={cardWidth}
      />
      {open && (
        <div key={getKey(items[idx], idx)} className="glass animate-in glow-border p-4">
          {renderDetail(items[idx], idx)}
        </div>
      )}
    </div>
  );
}
