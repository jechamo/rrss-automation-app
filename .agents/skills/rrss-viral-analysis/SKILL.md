---
name: rrss-viral-analysis
description: >-
  Analiza contenido viral de redes sociales (YouTube, TikTok, Instagram/Reels) para extraer
  los patrones que lo hacen funcionar: hook, retencion, estructura, formato y duracion. Usar
  al estudiar virales de un nicho, decidir que replicar, o definir criterios de "viral".
  Aplica a RRSS Studio REQ-004 (scraping de virales del nicho).
---

# Analisis de contenido viral (RRSS)

Objetivo: dado un conjunto de piezas (o metadatos) de un nicho, identificar **por que** cada
una funciona y destilar **patrones reutilizables** para generar contenido propio (REQ-005/006)
sin copiar literalmente.

## Que mirar (señales por plataforma)
- **YouTube:** titulo + miniatura (curiosity gap), primeros 30s (hook), retencion,
  ratio vistas/suscriptores, duracion optima por formato (short vs. long).
- **TikTok:** primer 1-3s (patron de interrupcion), audio/tendencia usada, texto en pantalla,
  loop/rewatch, comentarios como señal de engagement, duracion 15-60s.
- **Instagram/Reels:** hook visual, ritmo de cortes, caption + primera linea, saves/shares
  (mejor señal que likes), covers de la cuadricula.

## Metrica de "viral" (ventana temporal)
Define viral de forma relativa al canal, no absoluta: p. ej. *vistas ≥ 5x la mediana del
autor en su primera semana*, o alto ratio de shares/saves. Fija la **ventana** (7/14/30 dias)
segun la velocidad del nicho.

## Metodo
1. **Clasificar el formato** (educativo, storytelling, reaccion, tutorial, POV, listicle, antes/despues).
2. **Descomponer la estructura** en bloques temporales: `hook → contexto → desarrollo → giro → CTA`.
   Anota segundos aproximados de cada bloque.
3. **Aislar el hook** (lo mas importante): tipo (pregunta, dato impactante, promesa, conflicto,
   negacion) y por que corta el scroll.
4. **Identificar el "share trigger"**: emocion o utilidad que hace compartir/guardar.
5. **Extraer el patron transferible** al negocio propio (concepto, no copia): que estructura,
   que tipo de hook y que formato replicar para el `nicho` del dossier.

## Salida (JSON sugerido)
```json
{
  "criterioViral": { "metrica": "", "umbral": "", "ventanaDias": 7 },
  "piezas": [
    { "url": "", "plataforma": "youtube|tiktok|instagram", "formato": "",
      "hook": { "tipo": "", "texto": "", "segundos": 3 },
      "estructura": [ { "bloque": "hook", "desde": 0, "hasta": 3, "nota": "" } ],
      "shareTrigger": "", "porQueFunciona": "",
      "patronTransferible": "" }
  ],
  "patronesRecurrentes": [ { "patron": "", "frecuencia": "", "comoAplicar": "" } ]
}
```

## Buenas practicas
- **Reinterpretar, no copiar** (evitar copyright, DA-04): extrae el *concepto/estructura*, no
  el guion ni los assets originales.
- Prioriza patrones que se repiten en >=3 piezas (señal, no anecdota).
- Ata cada patron a un formato producible con las herramientas del proyecto (video/imagen).
