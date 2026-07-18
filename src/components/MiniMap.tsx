"use client";

// Mapa embebido por ficha (sin API key ni paquetes): iframe de Google Maps con
// output=embed geocodifica la query (dirección o nombre+zona) en el navegador.
// Perezoso: se monta solo cuando la card está desplegada (lo controla el padre).
export function MiniMap({
  query,
  height = 200,
  className = "",
}: {
  query: string;
  height?: number;
  className?: string;
}) {
  const q = query.trim();
  if (!q) return null;
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=13&output=embed`;
  return (
    <div className={`overflow-hidden rounded-lg border border-white/10 ${className}`}>
      <iframe
        title={`Mapa: ${q}`}
        src={src}
        width="100%"
        height={height}
        style={{ border: 0, filter: "grayscale(0.2) contrast(1.05)" }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
