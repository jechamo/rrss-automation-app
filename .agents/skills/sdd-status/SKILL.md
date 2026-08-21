---
name: sdd-status
description: Muestra en qué punto del circuito SDD está el proyecto, qué specs hay abiertas, qué tareas quedan y cuál es el siguiente paso.
---

# /sdd-status — Dónde estoy

Solo lectura. Rápido y sin adornos. Empieza por un único snapshot determinista.

## Snapshot

Ejecuta una sola vez:

```bash
node scripts/sdd-project.mjs status --json
```

El JSON v1 ya contiene producto, arquitectura, specs/fases, tareas, artefactos, trabajo Git y
`next.skill`/`next.reason`. No repitas globs y búsquedas salvo que necesites explicar una
incoherencia concreta del snapshot.

## Presenta

- Producto y arquitectura.
- Specs activas, fase y tareas `hecho/pendiente/en curso/bloqueado`.
- Trabajo Git sin cerrar e incoherencias visibles.
- El siguiente paso calculado, con su motivo.

No elijas entre varias specs activas: muestra la ambigüedad y pide prioridad humana. Producto en
bootstrap sigue entrando por `/sdd-intake`. No modifiques nada.
