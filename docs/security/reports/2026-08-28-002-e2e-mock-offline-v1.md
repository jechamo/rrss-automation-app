# Informe de seguridad — 002-e2e-mock-offline-v1

Fecha: 2026-08-28

Modo: `security-scan verify`

Alcance: diff de `codex/e2e-mock-v1` respecto a `origin/main`

Nivel: OWASP ASVS 5.0.0 L2

Veredicto: **APTO**

## Resultado

No quedan hallazgos de seguridad abiertos.

El hallazgo ALTO anterior sobre egreso queda cerrado mediante:

- guard global de `fetch` instalado por `src/instrumentation.ts`;
- allowlist exclusiva de loopback con validación DNS A/AAAA;
- redirecciones manuales y fallo cerrado;
- timeout, cancelación y límite de respuesta probado en n-1, n y n+1;
- guard de rutas Playwright;
- dobles fail-closed para IA, proveedores, GitHub, yt-dlp y clips;
- inventario sin adaptadores salientes actuales mediante `node:http`, `https`, `net`, `tls` o `dgram`;
- probe E2E usando el `fetch` global real;
- gate que falla ante evidencia ausente, Playwright fallido o cualquier egreso externo contabilizado.

La excepción loopback está acotada al perfil E2E, documentada con responsable `release-manager`, motivo material, aprobación del 2026-08-27 y revisión el 2026-11-27 o ante cambios de perfil/allowlist.

## Controles evaluados

| Control | Estado | Evidencia principal |
|---|---|---|
| SEC-DATA-001 | PASS | Raíz canónica por ejecución, limpieza contenida, lock, señales y prueba sintética de dos ejecuciones preservando hashes y conteos de DB, Vault, sesiones y medios. |
| SEC-EGRESS-002 | PASS | 20 casos unitarios, barrera global, DNS/redirect/timeout/límite, navegador protegido y E2E con 0 salidas externas. |
| SEC-SECRETS-003 | PASS | Snapshot de código allowlist sin `.env`, entorno hijo allowlist, sentinel ausente, fixtures ficticios y escáner de secretos limpio. |
| SEC-MODE-004 | PASS | Activación exacta `RRSS_E2E_MODE=mock`, `runId` y rutas validadas; cualquier configuración incompleta falla cerrada y el modo normal permanece intacto. |

No se introduce autenticación productiva, JWT, bearer ni cambios de autorización. La cookie observada pertenece únicamente a la fixture HTTP de loopback, contiene un valor ficticio y usa `HttpOnly` y `SameSite=Lax`.

Para la superficie IA/agentic, el motor mock solo acepta intenciones conocidas, no dispone de fallback real ni ejecuta herramientas externas. Una capacidad desconocida devuelve `E2E_CAPABILITY_UNMOCKED`.

## Evidencias ejecutadas

- `npm run test:e2e:mock`: **9/9 PASS** sobre build de producción.
  - 55 solicitudes simuladas.
  - 18 solicitudes loopback permitidas.
  - 1 intento externo bloqueado.
  - 0 solicitudes externas realizadas.
  - Duración: 65.566 s.
  - Al finalizar: lock, raíz del run y `.next-e2e` eliminados.
- `npm test`: **12/12 ficheros, 71/71 Vitest y 138/138 contratos**.
- Pruebas dirigidas de perfil, aislamiento, egreso, mocks y gate: verdes.
- `npm run lint`: exit 0, sin warnings.
- `npm run typecheck`: exit 0.
- Build Next de producción: compilación correcta.
- `node scripts/scan-secrets.mjs --json`: 578 ficheros, 0 hallazgos.
- `npm audit --audit-level=high`: 0 vulnerabilidades.
- `node scripts/check-sdd.mjs --spec 002 --strict --json`: 0 problemas.
- `git diff --check`: limpio.
- Workflow Windows revisado: acciones fijadas por SHA, checkout sin credenciales persistentes, sin secrets, Chromium explícito y artefactos solo ante fallo con retención de tres días.

No se leyeron `.env`, Vault ni datos reales.

<!-- sdd-security-report:v1 -->
```json
{
  "schemaVersion": 1,
  "spec": "002-e2e-mock-offline-v1",
  "standards": {
    "owaspTop10": "2025",
    "asvs": "5.0.0",
    "level": "L2"
  },
  "scope": "diff",
  "controlsEvaluated": [
    "SEC-DATA-001",
    "SEC-EGRESS-002",
    "SEC-SECRETS-003",
    "SEC-MODE-004"
  ],
  "openFindings": {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0
  },
  "verdict": "PASS",
  "acceptedRisks": [],
  "controlsNotExecuted": []
}
```

### HANDOFF

- Agente origen: security-auditor
- Fase completada: security-scan · verify
- Fuentes consultadas: `.claude/agents/security-auditor.md`; `.agents/skills/security-scan/SKILL.md`; `AGENTS.md`; `docs/security/SECURITY-CHECKLIST.md`; `docs/security/AUTH-TOKENS.md`; constitución; spec, plan, tareas, test-plan, investigación y evidencia de `002-e2e-mock-offline-v1`; diff respecto a `origin/main`; código runtime, endpoints E2E, mocks, Playwright, runner y workflow CI.
- Estándares: OWASP Top 10:2025 · ASVS 5.0.0 L2 · OWASP Top 10 for Agentic Applications
- Alcance: diff de `codex/e2e-mock-v1` respecto a `origin/main`
- Controles evaluados: SEC-DATA-001, SEC-EGRESS-002, SEC-SECRETS-003, SEC-MODE-004
- Evidencias y comandos: E2E 9/9; Vitest 71/71; contratos 138/138; lint, typecheck, build, SDD estricto, auditoría de dependencias, escáner de secretos y diff-check verdes
- Hallazgos: CRÍTICO 0 · ALTO 0 · MEDIO 0 · BAJO 0
- Riesgos aceptados: ninguno
- Controles no ejecutados: ninguno
- Veredicto: APTO
- Informe a materializar: `docs/security/reports/2026-08-28-002-e2e-mock-offline-v1.md`
- Bloques literales del informe: todo el contenido desde `# Informe de seguridad` hasta este HANDOFF, incluido `sdd-security-report:v1`
- Siguiente agente sugerido: agente invocador `/root`; puede delegar la materialización literal en `docs-writer`
- Comando / contexto durable: `security-scan verify`; releer el diff frente a `origin/main` y `docs/specs/002-e2e-mock-offline-v1/` antes de materializar
