---
name: sdd-plan
description: Convierte una spec aprobada en plan técnico, modelo de datos, contratos e investigación. Aquí se decide el CÓMO, conforme a la arquitectura vigente.
---

# /sdd-plan — Cómo

Agente responsable: `@planner`, con consulta a especialistas.

## Entrada

- Spec aprobada, sin marcadores y con OBJ→PRD-RF→UC→RF→CA.
- `design.md` aprobado si hay UI; constitución y ADR vigentes.
- Impactos de seguridad, usabilidad y documentación válidos; una spec nueva no usa estados pending.
- MoSCoW de la spec ordena el plan: must antes de could.

## Scaffold

```bash
node scripts/sdd-project.mjs scaffold --spec NNN --phase plan --json
node scripts/sdd-project.mjs trace-status --spec NNN --json
```

El scaffold crea `plan.md`, `data-model.md`, `research.md` y `contracts/` sin decisiones ni overwrite. El snapshot señala IDs huérfanos; no valida significado.

## Decidir

1. Investiga cada decisión no trivial en documentación actual y registra opciones, criterios, elegida, descartes y coste. Incluye no añadir nada.
2. Consulta especialistas solo donde aplica y recupera el control.
3. Define capas/componentes/rutas, patrones justificados, flujo, datos/migración, contratos/versionado y test-plan.
4. Declara tiers de cobertura, seguridad/amenazas, UX, rendimiento, observabilidad, flags, despliegue, riesgos y reversión.
5. Para documentación aplicable conserva DOC-ID, fuente, artefacto, owner, tarea, gate y evidencia.

Para matrices y cruces detallados carga [`references/coherence-and-gates.md`](references/coherence-and-gates.md). Si hay JWT/cookies lee `docs/security/AUTH-TOKENS.md`; si hay UI, los checklists A11Y/usabilidad; si no, no cargues esos documentos.

## Seguridad y usabilidad

Una spec sensible delega `/security-scan plan` en `security-auditor` read-only. Cada control usa la matriz exacta del template y salida material. Para UX aplicable, consulta ux/frontend y conserva WCAG 2.2 AA/Nielsen, velocidad percibida y reversión de optimistas.

## Gate humano

Contrasta artefactos y resuelve huecos. Presenta enfoque, componentes, dependencias, migraciones, riesgos, coste y reversión. Registra `approved/rejected/cambios`, actor, fecha y alcance; pausa. Sin aprobación no hay `tasks.md`.

## Cierre

```markdown
### HANDOFF
- Agente origen: planner
- Fase completada: plan
- Artefactos: plan/research/data-model/contracts/test-plan
- Cobertura: <OBJ→PRD-RF→UC→RF→CA→test>
- Decisiones/patrones/dependencias: <resumen>
- Seguridad/UX/DOC: <controles y huecos>
- Conformidad: <OK o ADR requerido>
- Gate humano: <actor/fecha/alcance>
- Siguiente agente sugerido: planner — /sdd-tasks
```
