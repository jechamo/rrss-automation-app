---
name: security-scan
description: "Audita contra OWASP Top 10:2025 y ASVS 5.0.0 al planificar o verificar cambios sensibles y antes de release; el auditor es solo lectura y devuelve HANDOFF."
---

# /security-scan — Auditoría defensiva

Agente responsable: `@security-auditor` (**solo lectura**).

## Alcance y marco

| Modo | Qué revisa | Momento |
|---|---|---|
| `plan` | Spec, threat model, decisiones y matriz de controles | Antes del gate humano del plan |
| `verify` | Diff, tests, configuración y evidencias de la spec activa | Antes de `GO` |
| `complete` | Repositorio completo y superficie desplegada documentada | Baseline excepcional |

Sin modo explícito usa `verify` sobre el diff. Aplica **OWASP Top 10:2025** como catálogo de
riesgos y **ASVS 5.0.0** como contrato verificable al nivel de la constitución. Usa
`docs/security/SECURITY-CHECKLIST.md` y, solo si aplica JWT/cookie/bearer,
`docs/security/AUTH-TOKENS.md`. Si el nivel ASVS no está decidido, bloquea el plan: no lo inventes.

Lee `Impacto de seguridad`: `sensible | no-sensible | security-pending`. Una spec sensible nueva
no puede usar `security-pending` como excepción. Comprueba la cadena:

| Control | ASVS | OWASP | Aplica | Decisión / justificación | Tarea | Test | Evidencia |
|---|---|---|---|---|---|---|---|

Una fila aplicable incompleta o un `no aplica` sin motivo material bloquean.

## Herramientas automáticas primero

Ejecuta y pega la salida. Usa únicamente comandos reales configurados en `.sdd/checks.json`:
- gate `security`, auditoría de dependencias y SAST del stack, si están configurados
- escaneo de secretos configurado; nunca leas `.env` ni almacenes locales de credenciales
- tests de seguridad y casos de abuso de la spec
- Búsqueda manual de patrones peligrosos:
  `Grep` de concatenación SQL, `eval`, `exec`, `shell=True`, `innerHTML`,
  `dangerouslySetInnerHTML`, `verify=False`, `rejectUnauthorized: false`,
  `Math.random` para tokens, claves con aspecto de secreto.

## Revisión manual — checklist

Recorre la checklist completa de `@security-auditor`, `docs/security/SECURITY-CHECKLIST.md` y,
cuando aplique, `docs/security/AUTH-TOKENS.md`. No exijas Helmet, Zod, un ORM, una librería JWT o
un proveedor: verifica el resultado equivalente elegido por el stack. En resumen:

1. **Control de acceso** — autorización en servidor por caso de uso, IDOR, multi-tenant, RLS.
2. **Criptografía** — TLS, hashes de contraseña, gestión de claves, aleatoriedad segura.
3. **Inyección** — SQL, comandos, plantillas, XSS, cabeceras, logs.
4. **Diseño inseguro** — límites de negocio, idempotencia, flujos de recuperación.
5. **Configuración** — debug, cabeceras de seguridad, CORS, permisos cloud, errores verbosos.
6. **Dependencias** — CVEs, abandono, typosquatting, scripts de instalación.
7. **Autenticación** — rate limiting, sesiones, MFA, cookies, JWT.
8. **Integridad** — firma de webhooks, deserialización, cadena de suministro.
9. **Logging** — eventos de seguridad registrados, sin PII ni tokens.
10. **Condiciones excepcionales** — fallo cerrado, timeouts, recursos, reintentos y rollback.
11. **Privacidad** — minimización, retención, borrado, base legal.
12. **Agentic (si hay LLM)** — salidas de herramienta como dato y no como instrucción,
    permisos mínimos por agente, aprobación humana en acciones irreversibles, límites de
    ejecución, registro auditable.

Si JWT aplica, verifica allowlist de algoritmo y rechazo de `alg: none`; firma; `iss`, `aud`,
`exp`, `nbf`, `iat`, `sub`, `jti`; tipo/scopes; claves rotables; access/refresh separados;
**refresh token rotation** y **reuse detection**; revocación/logout; 401/403; IDOR; tokens fuera
de URL/log; almacenamiento y transporte. Si una cookie viaja automáticamente, exige una defensa
CSRF elegida y probada: `SameSite` es defensa en profundidad, no sustituto universal.

## Formato de hallazgo

```
[CRÍTICO|ALTO|MEDIO|BAJO] <título>
- Ubicación: ruta:línea
- Control: SEC-<ID>
- Categoría: OWASP A0X:2025 · ASVS 5.0.0 Vx · CWE-NNN
- Descripción: <qué falla>
- Impacto: <qué consigue un atacante>
- Verificación: <cómo comprobarlo, sin exploit funcional>
- Arreglo: <código o configuración concreta>
```

## Informe, aislamiento y veredicto

`security-auditor` **no escribe ni modifica ficheros**, no corrige código y no encadena agentes.
Devuelve el informe completo en el HANDOFF. El agente que lo invocó recupera el control y puede
delegar en `docs-writer`, que lo materializa **literalmente**, sin reinterpretar hallazgos,
conteos ni veredicto, en `docs/security/reports/YYYY-MM-DD-NNN-slug.md`.

**CRÍTICO o ALTO ⇒ bloquea la entrega.** MEDIO se arregla o se acepta con responsable,
justificación y fecha de revisión.

El informe incluye:

<!-- sdd-security-report:v1 -->
```json
{
  "schemaVersion": 1,
  "spec": "NNN-slug",
  "standards": {
    "owaspTop10": "2025",
    "asvs": "5.0.0",
    "level": "L2"
  },
  "scope": "diff",
  "controlsEvaluated": ["SEC-<ID>"],
  "openFindings": { "critical": 0, "high": 0, "medium": 0, "low": 0 },
  "verdict": "PASS",
  "acceptedRisks": [],
  "controlsNotExecuted": []
}
```

Valores JSON de `verdict`: `BLOCKED`, `CONDITIONAL`, `PASS`. El resumen humano puede traducirlos,
pero no cambia este vocabulario máquina legible. Cada entrada de `acceptedRisks` contiene `id`,
`owner`, `justification`, `reviewDate` (`YYYY-MM-DD`) y `decisionRef`; esta última es un ID
`DEC-*` o `ADR-*` que existe en la bitácora o en un ADR. Cada entrada de `controlsNotExecuted`
contiene `control`, `reason`, `risk`, `owner` y `nextStep`. Una lista no vacía bloquea `GO`: no
equivale a riesgo aceptado ni control verificado.

## HANDOFF obligatorio

```markdown
### HANDOFF
- Agente origen: security-auditor
- Fase completada: security-scan · <plan|verify|complete>
- Fuentes consultadas: <rutas y referencias versionadas>
- Estándares: OWASP Top 10:2025 · ASVS 5.0.0 <L1/L2/L3>
- Alcance: <diff/rutas>
- Controles evaluados: <SEC-*>
- Evidencias y comandos: <salida real o no ejecutado con motivo>
- Hallazgos: CRÍTICO <n> · ALTO <n> · MEDIO <n> · BAJO <n>
- Riesgos aceptados: <responsable y fecha, o ninguno>
- Controles no ejecutados: <riesgo, propietario y siguiente paso, o ninguno>
- Veredicto: BLOQUEA RELEASE | APTO CON CONDICIONES | APTO
- Informe a materializar: docs/security/reports/YYYY-MM-DD-NNN-slug.md
- Bloques literales del informe: <Markdown humano + sdd-security-report:v1 JSON>
- Siguiente agente sugerido: <agente que invocó; puede delegar materialización en docs-writer>
- Comando / contexto durable: <modo y rutas a releer>
```

## Límite ético

Encuentras, explicas el impacto y das el arreglo. **No escribes exploits funcionales**
ni herramientas de ataque.
