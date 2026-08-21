# Evidencias y convergencia · NNN-slug

> `execution-log.jsonl` es la bitácora **append-only** que registra qué subagente arrancó y
> terminó, escrita por los hooks y no por el modelo. Este documento resume la **evidencia
> técnica**: qué se ejecutó, con qué comando, con qué resultado.
>
> Regla: **"pasa" sin ejecución no es un resultado. "No ejecutado" sí lo es** — y se escribe.

---

## 1. Ejecuciones

| Fecha/hora | Agente | Verificación | Tarea | Comando ejecutado | Resultado | Artefacto |
|---|---|---|---|---|---|---|
| YYYY-MM-DD HH:MM | `implementer` | `observed` | T-NNN-01 | `npm test -- order.spec` | 🔴 falla por `InsufficientStock` (esperado) | log en la conversación |
| YYYY-MM-DD HH:MM | `implementer` | `observed` | T-NNN-01 | `npm test` | 🟢 42/42 | — |

**Verificación**: `observed` (hooks vieron el subagente) · `declared-direct` (el agente activo
trabajó él mismo) · `unverified` (delegación afirmada pero no observada — documenta por qué).

## 2. Trazabilidad requisito → test

| OBJ | PRD-RF | UC | RF | CA | Tarea | Implementación | Test | Resultado |
|---|---|---|---|---|---|---|---|---|
| OBJ-001 | PRD-RF-001 | UC-001 | RF-01 | CA-01 | T-NNN-01 | `src/domain/Order.ts:42` | `tests/unit/order.spec.ts::debe_rechazar_cuando_stock_insuficiente` | 🟢 |

- [ ] Todo `CA` de la spec aparece en esta tabla
- [ ] Cada test citado se ha ejecutado y su salida está arriba
- [ ] Ningún OBJ, PRD-RF, UC, RF, CA o tarea referenciado es huérfano

### Gates humanos verificados

| Gate | Estado | Persona | Fecha | Alcance / evidencia |
|---|---|---|---|---|
| Producto | `<approved/legacy-pending>` | | | `docs/product/PRD.md` |
| Spec | `<approved>` | | | `spec.md` |
| Diseño | `<approved/skipped-no-ui>` | | | `design.md` |
| Plan técnico | `<approved>` | | | `plan.md` |
| Entrega | `<pending/approved>` | | | §5 |

## 3. Controles NO ejecutados

> La sección más importante y la que todo el mundo omite. Un control que no se corrió
> no es un control aprobado: es un riesgo sin dueño.

| Control | Por qué no se ejecutó | Riesgo que queda abierto | Propietario | Próximo paso |
|---|---|---|---|---|
| E2E en Safari | Sin runner de macOS en CI | Regresión no detectada en WebKit | | Añadir job antes de la v1.1 |

### 3.0 · Evidencia documental

| DOC-ID | Tarea | Artefacto | Comprobación ejecutada | Resultado | Estado |
|---|---|---|---|---|---|
| DOC-... | T-NNN-XX | `<ruta versionable>` | `<comando o revisión exacta>` | `<salida real>` | `<verificado/no ejecutado/no aplica>` |

### 3.1 · Controles de seguridad ejecutados

| Control | Tarea | Test / comando ejecutado | Resultado | Evidencia | Estado |
|---|---|---|---|---|---|
| SEC-<ID> | T-NNN-XX | `<comando exacto>` | `<salida real resumida>` | `<ruta, log o artefacto>` | `<verificado/no ejecutado/no aplica>` |

**Informe de seguridad**: `docs/security/reports/YYYY-MM-DD-NNN-slug.md`.

- Auditor: `security-auditor` (solo lectura) — `<observed/declared-direct/unverified>`.
- Materialización: `docs-writer` copia literalmente el HANDOFF estructurado; no cambia hallazgos,
  conteos ni veredicto.
- Contrato mínimo del informe:

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

Valores JSON de `verdict`: `BLOCKED`, `CONDITIONAL` o `PASS`. Cada riesgo MEDIO aceptado usa
`id`, `owner`, `justification`, `reviewDate` (`YYYY-MM-DD`) y un `decisionRef` durable `DEC-*` o
`ADR-*`. Cada control no ejecutado usa `control`, `reason`, `risk`, `owner` y `nextStep`.
`controlsNotExecuted` no vacío bloquea `GO`; no cuenta como control verificado.

### 3.2 · Controles de usabilidad ejecutados

| Control | Tarea | Test / comando ejecutado | Resultado | Evidencia | Estado |
|---|---|---|---|---|---|
| UX-`<AREA>`-NNN | T-NNN-XX | `<comando exacto>` | `<salida real resumida>` | `<ruta, log o captura>` | `<verificado/no ejecutado/no aplica>` |

**Informe de usabilidad**: `docs/design/reports/YYYY-MM-DD-NNN-slug.md`.

- Auditor: `code-reviewer` (solo lectura) — `<observed/declared-direct/unverified>`.
- Materialización: `docs-writer` copia literalmente el HANDOFF estructurado; no cambia hallazgos,
  conteos ni veredicto.
- Contrato mínimo del informe:

<!-- sdd-usability-report:v1 -->
```json
{
  "schemaVersion": 1,
  "spec": "NNN-slug",
  "standards": {
    "wcag": "2.2",
    "level": "AA",
    "heuristics": "nielsen-10"
  },
  "scope": "diff",
  "controlsEvaluated": ["UX-<AREA>-NNN"],
  "openFindings": { "critical": 0, "high": 0, "medium": 0, "low": 0 },
  "verdict": "PASS",
  "acceptedRisks": [],
  "controlsNotExecuted": []
}
```

Valores JSON de `verdict`: `BLOCKED`, `CONDITIONAL` o `PASS`. Cada riesgo MEDIO aceptado usa
`id`, `owner`, `justification`, `reviewDate` (`YYYY-MM-DD`) y un `decisionRef` durable `DEC-*` o
`ADR-*`. Cada control no ejecutado usa `control`, `reason`, `risk`, `owner` y `nextStep`.
`controlsNotExecuted` no vacío bloquea `GO`; no cuenta como control verificado.

**Verificación manual de accesibilidad** — lo que ningún analizador detecta:

| Comprobación | Quién | Fecha | Resultado |
|---|---|---|---|
| Flujo completo solo con teclado, sin ratón | | | |
| Lectura con lector de pantalla | | | |
| Zoom al 200 % sin pérdida ni solape | | | |

## 3 bis. Cobertura, deuda y observabilidad

**Cobertura por tier.** No se reporta cifra global: un porcentaje único deja pasar el 6 % que
hunde el producto.

| Módulo / ruta | Tier declarado en `plan.md` | Umbral | Real | ✓ |
|---|---|---:|---:|---|
| | | | | |

**Módulos sin tier declarado** — el defecto estricto los exige al 100 %:

| Módulo / ruta | Cobertura real | ✓ |
|---|---:|---|
| | | |

| Medida | Valor | Comando |
|---|---|---|
| Mutation score en el core | `<n> %` \| n/a | |
| Marcadores de deuda | `<n>` | `node scripts/sdd-project.mjs debt` |
| Ratio de deuda | `<n> %` (estimación humana del esfuerzo) | |

**Observabilidad de los caminos nuevos**

- [ ] Errores capturados y **clasificados** por tipo
- [ ] Salud por versión visible, con regla de reversión escrita
- [ ] Rastro de eventos de negocio **sin datos personales**
- [ ] Toda alerta con umbral de aviso, umbral crítico y playbook
- [ ] Error de prueba disparado y visto llegar — salida en §1

## 4. Convergencia

- [ ] La spec refleja el comportamiento realmente construido (si divergen, se clasifica como
      defecto, aprendizaje o cambio aprobado — **no se ajusta la spec en silencio**)
- [ ] Código y contratos satisfacen los criterios de aceptación
- [ ] Los tests relevantes pasan; ningún test flaky ignorado
- [ ] Seguridad, privacidad, datos y accesibilidad revisados
- [ ] ADR, documentación, runbooks y CHANGELOG actualizados donde aplica
- [ ] Cada tarea `hecho` tiene ejecución registrada, checks y evidencia
- [ ] No quedan discrepancias de intake abiertas que afecten al alcance entregado
- [ ] Las delegaciones se observaron por hooks, o su limitación está documentada arriba
- [ ] Los riesgos abiertos tienen propietario y decisión

## 5. Decisión de entrega

| Campo | Valor |
|---|---|
| **Estado** | `NO-GO` \| `GO` |
| **Razón** | |
| **Aprobado por** | |
| **Fecha** | |

> Arranca en `NO-GO`. Se cambia a `GO` cuando todas las casillas de §4 están marcadas
> **y** una persona lo aprueba. El valor por defecto no es "listo".
