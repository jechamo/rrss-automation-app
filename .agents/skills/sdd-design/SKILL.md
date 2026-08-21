---
name: sdd-design
description: Convierte la spec en el documento de diseño de la funcionalidad — flujo de pantallas, estados, componentes y accesibilidad — antes de decidir arquitectura. Úsala cuando la funcionalidad tenga interfaz.
---

# /sdd-design — Cómo se ve y se recorre

Agente responsable: `@ux-designer`; `@spec-analyst` si aparece un requisito nuevo. Se omite solo cuando no existe interfaz.

## Entrada

- `spec.md` aprobada y sin `[NEEDS CLARIFICATION]`.
- Intake review/diseños externos tratados como fuentes, no decisiones.
- Dirección visual y design system disponibles; cualquier contradicción se presenta al usuario.

## Scaffold determinista

```bash
node scripts/sdd-project.mjs scaffold --spec NNN --phase design --json
```

El CLI crea `design.md` desde la plantilla canónica, sin sobrescribir ni aprobar. Si ya existe, léelo y continúa; nunca lo reemplaces.

## Trabajo semántico

1. Confirma la dirección visual con el usuario.
2. Pregunta dudas materiales con recomendación y alternativas.
3. Dibuja flujo completo con errores/fricción en `docs/design/flows/NNN-*.md`.
4. Define seis estados y un elemento con carácter por pantalla.
5. Clasifica componentes reutilizados/extendidos/nuevos y revisa tokens.
6. Recorre accesibilidad y usabilidad; propone `UX-A11Y|FORM|COPY|PERF-NNN`.

Carga [`references/design-gates.md`](references/design-gates.md) cuando haya que crear dirección, formular preguntas, revisar pantallas o cerrar el gate. Carga los checklists A11Y/usabilidad del proyecto solo si son aplicables.

Si cambia producto vuelve a `/sdd-intake`; si aclara alcance vuelve a `/sdd-clarify`. Cero decisiones técnicas en esta fase.

## Cierre

```markdown
### HANDOFF
- Agente origen: ux-designer
- Fase completada: design
- Artefactos y cobertura: <rutas · OBJ→PRD-RF→UC→RF→CA>
- Dirección visual: <estado/aprobación>
- Pantallas/estados/elementos con carácter: <conteos>
- Componentes: <reutiliza/extiende/nuevo>
- Discrepancias y requisitos descubiertos: <lista>
- Accesibilidad/usabilidad y UX-* propuestos: <resultado>
- Preguntas confirmadas / marcadores pendientes: <conteos>
- Siguiente agente sugerido: planner — /sdd-plan
```
