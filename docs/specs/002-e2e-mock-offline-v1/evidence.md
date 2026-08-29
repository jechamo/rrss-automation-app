# Evidencia · 002-e2e-mock-offline-v1

Estado: implementación verificada localmente el 2026-08-28, con revisión de código GO y auditoría
independiente de seguridad APTO. Ningún proveedor real, secreto ni dato de la instalación local
forma parte de esta evidencia.

## T-002-01

- T-002-01 · `declared-direct`: implementada directamente en este task de Codex; el host no emitió
  hooks de escritura SDD para esta ejecución.
- RED: el primer `vitest` del perfil produjo 5 aserciones fallidas porque el módulo todavía no
  aplicaba aislamiento.
- GREEN dirigido: `e2e-profile.test.ts` terminó con 6/6 casos.
- GREEN final: `npm test` incluyó `e2e-profile.test.ts` 6/6 y
  `e2e-isolation.test.mjs` 4/4.
- CA-01: la prueba sintética creó una SQLite normal con 1 proyecto y 1 pieza, Vault, sesión y medio;
  ejecutó dos `run_id` diferentes, limpió solo cada subárbol y conservó exactamente hashes SHA-256
  y conteos tras ambos.

## SEC-DATA-001

SEC-DATA-001 · T-002-01 · `src/core/runtime/e2e-profile.test.ts::debe_rechazar_la_raiz_normal_cuando_el_perfil_mock_esta_activo`.

Superado por los 10 casos anteriores. `resolveRuntimeProfile` exige la ruta absoluta exacta
`.e2e-runtime/<runId>/data`; la limpieza compartida valida el `runRoot` antes de eliminarlo y el
runner rechaza concurrencia mediante `runner.lock`. La instantánea de fuente no copia `.env*` y el
entorno hijo usa allowlist; el teardown espera al hijo incluso tras `SIGKILL` y libera el lock en
`finally` aunque el borrado falle.

## SEC-MODE-004

SEC-MODE-004 · T-002-01 · `src/core/runtime/e2e-profile.test.ts::debe_conservar_el_modo_normal_cuando_no_se_activa_mock`.

Superado: modo ausente conserva `<proyecto>/data`; modo distinto de `mock`, `run_id` inválido,
SQLite externa o raíz normal devuelven `E2E_PROFILE_INVALID` antes de I/O.

## T-002-02

- T-002-02 · `declared-direct`: implementada directamente y contrastada además por auditoría
  independiente; el host no emitió hooks de escritura SDD.
- RED del refuerzo de seguridad: `npx vitest run ...egress-policy... ...mock-runtime...` terminó
  con 3 fallos y 17 casos superados (redirección automática, barrera global y contador real aún
  ausentes).
- GREEN dirigido y final: egreso terminó con 20/20 casos y runtime con 6/6.
- GREEN E2E: la API de prueba usó `fetch` global sin wrapper local; devolvió
  `E2E_EGRESS_BLOCKED`, con 1 intento rechazado, 18 peticiones loopback medidas y 0 externas.
- Las redirecciones automáticas quedan desactivadas; `localhost` resuelve y valida todas sus
  direcciones antes de conectar; cualquier otro nombre, IP no loopback, credenciales o protocolo
  falla cerrado.

## SEC-EGRESS-002

SEC-EGRESS-002 · T-002-02 · `src/core/runtime/egress-policy.test.ts::debe_bloquear_un_destino_externo_antes_de_invocar_fetch`.

Superado por `src/instrumentation.ts`, 20 casos unitarios y el recorrido E2E global. El runner
convierte en fallo tanto la ausencia del informe como `performedExternalRequests !== 0`.

## T-002-03

- T-002-03 · `declared-direct`: implementada directamente en este task; el host no emitió hooks
  de escritura SDD.
- RED inicial: motor, proveedores y runtime no existían o rechazaban las aserciones de contrato.
- GREEN final: `mock-engine.test.ts` 3/3, `mock-providers.test.ts` 3/3 y
  `mock-runtime.test.ts` 6/6.
- El informe E2E registró 55 simulaciones sobre Claude/WebSearch, Gemini, fal.ai, HeyGen,
  ElevenLabs, Scrape Creators, GitHub, yt-dlp y clips, incluidos error, timeout e inválido.
- Una intención o proveedor no registrado devuelve `E2E_CAPABILITY_UNMOCKED`; no existe fallback.

## SEC-SECRETS-003

SEC-SECRETS-003 · T-002-03 · `src/core/testing/mock-providers.test.ts::debe_usar_valores_ficticios_sin_fallback_real`.

Superado: CI no declara `secrets`; fixtures usan valores ficticios; la contraseña de login no se
devuelve; errores no contienen `api_key`, bearer, password ni `.vaultkey`.
`node scripts/scan-secrets.mjs --json` examinó 578 ficheros con 0 hallazgos.

## T-002-04

- T-002-04 · `declared-direct`: runner y recorridos implementados directamente; el host no emitió
  hooks de escritura SDD.

`npm run test:e2e:mock` sobre build de producción y ruta con espacios:

```text
Running 9 tests using 1 worker
9 passed
status: passed · durationMs: 65566
simulatedRequests: 55 · blockedExternalAttempts: 1
allowedLoopbackRequests: 18 · performedExternalRequests: 0
```

Recorridos: instalación vacía/Ajustes, proyecto+dossier, navegador bloqueado, mercado y ampliar,
fal.ai/HeyGen/ElevenLabs, login+grabación+remontaje, clips+reanudar+yt-dlp, recuperación y barrera
global. Trace, captura y vídeo se conservan solo al fallar; la raíz temporal se eliminó al cerrar.
La auditoría confirmó además `runner.lock=false`, `runRoot=false` y `.next-e2e=false` tras el
teardown final.

## T-002-05

- T-002-05 · `declared-direct`: CI y documentación implementados directamente; la verificación de
  seguridad sí fue delegada y se conserva en su informe independiente.
- `NODE_OPTIONS=--use-system-ca npm ci`: 515 paquetes instalados desde lockfile; Prisma generado;
  0 vulnerabilidades.
- `npm run lint`: exit 0, 0 warnings.
- `npm run typecheck`: exit 0.
- `npm test`: 12 ficheros/71 tests Vitest y 138 contratos Node, todos superados.
- `npm run build`: build Next de producción superado.
- `npm audit --audit-level=high`: 0 vulnerabilidades.
- `node scripts/check-sdd.mjs --spec 002 --strict --json`: 0 problemas.
- Revisión de código: GO, sin bloqueantes, mayores ni menores.
- Auditoría de seguridad: APTO, 0 hallazgos; informe materializado en
  `docs/security/reports/2026-08-28-002-e2e-mock-offline-v1.md`.
- Workflow: job Windows separado, sin secrets, Chromium explícito y artefactos solo en fallo con
  retención de 3 días. Validación en GitHub pendiente del futuro push autorizado.
- `run --slow` ejecutó y dejó verdes escáner y E2E. Su agregado global sigue rojo por 25 problemas
  de trazabilidad históricos de la spec 001 y porque el wrapper no añade `--use-system-ca` a
  `npm audit`; la spec 002 estricta y la auditoría npm separada sí quedaron verdes. No se amplió el
  alcance para reescribir la deuda histórica.

## DOC-README-INSTALACION

DOC-README-INSTALACION · T-002-05 · artefactos `README.md` y `docs/quality/TEST-STRATEGY.md` · resultado documental ejecutado: PASS, exit 0 de `node scripts/check-sdd.mjs --spec 002 --json`.

`README.md` y `docs/quality/TEST-STRATEGY.md` documentan comandos, aislamiento, proveedores
simulados, evidencia y límites. Cobertura y accesibilidad permanecen no configuradas con motivo
explícito, fuera del alcance aprobado.

## Controles NO ejecutados

| Control | Estado | Motivo |
|---|---|---|
| Job remoto de GitHub Actions | no ejecutado | Solo podrá observarse tras un push autorizado y no se presenta aquí como verde local. |
