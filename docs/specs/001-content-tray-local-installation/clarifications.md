# Clarificaciones · 001-content-tray-local-installation

Registro de las ambigüedades resueltas con la persona usuaria. Cada respuesta aceptada actualiza `spec.md`; este registro no aprueba la spec.

---

## Ronda 1 — 2026-08-21

### P1 · Tratamiento de datos locales existentes

**Marcador origen**: `spec.md` §7, §10 y §13.

**Trazabilidad afectada**: `OBJ-004 → PRD-RF-005 → UC-011 → RF-04/CA-04` y `OBJ-004 → PRD-RF-006 → UC-012 → RF-05, RF-07, RF-08/CA-05, CA-07, CA-08`.

**Fuentes / discrepancias**: `SRC-001`, `SRC-012`, `SRC-015`, `SRC-016` · `DISC-009`, `DISC-010` resueltas en baseline; alcance de preservación no especificado.

**Pregunta resuelta**: Cuando el asistente detecta datos locales existentes, incompletos o incompatibles, ¿debe preservar y bloquear la preparación, permitir una recuperación no destructiva, o admitir un reinicio explícitamente confirmado?

**Opciones planteadas**:
- a) Preservar y bloquear la preparación hasta que la persona resuelva el estado local — consecuencia: no hay pérdida silenciosa; puede requerir intervención manual.
- b) Intentar una recuperación no destructiva automáticamente — consecuencia: reduce fricción, pero exige definir con precisión qué modificaciones están autorizadas.
- c) Permitir un reinicio local con confirmación explícita — consecuencia: facilita un inicio limpio, pero puede provocar pérdida de datos locales.

**Recomendación del agente**: a) por defecto, con c) solo como alternativa posterior y confirmación separada, porque evita pérdida de datos y conserva un límite claro para la instalación guiada.

**Respuesta**: Preservar los datos locales existentes, incompletos o incompatibles y bloquear el arranque con diagnóstico. Un reinicio requiere una confirmación separada.

**Decidido por**: persona usuaria.

**Evidencia de confirmación**: aprobación explícita de la persona usuaria en `/sdd-clarify` el 2026-08-21.

**Impacto en la spec**: actualiza RF-05, CA-05, CA-07, CA-08, los casos límite, RN-07, riesgos, retención de datos y fuera de alcance. No se permite recuperación automática ni reinicio sin una confirmación separada.

---

### P2 · Excepción al reparto MoSCoW

**Marcador origen**: `spec.md` §4 y §13.

**Trazabilidad afectada**: `OBJ-004 → PRD-RF-008 → UC-011 → RF-06/CA-06`.

**Fuentes / discrepancias**: `SRC-001`, `SRC-002`, `SRC-009`, `SRC-010`, `SRC-016` · ninguna abierta.

**Pregunta resuelta**: ¿Se aprueba bajar RF-06 de Must a Should para llevar el esfuerzo Must al 50%, o se acepta expresamente un reparto de 62% Must?

**Opciones planteadas**:
- a) Bajar RF-06 a Should — consecuencia: el arranque local y la persistencia preparada siguen siendo obligatorios; la clasificación detallada de capacidades opcionales puede aplazarse.
- b) Mantener RF-06 como Must y aceptar 62% Must — consecuencia: conserva toda la claridad inicial, pero reduce el margen de contingencia de la iteración.

**Recomendación del agente**: a) porque el resultado básico sigue siendo útil y el reparto recupera previsibilidad sin eliminar el requisito.

**Respuesta**: Bajar RF-06 de Must a Should para que el esfuerzo Must sea el 50%.

**Decidido por**: persona usuaria.

**Evidencia de confirmación**: aprobación explícita de la persona usuaria en `/sdd-clarify` el 2026-08-21.

**Impacto en la spec**: RF-06 y CA-06 mantienen su trazabilidad, pero RF-06 pasa a Should. El reparto queda en Must 50%, Should 31% y Could 19% del esfuerzo.

---

## Resumen de cambios de alcance

| Ronda | Qué se amplió | Qué se sacó del alcance |
|---|---|---|
| 1 | Ninguno: P1 resuelve una alternativa ya planteada. | Recuperación automática y reinicio sin confirmación separada; RF-06 sale de Must y pasa a Should. |

## Estado

- Marcadores iniciales: 2
- Resueltos: 2
- **Pendientes: 0**

## Gate humano de clarificaciones

| Campo | Valor |
|---|---|
| Estado | `approved` para las respuestas P1 y P2; la spec queda aprobada. |
| Persona | norkc |
| Fecha | 2026-08-21 |
| Discrepancias abiertas | 0 en esta spec. |

Este gate alimenta el gate de `spec.md`; no lo sustituye.

### HANDOFF
- Agente origen: spec-analyst
- Fase completada: clarify
- Fuentes consultadas: SRC-001, SRC-002, SRC-009 a SRC-016; `docs/design/INTAKE-REVIEW.md`.
- Artefactos: `docs/specs/001-content-tray-local-installation/spec.md`, `docs/specs/001-content-tray-local-installation/clarifications.md`.
- Requisitos / casos cubiertos: OBJ-005 → PRD-RF-007, PRD-RF-012 → UC-010; OBJ-004 → PRD-RF-005, PRD-RF-006, PRD-RF-008 → UC-011, UC-012.
- Discrepancias: DISC-008, DISC-009 y DISC-010 tratadas como resueltas por el baseline; ninguna abierta en esta spec.
- Decisiones tomadas: P1 preserva datos locales existentes, incompletos o incompatibles y bloquea el arranque con diagnóstico; un reinicio exige confirmación separada. P2 baja RF-06 a Should y deja Must en el 50% del esfuerzo.
- Supuestos: los documentados en `spec.md` §11.
- Bloqueos: contrato documental para la guía antes de planificar.
- Siguiente agente sugerido: ux-designer — motivo: continuar por `/sdd-design` con la spec aprobada.
- Comando / contexto durable: `/sdd-design`; releer los dos artefactos de esta carpeta y `docs/design/INTAKE-REVIEW.md`.