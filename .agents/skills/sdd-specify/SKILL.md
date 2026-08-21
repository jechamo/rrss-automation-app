---
name: sdd-specify
description: Crea la especificación de una funcionalidad nueva. Convierte la idea en requisitos EARS con criterios de aceptación testables. Sin decisiones técnicas.
---

# /sdd-specify — Qué y por qué

Agente responsable: `@spec-analyst`.

## Paso 0 — Contexto

Lee primero `docs/product/PRD.md`, `docs/product/USE-CASES.md`,
`docs/product/FEATURE-MAP.md` y `docs/product/SOURCES.md` cuando existan. Si el baseline está
`approved`, selecciona con el usuario un corte vertical aprobado de `FEATURE-MAP.md` y conserva
sus IDs de origen. No conviertas todo el PRD en una sola spec.

Si producto está en `bootstrap`, `intake` o `pending-approval`, para y vuelve a `/sdd-intake`.
En brownfield `legacy-pending`, avisa de la cobertura incompleta y permite documentar la spec sin
inventar IDs; el gate seguirá pendiente hasta normalizar producto.

Lee `docs/architecture/constitution.md` (si existe) solo para conocer el dominio y el
vocabulario. **No** la uses para meter decisiones técnicas en la spec.

Si no existe constitución y el repo está vacío → avisa: falta `/sdd-init`.

## Paso 1 — Numeración y carpeta

Ejecuta `node scripts/sdd-project.mjs new-spec <slug-en-kebab-case> --json`. El CLI calcula el
número y copia solo `spec.md`/`clarifications.md` desde la plantilla canónica sin aprobar nada.
Usa la ruta devuelta; no renumeres ni recrees el esqueleto a mano.

Si se trabaja con git, propón crear la rama `feature/NNN-slug` (no la crees sin permiso).

## Paso 2 — Escribir `spec.md`

Secciones obligatorias:

1. **Metadatos** — id, título, autor, fecha, estado (`borrador`), dependencias con otras specs.
   Añade el corte de `FEATURE-MAP.md` y los IDs `OBJ-*`, `PRD-RF-*` y `UC-*` de procedencia.
2. **Problema** — qué duele hoy, a quién, con qué frecuencia, qué coste tiene no arreglarlo.
3. **Objetivo y métrica de éxito** — cómo sabremos que funcionó (número, no adjetivo).
4. **Usuarios y contexto de uso** — perfiles, escenario real, frecuencia.
5. **Requisitos funcionales (EARS) con prioridad MoSCoW** — numerados `RF-01`…
   - `El sistema DEBE <respuesta>.`
   - `CUANDO <disparador>, el sistema DEBE <respuesta>.`
   - `MIENTRAS <estado>, el sistema DEBE <respuesta>.`
   - `SI <condición no deseada>, ENTONCES el sistema DEBE <respuesta>.`

   Cada `RF` lleva **prioridad** (M/S/C/W) y **esfuerzo relativo** (1, 2, 3, 5, 8).
   Ver paso 2 bis para el reparto.
6. **Requisitos no funcionales** — rendimiento (p95), disponibilidad, escala, seguridad y
   privacidad, accesibilidad (WCAG 2.2 AA), i18n, observabilidad, coste, retención de datos.
   Declara `Impacto de seguridad` con uno de estos valores exactos:
   `sensible | no-sensible | security-pending`. Es `sensible` si toca autenticación,
   autorización, PII, pagos, ficheros, administración, multi-tenant, integraciones o agentes/LLM.
   `security-pending` solo preserva contexto brownfield histórico; nunca exime una spec sensible
   nueva. En esta fase se declara impacto y comportamiento, no librerías ni controles técnicos.
   Declara también `Impacto de usabilidad` con uno de estos valores exactos:
   `aplicable | sin-ui · <motivo material> | ux-pending`. Es `aplicable` si la spec toca una
   pantalla, un formulario, un texto que lee una persona o una espera que se nota (> 300 ms).
   `sin-ui` necesita un motivo material: "no procede" no lo es. `ux-pending` solo preserva
   contexto brownfield; nunca exime una spec nueva con interfaz.
7. **Criterios de aceptación** — numerados `CA-01`…, en Gherkin, ligados a su `RF`.
8. **Casos límite** — vacío, extremos, concurrencia, sin permisos, sistema externo caído,
   datos corruptos, reintentos.
9. **Reglas de negocio** — invariantes que deben cumplirse siempre.
10. **Fuera de alcance** — explícito. Tan importante como el alcance.
11. **Riesgos y dependencias**.
12. **Supuestos** — lo que has decidido tú y el usuario debe validar.
13. **Glosario** — lenguaje ubicuo del dominio.
14. **Preguntas abiertas** — cada una como `[NEEDS CLARIFICATION: ...]` en su sitio.

Incluye una tabla de trazabilidad funcional con esta cadena y sin saltos:

| Objetivo | Requisito de producto | Caso de uso | Requisito de spec | Criterio de aceptación |
|---|---|---|---|---|
| OBJ-001 | PRD-RF-001 | UC-001 | RF-01 | CA-01 |

Si la idea solicitada contradice el baseline o no cabe en el mapa aprobado, no actualices
`PRD.md` ni `FEATURE-MAP.md` de forma silenciosa: registra la discrepancia y vuelve al gate de
`/sdd-intake`.

## Paso 2 bis — Priorizar con MoSCoW, y hacerlo bien

MoSCoW casi siempre se aplica mal: se etiqueta y no se reparte. Las reglas del DSDM:

| Prioridad | Significa | Esfuerzo |
|---|---|---|
| **Must** | Sin esto la entrega no tiene sentido. Es *no negociable*, no *muy importante* | **≤ 60 %** |
| **Should** | Duele omitirlo, pero hay alternativa o apaño temporal | ~20 % |
| **Could** | Se sacrifica primero cuando aprieta. Es la **contingencia deliberada** | ~20 % |
| **Won't have this time** | Descartado **en esta iteración**, y escrito | — |

Cómo hacerlo:

1. Estima cada `RF` en esfuerzo **relativo** (1, 2, 3, 5, 8). No pidas horas: no las sabes.
2. Suma por prioridad y calcula el porcentaje **sobre esfuerzo, no sobre número de requisitos**.
3. **Si los must pasan del 60 %, avisa y propón qué bajar a should.** Es el aviso más útil de esta
   fase: un plan donde todo es obligatorio no tiene margen y descarrila en el primer imprevisto.
4. Los *won't* se escriben con motivo. Un descarte no registrado vuelve como discusión.

**Prueba del must**: si el usuario dice "must" a todo, pregunta por cada uno: *¿entregamos sin
esto y el resultado sigue sirviendo para algo?* Si la respuesta es sí, no es must.

Si el tipo de trabajo pide otro esquema (WSJF con dependencias de coste de retraso, Kano para
satisfacción percibida, RICE para descubrimiento), **propónlo y explica por qué**, pero el
resultado sigue necesitando un límite explícito de alcance obligatorio.

## Paso 2 ter — Preguntar antes de suponer

Esta fase **no es de escritura silenciosa**. La entrada casi nunca está completa: un PRD sin
estados de error, un "login" sin decir si hay recuperación de contraseña, un Figma con una
pantalla que no aparece en el texto.

Regla: **por cada duda que cambie materialmente el resultado, pregunta y trae tu sugerencia.**

```
❓ <pregunta concreta>
   Mi sugerencia: <opción recomendada> — porque <motivo en una línea>
   Alternativas: <opción B> / <opción C>
   Si no lo confirmas: queda como [NEEDS CLARIFICATION] y bloquea /sdd-plan
```

Preguntar sin sugerir traslada el trabajo al usuario. Sugerir sin preguntar decide por él.
**Las dos cosas, y la confirmación es suya.** Lo que no se confirme no se convierte en supuesto
silencioso: se marca.

Fuentes con diseño de entrada (Figma, Stitch, boceto): revísalas **con** `@ux-designer` y anota
las funcionalidades que aparecen en el diseño y no en el texto —y al revés—. Esa lista suele ser
donde está el trabajo real.

## Reglas duras

- **Cero tecnología.** Nada de tablas, endpoints, frameworks, librerías o nombres de clase.
  Si aparece, bórralo: es trabajo del `planner`.
- Si no sabes escribir el test de un requisito, el requisito no está claro. Márcalo.
- Un requisito con "y" suele ser dos requisitos.
- No inventes: lo que no sepas y cambie el resultado, va como `[NEEDS CLARIFICATION]`.
- Los IDs de producto se copian del baseline; nunca se renumeran dentro de una spec.

## Paso 3 — Autorrevisión antes de entregar

- [ ] Cada `RF` tiene al menos un `CA`
- [ ] Cada `RF` traza a `OBJ-*`, `PRD-RF-*` y `UC-*`, o el estado `legacy-pending` explica el hueco
- [ ] Cada `RF` tiene prioridad MoSCoW **y** esfuerzo relativo
- [ ] El reparto está calculado sobre esfuerzo, y los must no pasan del 60 % (o está justificado)
- [ ] Hay sección de *won't have this time*, aunque sea para decir que no hay nada
- [ ] Cada `CA` es observable y automatizable
- [ ] Hay sección de casos límite no vacía
- [ ] Hay requisitos no funcionales (no los olvides: es el error más común)
- [ ] `Impacto de seguridad` usa `sensible`, `no-sensible` o `security-pending`, con señales
      trazadas a RF/CA; no se oculta una spec sensible nueva como `security-pending`
- [ ] `Impacto de usabilidad` usa `aplicable`, `sin-ui · motivo` o `ux-pending`, con las cuatro
      señales trazadas a RF/CA; un `sin-ui` sin motivo material no vale
- [ ] Hay "fuera de alcance"
- [ ] No hay ninguna decisión técnica
- [ ] Los marcadores `[NEEDS CLARIFICATION]` están donde deben

## Cierre

```
### HANDOFF
- Agente origen: spec-analyst
- Fase completada: specify
- Artefacto: docs/specs/NNN-slug/spec.md
- Corte vertical y cobertura de producto: <FEATURE-MAP · OBJ-* · PRD-RF-* · UC-*>
- Requisitos: <n> RF · <n> RNF · <n> CA
- Impacto de seguridad: <sensible/no-sensible/security-pending> · señales: <RF/CA>
- Impacto de usabilidad: <aplicable/sin-ui · motivo/ux-pending> · señales: <RF/CA>
- Reparto MoSCoW: must <n>% · should <n>% · could <n>% · won't <n> requisitos
- Preguntas hechas al usuario: <n> · confirmadas: <n>
- Marcadores pendientes: <n>
- Siguiente agente sugerido: spec-analyst — comando: /sdd-clarify (si hay marcadores)
                              ux-designer — comando: /sdd-design (si la funcionalidad tiene UI)
                              o planner — comando: /sdd-plan
```
