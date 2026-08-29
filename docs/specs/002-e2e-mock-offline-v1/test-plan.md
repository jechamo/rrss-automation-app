# Plan de pruebas · 002-e2e-mock-offline-v1

| CA | Nivel | Caso | Resultado esperado |
|---|---|---|---|
| CA-01 | unitario/integración | rutas normales, ancestros, espacios y dos run ids | solo raíces exclusivas válidas; datos normales intactos |
| CA-02 | unitario/E2E | HTTP(S) loopback vs DNS/IP externa; route browser | loopback permitido; externo bloqueado antes de conexión |
| CA-03 | contrato | intención/capacidad conocida y desconocida | fixture conocida; error tipado sin fallback |
| CA-04 | E2E | health, dashboard y Ajustes sin claves | páginas disponibles y degradación visible |
| CA-05 | E2E | proyecto contra web fixture local | run observable y dossier persistido |
| CA-06 | contrato/E2E | ramas fal y avatar/voz | estados deterministas y assets locales |
| CA-07 | integración/E2E | login ficticio, contenido propio y reanudación de clips | contraseña no sale; terminado no se regenera |
| CA-08 | contrato/CI | timeout, fixture inválida y test roto sintético | error seguro, informe y exit code no cero |

## Orden TDD

1. Perfil/raíz: RED por módulo ausente; GREEN validando contrato; refactor con errores tipados.
2. Egreso: RED aceptando URL externa; GREEN con allowlist; refactor compartiendo clasificación.
3. Fakes: RED por intención ausente; GREEN por fixture; refactor hacia puertos propios.
4. Runner/E2E: RED sin configuración; GREEN por recorrido; refactor a Page Objects.
5. CI/docs: validar scripts, workflow y trazabilidad con los gates completos.

## Entorno y fixtures

- Windows, Node fijado por CI, `npm ci`, Chromium de Playwright.
- Un worker. Web fixture solo en loopback. Sin variables secretas ni red externa.
- Datos bajo `.e2e-runtime/<runId>/`; rutas con espacios incluidas.
- Trace, screenshot y vídeo solo al fallar; no se sube la raíz de datos.

## Negativas obligatorias

- Modo mock sin run id o con ruta normal.
- `DATABASE_URL` fuera de la raíz.
- URL con credenciales, dominio externo, IPv6 no loopback y esquema inesperado.
- Prompt/capacidad sin fixture.
- Secretos reales presentes en el entorno no alteran la selección mock.
- Timeout y respuesta simulada inválida generan fallo bloqueante.

## Controles de seguridad y documentación

| Control | Tarea | Test concreto |
|---|---|---|
| SEC-DATA-001 | T-002-01 | `src/core/runtime/e2e-profile.test.ts::debe_rechazar_la_raiz_normal_cuando_el_perfil_mock_esta_activo` |
| SEC-EGRESS-002 | T-002-02 | `src/core/runtime/egress-policy.test.ts::debe_bloquear_un_destino_externo_antes_de_invocar_fetch` |
| SEC-SECRETS-003 | T-002-03 | `src/core/testing/mock-providers.test.ts::debe_usar_valores_ficticios_sin_fallback_real` |
| SEC-MODE-004 | T-002-01 | `src/core/runtime/e2e-profile.test.ts::debe_conservar_el_modo_normal_cuando_no_se_activa_mock` |
| DOC-README-INSTALACION | T-002-05 | revisión + SDD de `README.md` y `docs/quality/TEST-STRATEGY.md`; gate `node scripts/check-sdd.mjs --spec 002 --json` |

## Evidencia

Cada tarea registra comando RED, causa esperada, comando GREEN y salida final en `evidence.md`.
La verificación final ejecuta `run --slow`, build limpio y el workflow E2E equivalente localmente.
