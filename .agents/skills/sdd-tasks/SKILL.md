---
name: sdd-tasks
description: Trocea el plan en tareas atómicas y ordenadas, cada una con su test asociado y su trazabilidad a la spec.
---

# /sdd-tasks — Trocear

Agente responsable: `@planner`.

## Puerta de entrada

`plan.md`, `data-model.md`, `contracts/` y `test-plan.md` existen y son coherentes con `spec.md`.
El gate humano del plan consta como `approved`, con actor, fecha y alcance. Sin esa confirmación,
no se crea `tasks.md`.

Ejecuta `node scripts/sdd-project.mjs scaffold --spec NNN --phase tasks --json`. Completa el
esqueleto canónico; el CLI no descompone el plan, no inventa tareas y nunca sobrescribe.

## Formato de tarea

```markdown
### T-NNN-XX · <título imperativo>
- Estado: pendiente
- Terreno: middle | front | bbdd | contratos | test | infra | docs
- Skill: /middle | /front | /bbdd | <otra skill aplicable> | — (justificado)
- Capa: domain | application | infrastructure | interfaces | test | infra | docs
- Cubre: OBJ-001 → PRD-RF-003 → UC-002 → RF-03 → CA-05
- Controles de seguridad: SEC-<ID> | no aplica (<justificación material>)
- Controles de usabilidad: UX-<ID> | no aplica (<justificación material>)
- Documentación: DOC-<ID> | no aplica (<motivo material>)
- Test que la define: `tests/domain/order/place_order.test.ts::debe_rechazar_cuando_stock_insuficiente`
- Depende de: T-NNN-YY  (o "ninguna")
- Ficheros previstos: `src/domain/order/Order.ts`
- Definición de hecho: <condición observable y verificable>
- Estimación: S | M | L
- Paralelizable: [P] sí | no
```

## Reglas del troceo

1. **Atómica**: una sesión, un concepto, idealmente un commit. Si tarda más de medio día,
   pártela.
2. **Toda tarea de producto nace de un test.** Si no puedes nombrar el test que la define,
   la tarea está mal cortada o falta información del plan.
3. **Orden por dependencias, de dentro hacia fuera**:
   ```
   1. domain          entidades, value objects, puertos
   2. application     casos de uso
   3. infrastructure  adaptadores, repositorios, migraciones
   4. interfaces      controladores, UI
   5. transversal     observabilidad, documentación, limpieza de flags
   ```
   **Nunca** empieces por la pantalla ni por la tabla: empezar por fuera lleva a diseñar el
   dominio para encajar en la UI o en el ORM.
4. **Separa por terreno y da a cada tarea su skill**: `middle`, `front`, `bbdd` u
   `observability`. No es burocracia: cada terreno tiene puertas de entrada y comprobaciones
   distintas, y la tarea entra por la skill que las aplica. Una tarea que mezcla varios está mal
   cortada.
   Orden entre terrenos: **bbdd antes que middle** cuando el esquema es prerrequisito, y
   **contratos antes que front** siempre —sin contrato, el front adivina la respuesta.
5. Marca `[P]` las tareas que tocan ficheros disjuntos y pueden ir en paralelo. Con el contrato
   fijado, front y middle **sí** pueden ir en paralelo: es la razón de que el contrato vaya antes.
6. **El orden respeta MoSCoW**: todos los *must* antes del primer *should*. Si el trabajo se corta
   por tiempo, lo que queda fuera debe ser lo que la spec ya marcó como sacrificable.
7. Incluye tareas que se olvidan siempre:
   - migración de datos existentes
   - actualización de contratos y regeneración de tipos
   - logs, métricas y trazas de los caminos nuevos
   - **instrumentación de errores y alertas** de los caminos nuevos, con skill `observability`:
     es la tarea que más se olvida, porque el circuito termina en el despliegue y el problema
     empieza justo después
   - documentación de usuario o de API
   - eliminación del feature flag tras la estabilización
   - actualización de la bitácora
8. **Toda tarea declara Terreno y Skill.** Usa `—` solo para una tarea transversal que no tenga
   una skill aplicable y explica el motivo. La trazabilidad no se infiere por el título.
9. **Cadena total**: una tarea de producto enlaza `OBJ-*`, `PRD-RF-*`, `UC-*`, `RF-*` y `CA-*`.
   Una tarea transversal sin `CA` necesita una justificación y debe enlazar el riesgo, gate o
   artefacto que la exige.
10. Si `Impacto de seguridad = sensible`, **cada tarea declara `Controles de seguridad`**. Todo
    `SEC-*` aplicable de `plan.md` aparece al menos en una tarea y conserva test/evidencia. `no
    aplica` repite la justificación material; no vale `n/a` sin motivo.
11. Incluye casos de abuso y auditoría `/security-scan verify`. El `security-auditor` es solo
    lectura y devuelve HANDOFF; el agente que lo invocó puede delegar en `docs-writer` la
    materialización literal de `docs/security/reports/YYYY-MM-DD-NNN-slug.md`.
12. Si `Impacto de usabilidad = aplicable`, **cada tarea de interfaz declara `Controles de
    usabilidad`**. Todo `UX-*` aplicable de `plan.md` §9.3 aparece al menos en una tarea y conserva
    test/evidencia. `no aplica` repite la justificación material. Una tarea de UI no está completa
    sin sus estados: vacío, cargando, parcial, error, sin permiso y éxito no son tareas aparte,
    son parte de la misma.
13. Incluye la auditoría de usabilidad de `/sdd-verify`. El `code-reviewer` es solo lectura y
    devuelve HANDOFF; el agente que lo invocó puede delegar en `docs-writer` la materialización
    literal de `docs/design/reports/YYYY-MM-DD-NNN-slug.md`.
14. Si `Impacto de documentación = aplicable`, crea una tarea real por artefacto mantenible,
    dependiente de la estabilización de su fuente. Conserva `DOC-ID`, propietario, artefacto,
    gate y evidencia. Código y docs pueden vivir en commits distintos del mismo PR.

## Verificación de cobertura

Ejecuta `node scripts/sdd-project.mjs trace-status --spec NNN --json` y resuelve todos los
huérfanos reales. El snapshot detecta IDs; decidir el corte atómico sigue siendo trabajo del
`planner`.

Construye la tabla de trazabilidad y comprueba que **no queda hueco**:

| OBJ | PRD-RF | UC | RF | CA | Tareas | Test / evidencia esperada |
|---|---|---|---|---|---|---|
| OBJ-001 | PRD-RF-001 | UC-001 | RF-01 | CA-01, CA-02 | T-042-01, T-042-03 | `<id o ruta>` |

- [ ] Todo `RF` tiene al menos una tarea
- [ ] Todo `CA` tiene un test en alguna tarea
- [ ] Toda tarea de producto cubre la cadena `OBJ → PRD-RF → UC → RF → CA`
- [ ] Toda tarea declara Terreno y Skill, o justifica `—`
- [ ] Toda tarea apunta a un `RF` y `CA`, o es transversal justificada
- [ ] No hay tareas que la spec no pida
- [ ] Todo control aplicable de seguridad tiene tarea, test y evidencia previstos
- [ ] Todo control aplicable de usabilidad tiene tarea, test y evidencia previstos
- [ ] Toda tarea de interfaz cubre los seis estados, no solo el camino feliz
- [ ] Todo control no aplicable conserva una justificación material

## Salida

Escribe `docs/specs/NNN-slug/tasks.md` con: resumen (total, por capa, estimación),
la tabla de trazabilidad, y las tareas en orden de ejecución.

## Cierre

```
### HANDOFF
- Agente origen: planner
- Fase completada: tasks
- Artefacto: docs/specs/NNN-slug/tasks.md
- Tareas: <n> (S:<n> M:<n> L:<n>) · paralelizables: <n>
- Cobertura: <n>/<n> OBJ · <n>/<n> PRD-RF · <n>/<n> UC · <n>/<n> RF · <n>/<n> CA
- Terrenos / skills: <resumen y excepciones justificadas>
- Seguridad: <sensible/no-sensible/security-pending> · <controles cubiertos/total>
- Usabilidad: <aplicable/sin-ui/ux-pending> · <controles cubiertos/total>
- Primera tarea a ejecutar: T-NNN-01
- Siguiente agente sugerido: implementer — comando: /sdd-implement
```
