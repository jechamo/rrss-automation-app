# Resumen ejecutivo · `<spec o entrega>`

> Plantilla. La rellena `release-manager` en `/sdd-ship`.
>
> **Regla de honestidad:** toda cifra que aparezca aquí está verificada y se puede rastrear hasta
> `evidence.md`. Si no hay cifras, se escribe "sin medición todavía" y se dice cuándo la habrá.
> Proyectar un impacto inventado es peor que no escribir el resumen: destruye la credibilidad de
> todos los siguientes.
>
> Objetivo: **250-300 palabras**, dos minutos de lectura. Cero jerga técnica.
> Si tu interlocutor no técnico no lo entiende, está mal escrito. Borra la plantilla al rellenar.

---

## Qué hicimos

<Una frase. Sin nombres de librerías, patrones ni capas.>

*Mal:* "Migramos la gestión de estado del carrito a un store externo con middleware de persistencia."
*Bien:* "Arreglamos la lentitud del carrito que estaban reportando los usuarios móviles."

## Por qué importa

<El problema de negocio que había detrás. A cuánta gente afectaba y desde cuándo.>

## Resultados

<Tres a cinco líneas, cada una con un número medido. Nada de "mucho más rápido".>

| Antes | Después | Medido con |
|---|---|---|
| | | |

## Lo que no se resolvió

<Opcional pero recomendado. Mantiene la expectativa donde debe estar y evita la conversación
incómoda del mes siguiente. Enlaza a los controles no ejecutados de `evidence.md` si los hay.>

## Qué sigue

- <Siguiente paso concreto, con fecha.>

---

**Completado:** `<fecha>` · **Siguiente hito:** `<fecha>`
**Trazabilidad:** `docs/specs/NNN-slug/spec.md` · `docs/specs/NNN-slug/evidence.md`

---

## Ajuste por audiencia

El mismo trabajo se cuenta distinto según quién decide con ello:

| Audiencia | Le importa | Longitud |
|---|---|---|
| Dirección | Riesgo, coste, posición competitiva | 2-3 párrafos |
| Producto | Experiencia de usuario, adopción, roadmap | 3-4 párrafos |
| Ingeniería | Decisiones técnicas, deuda, velocidad del equipo | 4-5 párrafos + apéndice técnico |

Escribe una versión, no tres. Elige la audiencia principal y enlaza el detalle para el resto.
