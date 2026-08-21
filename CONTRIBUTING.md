# Cómo trabajar en este repositorio

Este proyecto usa **Spec-Driven Development** con un ecosistema de agentes.
La constitución operativa está en [`AGENTS.md`](AGENTS.md) y es vinculante para humanos y agentes.

---

## Regla cero

**Ninguna línea de código se escribe sin una especificación aprobada y un test rojo previo.**

Si tienes prisa, el circuito se recorre igual, solo que más rápido. Saltárselo no ahorra
tiempo: lo traslada a la fase de depuración, donde cuesta diez veces más.

---

## Flujo para una funcionalidad

```
/sdd-specify → /sdd-clarify → /sdd-plan → /sdd-tasks → /sdd-implement → /sdd-verify → /sdd-ship
```

1. **Especifica** el QUÉ en `docs/specs/NNN-slug/spec.md`. Sin tecnología.
2. **Clarifica** las ambigüedades. La spec no avanza con marcadores pendientes.
3. **Planifica** el CÓMO conforme a `docs/architecture/constitution.md`.
4. **Trocea** en tareas atómicas, cada una con su test.
5. **Implementa** en ciclo rojo-verde-refactor, una tarea por ciclo.
6. **Verifica** todos los gates.
7. **Entrega** con PR trazable.

Si no sabes por dónde vas: `/sdd-status`.

---

## Ramas y commits

**Ramas**: `feature/NNN-slug` · `fix/NNN-slug` · `chore/descripcion`

**Commits**: Conventional Commits + id de spec y de tarea.

```
feat(042): permite finalizar la compra sin cuenta — task T-042-07
fix(038): corrige el cálculo del IVA en pedidos internacionales — task T-038-03
refactor(042): extrae PriceCalculator de OrderService — task T-042-11
```

Tipos: `feat` `fix` `refactor` `perf` `test` `docs` `build` `ci` `chore`.
Cambio rompedor: `feat(042)!:` y sección `BREAKING CHANGE:` en el cuerpo.

---

## Antes de abrir un PR

Ejecuta `/sdd-verify` y comprueba la
[Definition of Done](docs/quality/DEFINITION-OF-DONE.md):

- [ ] Suite completa en verde, **con la salida pegada**
- [ ] Lint, formato y tipos sin warnings
- [ ] Cada criterio de aceptación de la spec tiene un test
- [ ] Cobertura de dominio/aplicación ≥ 80 %
- [ ] Sin hallazgos de seguridad CRÍTICO ni ALTO
- [ ] Sin violaciones SOLID sin justificar
- [ ] Contratos y documentación actualizados
- [ ] Migraciones reversibles y compatibles hacia atrás
- [ ] Entrada en la bitácora si hubo decisión relevante
- [ ] `tasks.md` al día

---

## Decisiones

| Tipo de decisión | Dónde se registra |
|---|---|
| Estructural, con consecuencias duraderas | ADR en `docs/architecture/adr/` (`/adr`) |
| Técnica relevante, alternativa descartada, deuda aceptada | `docs/bitacora/DECISIONS.md` (`/bitacora`) |
| Trivial y reversible en una tarde | En ningún sitio |

**Ninguna decisión arquitectónica vive solo en el chat.** El chat se pierde.

---

## Trabajando con los agentes

- Empieza por `@orchestrator` si no sabes qué agente necesitas.
- Los agentes de fase hacen handoff explícito; los especialistas devuelven el control.
- Un agente que te propone saltarse una fase está haciéndolo mal: recuérdaselo.
- Si un agente dice que algo funciona **sin enseñarte la salida de los tests**, no lo creas.
- Ante ambigüedad que cambie el resultado, el agente debe preguntar, no adivinar.

Catálogo: [`docs/agents/CATALOG.md`](docs/agents/CATALOG.md).

---

## Lo que no se hace aquí

- Código sin spec ni test rojo previo.
- Lógica de negocio en controladores, componentes de UI o triggers de BD.
- Importar infraestructura desde el dominio.
- Añadir una dependencia sin justificarla en `research.md`.
- SQL concatenado. Secretos en el repositorio.
- Refactorizar fuera del alcance de la tarea sin acordarlo.
- `git push --force`, borrar ramas o tocar producción sin permiso explícito.
- Marcar algo como terminado sin ejecutar los tests y mostrar la salida real.
