---
name: bitacora
description: Registra una decisión, cambio, deuda técnica, incidente o aprendizaje en la bitácora del proyecto. También responde a "¿por qué hicimos X?".
---

# /bitacora — Memoria del proyecto

Agente responsable: `@bitacora-keeper`.

## Modo escritura

Si el usuario describe algo que ha pasado o se ha decidido, escribe la entrada
**arriba del todo** de `docs/bitacora/DECISIONS.md`:

```markdown
## YYYY-MM-DD · <título en una línea>

- **Tipo**: decisión | cambio | deuda | incidente | aprendizaje | reversión
- **Contexto**: <qué lo provocó>
- **Decisión / hecho**: <qué se hizo>
- **Alternativas descartadas**: <cuáles y por qué no>
- **Impacto**: <en código, equipo, usuario, coste>
- **Deuda aceptada**: <si la hay + fecha de revisión>
- **Referencias**: spec NNN-slug · ADR-NNNN · PR #N · commit `abc1234`
- **Quién**: <humano / agente>
```

Si la decisión es **estructural**, avisa: necesita además un ADR (`/adr`).

## Modo consulta

Ante "¿por qué hacemos X así?":
1. Busca en `DECISIONS.md`, luego en `docs/architecture/adr/`, luego en `git log`.
2. Responde: **qué se decidió · cuándo · por qué · qué se descartó y por qué**.
3. Si no hay registro, dilo con claridad ("no está documentado") y propón registrarlo ahora,
   mientras alguien todavía recuerda el motivo.

## Qué NO se registra

Renombrados, formateo, correcciones triviales, progreso normal de tareas.
El ruido mata la bitácora: una bitácora que no se lee no sirve para nada.

## Revisión de deuda

Si te lo piden, lista la deuda técnica con fecha de revisión **vencida** y propón:
abordarla, reprogramarla con nueva fecha, o aceptarla definitivamente (y decir por qué).
