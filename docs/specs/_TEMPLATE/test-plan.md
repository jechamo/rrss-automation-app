# Plan de test · NNN-slug

---

## 1. Alcance

Qué se prueba en esta spec y qué **no** (y por qué).

## 2. Mapa criterio → test

| OBJ | PRD-RF | UC | RF | CA | Tarea | Comportamiento | Nivel | Test |
|---|---|---|---|---|---|---|---|---|
| OBJ-001 | PRD-RF-001 | UC-001 | RF-01 | CA-01 | T-NNN-01 | | unitario | `ruta::debe_<...>_cuando_<...>` |

**Regla**: ningún CA sin test. Ningún test sin CA (salvo tests técnicos justificados).

## 3. Por nivel

### Unitarios (~70 %)
Dominio y aplicación, sin I/O. Milisegundos.
- <qué se cubre aquí>

### Integración (~20 %)
Adaptadores reales con testcontainers: BD, HTTP, colas.
- <qué se cubre aquí>

### Contrato
Cada frontera de `contracts/`. Consumer-driven. Un cambio incompatible **debe romper el build**.
- <qué contratos>

### E2E (~10 %)
Solo flujos críticos de negocio. Selectores por rol y texto accesible.
- <qué flujos>

## 4. Casos límite a cubrir

| Caso | Test | Estado |
|---|---|---|
| Entrada vacía | | |
| Límite exacto (n, n-1, n+1) | | |
| Concurrencia / carrera | | |
| Idempotencia (petición repetida) | | |
| Permiso denegado | | |
| Dependencia externa caída / timeout | | |
| Datos corruptos o parciales | | |
| Zonas horarias y cambio de hora | | |

## 5. Datos de prueba

- Builders / Object Mothers a usar: <…>
- Fixtures: <…>
- **Sin PII real.** Sin secretos, ni siquiera de prueba con formato válido.

### 5.1 · Casos de abuso y controles de seguridad

> Obligatorio si `Impacto de seguridad = sensible`. Cada control aplicable de `plan.md` aparece
> aquí; un `no aplica` conserva la misma justificación material.

| Control | ASVS | OWASP | Caso de abuso / condición negativa | Nivel | Test | Resultado seguro esperado |
|---|---|---|---|---|---|---|
| SEC-<ID> | ASVS 5.0.0 Vx | A0x:2025 | `<entrada, identidad, estado o fallo hostil>` | `<unit/integration/contract/e2e>` | `<ruta::caso>` | `<rechazo cerrado y observable>` |

Si se elige JWT, incluye algoritmo no permitido y `alg: none`, firma inválida, `iss`, `aud`,
`exp`, `nbf`, `iat`, `sub`, `jti`, tipo/scope incorrectos, revocación, **refresh token rotation**,
**reuse detection**, 401/403, IDOR y ausencia de tokens en logs/URLs. Para cookies automáticas,
prueba la defensa CSRF elegida; `SameSite` es defensa en profundidad, no sustituto universal.

### 5.2 · Casos de uso hostil y accesibilidad

> Obligatorio si `Impacto de usabilidad = aplicable`. Cada control aplicable de `plan.md` §9.3
> aparece aquí; un `no aplica` conserva la misma justificación material.

| Control | WCAG 2.2 | Heurística | Condición hostil | Nivel | Test | Resultado usable esperado |
|---|---|---|---|---|---|---|
| UX-`<AREA>`-NNN | `<criterio o n/a>` | `<H1…H10 o n/a>` | `<solo teclado / lector de pantalla / zoom 200 % / red lenta / error del servidor / doble envío>` | `<unit/integration/e2e>` | `<ruta::caso>` | `<comportamiento observable y comprensible>` |

Condiciones hostiles que conviene no olvidar: navegación **sin ratón** de principio a fin; foco
visible en todo momento; envío del formulario **dos veces seguidas**; el servidor devuelve error
justo después de una actualización optimista; la red tarda cinco segundos; el texto se amplía al
200 %; el campo recibe el valor exacto del límite y el límite más uno.

## 6. Dobles

| Dependencia | Doble | Por qué |
|---|---|---|
| | fake / stub / mock | |

> No mockees lo que no controlas: envuélvelo en un puerto y haz un fake del puerto.

## 6 bis. Verificación documental

| DOC-ID | Tarea | Fuente | Artefacto | Comprobación o revisión | Resultado esperado |
|---|---|---|---|---|---|
| DOC-... | T-NNN-XX | `<ruta>` | `<ruta>` | `<comando docs:* o revisión material>` | `<artefacto actualizado y verificable>` |

La documentación puede vivir en otro commit del mismo PR. `NO EJECUTADO` no equivale a verde.

## 7. Criterio de suficiencia

**Cobertura por tier**, no global — el tier lo declara `plan.md` §8.1:

| Módulo / ruta | Tier | Umbral | Alcanzado |
|---|---|---:|---:|
| `<ruta>` | CORE | 100 % | |
| `<ruta>` | IMPORTANT | 80 % | |
| `<ruta>` | INFRASTRUCTURE | excluido | — |
| `<ruta sin tier declarado>` | — | **100 %** | |

- Mutation score en el core ≥ <n> % (si está configurado)
- Todos los CA con test verde
- Suite completa < <n> minutos en CI
- Cero tests flaky, cero `.skip`, cero `.only`

## 8. Qué NO se automatiza

<Y cómo se verifica entonces: revisión manual, checklist, exploratorio.>

Los gates humanos de producto, spec, diseño, plan y entrega no se infieren de tests: su estado,
persona, fecha y alcance se comprueban como evidencia documental.

## 9. Fuentes y discrepancias

| Riesgo de intake | Fuente / discrepancia | Test o revisión | Resultado esperado |
|---|---|---|---|
| Fuente inaccesible | `<SRC-...>` | `<test/revisión>` | No se inventa contenido y el bloqueo queda visible |
| Contradicción producto-diseño | `<DISC-...>` | `<test/revisión>` | No avanza el gate hasta decisión humana |
