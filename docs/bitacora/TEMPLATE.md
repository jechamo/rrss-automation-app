# Plantilla de entrada de bitácora

Copia este bloque **al principio** de [`DECISIONS.md`](./DECISIONS.md).

```markdown
## YYYY-MM-DD · <título en una línea>

- **Tipo**: decisión | cambio | deuda | incidente | aprendizaje | reversión
- **Contexto**: <qué situación lo provocó>
- **Decisión / hecho**: <qué se hizo>
- **Alternativas descartadas**: <cuáles y por qué no>
- **Impacto**: <qué cambia para el código, el equipo o el usuario>
- **Deuda aceptada**: <si la hay, y cuándo se revisa>
- **Referencias**: spec `NNN-slug` · ADR-NNNN · PR #N · commit `abc1234`
- **Quién**: <humano / agente>
```

---

## Cuándo se escribe una entrada

**Sí:**
- Cambia una decisión técnica
- Se descarta una alternativa ← **lo más valioso que puedes registrar**
- Se añade o elimina una dependencia relevante
- Se acepta deuda técnica
- Cambia un contrato público
- Se detecta y resuelve un incidente
- Cambia el alcance de una spec
- Se descubre algo no obvio del dominio o de una herramienta
- Se revierte algo

**No:**
- Renombrados, formateo, correcciones triviales
- Progreso normal de tareas (eso está en `tasks.md`)

Una bitácora llena de ruido no se lee. Una bitácora que no se lee no sirve para nada.

---

## Los tres niveles

| Nivel | Fichero | Qué registra | Quién escribe |
|---|---|---|---|
| Estructural | `docs/architecture/adr/ADR-NNNN-*.md` | Decisiones con consecuencias duraderas (MADR) | `architect` |
| Diario | `docs/bitacora/DECISIONS.md` | Registro cronológico de decisiones y aprendizajes | `bitacora-keeper` |
| Sesiones | `docs/bitacora/sessions/YYYY-MM.md` | Traza de actividad de los agentes | hook `Stop` |

---

## Revisión de deuda

Cada entrada de tipo `deuda` lleva **fecha de revisión**. Cuando venza:
abordarla · reprogramarla con nueva fecha y motivo · o aceptarla definitivamente
(y escribir por qué). Lo que no se revisa, se convierte en "así ha sido siempre".
