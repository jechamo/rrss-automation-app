# Tareas · NNN-slug

| Campo | Valor |
|---|---|
| **Spec** | [`spec.md`](./spec.md) · **Plan**: [`plan.md`](./plan.md) |
| **Total** | 0 tareas · S: 0 · M: 0 · L: 0 |
| **Progreso** | 0/0 |

---

## Trazabilidad

| OBJ | PRD-RF | UC | RF | CA | Tarea | Test | Evidencia |
|---|---|---|---|---|---|---|---|
| OBJ-001 | PRD-RF-001 | UC-001 | RF-01 | CA-01 | T-NNN-01 | `tests/...` | `evidence.md#T-NNN-01` |

- [ ] Todo RF tiene al menos una tarea
- [ ] Todo CA tiene un test en alguna tarea
- [ ] Ninguna tarea sin RF ni justificación transversal
- [ ] Ningún OBJ, PRD-RF o UC referenciado es huérfano

---

## Orden de ejecución

> De dentro hacia fuera: `domain` → `application` → `infrastructure` → `interfaces` → transversal.
> Nunca empieces por la pantalla ni por la tabla.

### T-NNN-01 · <título imperativo>
- **Estado**: pendiente
- **Terreno**: `<middle / front / bbdd / contratos / test / docs / tooling>`
- **Skill**: `</middle / /front / /bbdd / /tdd / otra aplicable>`
- **Capa**: domain
- **Cubre**: OBJ-001, PRD-RF-001, UC-001, RF-01, CA-01
- **Controles de seguridad**: `SEC-<ID>` \| `no aplica (<justificación material>)`
- **Controles de usabilidad**: `UX-<ID>` \| `no aplica (<justificación material>)`
- **Documentación**: `DOC-<ID>` \| `no aplica (<motivo material>)`
- **Test que la define**: `tests/domain/<...>.test.ts::debe_<comportamiento>_cuando_<condición>`
- **Depende de**: ninguna
- **Ficheros previstos**: `src/domain/<...>`
- **Definición de hecho**: <condición observable>
- **Evidencia prevista**: `evidence.md#T-NNN-01`
- **Estimación**: S
- **Paralelizable**: no

### T-NNN-02 · <título>
- **Estado**: pendiente
- **Terreno**: `<...>`
- **Skill**: `<...>`
- **Capa**: application
- **Cubre**: OBJ-001, PRD-RF-001, UC-001, RF-01
- **Controles de seguridad**: `SEC-<ID>` \| `no aplica (<justificación material>)`
- **Controles de usabilidad**: `UX-<ID>` \| `no aplica (<justificación material>)`
- **Documentación**: `DOC-<ID>` \| `no aplica (<motivo material>)`
- **Test que la define**: `…`
- **Depende de**: T-NNN-01
- **Ficheros previstos**: `…`
- **Definición de hecho**: <…>
- **Evidencia prevista**: `evidence.md#T-NNN-02`
- **Estimación**: M
- **Paralelizable**: `[P]`

---

## Tareas transversales (no las olvides)

- [ ] Migración de datos existentes
- [ ] Actualización de contratos y regeneración de tipos
- [ ] Logs, métricas y trazas de los caminos nuevos
- [ ] Casos de abuso y controles de seguridad aplicables, cada uno con test y evidencia
- [ ] Auditoría `/security-scan`; `security-auditor` devuelve HANDOFF y `docs-writer` materializa
- [ ] Controles de usabilidad aplicables, cada uno con test y evidencia
- [ ] Auditoría de usabilidad en `/sdd-verify`; `code-reviewer` devuelve HANDOFF y `docs-writer` materializa
- [ ] Documentación de usuario o de API
- [ ] Retirada del feature flag tras estabilizar
- [ ] Entrada en `docs/bitacora/DECISIONS.md`

---

**Estados**: `pendiente` · `en curso` · `hecho` · `bloqueado`
**Estimaciones**: `S` (< 2 h) · `M` (medio día) · `L` (más — pártela)
