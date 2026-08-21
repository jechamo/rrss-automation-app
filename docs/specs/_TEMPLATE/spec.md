# NNN · <Título de la funcionalidad>

| Campo | Valor |
|---|---|
| **ID** | `NNN-slug` |
| **Estado** | borrador \| en clarificación \| aprobada \| en implementación \| entregada |
| **Autor** | |
| **Fecha** | YYYY-MM-DD |
| **Rama** | `feature/NNN-slug` |
| **Depende de** | <otras specs, o "ninguna"> |
| **Baseline de producto** | [`docs/product/PRD.md`](../../product/PRD.md) · estado `<pending/approved/legacy-pending>` |
| **Fuentes** | [`docs/product/SOURCES.md`](../../product/SOURCES.md) · `<SRC-...>` |
| **Impacto de seguridad** | `sensible` \| `no-sensible` \| `security-pending` |
| **Impacto de usabilidad** | `aplicable` \| `sin-ui · <motivo material>` \| `ux-pending` |
| **Impacto de documentación** | `aplicable · DOC-...` \| `no-aplica · <motivo material>` \| `docs-pending` |

> ⚠️ Esta spec describe **QUÉ** y **POR QUÉ**. Cero tecnología: ni tablas, ni endpoints,
> ni frameworks, ni nombres de clase. Eso va en `plan.md`.

---

## 0. Origen y trazabilidad de producto

> `docs/product/PRD.md` es la fuente canónica. La visión, un PRD original, un diseño o una URL
> son fuentes de intake y se citan mediante `SRC-*`; no sustituyen al baseline aprobado.

| Objetivo | Requisito de producto | Caso de uso | Requisito de esta spec | Fuente |
|---|---|---|---|---|
| OBJ-001 | PRD-RF-001 | UC-001 | RF-01 | SRC-001 |

**Discrepancias que afectan a esta spec**: `<ninguna / DISC-...>`.

## 1. Problema

<Qué duele hoy. A quién. Con qué frecuencia. Qué coste tiene no arreglarlo.>

## 2. Objetivo y métrica de éxito

**Objetivo**: <en una frase>

**Cómo sabremos que funcionó**:
- <métrica con número y plazo. No vale "mejor experiencia">

## 3. Usuarios y contexto de uso

| Perfil | Qué necesita | Frecuencia | Contexto |
|---|---|---|---|
| | | | |

## 4. Requisitos funcionales (EARS) con prioridad MoSCoW

> Formatos: `El sistema DEBE …` · `CUANDO <disparador>, el sistema DEBE …` ·
> `MIENTRAS <estado>, el sistema DEBE …` · `SI <condición no deseada>, ENTONCES el sistema DEBE …`
>
> Prioridad: **M** must · **S** should · **C** could · **W** won't have this time.
> Esfuerzo: estimación **relativa** (1, 2, 3, 5, 8). No son horas; sirven para repartir.

| Id | Requisito | Prioridad | Esfuerzo |
|---|---|---|---|
| **RF-01** | <requisito atómico y verificable> | M | |
| **RF-02** | <…> | S | |

### Reparto MoSCoW

> **El reparto es sobre esfuerzo estimado, no sobre número de requisitos.** Diez must pequeños y
> dos enormes no son "el 83 % must". Reglas del DSDM:

| Prioridad | Esfuerzo | % | Límite recomendado |
|---|---|---|---|
| Must | | | **≤ 60 %** |
| Should | | | ~20 % |
| Could | | | ~20 % — es la **contingencia deliberada** |
| **Total** | | 100 % | |

Si los *must* pasan del 60 %, hay riesgo de previsibilidad: o se baja algo a *should*, o se
justifica por escrito aquí (tecnología conocida, equipo estable, riesgo externo bajo).

**Won't have this time** — se escribe. Un descarte no registrado vuelve como discusión:

| Id | Qué se descarta | Por qué ahora no | ¿Volverá? |
|---|---|---|---|
| **RF-W01** | | | |

## 5. Requisitos no funcionales

> No los omitas: es el error más común y el que más caro sale.

| Categoría | Requisito | Valor objetivo |
|---|---|---|
| Rendimiento | | p95 < ___ ms |
| Disponibilidad | | ___ % |
| Escala | | ___ usuarios / ___ registros |
| Seguridad y privacidad | ¿hay PII? ¿nivel ASVS? | |
| Accesibilidad | WCAG 2.2 AA | |
| Internacionalización | | |
| Observabilidad | | |
| Coste | | |
| Retención de datos | | |

### 5.1 · Clasificación de seguridad

> Usa `sensible` cuando la spec toca autenticación, autorización, PII, pagos, ficheros,
> administración, multi-tenant, integraciones externas o agentes/LLM. `security-pending` es una
> transición brownfield para contexto histórico, no una excepción para una spec sensible nueva.

| Señal | Aplica | Requisito / caso afectado | Fuente o motivo |
|---|---|---|---|
| Autenticación o sesión | `<sí/no>` | `<RF/CA>` | `<SRC/razón>` |
| Autorización, roles, IDOR o multi-tenant | `<sí/no>` | `<RF/CA>` | `<SRC/razón>` |
| PII, pagos, ficheros o administración | `<sí/no>` | `<RF/CA>` | `<SRC/razón>` |
| Integración externa, webhook o agente/LLM | `<sí/no>` | `<RF/CA>` | `<SRC/razón>` |

La spec declara el impacto y el comportamiento esperado; las decisiones técnicas y la matriz de
controles se completan en `plan.md`.

### 5.2 · Clasificación documental

> `aplicable` identifica una o más superficies `DOC-*` declaradas en `.sdd/docs.json`.
> `no-aplica` necesita un motivo material. `docs-pending` solo conserva historia brownfield
> anterior a `documentation.enforceFromSpec`; una spec nueva no puede usarlo como excepción.

| DOC-ID / estado | Superficie afectada | Audiencia | Motivo o comportamiento que cambia |
|---|---|---|---|
| `DOC-...` \| `no-aplica` | `<public-api/public-code/ui-catalog/user-guide/architecture/operations/developer-readme>` | `<audiencia>` | `<motivo concreto>` |

### 5.3 · Clasificación de usabilidad

> Usa `aplicable` cuando la spec toca una pantalla, un formulario, un texto que lee una persona o
> una espera que se nota. `sin-ui` necesita un motivo material —"no procede" no lo es—.
> `ux-pending` es una transición brownfield para contexto histórico, nunca una excepción para una
> spec nueva con interfaz.

| Señal | Aplica | Requisito / caso afectado | Fuente o motivo |
|---|---|---|---|
| Pantalla nueva o modificada | `<sí/no>` | `<RF/CA>` | `<SRC/razón>` |
| Formulario o entrada de datos | `<sí/no>` | `<RF/CA>` | `<SRC/razón>` |
| Espera perceptible (> 300 ms) | `<sí/no>` | `<RF/CA>` | `<SRC/razón>` |
| Texto de interfaz nuevo | `<sí/no>` | `<RF/CA>` | `<SRC/razón>` |

La spec declara el impacto y el comportamiento esperado; las decisiones de diseño van en
`design.md` y la matriz de controles se completa en `plan.md` §9.3.

Doctrina vinculante: [`A11Y-CHECKLIST.md`](../../design/A11Y-CHECKLIST.md) —el suelo legal— y
[`USABILITY-CHECKLIST.md`](../../design/USABILITY-CHECKLIST.md) —lo que hace que además funcione—.

## 6. Criterios de aceptación

> Uno por comportamiento. Si no sabes escribir el test, el requisito no está claro.

### CA-01 — <nombre> *(cubre RF-01)*
```gherkin
Escenario: <nombre>
  Dado <contexto>
  Cuando <acción>
  Entonces <resultado observable>
```

### Matriz RF → CA

| OBJ | PRD-RF | UC | RF | CA |
|---|---|---|---|---|
| OBJ-001 | PRD-RF-001 | UC-001 | RF-01 | CA-01 |

## 7. Casos límite

| Situación | Comportamiento esperado |
|---|---|
| Entrada vacía | |
| Valor en el límite exacto | |
| Dos usuarios a la vez | |
| Usuario sin permisos | |
| Sistema externo caído | |
| Petición repetida (idempotencia) | |
| Datos existentes corruptos | |

## 8. Reglas de negocio

- **RN-01** — <invariante que debe cumplirse siempre>

## 9. Fuera de alcance

> Tan importante como el alcance. Defensa contra el scope creep.
>
> No confundir con los **won't have** de §4: aquello está en el ámbito de esta spec pero se aplaza
> a otra iteración. Esto **no pertenece** a esta spec.

- <lo que esta spec NO hace, y por qué>

## 10. Riesgos y dependencias

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| | | | |

## 11. Supuestos

> Decisiones tomadas por el agente ante la falta de información. **El usuario debe validarlas.**

- <supuesto>

## 12. Glosario

| Término | Definición |
|---|---|
| | |

## 13. Preguntas abiertas

- `[NEEDS CLARIFICATION: <pregunta>]`

## 14. Gate humano de especificación

| Campo | Valor |
|---|---|
| **Estado** | `pending` \| `approved` \| `rejected` |
| **Aprobado / rechazado por** | `<persona>` |
| **Fecha** | `<YYYY-MM-DD>` |
| **Alcance de la decisión** | `<RF/CA y discrepancias incluidas>` |
| **Condiciones** | `<ninguna / lista>` |

> `/sdd-plan` no comienza mientras haya marcadores, discrepancias abiertas o este gate no esté
> en `approved`. La aprobación del PRD no sustituye la aprobación funcional de esta spec.
