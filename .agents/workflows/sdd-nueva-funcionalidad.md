# Workflow: nueva funcionalidad (circuito B)

Flujo completo para añadir una funcionalidad a un proyecto que **ya tiene** arquitectura
decidida. Ejecuta los pasos en orden; no saltes ninguno.

Reglas del proyecto: @AGENTS.md · Arquitectura: @docs/architecture/constitution.md

---

## 0. Intake cuando la entrada es global

Si el usuario aporta un PRD global, una ruta/carpeta/URL de requisitos o quiere arrancar desde
Figma, Stitch, un boceto o una descripción visual, vuelve al `orchestrator` y ejecuta
`/sdd-intake` según @.agents/skills/sdd-intake/SKILL.md antes de especificar. El diseño es
opcional. Tras aprobar el baseline, crea una spec vertical del `FEATURE-MAP.md`, no una spec
gigante.

Si el proyecto brownfield está `legacy-pending` y la petición es una funcionalidad concreta,
avisa pero no bloquees ni reescribas producto existente. Si el host no delega, indica el perfil y
comando exactos y reanuda desde `docs/product/` y `docs/design/INTAKE-REVIEW.md`.

## 1. Especificar

Adopta el perfil de @.claude/agents/spec-analyst.md.

Crea `docs/specs/NNN-slug/spec.md` con: problema · objetivo medible · usuarios ·
requisitos funcionales en **EARS con prioridad MoSCoW** · requisitos no funcionales · criterios de
aceptación en **Gherkin** · casos límite · reglas de negocio · **fuera de alcance** · riesgos ·
supuestos.

MoSCoW **sobre esfuerzo estimado, no sobre número de requisitos**: must ≤ 60 %, should ~20 %,
could ~20 % como contingencia. Si los must pasan del 60 %, avisa y propón qué bajar.

Por cada duda que cambie el resultado: **pregunta, trae tu recomendación y espera confirmación.**

**Cero tecnología.** Lo que no sepas → `[NEEDS CLARIFICATION: ...]`.

## 2. Clarificar

Mismo perfil. Máximo 5 preguntas por ronda, cada una con opciones concretas y tu recomendación.
Registra en `clarifications.md`. **La spec no avanza con marcadores pendientes.**

## 3. Diseñar (solo si hay interfaz)

Adopta el perfil de @.claude/agents/ux-designer.md. Procedimiento:
@.agents/skills/sdd-design/SKILL.md

**Antes de dibujar**: `docs/design/DIRECCION-VISUAL.md` tiene que existir y estar **aprobada por
el usuario**. Los seis estados y la accesibilidad son un suelo, no un techo: se cumplen enteros y
aun así sale el MVP de cuatro cajas grises.

Produce `docs/specs/NNN-slug/design.md`: flujo **con los caminos de error** · los **seis estados
por pantalla** (vacío, cargando, parcial, error, sin permiso, éxito) · **un elemento con carácter
por pantalla** · componentes clasificados en reutiliza/extiende/nuevo · accesibilidad WCAG 2.2 AA
verificada **sobre el diseño**.

Pregunta antes de dibujar. Requisito nuevo que aparezca aquí → vuelve al paso 1.
**Cero tecnología.** Si la funcionalidad no tiene UI, di por qué se salta y pasa al paso 4.

## 4. Planificar

Adopta el perfil de @.claude/agents/planner.md.

Produce `research.md`, `data-model.md`, `contracts/`, `test-plan.md` y `plan.md`.
Justifica cada patrón aplicado. Consulta a los especialistas de @.claude/agents/ cuando el
tema sea de su terreno.

Si el plan viola la constitución → para y adopta el perfil de @.claude/agents/architect.md
para escribir el ADR correspondiente.

Presenta el plan técnico y espera aprobación humana antes de trocear tareas.

## 5. Trocear

Mismo perfil. `tasks.md` con tareas atómicas, **separadas por middle / front / BBDD**, ordenadas
**de dentro hacia fuera** (domain → application → infrastructure → interfaces), cada una con su
test y su trazabilidad a RF/CA. Las de BBDD van antes que las de middle que dependan de ellas.

## 6. Implementar

Adopta el perfil de @.claude/agents/implementer.md. **Una tarea por ciclo**:

1. 🔴 Test que falla. **Pega la salida real del fallo.**
2. 🟢 Código mínimo. Test verde + suite completa verde. Pega la salida.
3. 🔵 Refactor con SOLID, tests en verde.
4. `tasks.md` → `hecho`.

Según el terreno de la tarea, sigue el procedimiento correspondiente — ahí están las puertas de
entrada, los patrones y la lista de comprobación de cada capa:

- Capa media: @.agents/skills/middle/SKILL.md (perfil @.claude/agents/backend-expert.md)
- Frontend: @.agents/skills/front/SKILL.md (perfil @.claude/agents/frontend-expert.md)
- Base de datos: @.agents/skills/bbdd/SKILL.md (perfil @.claude/agents/database-expert.md)
- Observabilidad: @.agents/skills/observability/SKILL.md (perfil @.claude/agents/devops-expert.md)

## 7. Verificar

Adopta @.claude/agents/code-reviewer.md y luego @.claude/agents/security-auditor.md.

Gates automáticos (tests, cobertura, lint, typecheck, build, auditoría de dependencias),
trazabilidad RF→CA→test, revisión del diff, auditoría SOLID, auditoría de seguridad OWASP.

**CRÍTICO o ALTO en seguridad bloquea la entrega.**

Ejecuta también los verificadores deterministas, que no dependen del IDE ni del modelo:
`node scripts/check-sdd.mjs --strict` y `node scripts/skills-sync.mjs --check`.

## 8. Entregar

Adopta @.claude/agents/release-manager.md.

Verifica la DoD de AGENTS.md §7, prepara el PR con tabla de cobertura, actualiza el CHANGELOG,
registra en `docs/bitacora/DECISIONS.md` y escribe el plan de reversión.

**No hagas push, PR, merge ni deploy sin permiso explícito del usuario.**

---

Al terminar cada paso, cierra con el bloque `### HANDOFF` ampliado de AGENTS.md. Respeta los seis
gates humanos de `docs/sdd/OPERATING-MODEL.md`: producto, arquitectura greenfield, spec, diseño,
plan y entrega.
