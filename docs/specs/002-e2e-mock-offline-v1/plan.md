# Plan técnico · 002-e2e-mock-offline-v1

| Campo | Valor |
|---|---|
| **Spec** | [`spec.md`](./spec.md) |
| **Estado** | aprobado |
| **Fecha** | 2026-08-27 |
| **Arquitectura vigente** | `docs/architecture/constitution.md` · monolito modular local |
| **ADR relacionados** | ADR-0001; no se requiere uno nuevo |
| **Gate de producto** | `legacy-pending` · FEAT-007 autorizada |
| **Gate funcional** | `approved` |
| **Gate de diseño** | `skipped-no-ui` · no se modifica interfaz |

## 1. Resumen de la solución

Se añade un perfil explícito `mock-e2e` que exige una raíz de datos temporal y una base SQLite
temporal. Un guard de egreso bloquea HTTP externo y capacidades CLI remotas antes de cualquier
efecto. Los puertos de IA y proveedores reciben dobles deterministas centrados en los contratos
propios. Playwright recorre los flujos críticos contra una web fixture local y CI ejecuta la suite
en Windows sin secretos, conservando trazas solo al fallar.

### Trazabilidad y fuentes de entrada

| OBJ | PRD-RF | UC | RF | CA | Componente previsto | Test previsto |
|---|---|---|---|---|---|---|
| OBJ-006 | PRD-RF-015 | UC-013 | RF-01 | CA-01, CA-07 | perfil y raíz de datos | aislamiento y Vault ficticio |
| OBJ-006 | PRD-RF-016, PRD-RF-017 | UC-013 | RF-02 | CA-02, CA-03 | política de egreso y factorías | peticiones/fixtures rechazados |
| OBJ-006 | PRD-RF-018 | UC-013 | RF-03 | CA-04 a CA-08 | fakes, fixture web y Playwright | recorridos críticos |
| OBJ-006 | PRD-RF-018 | UC-013 | RF-04 | CA-08 | runner y workflow | fallo bloqueante y artefacto |

- Fuentes: SRC-017 a SRC-021.
- Discrepancias resueltas: DISC-012 y DISC-013.
- Discrepancias abiertas que bloqueen este corte: ninguna.

## 2. Aplicación de la arquitectura

| Capa | Qué se añade aquí |
|---|---|
| Dominio/aplicación | Contrato pequeño de perfil, política de egreso y reporte determinista. |
| Infraestructura | Adaptadores mock, resolución de raíz de datos y bloqueo de HTTP/CLI. |
| Entrada | Runner E2E, configuración Playwright y endpoint diagnóstico solo en perfil E2E. |

Las dependencias apuntan hacia contratos propios; no se simulan SDK internos ni se mueve el
monolito. Las rutas productivas eligen adaptador mediante una factoría existente o mínima.

## 3. Componentes

### Nuevos

| Componente | Responsabilidad | Ruta prevista |
|---|---|---|
| `e2e-profile` | Validar activación explícita, aislamiento y rutas seguras | `src/core/runtime/e2e-profile.ts` |
| `egress-policy` | Permitir solo loopback y rechazar capacidades no simuladas | `src/core/runtime/egress-policy.ts` |
| `mock-engine` | Respuestas IA deterministas por intención conocida | `src/core/ai/mock-engine.ts` |
| dobles de proveedor | Resultados locales conforme a contratos propios | `src/core/testing/` |
| runner y POM | Orquestar estado temporal, servidor y escenarios | `scripts/run-e2e-mock.mjs`, `e2e/` |

### Modificados

| Componente | Qué cambia | Riesgo de regresión |
|---|---|---|
| almacenamiento local | usa raíz configurable solo cuando está declarada | alto; protege datos existentes |
| factoría IA/proveedores | selecciona fake únicamente con perfil válido | alto; no debe existir fallback real |
| arranque Next | instala el guard en runtime Node | medio |
| CI y checks SDD | añade gate E2E Windows | medio |
| README/estrategia | documenta contrato y operación | bajo |

## 4. Patrones

| Problema | Patrón | Alternativa descartada | Por qué |
|---|---|---|---|
| elegir real/mock | Strategy + Factory | condicionales en cada pipeline | punto único y fallo cerrado |
| representar terceros | Adapter/Fake | mockear SDK o `fetch` por test | prueba el contrato consumidor |
| impedir red | Policy/Guard | confiar en ausencia de claves | una clave accidental no debe habilitar red |
| datos por ejecución | Context Object | cambiar globales durante tests | configuración validada e inmutable |

## 5. Flujo principal

```mermaid
sequenceDiagram
    participant R as Runner
    participant P as Perfil E2E
    participant N as Next local
    participant F as Fakes
    participant B as Playwright
    R->>P: crea raíz temporal + env explícito
    P->>P: valida que no coincide con data normal
    R->>N: prepara SQLite y arranca en loopback
    N->>F: selecciona fakes; instala guard de egreso
    R->>B: ejecuta recorridos y aserciones
    B->>N: UI/API local
    N-->>B: estados persistidos deterministas
    B-->>R: informe, traza solo en fallo, egreso=0
```

## 6. Modelo de datos

No hay cambios Prisma ni migraciones. Ver [`data-model.md`](./data-model.md). La suite usa el mismo
esquema sobre una base nueva y una raíz completa por ejecución; nunca ejecuta reset contra una
ruta no validada.

## 7. Contratos

Ver [`contracts/e2e-runtime.md`](./contracts/e2e-runtime.md). Es un contrato interno aditivo; el
modo normal no cambia y un perfil incompleto se rechaza antes de arrancar.

## 8. Estrategia de test

Ver [`test-plan.md`](./test-plan.md).

| Nivel | Qué se prueba aquí |
|---|---|
| Unitario | validación del perfil, rutas y política de egreso |
| Integración | selección de fakes, persistencia temporal, Vault y no-fallback |
| Contrato | forma y estados de IA/proveedores simulados |
| E2E | arranque, Ajustes, proyecto/dossier y recorridos representativos |

### Calibración

| Módulo / ruta | Tier | Por qué |
|---|---|---|
| `src/core/runtime/**` | CORE | decide aislamiento, datos y egreso |
| `src/core/ai/mock-engine.ts` | IMPORTANT | infraestructura determinista validada por contrato |
| `src/core/testing/**` | IMPORTANT | adaptadores visibles en recorridos |
| `e2e/**`, `playwright.config.ts` | INFRASTRUCTURE | configuración del runner validada al ejecutarla |

Perfil/egreso responde 4/4 hacia verificar: comportamiento estable, fallo crítico, requisito
aprobado y simulable; exige casos exhaustivos. Los recorridos completos usan pocos E2E y estados
exhaustivos en contrato para evitar un cono de pruebas.

## 9. Seguridad

Impacto `sensible`; OWASP ASVS 5.0.0 L2.

| Control | ASVS | OWASP | Aplica | Decisión | Tarea | Test | Evidencia |
|---|---|---|---|---|---|---|---|
| SEC-DATA-001 | ASVS 5.0.0 V8 | A04:2025 | sí | raíz absoluta exclusiva; rechazo de `data/` normal y limpieza acotada | T-002-01 | `src/core/runtime/e2e-profile.test.ts::debe_rechazar_la_raiz_normal_cuando_el_perfil_mock_esta_activo` | `evidence.md#SEC-DATA-001` |
| SEC-EGRESS-002 | ASVS 5.0.0 V13 | A10:2025 | sí | solo loopback; HTTP y capacidad real fallan antes de conectar | T-002-02 | `src/core/runtime/egress-policy.test.ts::debe_bloquear_un_destino_externo_antes_de_invocar_fetch` | `evidence.md#SEC-EGRESS-002` |
| SEC-SECRETS-003 | ASVS 5.0.0 V6/V8 | A02:2025 | sí | CI sin secrets; valores ficticios; errores y artefactos redactados | T-002-03 | `src/core/testing/mock-providers.test.ts::debe_usar_valores_ficticios_sin_fallback_real` | `evidence.md#SEC-SECRETS-003` |
| SEC-MODE-004 | ASVS 5.0.0 V1/V13 | A05:2025 | sí | mock solo con modo exacto y run id; ausencia conserva producción | T-002-01 | `src/core/runtime/e2e-profile.test.ts::debe_conservar_el_modo_normal_cuando_no_se_activa_mock` | `evidence.md#SEC-MODE-004` |

No se añade auth, CORS, cookies, HTML ni SQL manual. Prisma mantiene queries parametrizadas. La
principal amenaza es que un camino evite el fake; el guard de egreso es defensa adicional y el
reporte debe terminar con cero intentos externos permitidos.

Excepción de red SEC-EGRESS-002: responsable `release-manager`; alcance limitado a HTTP(S) hacia
loopback durante el perfil E2E; motivo: comunicar Playwright, Next y la web fixture locales;
aprobada el 2026-08-27 y revisable el 2026-11-27 o antes si cambia el perfil o su allowlist.

### Usabilidad

Impacto `sin-ui`: no se añade o modifica pantalla, formulario, copia ni interacción. Los cuatro
controles UX son no aplicables por ese motivo y no se crea gate de accesibilidad en este corte.

## 10. Rendimiento

| Métrica | Objetivo | Cómo |
|---|---|---|
| suite E2E Windows | < 10 min inicial | fixtures locales, un worker, espera por condición |
| flakes | 0 | datos por ejecución, reloj/ids de fixture y sin `waitForTimeout` |

## 10 bis. Documentación

| DOC-ID | Superficie | Fuente de verdad | Artefacto | Propietario | Tarea | Gate | Evidencia |
|---|---|---|---|---|---|---|---|
| DOC-README-INSTALACION | developer-readme | contrato y runner | `README.md`, `docs/quality/TEST-STRATEGY.md` | docs-writer | T-002-05 | revisión + SDD | `evidence.md#DOC-README-INSTALACION` |

## 11. Observabilidad

- El runner emite JSON con `profile`, capacidades simuladas, bloqueos y duración, sin rutas
  personales, prompts, credenciales ni cuerpos.
- Playwright conserva trace/captura/vídeo solo al fallar; CI los retiene 3 días.
- Un intento externo, una simulación ausente, una raíz insegura o un timeout son errores tipados y
  hacen fallar el gate.
- No se construye panel ni telemetría remota.

## 12. Despliegue

No hay feature flag de producto. `RRSS_E2E_MODE=mock` es un perfil de test deliberado y rechazado
si falta `RRSS_E2E_RUN_ID` o la raíz aislada. El modo normal permanece compatible.

## 13. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| borrar datos reales | containment canónico, nombre de ejecución y limpieza solo de su subárbol |
| fallback real | factory fail-closed + guard de egreso + CI sin secretos |
| mocks engañosos | contratos consumidor y formas mínimas, no SDKs clonados |
| E2E lento/flaky | Page Objects, local fixture, espera por estados, pocos flujos |
| ruta omitida | inventario de I/O y prueba negativa explícita |

## 14. Reversión

Antes del merge: eliminar el worktree/rama no afecta el local. Tras integrar: `git revert <sha>`;
no hay migración ni datos productivos que revertir. Nunca se usa `git reset --hard`, `git clean` ni
`prisma migrate reset`. El runner solo elimina el directorio de su propio `run_id` validado.

## 15. Gate humano del plan técnico

| Campo | Valor |
|---|---|
| **Estado** | `approved` |
| **Aprobado por** | norkc |
| **Fecha** | 2026-08-27 |
| **Condiciones** | sin llamadas/créditos reales; datos locales intactos; sin push/merge sin permiso |

La solución respeta la constitución, cubre RF-01 a RF-04 y no introduce una arquitectura nueva.
