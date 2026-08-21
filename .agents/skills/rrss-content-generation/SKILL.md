---
name: rrss-content-generation
description: "Genera guiones y copy para RRSS Studio, con hooks, retencion, CTA y tono de marca para REQ-005 y REQ-006."
---

# Generacion de contenido para RRSS

Objetivo: producir piezas (guion + copy) listas para grabar/montar, ancladas en el `dossier`
(propuesta de valor, `marca.tono`/`voz`, `publicoObjetivo`, `funcionalidades`) y, si existe,
en los `patronesTransferibles` del analisis de virales (REQ-004).

## Principios
- **Hook primero** (0-3s). Sin hook no hay retencion. Tipos: pregunta, dato/promesa, conflicto,
  negacion ("deja de..."), curiosity gap, POV.
- **Una idea por pieza.** Un solo mensaje, un solo CTA.
- **Tono de marca:** respeta `marca.tono` y `marca.voz` del dossier en cada linea.
- **Especifico > generico:** ejemplos, numeros y casos concretos del `nicho`.

## Estructura de guion (short-form video)
```
HOOK (0-3s)        promesa/pregunta que corta el scroll
CONTEXTO (3-8s)    por que le importa al espectador (dolor)
DESARROLLO (8-45s) 2-3 puntos o pasos; ritmo alto, texto en pantalla
GIRO/PRUEBA        demo del producto / resultado / dato sorprendente
CTA (ultimos 3s)   accion unica y clara (seguir, probar, link en bio)
```

## Copy por plataforma
- **TikTok/Reels:** caption corto con 1a linea-gancho + 3-5 hashtags de nicho.
- **YouTube:** titulo con curiosity gap + descripcion con keywords; short vs. long.
- **LinkedIn:** gancho en 1a linea, cuerpo en frases cortas, sin links en el cuerpo.
- **X/Twitter:** hilo; tweet 1 = hook autoconclusivo; 1 idea por tweet.
- **Anuncios:** variantes A/B del hook; beneficio + prueba + CTA; angulo por buyer persona (REQ-003).

## Salida (JSON sugerido)
```json
{
  "piezas": [
    {
      "plataforma": "tiktok|reels|youtube|linkedin|x",
      "formato": "",
      "titulo": "",
      "guion": [ { "bloque": "hook", "segundos": 3, "texto": "", "textoEnPantalla": "" } ],
      "caption": "",
      "hashtags": [],
      "cta": "",
      "variantesHook": []
    }
  ]
}
```

## Buenas practicas
- Deriva el angulo de las `ventajas` frente a competencia (REQ-002) y de las personas (REQ-003).
- Si clonas un viral (REQ-005): replica **estructura y tipo de hook**, no el guion literal (DA-04).
- Evita claims no verificables sobre el producto; usa solo `funcionalidades` reales del dossier.
- Cierra siempre con un unico CTA coherente con el objetivo (alcance vs. conversion).
