---
name: sdd-verify
description: "Verifica el trabajo antes de entregar. Ejecuta todos los gates de calidad: tests, cobertura, lint, revisión de código, principios de diseño y auditoría de seguridad."
---

# /sdd-verify — Validar

Coordina `code-reviewer` read-only; consulta security-auditor, refactor-specialist y test-engineer según impacto.

## Preparar y ejecutar

Si falta evidence, crea solo el esqueleto:

```bash
node scripts/sdd-project.mjs scaffold --spec NNN --phase verify --json
node scripts/sdd-project.mjs trace-status --spec NNN --json
node scripts/check-sdd.mjs --json --strict --spec NNN
node scripts/sdd-project.mjs run --slow --json
```

Pega o persiste la salida real. Si un gate requerido falla o queda NO EJECUTADO, para; no revises como entregable código que no compila/pasa.

## Verificar por excepción

Usa `trace-status` para abrir solo familias huérfanas/no resueltas. Comprueba que todo CA tiene test, todas las tareas de alcance están hechas y no hay código sin tarea.

Carga [`references/review-checklists.md`](references/review-checklists.md) solo para los impactos reales:

- siempre: diff, calidad de suite y evidencia;
- sensible: seguridad OWASP/ASVS e informe parseable;
- UI: WCAG/Nielsen, a11y automático y manual;
- cambios operativos: observabilidad, métricas, deuda, migración y reversión.

`security-auditor` y `code-reviewer` son read-only. `docs-writer` puede materializar literalmente sus HANDOFF; no reinterpreta veredictos. CRÍTICO/ALTO bloquea. MEDIO exige aceptación durable. Ausente/no ejecutado nunca equivale a verde.

## Informe

Materializa `docs/quality/reports/YYYY-MM-DD-NNN-slug.md` y actualiza `evidence.md` con comando, resultado y artefacto. Mantén NO-GO hasta aprobación humana.

## Cierre

```markdown
### HANDOFF
- Agente origen: code-reviewer
- Gates y trazabilidad: <resultado · CA cubiertos>
- Revisión/diseño/suite: <hallazgos>
- Cobertura y tiers: <CORE/IMPORTANT/sin tier>
- Seguridad/usabilidad: <conteos · informes · controles no ejecutados>
- Observabilidad/deuda: <resultado>
- Veredicto: APTO PARA ENTREGA | REQUIERE CAMBIOS
- Siguiente agente sugerido: implementer | release-manager — /sdd-ship
```
