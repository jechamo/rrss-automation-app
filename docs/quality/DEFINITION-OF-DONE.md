# Definition of Done

Una tarea **no está hecha** hasta que todo esto está en verde.
Lo verifica `/sdd-verify` y lo exige `release-manager` antes de `/sdd-ship`.

---

## Por tarea

- [ ] Test rojo previo demostrado (salida pegada) y ahora verde
- [ ] Toda la suite pasa, sin `.skip` ni `.only`
- [ ] Lint, formato y tipado estricto sin warnings
- [ ] El código cumple los criterios de aceptación que la tarea declara cubrir
- [ ] Casos límite tratados: vacío, límite, concurrencia, error externo
- [ ] Sin secretos, claves ni PII en código, logs o tests
- [ ] Sin `TODO` sin ticket ni código muerto
- [ ] `tasks.md` actualizado

## Por spec (antes de entregar)

- [ ] Todos los `CA` de la spec tienen un test que los verifica
- [ ] `evidence.md` completo: ejecuciones con su comando y resultado, trazabilidad
      requisito → test, y **la lista de controles que NO se ejecutaron** con su riesgo y dueño
- [ ] Cada tarea `hecho` tiene ejecución registrada en `execution-log.jsonl`
- [ ] **Cada módulo cumple el umbral de su tier** (CORE 100 % · IMPORTANT 80 % · INFRASTRUCTURE
      excluido) y **todo módulo sin tier declarado se ha verificado al 100 %**. No hay umbral
      global: un porcentaje único deja pasar el 6 % que hunde el producto
- [ ] Ningún módulo que maneje dinero, datos críticos o permisos está clasificado por debajo de CORE
- [ ] *Mutation score* del core medido y reportado como **número** en `evidence.md`, no como
      adjetivo. Cobertura alta con *mutation score* bajo = suite decorativa
- [ ] Si la funcionalidad tenía interfaz: `design.md` existe, con los seis estados por pantalla y
      las tablas §6 y §6 bis rellenadas, sin marcadores de plantilla
- [ ] Si `Impacto de usabilidad = aplicable`: cada `UX-*` aplicable tiene tarea, test y evidencia
      ejecutada; cada `no aplica`, motivo material; y existe el informe parseable en
      `docs/design/reports/` sin CRÍTICO/ALTO ni controles no ejecutados
- [ ] **Verificación manual de accesibilidad hecha, no supuesta**: recorrido completo sin ratón con
      el foco siempre visible, lectura con lector de pantalla y zoom al 200 %. El analizador
      automático cubre alrededor de un tercio de los problemas: es el suelo, no la prueba
- [ ] Todos los requisitos *must* de la spec entregados. Lo que quede fuera es lo que la spec ya
      marcó como *should*, *could* o *won't*, no lo que dio menos pereza
- [ ] `code-reviewer` → veredicto ✅, y veredicto de usabilidad sin CRÍTICO ni ALTO
- [ ] `refactor-specialist` → sin violaciones SOLID sin justificar
- [ ] `security-auditor` → sin hallazgos CRÍTICO ni ALTO
- [ ] Sin nuevas violaciones del umbral de complejidad cognitiva declarado por el proyecto
- [ ] Contratos de `contracts/` actualizados y tipos regenerados
- [ ] Documentación actualizada en el mismo cambio
- [ ] Migraciones reversibles y compatibles con la versión anterior desplegada
- [ ] Observabilidad: logs estructurados, métricas y trazas en los caminos nuevos
- [ ] Los caminos nuevos capturan y **clasifican** sus errores, y su salud es visible por versión.
      Un error que solo existe en la consola del usuario no existe
- [ ] Toda alerta añadida tiene umbral de aviso, umbral crítico y playbook. Sin playbook, se borra
- [ ] Feature flag donde el plan lo pedía, con condición de retirada escrita
- [ ] Plan de reversión escrito, con comando exacto
- [ ] Entrada en `docs/bitacora/DECISIONS.md` si hubo decisión relevante
- [ ] Trazabilidad completa: código ↔ tarea ↔ criterio de aceptación ↔ spec
- [ ] Impacto documental resuelto; si aplica, cada `DOC-ID` enlaza tarea, artefacto,
      comprobación ejecutada y evidencia en el mismo PR
- [ ] Resumen ejecutivo escrito con cifras **verificadas**, o con la declaración explícita de que no
      hay cifras que reportar. Una proyección inventada es peor que ningún resumen

---

## Automatización

Todo gate que se pueda automatizar, **se automatiza en CI**. Lo que depende de la buena
voluntad, se olvida.

| Gate | Automatizado en | Bloquea merge |
|---|---|---|
| Tests | CI | Sí |
| Cobertura por tier (umbral **por ruta**) | CI | Sí |
| Complejidad cognitiva y duplicación | CI (gate `smells`) | Sí |
| Lint / formato / tipos | CI + hook `PostToolUse` | Sí |
| Gates rápidos antes del commit, lentos antes del push | Hooks versionados opt-in mediante `core.hooksPath` · **y el propio agente** | No: el que bloquea es CI |
| Que los gates se hayan pasado sobre **este** árbol | Sello en `.sdd/state/` + `guard-bash` | No: avisa antes de aprobar |
| Escaneo de secretos | CI (`scripts/scan-secrets.mjs`) + hook `PreToolUse` | Sí |
| Auditoría de dependencias | CI, si hay lockfile | Sí (CRÍTICO/ALTO) |
| Tests de contrato | CI | Sí |
| Revisión de código | `code-reviewer` + humano | Sí |
| Auditoría de seguridad | `security-auditor` | Sí (CRÍTICO/ALTO) |
| Trazabilidad spec ↔ test | `/sdd-verify` + `scripts/check-sdd.mjs --strict` | Sí |
| Evidencia y ejecución de toda tarea `hecho` | `scripts/check-sdd.mjs --strict` | Sí |
| Snapshot de estado y cobertura de IDs | `sdd-project.mjs status --json` + `trace-status --json` | Sí, como entrada verificable; no sustituye el análisis |
| Scaffolds sin overwrite ni salto de gate | `sdd-project.mjs scaffold` + suite de instalación | Sí |
| Generadores registrados sin shell, con timeout y drift | `sdd-project.mjs generate` + controles SEC-AUTO | Sí cuando el proyecto los activa |
| Contrato, enlaces, placeholders y co-cambio documental contra SHA base | `check-sdd --docs-diff --base <SHA>` + gates `docs:*` configurados | Sí |
| Skills de terceros fijadas y con licencia verificada | `scripts/skills-sync.mjs --check` | Sí |

En este repositorio de plantilla, el workflow de calidad ejecuta además `--strict` sobre las specs
entregadas que definen contratos vivos, incluidas 009 y 010. La matriz portable valida Node
18/20/22 en Windows y Linux; un tag se crea únicamente después de observar verde el SHA exacto.

---

## Regla final

> **Nada se marca como terminado sin ejecutar los tests y mostrar la salida real.**
>
> "Los tests pasan" sin la salida pegada no cuenta como verificación. Ni para un humano,
> ni para un agente.
>
> Y su corolario, que se olvida siempre: **"no ejecutado" es un resultado válido y se
> escribe.** Un control que no se corrió no es un control aprobado: es un riesgo sin dueño.
> Por eso `evidence.md` tiene una sección obligatoria para ellos.
