# Tareas · 002-e2e-mock-offline-v1

| Campo | Valor |
|---|---|
| **Spec** | [`spec.md`](./spec.md) · `approved` |
| **Plan** | [`plan.md`](./plan.md) · `approved` por norkc, 2026-08-27 |
| **Total** | 5 tareas · S: 0 · M: 4 · L: 1 |
| **Progreso** | 5/5 |
| **Impacto de seguridad** | `sensible` · ASVS 5.0.0 L2 |
| **Impacto de usabilidad** | `sin-ui` |
| **Impacto de documentación** | `aplicable · DOC-README-INSTALACION` |

## Trazabilidad

| OBJ | PRD-RF | UC | RF | CA | Tarea | Test | Evidencia |
|---|---|---|---|---|---|---|---|
| OBJ-006 | PRD-RF-015 | UC-013 | RF-01 | CA-01, CA-07 | T-002-01 | `e2e-profile.test.ts` | `evidence.md#T-002-01` |
| OBJ-006 | PRD-RF-016, PRD-RF-017 | UC-013 | RF-02 | CA-02, CA-03 | T-002-02 | `egress-policy.test.ts` | `evidence.md#T-002-02` |
| OBJ-006 | PRD-RF-018 | UC-013 | RF-03 | CA-03, CA-05, CA-06, CA-07 | T-002-03 | `mock-engine.test.ts`, `mock-providers.test.ts` | `evidence.md#T-002-03` |
| OBJ-006 | PRD-RF-018 | UC-013 | RF-03 | CA-04 a CA-08 | T-002-04 | `e2e/*.spec.ts` | `evidence.md#T-002-04` |
| OBJ-006 | PRD-RF-018 | UC-013 | RF-04 | CA-08 | T-002-05 | workflow + `run --slow` | `evidence.md#T-002-05` |

- [x] Todo RF tiene al menos una tarea.
- [x] Todo CA tiene un test en alguna tarea.
- [x] Ninguna tarea carece de cadena de producto o justificación transversal.
- [x] Cada control de seguridad tiene tarea, test y evidencia previstos.

## Orden de ejecución

### T-002-01 · Aislar el perfil y toda la raíz de datos

- **Estado**: hecho
- **Terreno**: middle
- **Skill**: `/middle`, `/tdd`
- **Capa**: application/infrastructure
- **Cubre**: OBJ-006 → PRD-RF-015 → UC-013 → RF-01 → CA-01, CA-07
- **Controles de seguridad**: SEC-DATA-001, SEC-MODE-004
- **Controles de usabilidad**: no aplica; no modifica UI
- **Documentación**: no aplica directamente
- **Test que la define**: `src/core/runtime/e2e-profile.test.ts::debe_rechazar_la_raiz_normal_cuando_el_perfil_mock_esta_activo`
- **Prueba adicional**: SEC-MODE-004 · T-002-01 · `src/core/runtime/e2e-profile.test.ts::debe_conservar_el_modo_normal_cuando_no_se_activa_mock`
- **Depende de**: ninguna
- **Ficheros previstos**: `src/core/runtime/`, módulos dueños de persistencia local, `package.json`
- **Definición de hecho**: DB, Vault, sesiones, cachés y medios usan una raíz exclusiva en mock; el modo normal mantiene sus rutas; rutas inseguras fallan antes de I/O.
- **Evidencia prevista**: `evidence.md#T-002-01`
- **Estimación**: L
- **Paralelizable**: no

### T-002-02 · Bloquear todo egreso no local y capacidades reales

- **Estado**: hecho
- **Terreno**: middle
- **Skill**: `/middle`, `/security-scan`, `/tdd`
- **Capa**: application/infrastructure
- **Cubre**: OBJ-006 → PRD-RF-016, PRD-RF-017 → UC-013 → RF-02 → CA-02, CA-03
- **Controles de seguridad**: SEC-EGRESS-002, SEC-SECRETS-003
- **Controles de usabilidad**: no aplica; no modifica UI
- **Documentación**: contrato `contracts/e2e-runtime.md`
- **Test que la define**: `src/core/runtime/egress-policy.test.ts::debe_bloquear_un_destino_externo_antes_de_invocar_fetch`
- **Depende de**: T-002-01
- **Ficheros previstos**: `src/core/runtime/egress-policy.ts`, `src/instrumentation.ts`, adaptadores CLI/HTTP
- **Definición de hecho**: solo loopback se permite; URL/capacidad desconocida devuelve error tipado y nunca llama al adaptador real.
- **Evidencia prevista**: `evidence.md#T-002-02`
- **Estimación**: M
- **Paralelizable**: no

### T-002-03 · Proveer fakes deterministas por contrato

- **Estado**: hecho
- **Terreno**: middle/contratos
- **Skill**: `/middle`, `/tdd`
- **Capa**: infrastructure
- **Cubre**: OBJ-006 → PRD-RF-018 → UC-013 → RF-03 → CA-03, CA-05, CA-06, CA-07
- **Controles de seguridad**: SEC-EGRESS-002, SEC-SECRETS-003
- **Controles de usabilidad**: no aplica; no modifica UI
- **Documentación**: contrato `contracts/e2e-runtime.md`
- **Test que la define**: `src/core/ai/mock-engine.test.ts::debe_fallar_cerrado_cuando_no_hay_fixture`
- **Prueba adicional**: SEC-SECRETS-003 · T-002-03 · `src/core/testing/mock-providers.test.ts::debe_usar_valores_ficticios_sin_fallback_real`
- **Depende de**: T-002-02
- **Ficheros previstos**: `src/core/ai/`, `src/core/testing/`, factorías de proveedores
- **Definición de hecho**: IA y proveedores críticos generan formas/estados locales repetibles; una intención ausente nunca recurre a red, CLI o descarga.
- **Evidencia prevista**: `evidence.md#T-002-03`
- **Estimación**: M
- **Paralelizable**: no

### T-002-04 · Ejecutar los recorridos críticos con Playwright

- **Estado**: hecho
- **Terreno**: test/tooling
- **Skill**: `/sdd-implement`, `/tdd`
- **Capa**: interfaces
- **Cubre**: OBJ-006 → PRD-RF-018 → UC-013 → RF-03 → CA-04, CA-05, CA-06, CA-07, CA-08
- **Controles de seguridad**: SEC-DATA-001, SEC-EGRESS-002, SEC-SECRETS-003
- **Controles de usabilidad**: no aplica al cambio; se asertan roles/textos existentes
- **Documentación**: no aplica directamente
- **Test que la define**: `e2e/00-smoke.spec.ts::debe_abrir_una_instalacion_vacia_sin_claves`
- **Depende de**: T-002-03
- **Ficheros previstos**: `playwright.config.ts`, `scripts/run-e2e-mock.mjs`, `e2e/`, `.gitignore`
- **Definición de hecho**: los recorridos acordados pasan en una ruta con espacios, un worker, sin sleeps, secretos ni red; trazas solo en fallo.
- **Evidencia prevista**: `evidence.md#T-002-04`
- **Estimación**: M
- **Paralelizable**: no

### T-002-05 · Convertir la suite en gate Windows y documentarla

- **Estado**: hecho
- **Terreno**: devops/docs
- **Skill**: `/sdd-verify`, `/security-scan`, `/sdd-ship`
- **Capa**: transversal
- **Cubre**: OBJ-006 → PRD-RF-018 → UC-013 → RF-04 → CA-08
- **Controles de seguridad**: SEC-SECRETS-003, SEC-MODE-004
- **Controles de usabilidad**: no aplica; no modifica UI
- **Documentación**: DOC-README-INSTALACION
- **Test que la define**: workflow ejecuta `npm run test:e2e` en Windows sin bloque `secrets` y falla ante un escenario rojo
- **Depende de**: T-002-04
- **Ficheros previstos**: `.github/workflows/`, `.sdd/checks.json`, `README.md`, `docs/quality/TEST-STRATEGY.md`, bitácora y evidencia
- **Definición de hecho**: E2E es gate lento real, artefactos de fallo duran 3 días, documentación es reproducible y todos los gates/auditorías están verdes.
- **Evidencia prevista**: `evidence.md#T-002-05`
- **Estimación**: M
- **Paralelizable**: no

## Tareas transversales

- [x] No hay migración de datos ni feature flag productivo.
- [x] Contratos y observabilidad del runner actualizados.
- [x] Casos de abuso y controles de seguridad ejecutados.
- [x] Auditoría `/security-scan` materializada.
- [x] Usabilidad no aplica porque no hay cambio de UI; se revisará que el diff lo conserve.
- [x] README, estrategia, bitácora y evidencia actualizados.

**Estados**: `pendiente` · `en curso` · `hecho` · `bloqueado`
