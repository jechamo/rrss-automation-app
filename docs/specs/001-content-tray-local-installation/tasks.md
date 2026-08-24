# Tareas · 001-content-tray-local-installation

| Campo | Valor |
|---|---|
| **Spec** | [`spec.md`](./spec.md) · `approved` |
| **Diseño** | [`design.md`](./design.md) · `approved` |
| **Plan** | [`plan.md`](./plan.md) · `approved` por norkc, 2026-08-21 |
| **Fecha** | 2026-08-21 |
| **Impacto de seguridad** | `sensible` · ASVS 5.0.0 L2 |
| **Impacto de usabilidad** | `aplicable` |
| **Impacto de documentación** | `aplicable · DOC-README-INSTALACION` |
| **Gate de producto** | `legacy-pending`. Riesgo aceptado en el gate del plan. **No es verde.** |

## Resumen

| Métrica | Valor |
|---|---|
| Tareas | 8 |
| Por capa | domain 2 · application 1 · infrastructure 1 · interfaces 2 · docs 1 |
| Estimación | S 1 · M 3 · L 3 |
| Paralelizables | 2 (`T-001-01` y `T-001-02`) |
| Terrenos | middle 3 · infra 1 · front 1 · test/infra 1 · docs 1 |

Orden de ejecución: `T-001-01` → `T-001-02` → `T-001-03` → `T-001-04` → `T-001-05` → `T-001-06` →
`T-001-07` → `T-001-08`. La última tarea es un parche de continuidad aprobado expresamente y no
reabre el expediente de producto. Respeta domain → application → infrastructure → interfaces → transversal y MoSCoW: todos
los *must* (`RF-01`, `RF-02`, `RF-04`, `RF-05`) quedan cubiertos antes de que `T-001-06` cierre el
único *could* de interfaz (`RF-03`).

## Trazabilidad

| OBJ | PRD-RF | UC | RF | CA | Tareas | Test / evidencia esperada |
|---|---|---|---|---|---|---|
| OBJ-005 | PRD-RF-007 | UC-010 | RF-01 | CA-01 | T-001-01, T-001-06 | `selection.test.ts::debe_sincronizar_activo_y_detalle_cuando_cambia_indice` · `ContentTray.test.tsx::debe_actualizar_detalle_en_una_activacion` |
| OBJ-005 | PRD-RF-007 | UC-010 | RF-02 | CA-02 | T-001-01, T-001-06 | `selection.test.ts::debe_reconciliar_activo_cuando_desaparece` · `ContentTray.test.tsx::debe_anunciar_detalle_actualizado` |
| OBJ-005 | PRD-RF-012 | UC-010 | RF-03 | CA-03 | T-001-06 | `ContentTray.test.tsx::debe_conservar_plegados_independientes` |
| OBJ-004 | PRD-RF-005 | UC-011 | RF-04 | CA-04 | T-001-04, T-001-07 | `install-local.test.mjs::debe_requerir_persistencia_antes_de_ready` · revisión de clonación limpia |
| OBJ-004 | PRD-RF-006 | UC-012 | RF-05 | CA-05 | T-001-03, T-001-05 | `installation.test.mjs::debe_bloquear_reset_sin_confirmacion_separada` · `install-local.test.mjs::debe_exigir_confirmacion_separada_para_reset` |
| OBJ-004 | PRD-RF-008 | UC-011 | RF-06 | CA-06 | T-001-03, T-001-07 | `installation.test.mjs::debe_declarar_opcional_sin_bloquear_ready` · README |
| OBJ-004 | PRD-RF-006 | UC-012 | RF-07 | CA-07 | T-001-02, T-001-05 | `installation.test.mjs::debe_sanear_diagnostico_local` · `install-local.test.mjs::debe_requerir_confirmacion_por_pid` |
| OBJ-004 | PRD-RF-006 | UC-012 | RF-08 | CA-08 | T-001-03, T-001-05 | `installation.test.mjs::debe_recalcular_recibo_en_cada_ejecucion` |

### Cobertura de controles

| Control | Tarea | Test |
|---|---|---|
| SEC-INPUT-001 | T-001-02 | `installation.test.mjs::debe_rechazar_ruta_fuera_del_proyecto` |
| SEC-DATA-002 | T-001-03 | `installation.test.mjs::debe_bloquear_datos_existentes_sin_reset_confirmado` |
| SEC-PROC-003 | T-001-04 | `install-local.test.mjs::debe_requerir_confirmacion_por_pid` |
| SEC-DIAG-004 | T-001-02 | `installation.test.mjs::debe_sanear_diagnostico_local` |
| SEC-DEPS-005 | T-001-04 | `install-local.test.mjs::debe_clasificar_instalacion_global_como_efecto_externo` |
| UX-A11Y-001 a UX-A11Y-007 | T-001-06 | `ContentTray.test.tsx` y `PieceCarousel.test.tsx` (parte semántica) + revisión manual |
| UX-FORM-001 | T-001-05 | `install-local.test.mjs::debe_exigir_confirmacion_separada_para_reset` |
| UX-COPY-001 | T-001-03 | `installation.test.mjs::debe_devolver_recuperacion_segura` |
| UX-PERF-001 | T-001-06 | `ContentTray.test.tsx::debe_actualizar_detalle_en_una_activacion` |
| DOC-README-INSTALACION | T-001-07 | `node scripts/check-sdd.mjs --spec 001 --json` + clonación manual |

- [x] Todo `RF` tiene al menos una tarea
- [x] Todo `CA` tiene un test en alguna tarea
- [x] Toda tarea de producto cubre la cadena `OBJ → PRD-RF → UC → RF → CA`
- [x] Toda tarea declara Terreno y Skill
- [x] Todo control aplicable de seguridad tiene tarea, test y evidencia previstos
- [x] Todo control aplicable de usabilidad tiene tarea, test y evidencia previstos
- [x] Toda tarea de interfaz cubre los seis estados
- [x] Todo control no aplicable conserva una justificación material
- [x] No hay tareas que la spec no pida

---

## T-001-01 · Fijar la regla pura de reconciliación de la pieza activa

- Estado: hecho · 2026-08-21 · evidencia en [`evidence.md`](./evidence.md#t-001-01--regla-pura-de-reconciliación-de-la-pieza-activa)
- Terreno: middle
- Skill: /middle
- Capa: domain
- Cubre: OBJ-005 → PRD-RF-007 → UC-010 → RF-01, RF-02 → CA-01, CA-02
- Controles de seguridad: no aplica. La función recibe solo identificadores ya presentes en la
  colección que el cliente tiene cargada; no toca filesystem, procesos, configuración ni entrada no
  confiable. Ningún `SEC-*` de `plan.md` §9 la alcanza.
- Controles de usabilidad: no aplica directamente, porque no renderiza. Produce el `outcome` del que
  dependen `UX-A11Y-006` y `UX-PERF-001`, verificados en `T-001-06`.
- Documentación: no aplica. Módulo interno sin superficie documentada; `DOC-README-INSTALACION` cubre
  únicamente la instalación.
- Test que la define: `src/core/content/selection.test.ts::debe_reconciliar_activo_cuando_desaparece`
- Depende de: ninguna
- Ficheros previstos: `src/core/content/selection.ts`, `src/core/content/selection.test.ts`,
  `package.json`
- Estimación: S
- Paralelizable: [P] sí, con `T-001-02`

### Contrato

Lo fija [`design.md`](./design.md), no `data-model.md`. `data-model.md` modela el valor resultante;
`design.md` exige además tres microcopys distinguibles (líneas 125-127, 144 y 157), y devolver solo
`string | null` obligaría a la interfaz a deducir cuál ocurrió comparando con su estado anterior: una
segunda fuente de verdad, justo el defecto que la spec corrige.

```ts
type Reconciliation =
  | { pieceId: string; outcome: "kept" }
  | { pieceId: string; outcome: "replaced" }
  | { pieceId: null; outcome: "empty" };

function reconcileActivePiece(
  previousId: string | null,
  previousIndex: number,
  pieceIds: readonly string[],
): Reconciliation;
```

Prioridad: conservar → vecina siguiente → vecina anterior → vacío. `previousIndex` es necesario
porque, desaparecido el ID, la posición que ocupaba es la única vía para localizar a su vecina.

### Casos del RED

| Caso | Entrada | Salida esperada |
|---|---|---|
| Conservar | `previousId` sigue en la colección | `{ pieceId: previousId, outcome: "kept" }` |
| Vecina siguiente | `previousId` ausente y existe `pieceIds[previousIndex]` | `{ pieceId: pieceIds[previousIndex], outcome: "replaced" }` |
| Vecina anterior | `previousId` ausente y era la última posición | `{ pieceId: pieceIds[previousIndex - 1], outcome: "replaced" }` |
| Vacío | `pieceIds` vacío | `{ pieceId: null, outcome: "empty" }` |
| Primera carga | `previousId === null` y colección no vacía | `{ pieceId: pieceIds[0], outcome: "kept" }` |
| Índice fuera de rango | `previousIndex` mayor que la colección encogida | Última posición válida, sin excepción |

El caso «primera carga» devuelve `kept` de forma deliberada: nadie perdió una pieza al abrir la
vista, y emitir `replaced` dispararía el microcopy «La pieza que revisabas ya no está disponible»
sobre una persona que nunca revisó nada. Es el error silencioso más probable de esta regla.

### Ediciones de `package.json`

Son **dos**, y omitir la segunda produce un verde falso: el test compilaría sin error y nadie lo
ejecutaría. Ver `plan.md` §3.2.

1. Añadir `src/core/content/selection.ts` y `src/core/content/selection.test.ts` a la lista de `tsc`
   de `test:contracts`.
2. Añadir el glob `.contract-tests/content/*.test.js` a la lista de `node --test` del mismo script.

### Definición de hecho

`npm run test:contracts` **ejecuta** el fichero: el RED falla al ejecutarse, no solo compila. Los seis
casos pasan en GREEN. `selection.ts` no importa React, Prisma, `fs` ni nada de `src/components`.

---

## T-001-02 · Tipos, validación de rutas y saneamiento del diagnóstico de instalación

- Estado: hecho · 2026-08-21 · evidencia en [`evidence.md`](./evidence.md#t-001-02--tipos-rutas-y-diagnóstico-seguro-de-instalación)
- Terreno: middle
- Skill: /middle
- Capa: domain
- Cubre: OBJ-004 → PRD-RF-006 → UC-012 → RF-07 → CA-07
- Controles de seguridad: `SEC-INPUT-001` (validar argumentos, plataforma y rutas contenidas bajo la raíz
  del proyecto; nunca leer `.env`) y `SEC-DIAG-004` (el DTO de diagnóstico expone solo categoría, estado y
  siguiente paso).
- Controles de usabilidad: no aplica. Es una capa sin interfaz; el texto de recuperación que consume
  `UX-COPY-001` se compone en `T-001-03`.
- Documentación: no aplica. Los tipos públicos ya están fijados en
  [`contracts/internal-cli.md`](contracts/internal-cli.md); `T-001-07` documenta el recorrido humano.
- Test que la define: `src/core/installation/installation.test.mjs::debe_sanear_diagnostico_local`
- Depende de: ninguna
- Ficheros previstos: `src/core/installation/types.mjs`, `src/core/installation/paths.mjs`,
  `src/core/installation/diagnostics.mjs`, `src/core/installation/installation.test.mjs`,
  `package.json`
- Estimación: M
- Paralelizable: [P] sí, con `T-001-01`

### Restricción de runtime

JavaScript ESM con JSDoc, no TypeScript. El asistente arranca sobre un clon sin `node_modules`, así
que no puede depender de `typescript` para ejecutarse. Justificación completa en `plan.md` §3.3 y
`research.md` §`D-CLI-RUNTIME`. Consecuencia práctica: aquí basta **una** edición de `package.json`
—añadir `src/core/installation/*.test.mjs` a `node --test`—, no las dos de `T-001-01`.

Desviación registrada: `plan.md` §9 y `test-plan.md` nombran `installation.test.ts`. Los nombres de
caso no cambian, así que la trazabilidad de `SEC-INPUT-001` y `SEC-DIAG-004` se conserva.

### Casos del RED

| Caso | Comportamiento esperado |
|---|---|
| `debe_rechazar_ruta_fuera_del_proyecto` | Ruta absoluta, `..` o enlace que escape de la raíz: rechazo sin leer ni mostrar contenido. |
| `debe_rechazar_lectura_de_configuracion_sensible` | Cualquier intento de resolver `.env` se rechaza aunque esté dentro de la raíz. |
| `debe_sanear_diagnostico_local` | Un error de entrada que contiene `DATABASE_URL`, una ruta personal simulada y salida cruda de proceso produce un `CheckResult` con solo `id`, `classification`, `status`, `category` y `nextStep`. |
| `debe_normalizar_error_desconocido_como_bloqueo` | Una categoría no reconocida se trata como bloqueada, nunca como correcta. |

### Definición de hecho

Ninguna fixture toca `prisma/dev.db`, `.env`, PII ni rutas reales: solo IDs y directorios temporales
sintéticos. Un test comprueba por serialización que la salida no contiene ninguna de las cadenas
sensibles inyectadas.

---

## T-001-03 · Casos de uso de precheck, clasificación, consentimiento y recibo

- Estado: hecho · 2026-08-21 · evidencia en [`evidence.md`](./evidence.md#t-001-03--precheck-capacidades-consentimiento-y-recibo)
- Terreno: middle
- Skill: /middle
- Capa: application
- Cubre: OBJ-004 → PRD-RF-006, PRD-RF-008 → UC-011, UC-012 → RF-05, RF-06, RF-08 → CA-05, CA-06,
  CA-08
- Controles de seguridad: `SEC-DATA-002` (los datos SQLite y sidecars existentes se bloquean y preservan;
  el reset exige consentimiento separado y resguardo, nunca borrado automático).
- Controles de usabilidad: `UX-COPY-001` (cada diagnóstico da categoría, recuperación y alternativa
  sin datos locales).
- Documentación: no aplica directamente; el recibo que produce esta capa es la fuente de verdad que
  `T-001-07` refleja en el README.
- Test que la define:
  `src/core/installation/installation.test.mjs::debe_bloquear_datos_existentes_sin_reset_confirmado`
- Depende de: `T-001-02`
- Ficheros previstos: `src/core/installation/precheck.mjs`, `src/core/installation/capabilities.mjs`,
  `src/core/installation/consent.mjs`, `src/core/installation/receipt.mjs`,
  `src/core/installation/installation.test.mjs`
- Estimación: L
- Paralelizable: no

### Casos del RED

| Caso | Comportamiento esperado |
|---|---|
| `debe_bloquear_datos_existentes_sin_reset_confirmado` | Con base o sidecar detectado: `overallStatus: "blocked"`, datos preservados y ninguna lectura de su contenido. |
| `debe_bloquear_reset_sin_confirmacion_separada` | El reset requiere una segunda confirmación propia; sin ella no hay efecto y el bloqueo se mantiene. |
| `debe_declarar_opcional_sin_bloquear_ready` | Una capacidad opcional ausente aparece en `optional[]` con su efecto funcional y `requiredComplete` sigue siendo `true`. |
| `debe_recalcular_recibo_en_cada_ejecucion` | Dos ejecuciones sobre el mismo estado producen el mismo recibo; una ejecución interrumpida no hereda `ready` de la anterior. |
| `debe_devolver_recuperacion_segura` | Todo `CheckResult` bloqueado nombra categoría, siguiente paso y alternativa, sin valores de configuración. |
| `debe_rechazar_ready_con_obligatorio_pendiente` | `overallStatus: "ready"` es imposible si algún obligatorio no está `ok`. |

### Definición de hecho

El precheck no produce ningún efecto observable: un test comprueba que, sobre un directorio temporal,
el estado del filesystem antes y después es idéntico. `ready` solo se alcanza con
`requiredComplete === true`, cubriendo `RN-03`.

---

## T-001-04 · Adaptadores locales de filesystem, proceso, puerto y persistencia

- Estado: hecho · 2026-08-21 · corrección TDD final verificada · evidencia en [`evidence.md`](./evidence.md#t-001-0405--corrección-tdd-final)
- Terreno: infra
- Skill: /middle (cubre integraciones e infraestructura de servidor; no hay skill específica de
  adaptadores locales)
- Capa: infrastructure
- Cubre: OBJ-004 → PRD-RF-005 → UC-011 → RF-04 → CA-04
- Controles de seguridad: `SEC-PROC-003` (procesos con argv separado y `shell:false`; nunca terminar por
  imagen global, solo PID o puerto detectado y confirmado) y `SEC-DEPS-005` (las dependencias se preparan
  con npm bajo consentimiento; no se instala globalmente ni se modifica el PATH).
- Controles de usabilidad: no aplica. Los adaptadores no dialogan con la persona; el consentimiento
  se presenta en `T-001-05`.
- Documentación: no aplica. `T-001-07` documenta el resultado, no el adaptador.
- Test que la define: `scripts/install-local.test.mjs::debe_requerir_confirmacion_por_pid`
- Depende de: `T-001-03`
- Ficheros previstos: `src/core/installation/adapters/filesystem.mjs`,
  `src/core/installation/adapters/process.mjs`, `src/core/installation/adapters/port.mjs`,
  `src/core/installation/adapters/persistence.mjs`, `scripts/install-local.test.mjs`, `package.json`
- Estimación: L
- Paralelizable: no

### Por qué los tests viven en `scripts/install-local.test.mjs`

`plan.md` §9 ancló ahí la evidencia de `SEC-PROC-003` y `SEC-DEPS-005`, y `test-plan.md` hace lo mismo con
`RF-04`. Se respeta: lo que hay que fijar es el **comportamiento observable** del adaptador —qué argv
compone, qué consentimiento exige antes de actuar, qué devuelve cuando la persistencia no está
preparada—, no su implementación interna. El fichero se crea en esta tarea y `T-001-05` lo amplía con
sus propios casos.

### Casos del RED

| Caso | Comportamiento esperado |
|---|---|
| `debe_requerir_confirmacion_por_pid` | Una acción sobre proceso solo puede referirse a un PID o puerto detectado y confirmado. `taskkill /IM node.exe` o equivalente por imagen global se rechaza siempre. |
| `debe_clasificar_instalacion_global_como_efecto_externo` | Instalar globalmente o modificar el PATH se clasifica como `outside-project` y esta spec no lo autoriza: se rechaza. |
| `debe_requerir_persistencia_antes_de_ready` | Sin persistencia local comprobada, el resultado nunca es `ready`. |
| `debe_invocar_procesos_sin_shell` | Todo proceso hijo se lanza con argumentos separados y sin shell. |
| `debe_preservar_datos_detectados` | El adaptador de persistencia no crea, migra ni borra nada cuando detecta una base o sidecar existente. |

### Definición de hecho

Ninguna prueba lanza procesos reales del sistema ni toca `prisma/dev.db`: se usan dobles y
directorios temporales. Añadir `scripts/install-local.test.mjs` a `node --test` en `test:contracts`.

---

## T-001-05 · Asistente de consola lineal con consentimientos y recibo

- Estado: hecho · 2026-08-21 · corrección TDD final verificada · evidencia en [`evidence.md`](./evidence.md#t-001-0405--corrección-tdd-final)
- Terreno: infra
- Skill: /middle
- Capa: interfaces
- Cubre: OBJ-004 → PRD-RF-006 → UC-012 → RF-05, RF-07, RF-08 → CA-05, CA-07, CA-08
- Controles de seguridad: `SEC-PROC-003` y `SEC-DIAG-004` heredados: la consola no imprime valores de entorno,
  rutas personales, contenido SQLite ni salida cruda de procesos.
- Controles de usabilidad: `UX-FORM-001` (consentimiento visible, separado y sin opción afirmativa
  predeterminada; rechazar conserva el estado) y `UX-COPY-001` en su presentación.
- Documentación: alimenta `DOC-README-INSTALACION`; `T-001-07` depende de que esta superficie esté
  estabilizada.
- Test que la define: `scripts/install-local.test.mjs::debe_exigir_confirmacion_separada_para_reset`
- Depende de: `T-001-04`
- Ficheros previstos: `scripts/install-local.mjs`, `scripts/install-local.test.mjs`, `package.json`
- Estimación: M
- Paralelizable: no

### Forma del módulo

`scripts/install-local.mjs` exporta una función pura de orquestación —el recorrido de pasos, las
peticiones de confirmación y la composición del recibo— que recibe sus adaptadores y su entrada/salida
por parámetro. El arranque real los inyecta. Así los tests ejercitan el recorrido completo con dobles,
sin lanzar procesos ni escribir en disco, y sin duplicar la lógica del núcleo.

### Los seis estados

La consola es una superficie de interfaz y debe cubrir los seis estados de `design.md` §5, no solo el
camino feliz: vacío («El asistente todavía no ha comprobado este equipo»), cargando (paso y categoría
en curso), parcial (obligatorios correctos con opcionales limitados), error (categoría, resultado
seguro y recuperación), bloqueado (plataforma, permiso, datos protegidos o confirmación rechazada) y
éxito («Uso local básico preparado»). Cada uno termina en una única conclusión legible.

### Casos del RED

| Caso | Comportamiento esperado |
|---|---|
| `debe_exigir_confirmacion_separada_para_reset` | El reset necesita una confirmación propia, distinta de la del diagnóstico y no preseleccionada. |
| `debe_conservar_estado_al_rechazar_confirmacion` | Rechazar no ejecuta el paso, no es un fallo técnico y mantiene el bloqueo pendiente. |
| `debe_terminar_en_una_sola_conclusion` | Cada ejecución acaba en «Uso local básico preparado» o «Preparación bloqueada», nunca en ambas ni en ninguna. |
| `debe_repetir_estado_tras_interrupcion` | Una ejecución reanudada vuelve a mostrar el estado de cada paso y no hereda `ready`. |
| `debe_bloquear_fuera_de_windows_11` | Fuera de la plataforma soportada comunica el alcance y detiene el recorrido; no declara preparación. |
| `debe_omitir_datos_sensibles_en_la_salida` | La salida completa, en éxito y en error, no contiene valores de entorno, rutas personales ni contenido local. |

### Definición de hecho

Los seis estados tienen su caso. La salida se puede leer y copiar sin color. `RN-05` y `RN-06` quedan
cubiertas por casos observables.

---

### T-001-06 · Unificar la pieza activa en `ContentTray` y `PieceCarousel`

- Estado: hecho · 2026-08-22 · evidencia en [`evidence.md`](./evidence.md#t-001-06--unificar-la-pieza-activa-en-contenttray-y-piececarousel)
- Terreno: front
- Skill: /front
- Capa: interfaces
- Cubre: OBJ-005 → PRD-RF-007, PRD-RF-012 → UC-010 → RF-01, RF-02, RF-03 → CA-01, CA-02, CA-03
- Controles de seguridad: no aplica. No hay entrada no confiable, autenticación ni acceso a
  filesystem: la vista consume la colección que la API de contenido ya devuelve y solo cambia estado
  de presentación. Ningún `SEC-*` de `plan.md` §9 la alcanza.
- Controles de usabilidad: `UX-A11Y-001` a `UX-A11Y-007`, `UX-PERF-001`.
  Trazabilidad de test por control:
  `UX-A11Y-001` → `ContentTray.test.tsx::debe_mantener_contraste_y_estado_activo`
  `UX-A11Y-002` → `ContentTray.test.tsx::debe_exponer_estado_activo_en_texto`
  `UX-A11Y-003` → `ContentTray.test.tsx::debe_conservar_foco_del_control_activado`
  `UX-A11Y-004` → `ContentTray.test.tsx::debe_mantener_controles_accesibles`
  `UX-A11Y-005` → `PieceCarousel.test.tsx::debe_nombrar_indicador_y_pieza_activa`
  `UX-A11Y-006` → `ContentTray.test.tsx::debe_anunciar_detalle_actualizado`
  `UX-A11Y-007` → `PieceCarousel.test.tsx::debe_conservar_seleccion_sin_movimiento`
  `UX-PERF-001` → `ContentTray.test.tsx::debe_actualizar_detalle_en_una_activacion`
- Documentación: no aplica. Sin superficie documental propia.
- Test que la define: `src/components/ContentTray.test.tsx::debe_actualizar_detalle_en_una_activacion`
- Depende de: `T-001-01`
- Ficheros previstos: `src/components/ContentTray.tsx`, `src/components/PieceCarousel.tsx`,
  `src/components/ContentTray.test.tsx`, `src/components/PieceCarousel.test.tsx`,
  `vitest.config.ts`, `package.json`
- Estimación: L
- Paralelizable: no

### Precondición humana

`npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event`
(y opcionalmente `@testing-library/jest-dom`) debe ejecutarlo la persona en su máquina: el DNS externo
no resuelve desde la shell del agente (AGENTS.md §2). Son **cinco paquetes imprescindibles y uno
opcional**, no dos; el detalle y las alternativas descartadas están en `research.md` §`D-RUNNER-UI` y
en `plan.md` §3.1. Aprobado por norkc el 2026-08-21. Es la única tarea con esta precondición.

`vitest.config.ts` resuelve el alias `@` con `resolve.alias`, sin añadir `vite-tsconfig-paths`.
`package.json` gana un script `test:ui`.

### Cambio de fondo

`ContentTray` pasa a ser la única fuente de la pieza activa. `PieceCarousel` recibe la selección y
propaga `active`/`onActive` a `Carousel3D`, que ya los admite —`ExpandableCarousel` lo usa así—, de
modo que tarjeta lateral, anterior, siguiente e indicador dejen de mover un índice interno invisible
para el detalle. Desaparece el fallback `?? pieces[0]`, sustituido por `reconcileActivePiece`. El mapa
de plegados se reinicia al cargar una colección nueva y se conserva durante la sesión.

### Los seis estados

Vacío, cargando, parcial, error, sin permiso o bloqueado y éxito forman parte de esta tarea, no de
otra. `design.md` §2 y §3 fijan el microcopy de cada uno en carrusel y lista.

### Casos del RED

| Caso | Control | Comportamiento esperado |
|---|---|---|
| `debe_actualizar_detalle_en_una_activacion` | UX-PERF-001 | Tarjeta lateral, anterior, siguiente e indicador cambian el detalle sin segunda activación. |
| `debe_anunciar_detalle_actualizado` | UX-A11Y-006 | Región educada anuncia la pieza activa; el bloqueo usa la asertiva. |
| `debe_conservar_plegados_independientes` | — | Abrir una unidad no altera las demás; una colección recién cargada empieza plegada. |
| `debe_exponer_estado_activo_en_texto` | UX-A11Y-002 | El estado se comunica con texto o etiqueta además de color. |
| `debe_conservar_foco_del_control_activado` | UX-A11Y-003 | El foco permanece en el control usado tras seleccionar o plegar. |
| `debe_nombrar_indicador_y_pieza_activa` | UX-A11Y-005 | «Ir a pieza 5 de 12» y equivalentes; los indicadores no son puntos sin nombre. |
| `debe_conservar_seleccion_sin_movimiento` | UX-A11Y-007 | Con `prefers-reduced-motion` se conservan orden, selección y controles. |
| `debe_vaciar_detalle_sin_residuo` | — | Al desaparecer la última pieza no queda título, vídeo ni acción de la anterior. |
| `debe_activar_vecina_al_desaparecer_la_activa` | — | Consume el `outcome` de `T-001-01` para elegir el microcopy correcto entre los tres. |

### Límite honesto de la automatización

`UX-A11Y-001` (contraste medido sobre tokens finales) y `UX-A11Y-004` (área de los controles con zoom
al 200 %) **no** son verificables en `jsdom`, que no calcula layout ni resuelve variables CSS. El test
automático cubre su parte semántica; la medición queda como revisión manual de `code-reviewer` en
`/sdd-verify` y se registra en `evidence.md` como control ejecutado manualmente. No se declara verde
lo que no se ha medido.

### Definición de hecho

`npm run test:ui` en verde con los nueve casos. Los seis estados están cubiertos. Ninguna vía de
navegación puede dejar carrusel y detalle en piezas distintas, cumpliendo `RN-01`.

---

### T-001-07 · Documentar el recorrido de clonación limpia en el README

- Estado: hecho · 2026-08-22 · evidencia en [`evidence.md`](./evidence.md#t-001-07--documentar-el-recorrido-de-clonación-limpia-en-el-readme)
- Terreno: docs
- Skill: /docs-sync
- Capa: docs
- Cubre: OBJ-004 → PRD-RF-005, PRD-RF-008 → UC-011 → RF-04, RF-06, RF-07 → CA-04, CA-06, CA-07
- Controles de seguridad: `SEC-DIAG-004` en su vertiente documental: la guía no imprime `DATABASE_URL`,
  secretos, rutas personales ni contenido de datos locales, y no lee `.env` para redactarse.
- Controles de usabilidad: `UX-COPY-001`. La guía es una superficie de lectura: cada paso dice qué se
  comprueba, qué resultado esperar y qué hacer si no ocurre.
- Documentación: `DOC-README-INSTALACION` · artefacto `README.md` · propietario `docs-writer` ·
  fuente de verdad: `spec.md`, `contracts/internal-cli.md` y `.env.example`.
- Test que la define: `node scripts/check-sdd.mjs --spec 001 --json` más una revisión de clonación
  limpia en Windows 11 registrada en `evidence.md`.
- Depende de: `T-001-05`
- Ficheros previstos: `README.md`, `docs/bitacora/DECISIONS.md`
- Estimación: M
- Paralelizable: no

### Alcance

Encabeza con el **contrato de preparación** de `design.md` §4: «persistencia comprobada», «arranque
comprobado» y «opcionales identificados». Pasos numerados y regresables, y la clasificación visible de
capacidades en tres clases: obligatoria, opcional bloqueada y opcional degradada. Explica que el
arranque limpio existente puede afectar procesos y caché, sin presentarlo como inocuo y sin
dispararlo desde la documentación.

Depende de `T-001-05` porque el README debe describir el contrato que el asistente realmente
implementa. Documentar antes garantiza deriva: es el riesgo que `plan.md` §13 ya identificó.

### Cierre de fase

Esta tarea incluye la entrada en `docs/bitacora/DECISIONS.md` con las decisiones tomadas al planificar:
el runner de UI y su coste real, la restricción de runtime del asistente y el contrato de tres
desenlaces de la regla de selección.

No incluye las auditorías. `/security-scan verify` y la auditoría de usabilidad de `code-reviewer`
pertenecen a `/sdd-verify`, ambos en solo lectura, y sus informes los materializa `docs-writer` en
`docs/security/reports/` y `docs/design/reports/`.

### Definición de hecho

Una persona que clona el repositorio en Windows 11 llega al arranque local siguiendo solo el README, o
se detiene en un único bloqueo accionable con su siguiente paso. Ningún ejemplo contiene valores
reales de configuración.

---

### T-001-08 · Actualizar SDD y endurecer la instalación sin perder estado local

- Estado: completada · 2026-08-24
- Terreno: middle / infra / docs
- Skill: `/sdd-refresh`, `/middle`, `/docs-sync`, `/security-scan`, `/sdd-verify`, `/bitacora`
- Capa: transversal
- Cubre: continuidad de OBJ-004 → UC-011/UC-012 → RF-04/RF-05/RF-06/RF-07 → CA-04/CA-05/CA-06/CA-07
- Seguridad: sensible. Protege la pareja Vault, SQLite, medios y sesiones; prohíbe resets automáticos.
- Test dirigido: Vault corrupto o incompleto, build obligatorio, health readiness y Chromium ausente.
- Excepción humana: norkc aprueba no crear nueva spec, diseño, plan, test-plan ni evidencia TDD por
  presupuesto de tokens. Se mantienen tests dirigidos, build, CI, revisión y rollback. No se declara
  `light`: el circuito y los trailers permanecen `full`.

#### Alcance

Actualizar el marco instalado de SDD 0.7.0 a 0.9.1 fijando el SHA oficial; versionar exclusivamente
el código del Vault que `.gitignore` ocultaba por error; mantener el formato AES-256-GCM y las rutas
locales; exigir build y readiness real al instalador; conservar `/ajustes` manual; detectar Chromium
por su ejecutable; configurar gates existentes y corregir la descripción del crawler HTTP.

No cambia el esquema Prisma, no crea seeds, no rota claves, no llama proveedores pagados y no toca
los datos locales del operador. El snapshot externo verificado es el punto de restauración.

---

## Riesgos de ejecución

| Riesgo | Señal temprana | Mitigación |
|---|---|---|
| Verde falso en `T-001-01` | El RED «pasa» sin haber escrito `selection.ts`. | Exigir que el RED **falle al ejecutarse**; comprobar la edición 2 de `test:contracts`. |
| `T-001-06` se queda bloqueada sin red | `npm install -D` falla en la shell del agente. | Es precondición humana declarada; `T-001-01` a `T-001-05` avanzan sin ella. |
| Contraste declarado verde sin medirlo | `jsdom` no falla, luego «pasa». | El límite está escrito en la tarea; la medición es manual y se registra como tal. |
| El asistente se vuelve indepurable por el runtime JS | Aparecen errores de tipo en ejecución. | JSDoc en los módulos y tipos ya fijados en el contrato interno; tests de forma del recibo. |
| Gate de producto interpretado como verde | Alguien cita la spec aprobada como aprobación de producto. | El PRD sigue en `legacy-pending` y consta como riesgo aceptado, no como aprobación. |

### HANDOFF
- Agente origen: planner
- Fase completada: plan + tasks
- Fuentes consultadas: `AGENTS.md`, `.agents/skills/sdd-tasks/SKILL.md`, `spec.md`, `clarifications.md`, `design.md`, `data-model.md`, `contracts/internal-cli.md`, `test-plan.md`, `research.md`, `package.json`, `ContentTray.tsx`, `PieceCarousel.tsx`, `Carousel3D.tsx`, `.sdd/territories.json`, `.sdd/docs.json`
- Artefactos: `docs/specs/001-content-tray-local-installation/research.md` (ampliado), `plan.md` (aprobado), `tasks.md` (nuevo)
- Tareas: 7 (S:1 M:3 L:3) · paralelizables: 2
- Cobertura: 2/2 OBJ · 5/5 PRD-RF · 3/3 UC · 8/8 RF · 8/8 CA
- Terrenos / skills: middle 3 · infra 2 · front 1 · docs 1. `T-001-04` y `T-001-05` usan `/middle` por ser infraestructura de servidor; no existe skill específica de adaptadores locales.
- Seguridad: `sensible` · 5/5 controles con tarea, test y evidencia previstos. SCA no configurada: se registrará como no ejecutada, no como verde.
- Usabilidad: `aplicable` · 10/10 controles con tarea y test previstos, de los cuales `UX-A11Y-001` y `UX-A11Y-004` solo son automatizables en su parte semántica.
- Decisiones tomadas: runner de UI Vitest + Testing Library con su coste real de 5-6 devDependencies; `src/core/installation/*` en JavaScript ESM por la restricción de arranque sin `node_modules`; contrato de tres desenlaces para `reconcileActivePiece`.
- Supuestos: la persona ejecuta `npm install -D` del runner antes de `T-001-06`; el resto del backlog no lo necesita.
- Discrepancias: `plan.md` §9 y `test-plan.md` nombran `installation.test.ts`; se materializa como `installation.test.mjs` sin cambiar los nombres de caso ni el alcance.
- Bloqueos: ninguno para empezar `T-001-01`. El gate de producto sigue en `legacy-pending` como riesgo aceptado.
- Primera tarea a ejecutar: `T-001-01`
- Siguiente agente sugerido: implementer — comando: `/sdd-implement T-001-01`
- Comando / contexto durable: `/sdd-implement`; releer `tasks.md`, `plan.md` §3.1-§3.3 y §7.1, y `research.md` §`D-RUNNER-UI`, §`D-TEST-CONTRACTS`, §`D-CLI-RUNTIME` y §`D-SELECTION-CONTRACT`.
