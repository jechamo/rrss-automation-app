# Evidencia · 001-content-tray-local-installation

Registro de la salida real de los tests por tarea. No se declara verde nada que no
aparezca aquí con su salida.

---

## T-001-01 · Regla pura de reconciliación de la pieza activa

- Cubre: OBJ-005 → PRD-RF-007 → UC-010 → **RF-01, RF-02** → CA-01, CA-02
- Test: [`src/core/content/selection.test.ts`](../../../src/core/content/selection.test.ts)
- Implementación: [`src/core/content/selection.ts`](../../../src/core/content/selection.ts)
- Comando: `npm run test:contracts`
- Runner: `node --test` sobre la salida de `tsc` (glob `.contract-tests/content/*.test.js`)

Casos cubiertos (los seis del contrato de `design.md` §2 y `tasks.md`):

| Caso | Test | RF |
|---|---|---|
| Conservar (id presente) | `debe_sincronizar_activo_y_detalle_cuando_cambia_indice` | RF-01 |
| Reemplazar por vecina siguiente | `debe_reconciliar_activo_cuando_desaparece` | RF-02 |
| Reemplazar por vecina anterior (era la última) | `debe_activar_vecina_anterior_cuando_desaparece_la_ultima` | RF-02 |
| Vacío (colección vacía) | `debe_vaciar_cuando_la_coleccion_esta_vacia` | RF-02 |
| Primera carga (`previousId === null` → `kept`) | `debe_conservar_en_la_primera_carga_sin_activo_previo` | RF-01 |
| Índice fuera de rango (sin excepción) | `debe_acotar_el_indice_fuera_de_rango_sin_excepcion` | RF-02 |

### RED (2026-08-21)

El test **se ejecuta** y falla por aserción (no es un error de compilación por módulo
ausente): el stub inicial devolvía `{ pieceId: null, outcome: "empty" }`. Prueba de que
la edición 2 de `test:contracts` (glob `.contract-tests/content/*.test.js`) está aplicada.

```
✖ debe_sincronizar_activo_y_detalle_cuando_cambia_indice (4.1582ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
    actual:   { pieceId: null, outcome: 'empty' }
    expected: { pieceId: 'c',  outcome: 'kept' }
✖ debe_reconciliar_activo_cuando_desaparece (0.7118ms)
    actual:   { pieceId: null, outcome: 'empty' }
    expected: { pieceId: 'c',  outcome: 'replaced' }
✖ debe_activar_vecina_anterior_cuando_desaparece_la_ultima (2.0694ms)
    actual:   { pieceId: null, outcome: 'empty' }
    expected: { pieceId: 'c',  outcome: 'replaced' }
✔ debe_vaciar_cuando_la_coleccion_esta_vacia (0.3671ms)
✖ debe_conservar_en_la_primera_carga_sin_activo_previo (0.5545ms)
    actual:   { pieceId: null, outcome: 'empty' }
    expected: { pieceId: 'a',  outcome: 'kept' }
✖ debe_acotar_el_indice_fuera_de_rango_sin_excepcion (0.5006ms)
    actual:   { pieceId: null, outcome: 'empty' }
    expected: { pieceId: 'b',  outcome: 'replaced' }

ℹ tests 58
ℹ pass 53
ℹ fail 5
```

(El caso «vacío» pasó ya en RED porque el stub devolvía precisamente `empty`; los otros
cinco fallaron por aserción en ejecución. Exit code 1.)

### GREEN (2026-08-21)

Implementado `reconcileActivePiece`. Suite completa en verde:

```
✔ debe_sincronizar_activo_y_detalle_cuando_cambia_indice (2.6703ms)
✔ debe_reconciliar_activo_cuando_desaparece (0.3452ms)
✔ debe_activar_vecina_anterior_cuando_desaparece_la_ultima (0.252ms)
✔ debe_vaciar_cuando_la_coleccion_esta_vacia (1.5181ms)
✔ debe_conservar_en_la_primera_carga_sin_activo_previo (0.3157ms)
✔ debe_acotar_el_indice_fuera_de_rango_sin_excepcion (0.2397ms)

ℹ tests 58
ℹ pass 58
ℹ fail 0
```

Exit code 0.

### REFACTOR (2026-08-21)

Documentada la intención no obvia (caso «primera carga» → `kept`) y el acotado de índice
sin cambiar comportamiento. `npm run test:contracts` sigue en verde: `tests 58 · pass 58 ·
fail 0`, exit code 0.

### Definición de hecho

- [x] El RED **falla al ejecutarse** (5 aserciones), no solo compila.
- [x] Los seis casos pasan en GREEN.
- [x] `selection.ts` no importa React, Prisma, `fs` ni nada de `src/components` (cero imports).
- [x] Las dos ediciones de `test:contracts` aplicadas (lista de `tsc` + glob de `node --test`).

---

## T-001-02 · Tipos, rutas y diagnóstico seguro de instalación

- Cubre: OBJ-004 → PRD-RF-006 → UC-012 → **RF-07** → CA-07
- Tests: [`src/core/installation/installation.test.mjs`](../../../src/core/installation/installation.test.mjs)
- Implementación: [`types.mjs`](../../../src/core/installation/types.mjs), [`paths.mjs`](../../../src/core/installation/paths.mjs), [`diagnostics.mjs`](../../../src/core/installation/diagnostics.mjs)
- Runner: `node --test` directo sobre JavaScript ESM, registrado en `npm run test:contracts`

### RED (2026-08-21)

Cada comportamiento se añadió y ejecutó por separado. Los cuatro fallaron por aserción real:

1. Contención de ruta, ejecutado dentro de la suite completa:

```
✖ debe_rechazar_ruta_fuera_del_proyecto (7.6641ms)
AssertionError [ERR_ASSERTION]: Missing expected exception.
ℹ tests 59
ℹ pass 58
ℹ fail 1
```

2. Configuración sensible:

```
✔ debe_rechazar_ruta_fuera_del_proyecto (5.5401ms)
✖ debe_rechazar_lectura_de_configuracion_sensible (2.0051ms)
AssertionError [ERR_ASSERTION]: Missing expected exception.
ℹ tests 2
ℹ pass 1
ℹ fail 1
```

3. Saneamiento del diagnóstico:

```
✖ debe_sanear_diagnostico_local (1.7477ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
+ environment: 'DATABASE_URL=file:./synthetic-installation.db'
+ personalPath: 'C:\SyntheticUser\Profile\rrss-installation'
+ rawOutput: 'salida cruda sintética: --token=TOKEN_SINTETICO'
ℹ tests 3
ℹ pass 2
ℹ fail 1
```

4. Normalización conservadora:

```
✖ debe_normalizar_error_desconocido_como_bloqueo (1.1569ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
actual:   { status: 'future-ok', category: 'future-category', nextStep: undefined }
expected: { status: 'blocked', category: 'configuration', nextStep: 'Revisa la plantilla de configuración del proyecto.' }
ℹ tests 4
ℹ pass 3
ℹ fail 1
```

### GREEN (2026-08-21)

El cuarto ciclo dejó los cuatro comportamientos en verde:

```
✔ debe_rechazar_ruta_fuera_del_proyecto (12.8832ms)
✔ debe_rechazar_lectura_de_configuracion_sensible (2.1528ms)
✔ debe_sanear_diagnostico_local (1.3048ms)
✔ debe_normalizar_error_desconocido_como_bloqueo (0.1906ms)
ℹ tests 4
ℹ pass 4
ℹ fail 0
```

Suite completa tras GREEN:

```
✔ debe_rechazar_ruta_fuera_del_proyecto (8.0307ms)
✔ debe_rechazar_lectura_de_configuracion_sensible (2.3639ms)
✔ debe_sanear_diagnostico_local (1.1564ms)
✔ debe_normalizar_error_desconocido_como_bloqueo (0.2042ms)
ℹ tests 62
ℹ pass 62
ℹ fail 0
ℹ duration_ms 785.1552
```

### REFACTOR (2026-08-21)

Se separaron las normalizaciones de estado, categoría y clasificación, y la detección de segmentos de
ruta, sin ampliar el contrato. Verificación posterior:

```
✔ debe_rechazar_ruta_fuera_del_proyecto (6.4121ms)
✔ debe_rechazar_lectura_de_configuracion_sensible (1.8754ms)
✔ debe_sanear_diagnostico_local (1.0114ms)
✔ debe_normalizar_error_desconocido_como_bloqueo (0.6251ms)
ℹ tests 4
ℹ pass 4
ℹ fail 0
ℹ duration_ms 130.5096
```

### SEC-001

Las rutas absolutas externas, segmentos `..` y enlaces que resuelven fuera de la raíz producen un
error tipado genérico. `.env` se bloquea antes de resolver el candidato. Las fixtures fueron creadas
bajo directorios temporales sintéticos; no se leyó configuración ni persistencia del repositorio.

### SEC-004

`sanitizeDiagnostic` construye por selección únicamente `id`, `classification`, `status`, `category`
y `nextStep`. El test serializa el resultado y verifica la ausencia de `DATABASE_URL`, ruta personal
sintética, salida cruda y token sintético.

### Definición de hecho

- [x] Los cuatro RED fallaron por aserción observable.
- [x] `src/core/installation/*` es JavaScript ESM con JSDoc y solo usa módulos estándar de Node.
- [x] Ningún `.mjs` se añadió a la compilación TypeScript.
- [x] `test:contracts` ejecuta `src/core/installation/*.test.mjs`.
- [x] No se leyó `.env`, `prisma/dev.db` ni contenido local real.
- [x] Categorías o estados desconocidos se convierten en `blocked`, nunca en `ok`.

---

## T-001-03 · Precheck, capacidades, consentimiento y recibo

- Cubre: OBJ-004 → PRD-RF-006, PRD-RF-008 → UC-011, UC-012 → **RF-05, RF-06, RF-08** → CA-05, CA-06, CA-08
- Tests: [`src/core/installation/installation.test.mjs`](../../../src/core/installation/installation.test.mjs)
- Implementación: [`precheck.mjs`](../../../src/core/installation/precheck.mjs), [`capabilities.mjs`](../../../src/core/installation/capabilities.mjs), [`consent.mjs`](../../../src/core/installation/consent.mjs), [`receipt.mjs`](../../../src/core/installation/receipt.mjs)
- Runner: `node --test` directo, sin `node_modules` en runtime

### RED (2026-08-21)

Cada comportamiento se añadió y ejecutó por separado. Todos fallaron por `AssertionError` real:

1. Datos SQLite o sidecar protegidos:

```
✖ debe_bloquear_datos_existentes_sin_reset_confirmado (4.0316ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
actual: undefined
expected: 'blocked'
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

2. Consentimiento propio de `data-reset`:

```
✖ debe_bloquear_reset_sin_confirmacion_separada (5.0465ms)
AssertionError [ERR_ASSERTION]: La preparación general no autoriza el reset de datos
true !== false
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

3. Capacidad opcional ausente:

```
✖ debe_declarar_opcional_sin_bloquear_ready (5.6766ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
actual: []
expected: [{ id: 'ffmpeg', classification: 'optional', status: 'optional-blocked', category: 'capability', ... }]
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

4. Recibo recalculado sin compartir estado mutable:

```
✖ debe_recalcular_recibo_en_cada_ejecucion (6.0652ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
actual:   { requiredComplete: false, overallStatus: 'blocked', ... }
expected: { requiredComplete: true, overallStatus: 'ready', ... }
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

5. Recuperación saneada y alternativa dentro de `nextStep`:

```
✖ debe_devolver_recuperacion_segura (6.7984ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
actual nextStep:   'DATABASE_URL=file:C:\SyntheticUser\Private\dev.db CONTENIDO_SQLITE_PRIVADO'
expected nextStep: 'Revisa la plantilla de configuración del proyecto. Alternativa segura: detén la preparación y conserva el estado actual.'
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

6. Invariante que impide forzar `ready` con un obligatorio pendiente:

```
✖ debe_rechazar_ready_con_obligatorio_pendiente (2.0878ms)
AssertionError [ERR_ASSERTION]: Missing expected exception (TypeError).
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

7. Precheck puro mediante puertos de solo lectura:

```
✖ debe_mantener_precheck_puro_sin_leer_datos_reales (10.4975ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
0 !== 3
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

### GREEN (2026-08-21)

Cada caso pasó de forma aislada antes de ejecutar la suite completa. Resúmenes reales:

```
✔ debe_bloquear_datos_existentes_sin_reset_confirmado (2.8316ms)
✔ debe_bloquear_reset_sin_confirmacion_separada (4.7308ms)
✔ debe_declarar_opcional_sin_bloquear_ready (6.6239ms)
✔ debe_recalcular_recibo_en_cada_ejecucion (4.4778ms)
✔ debe_devolver_recuperacion_segura (5.5776ms)
✔ debe_rechazar_ready_con_obligatorio_pendiente (1.9724ms)
✔ debe_mantener_precheck_puro_sin_leer_datos_reales (11.4214ms)
```

La suite completa tras el último GREEN:

```
✔ debe_bloquear_datos_existentes_sin_reset_confirmado (3.8403ms)
✔ debe_bloquear_reset_sin_confirmacion_separada (1.3547ms)
✔ debe_declarar_opcional_sin_bloquear_ready (2.4255ms)
✔ debe_recalcular_recibo_en_cada_ejecucion (0.5074ms)
✔ debe_devolver_recuperacion_segura (0.637ms)
✔ debe_rechazar_ready_con_obligatorio_pendiente (0.9494ms)
✔ debe_mantener_precheck_puro_sin_leer_datos_reales (9.6069ms)
ℹ tests 69
ℹ pass 69
ℹ fail 0
ℹ duration_ms 905.0218
```

### REFACTOR (2026-08-21)

Se sustituyeron los cargadores dinámicos usados para demostrar los primeros RED por imports ESM
directos, se separó la construcción inmutable del recibo v1 y se mantuvieron precheck,
clasificación opcional y consentimiento en módulos con una sola responsabilidad.

Verificación específica posterior:

```
✔ debe_bloquear_datos_existentes_sin_reset_confirmado (1.8421ms)
✔ debe_bloquear_reset_sin_confirmacion_separada (0.5997ms)
✔ debe_declarar_opcional_sin_bloquear_ready (1.6944ms)
✔ debe_recalcular_recibo_en_cada_ejecucion (0.5686ms)
✔ debe_devolver_recuperacion_segura (0.529ms)
✔ debe_rechazar_ready_con_obligatorio_pendiente (0.7216ms)
✔ debe_mantener_precheck_puro_sin_leer_datos_reales (7.88ms)
ℹ tests 11
ℹ pass 11
ℹ fail 0
ℹ duration_ms 200.2349
```

Suite completa final de REFACTOR:

```
ℹ tests 69
ℹ pass 69
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 889.6176
```

### SEC-002

La presencia observada de base o sidecar añade un obligatorio `data` bloqueado. El caso de uso no
invoca lecturas de contenido ni efectos; `data-reset` no se autoriza mediante
`project-preparation` ni por ausencia de entrada. El recibo indica conservar los datos como
alternativa segura.

### UX-COPY-001

Los bloqueos normalizan categoría y recuperación y expresan la alternativa en el `nextStep` ya
existente, sin ampliar la frontera v1. La serialización comprobada no contiene `DATABASE_URL`,
rutas sintéticas ni contenido local sintético.

### Definición de hecho

- [x] Los siete ciclos RED fallaron por `AssertionError` observable.
- [x] Datos existentes e incompatibles quedan preservados y bloquean.
- [x] `data-reset` requiere consentimiento separado y no afirmativo por defecto.
- [x] Los opcionales ausentes no bloquean el uso básico.
- [x] Cada ejecución construye un recibo v1 nuevo, sin estado mutable global.
- [x] `ready` exige todos los obligatorios en `ok`.
- [x] El snapshot del filesystem temporal antes y después del precheck es idéntico.
- [x] Los dobles prueban que no se leen `.env`, SQLite ni datos reales.
- [x] No se añadieron dependencias, adaptadores reales ni CLI.
- [x] `npm run test:contracts`: `tests 69 · pass 69 · fail 0`, exit code 0.

---

## T-001-04 · Adaptadores locales de filesystem, proceso, puerto y persistencia

- Cubre: OBJ-004 → PRD-RF-005 → UC-011 → **RF-04** → CA-04
- Tests: [`scripts/install-local.test.mjs`](../../../scripts/install-local.test.mjs)
- Implementación: [`filesystem.mjs`](../../../src/core/installation/adapters/filesystem.mjs),
  [`process.mjs`](../../../src/core/installation/adapters/process.mjs),
  [`port.mjs`](../../../src/core/installation/adapters/port.mjs) y
  [`persistence.mjs`](../../../src/core/installation/adapters/persistence.mjs)
- Runner: `node --test` directo, incluido en `npm run test:contracts`

### RED (2026-08-21)

Cada comportamiento se añadió y ejecutó por separado. Los cinco RED válidos fallaron por
`AssertionError` real:

1. Confirmación vinculada al PID/puerto detectado:

```
✖ debe_requerir_confirmacion_por_pid (1.6559ms)
AssertionError [ERR_ASSERTION]: Missing expected exception.
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

2. Instalación global y modificación de PATH:

```
✖ debe_clasificar_instalacion_global_como_efecto_externo (5.4611ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
actual:   undefined
expected: { effect: 'outside-project', allowed: false }
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

3. Persistencia obligatoria antes de `ready`:

```
✖ debe_requerir_persistencia_antes_de_ready (2.9355ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
actual:   undefined
expected: true
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

4. Descriptor `executable + argv` con `shell:false`:

```
✖ debe_invocar_procesos_sin_shell (3.5508ms)
AssertionError [ERR_ASSERTION]: Missing expected exception.
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

5. Datos detectados preservados:

```
✖ debe_preservar_datos_detectados (4.1056ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
actual:   undefined
expected: { candidatePath: 'prisma\\dev.db', present: true, protection: 'protected' }
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

### GREEN (2026-08-21)

Cada caso pasó de forma aislada antes de ejecutar la suite completa:

```
✔ debe_requerir_confirmacion_por_pid (2.7561ms)
✔ debe_clasificar_instalacion_global_como_efecto_externo (3.7284ms)
✔ debe_requerir_persistencia_antes_de_ready (2.4389ms)
✔ debe_invocar_procesos_sin_shell (7.3612ms)
✔ debe_preservar_datos_detectados (4.1787ms)
```

Las suites completas incrementales quedaron en verde:

```
ciclo 1: tests 70 · pass 70 · fail 0
ciclo 2: tests 71 · pass 71 · fail 0
ciclo 3: tests 72 · pass 72 · fail 0
ciclo 4: tests 73 · pass 73 · fail 0
ciclo 5: tests 74 · pass 74 · fail 0
```

### REFACTOR (2026-08-21)

Se sustituyeron los cargadores tolerantes usados únicamente para demostrar los RED por imports ESM
directos. La observación de puerto pasó a un adaptador inyectable y el adaptador de proceso dejó de
depender de `this`; también conserva rutas ejecutables con espacios sin confundirlas con un comando
en string.

Verificación específica posterior:

```
✔ debe_requerir_confirmacion_por_pid (5.5837ms)
✔ debe_clasificar_instalacion_global_como_efecto_externo (0.3793ms)
✔ debe_requerir_persistencia_antes_de_ready (0.5097ms)
✔ debe_invocar_procesos_sin_shell (0.4234ms)
✔ debe_preservar_datos_detectados (0.4534ms)
ℹ tests 5
ℹ pass 5
ℹ fail 0
ℹ duration_ms 161.6853
```

Suite completa posterior al refactor:

```
ℹ tests 74
ℹ pass 74
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 884.7396
```

### Suite final (2026-08-21)

Comando exigido: `npm run test:contracts`. Salida final tras actualizar tarea y evidencia:

```
✔ debe_requerir_confirmacion_por_pid (6.2491ms)
✔ debe_clasificar_instalacion_global_como_efecto_externo (0.3713ms)
✔ debe_requerir_persistencia_antes_de_ready (0.5909ms)
✔ debe_invocar_procesos_sin_shell (0.4305ms)
✔ debe_preservar_datos_detectados (0.401ms)
ℹ tests 74
ℹ pass 74
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 886.3579
```

Exit code 0. npm emitió el aviso preexistente `Unknown env config "devdir"`; no afectó la suite.

---

## T-001-04/05 · Corrección TDD final

Esta sección **sustituye** las afirmaciones operativas de la «cuarta tanda» que quedaron obsoletas.
No se avanzó `T-001-06` ni `T-001-07`.

Correcciones de evidencia anteriores:

- El marcador ya no es `{"version":1}`: contiene `version`, `appVersion` y el hash SHA-256 del
  esquema Prisma. DB o sidecar sin marcador compatible quedan protegidos.
- `start` ya no exige que el PID listener sea el PID hijo de npm. Exige puerto libre antes del
  proceso propio, polling hasta listener y ausencia de fallo del hijo.
- El sondeo real ya no abre un socket: ejecuta `netstat.exe -ano -p tcp` por ruta absoluta,
  `shell:false`, y extrae un PID `LISTENING`.
- npm ya no se ejecuta por wrapper o basename: Node absoluto invoca un `npm-cli.js` absoluto,
  existente y aprobado.
- El reset ya no se limita a copiar: hace backup, retira originales, ejecuta Prisma y solo entonces
  escribe el marcador.
- Los 108 tests históricos incluían pruebas de una orquestación paralela eliminada. La suite final
  tiene 99 tests; todos los casos de orquestación de consola pasan por `main`, la misma ruta de
  `setup:local`.

### RED reales

Cada comportamiento se ejecutó aisladamente y falló por `AssertionError` observable antes del GREEN:

```text
✖ debe_invocar_npm_cli_mediante_node_absoluto_sin_shell
AssertionError [ERR_ASSERTION]: false !== true

✖ debe_extraer_pid_listener_del_netstat_de_windows
AssertionError [ERR_ASSERTION]: actual 'undefined' · expected 'function'

✖ debe_validar_windows_11_antes_de_cualquier_proceso_o_puerto
AssertionError [ERR_ASSERTION]: 1 !== 0

✖ debe_usar_la_orquestacion_canonica_desde_main_con_check_por_defecto
AssertionError [ERR_ASSERTION]: actual [] · expected ['check']

✖ debe_preparar_con_env_manual_sin_sobrescribirlo_cuando_no_hay_db
AssertionError [ERR_ASSERTION]: 'blocked' !== 'ready'

✖ debe_hacer_backup_retirar_db_y_recrear_antes_del_marcador
AssertionError [ERR_ASSERTION]: 'blocked' !== 'ready'

✖ debe_esperar_hasta_que_start_deje_el_puerto_escuchando
AssertionError [ERR_ASSERTION]: 'blocked' !== 'ready'

✖ debe_conservar_checks_previos_ante_error_async_del_hijo
AssertionError [ERR_ASSERTION]: false !== true

✖ debe_renderizar_el_next_step_especifico_del_dto_saneado
AssertionError [ERR_ASSERTION]: no apareció el reset separado esperado

✖ debe_exponer_opcionales_reales_con_efecto_funcional_seguro
AssertionError [ERR_ASSERTION]: 1 !== 4

✖ debe_usar_una_sola_fuente_para_datos_protegidos
AssertionError [ERR_ASSERTION]: 2 !== 1

✖ debe_rechazar_lectura_de_configuracion_sensible
AssertionError [ERR_ASSERTION]: Missing expected exception.

✖ debe_rechazar_escritura_cuando_un_junction_escapa_del_root
AssertionError [ERR_ASSERTION]: actual 'undefined' · expected 'function'
```

### GREEN y REFACTOR

- `main` llama a una única `runInstallationAssistant`; importar el módulo no ejecuta `main`.
- `check` es la operación predeterminada. `main` fija exit code `0` solo para `ready` y `1` para
  bloqueo o fallo.
- Plataforma se valida antes de npm/netstat. La salida pública elimina observaciones y PID.
- El DTO se sanea en la frontera y `renderReceipt` no vuelve a sanear cada `CheckResult`, por lo que
  conserva recuperaciones específicas.
- `InstallationStepFailure` usa `error.receipt ?? previousReceipt`, conserva checks y categoría, y
  captura el evento asíncrono `error` del hijo sin mostrar causa cruda.
- Las capacidades IA, proveedores, audiovisual y navegación aparecen separadas con estado y efecto
  funcional seguro.
- La regla de datos protegidos vive únicamente en `local-persistence`; se eliminó
  `protected-local-data`.
- Las APIs de escritura canonicalizan ancestros, rechazan junctions de escape y permiten únicamente
  el destino fijo `.env` sin habilitar su lectura.

Suites específicas tras REFACTOR:

```text
ℹ tests 22
ℹ pass 22
ℹ fail 0

ℹ tests 18
ℹ pass 18
ℹ fail 0
```

Suite contractual completa final:

```text
ℹ tests 99
ℹ suites 0
ℹ pass 99
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2677.3954
```

Comando: `npm run test:contracts`. Exit code `0`. Se mantuvo el aviso preexistente
`Unknown env config "devdir"`; no afectó la suite.

Comprobación read-only real en esta máquina:

```text
> node scripts/install-local.mjs check
plataforma: comprobada
runtime: comprobada
dependencias: comprobada
configuración: comprobada
persistencia: bloqueada
proceso: comprobada
IA autenticada: opcional no comprobada
proveedores externos: opcional no comprobada
herramientas audiovisuales: opcional degradada
navegación automatizada: opcional degradada
Preparación bloqueada
```

Exit code `1`, esperado porque la copia de trabajo contiene persistencia sin marcador compatible.
La comprobación no efectuó cambios y demostró que la ruta real resuelve npm mediante Node +
`npm-cli.js` sin el `ENOENT` confirmado para el wrapper `npm`.

---

## T-001-04/05 · Cuarta tanda histórica (superada por la corrección final)

- Alcance: A4, M4, M5 y B5. No se avanzó T-001-06 ni T-001-07.
- Entrada: `node scripts/install-local.mjs <check|prepare|reset|start>` y
  `npm run setup:local -- <operación>`.
- Implementación: raíz inyectable `createLocalInstallationRuntime`, adaptadores locales cableados,
  lista blanca exacta de procesos, marcador durable v1, reset con resguardo y arranque comprobado.

### RED reales

Cada comportamiento se ejecutó de forma aislada y falló por `AssertionError`, no por import roto:

```text
✖ debe_alcanzar_main_desde_cli_sin_ejecutarlo_al_importar (4.3921ms)
actual: 'undefined' · expected: 'function'

✖ debe_pedir_confirmacion_lineal_sin_afirmativa_predeterminada (5.3671ms)
actual: [] · expected: [{ effect: 'project-preparation', ... }]

✖ debe_sanear_error_crudo_en_la_frontera_main (3.7221ms)
AssertionError [ERR_ASSERTION]: Got unwanted rejection.
Actual message: "DATABASE_URL C:\SyntheticUser\Private ERROR_CRUDO"

✖ debe_aceptar_windows_11_por_build_real_inyectado (3.111ms)
actual: 'blocked' · expected: 'ready'

✖ debe_permitir_solo_descriptores_exactos_de_la_spec (5.042ms)
actual: true · expected: false

✖ debe_componer_check_con_seis_obligatorios_sin_leer_datos (53.5174ms)
actual: ['configuration-failure']
expected: ['windows-11', 'node-npm-runtime', 'project-dependencies',
           'configuration-template', 'local-persistence', 'local-port-process']

✖ debe_bloquear_prepare_sin_tocar_configuracion_o_db_desconocidas (20.3981ms)
actual: ['project-preparation-consent'] · expected: manifiesto de seis checks

✖ debe_resguardar_reset_antes_de_repreparar_y_solo_con_confirmacion (57.8918ms)
actual: 'blocked' · expected: 'ready'

✖ debe_declarar_start_listo_solo_tras_comprobar_el_puerto_esperado (52.3566ms)
adaptador ausente: actual 'ready' · expected 'blocked'

✖ debe_exigir_pid_y_puerto_confirmados_si_start_encuentra_ocupacion (68.2872ms)
actual: 'blocked' · expected: 'ready'

✖ debe_bloquear_start_sin_adaptador_aunque_haya_booleano_libre (3.9513ms)
actual: 'ready' · expected: 'blocked'
```

El test del orden del marcador se añadió cuando el GREEN mínimo de `prepare` ya lo satisfacía.
Para demostrar que no era vacuo se hizo una mutación deliberada retirando solo la escritura del
marcador; el test falló por aserción y después se restauró el código:

```text
✖ debe_marcar_prepare_solo_despues_de_prisma_exitoso (57.8509ms)
AssertionError [ERR_ASSERTION]: 'blocked' !== 'ready'
ℹ tests 1 · pass 0 · fail 1
```

### GREEN y REFACTOR

- `check` produce exactamente los seis IDs del manifiesto y usa solo presencia/metadatos; la prueba
  observa que únicamente se lee `data/installation/managed-v1.json`, nunca `.env` ni SQLite.
- Windows 11 se valida con `process.platform === "win32"` y build de `os.release()` ≥ 22000.
- La lista blanca permite únicamente npm local (`--version`, `install`, `ci`, scripts Prisma y
  `run dev`) con `cwd` del proyecto y `shell:false`; wrappers, global/PATH y argv desconocido se
  rechazan. `taskkill` solo se construye dentro de `terminateDetected` con PID/puerto coincidentes.
- `prepare` no lee ni sobrescribe `.env`; datos desconocidos bloquean. El marcador v1 se escribe
  después de `npm` y Prisma exitosos.
- `reset` denegado no cambia estado; aprobado copia DB/sidecars al resguardo antes de repreparar.
- `start` no usa `input.processAction`: adaptador ausente/fallido o puerto no verificado bloquean;
  un puerto ocupado exige confirmación ligada a PID+puerto y el éxito exige observar el PID iniciado.
- REFACTOR: preparación y reset comparten una única secuencia `performProjectPreparation`; el puerto
  tiene inspección async segura y los adaptadores conservan responsabilidades separadas.

Verificaciones específicas posteriores:

```text
✔ debe_marcar_prepare_solo_despues_de_prisma_exitoso (30.1591ms)
✔ debe_resguardar_reset_antes_de_repreparar_y_solo_con_confirmacion (34.5391ms)
✔ debe_declarar_start_listo_solo_tras_comprobar_el_puerto_esperado (92.9134ms)
ℹ tests 3 · pass 3 · fail 0
```

Suite contractual completa:

```text
ℹ tests 108
ℹ suites 0
ℹ pass 108
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 805.3924
```

Comando: `npm run test:contracts`. Exit code `0`. npm mantuvo el aviso preexistente
`Unknown env config "devdir"`; no afectó la suite.

---

## Correcciones tras revisión

La primera tanda cubrió defectos de `T-001-01`, `T-001-02` y `T-001-04`; la
segunda cubrió `T-001-03`; la tercera cubre exclusivamente `T-001-05`. No se
avanzó `T-001-06` ni `T-001-07`, no se creó la raíz de composición ejecutable,
no se modificó el recibo v1 y esta evidencia no declara verificada la spec
completa.

### T-001-05 · Tercera tanda de correcciones

Alcance exclusivo: A3, M3, M7, M2 integración y B2. No se creó la raíz de
composición ejecutable y no se avanzó `T-001-06` ni `T-001-07`. El contrato de
`PreparationReceipt` continúa en versión `1`.

#### RED reales

Cada comportamiento se añadió y ejecutó por separado; todos fallaron por
`AssertionError` observable:

```text
✖ debe_mostrar_recuperacion_segura_sin_filtrar_recibo (3.4614ms)
Expected /configuración: bloqueada/
Input: function Object() { [native code] }: bloqueada

✖ debe_distinguir_opcional_bloqueada_de_degradada_con_efecto (4.0959ms)
Expected /capacidad: opcional bloqueada/
Input: capacidad: opcional limitada

✖ debe_preservar_checks_y_categoria_en_fallos_tipados (4.5617ms)
Expected /runtime: comprobada/
Input: configuración: bloqueada

✖ debe_repetir_estado_tras_interrupcion (3.5925ms)
Expected output not to contain:
El asistente todavía no ha comprobado este equipo.

✖ debe_cubrir_los_seis_estados_de_consola (4.5013ms)
actual:   'undefined'
expected: 'function'

✖ debe_ejecutar_efecto_solo_con_confirmacion_exacta (3.8828ms)
0 !== 1

✖ debe_nombrar_paso_y_categoria_real_en_carga (4.2608ms)
actual:   'Comprobando paso de preparación: dependencias.'
expected: 'Comprobando paso de diagnóstico: plataforma.'
```

#### GREEN reales

```text
✔ debe_mostrar_recuperacion_segura_sin_filtrar_recibo (2.3828ms)
✔ debe_distinguir_opcional_bloqueada_de_degradada_con_efecto (2.5406ms)
✔ debe_preservar_checks_y_categoria_en_fallos_tipados (3.387ms)
✔ debe_repetir_estado_tras_interrupcion (2.8969ms)
✔ debe_cubrir_los_seis_estados_de_consola (6.6946ms)
✔ debe_ejecutar_efecto_solo_con_confirmacion_exacta (3.1657ms)
✔ debe_nombrar_paso_y_categoria_real_en_carga (4.4824ms)
```

Resultados implementados:

- El recibo se normaliza antes de usarlo y renderizarlo. Una comprobación
  bloqueada imprime categoría, estado y recuperación seleccionados de listas
  seguras; nunca imprime `id`, `nextStep` crudo, rutas, valores o el mensaje del
  error.
- Los opcionales muestran `opcional bloqueada` y `opcional degradada` con
  efectos funcionales seguros distintos.
- `InstallationStepFailure` conserva un recibo previo y una categoría segura.
  Los fallos de proceso se presentan como `proceso`, los de datos como
  `persistencia`; un error sin información segura cae en `configuración`.
- `renderConsoleState`, usado por la orquestación, cubre `empty`, `loading`,
  `partial`, `error`, `blocked` y `success`. El vacío no aparece al ejecutar o
  reanudar; la carga identifica primero diagnóstico/plataforma y después el
  efecto real. Cada ejecución termina en una sola conclusión.
- La orquestación importa y usa `executeWithConsent`. Las confirmaciones
  canónicas tienen `effect + approved`; solo la coincidencia exacta ejecuta el
  efecto. `project-preparation` no autoriza `data-reset`, el rechazo mantiene el
  bloqueo y la ausencia sigue siendo negativa.
- Labels, copys y estados seguros usan `Map`; `constructor` y `toString` no
  realizan lookup por prototipo.

#### REFACTOR verde

La primera suite completa tras integrar el consentimiento detectó una regresión
real: el efecto lanzado dentro de `executeWithConsent` podía escapar antes de la
normalización tipada (`tests 95 · pass 94 · fail 1`). Se extrajo
`executeWithConsentAndRecheck`: el efecto continúa ejecutándose únicamente a
través de la API real, pero su fallo se normaliza conservando el recibo previo.
También se migraron todos los fixtures de consola al formato
`{ effect, approved }` y se eliminaron los `Record<string, boolean>` de la
frontera.

Verificación específica final:

```text
✔ debe_mostrar_recuperacion_segura_sin_filtrar_recibo (3.9808ms)
✔ debe_distinguir_opcional_bloqueada_de_degradada_con_efecto (0.6005ms)
✔ debe_preservar_checks_y_categoria_en_fallos_tipados (2.6543ms)
✔ debe_ejecutar_efecto_solo_con_confirmacion_exacta (0.7424ms)
✔ debe_repetir_estado_tras_interrupcion (0.4161ms)
✔ debe_cubrir_los_seis_estados_de_consola (0.8113ms)
✔ debe_nombrar_paso_y_categoria_real_en_carga (1.0401ms)
ℹ tests 21
ℹ pass 21
ℹ fail 0
```

Suite contractual completa final:

```text
✔ debe_mostrar_recuperacion_segura_sin_filtrar_recibo (4.0997ms)
✔ debe_distinguir_opcional_bloqueada_de_degradada_con_efecto (0.7503ms)
✔ debe_preservar_checks_y_categoria_en_fallos_tipados (3.5094ms)
✔ debe_ejecutar_efecto_solo_con_confirmacion_exacta (0.8126ms)
✔ debe_cubrir_los_seis_estados_de_consola (1.3081ms)
✔ debe_nombrar_paso_y_categoria_real_en_carga (0.9141ms)
ℹ tests 96
ℹ pass 96
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 792.1965
```

Comando: `npm run test:contracts`. Exit code `0`. npm mantuvo el aviso
preexistente `Unknown env config "devdir"`; no afectó la suite.

### T-001-03 · Segunda tanda de correcciones

Manifiesto obligatorio exportado por `receipt.mjs`, estable y sin dependencia de
infraestructura:

1. `windows-11` (`platform`);
2. `node-npm-runtime` (`runtime`);
3. `project-dependencies` (`dependencies`);
4. `configuration-template` (`configuration`);
5. `local-persistence` (`data`);
6. `local-port-process` (`process`).

`ready` exige que los seis IDs estén presentes con clasificación `required`, categoría
coincidente y estado `ok`; un conjunto vacío, parcial, interrumpido o con forma distinta
queda bloqueado. Todos los fixtures que representan preparación válida proporcionan el
manifiesto completo.

RED reales, ejecutados uno por comportamiento:

```text
✖ debe_bloquear_ready_sin_el_manifiesto_obligatorio_completo (3.4887ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
true !== false

✖ debe_bloquear_un_obligatorio_que_no_coincide_con_el_manifiesto (2.666ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
true !== false

✖ debe_sanear_opcional_desconocido_sin_bloquear_obligatorios (5.8231ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
actual:   classification 'required', status 'future-ok', category 'future-category'
expected: classification 'optional', status 'optional-blocked', category 'capability'

✖ debe_bloquear_reset_sin_confirmacion_separada (3.1834ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
0 !== 1

✖ debe_recalcular_recibo_en_cada_ejecucion (4.3323ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
false !== true

✖ debe_normalizar_ids_maliciosos_sin_buscar_en_el_prototipo (4.9015ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
actual:   { id: 'constructor', status: 'ok', ... }
expected: { id: 'unknown-check', status: 'blocked', ... }
```

GREEN específicos reales:

```text
✔ debe_bloquear_ready_sin_el_manifiesto_obligatorio_completo (1.5542ms)
✔ debe_bloquear_un_obligatorio_que_no_coincide_con_el_manifiesto (2.3782ms)
✔ debe_sanear_opcional_desconocido_sin_bloquear_obligatorios (2.818ms)
✔ debe_bloquear_reset_sin_confirmacion_separada (2.8121ms)
✔ debe_recalcular_recibo_en_cada_ejecucion (5.491ms)
✔ debe_normalizar_ids_maliciosos_sin_buscar_en_el_prototipo (3.7575ms)
```

REFACTOR verde:

- `runPrecheck` sanea también los opcionales y fuerza su clasificación opcional; un
  estado o categoría desconocidos se convierten en `optional-blocked` con recuperación
  segura, sin contaminar `requiredComplete`.
- `classifyOptionalCapabilities` reutiliza `sanitizeDiagnostic`; los mapas seguros son
  `Map` y los IDs internos aceptan solo kebab-case acotado, excluyendo propiedades de
  `Object.prototype`. `constructor`, `toString`, `__proto__` y formas no válidas no
  alcanzan la salida.
- `executeWithConsent` recibe la `ConsentRequest`, parte de confirmación negativa y solo
  ejecuta el efecto inyectado cuando `effect` coincide y `approved === true`.
  `project-preparation` no autoriza `data-reset`.
- El recibo, sus arrays y cada `CheckResult` son snapshots congelados. La prueba de
  recálculo modifica únicamente la fuente original para comprobar independencia; ya no
  intenta mutar accidentalmente un objeto del recibo.

Se reemplazaron explícitamente los dos tests vacuos señalados:

- `debe_bloquear_datos_existentes_sin_reset_confirmado` ya no ofrece `readContent` ni
  `performDataReset`, que `runPrecheck` no recibía. Usa el metadato real de presencia,
  verifica el bloqueo y serializa el resultado para excluir valores sensibles.
- `debe_mantener_precheck_puro_sin_leer_datos_reales` ofrece únicamente
  `inspectRequired`, `inspectOptional` e `inspectDataPresence`, registra las tres llamadas
  permitidas y compara el snapshot del filesystem antes y después. No expone inspectores
  sensibles inalcanzables.

Verificación verde posterior al refactor de esas pruebas:

```text
✔ debe_bloquear_datos_existentes_sin_reset_confirmado (2.8935ms)
✔ debe_mantener_precheck_puro_sin_leer_datos_reales (10.6384ms)
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

Suite contractual completa al cerrar la segunda tanda:

```text
✔ debe_bloquear_ready_sin_el_manifiesto_obligatorio_completo (3.1181ms)
✔ debe_bloquear_un_obligatorio_que_no_coincide_con_el_manifiesto (0.2601ms)
✔ debe_sanear_opcional_desconocido_sin_bloquear_obligatorios (0.3768ms)
✔ debe_bloquear_reset_sin_confirmacion_separada (1.0839ms)
✔ debe_recalcular_recibo_en_cada_ejecucion (0.4835ms)
✔ debe_normalizar_ids_maliciosos_sin_buscar_en_el_prototipo (0.5386ms)
ℹ tests 91
ℹ pass 91
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Comando: `npm run test:contracts`. Exit code `0`. Se mantuvo el aviso preexistente
`Unknown env config "devdir"`; no afectó la suite.

### T-001-01 · Primera carga independiente del índice heredado

Comportamiento: con `previousId === null`, una colección no vacía selecciona siempre
`pieceIds[0]` con desenlace `kept`, aunque `previousIndex` conserve otro valor.

RED real:

```text
✖ debe_seleccionar_la_primera_pieza_aunque_exista_indice_heredado (2.4323ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
actual:   { pieceId: 'c', outcome: 'kept' }
expected: { pieceId: 'a', outcome: 'kept' }
ℹ tests 85
ℹ pass 84
ℹ fail 1
```

GREEN real tras hacer explícita la primera carga antes de reconciliar vecinas:

```text
✔ debe_seleccionar_la_primera_pieza_aunque_exista_indice_heredado (0.3278ms)
ℹ tests 85
ℹ pass 85
ℹ fail 0
```

### T-001-02 · Candidatos inexistentes y configuración sensible

Comportamiento 1: `resolveProjectPath` acepta `prisma/dev.db` inexistente cuando su
ancestro existente real permanece bajo la raíz, sin dejar de rechazar rutas léxicas o
enlaces que escapan.

RED real:

```text
✖ debe_resolver_candidato_inexistente_desde_ancestro_seguro (6.0567ms)
AssertionError [ERR_ASSERTION]: Got unwanted exception.
Actual message: "La ruta solicitada no es segura."
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

GREEN real, incluyendo la regresión del enlace de escape:

```text
✔ debe_rechazar_ruta_fuera_del_proyecto (8.1006ms)
✔ debe_resolver_candidato_inexistente_desde_ancestro_seguro (4.1201ms)
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

Comportamiento 2: se rechaza cualquier basename `.env` o que empiece por `.env.`,
incluidos `.env.local`, `.env.development` y `.env.production`.

RED real:

```text
✖ debe_rechazar_lectura_de_configuracion_sensible (8.3997ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
actual:   'UNSAFE_PROJECT_PATH'
expected: 'SENSITIVE_CONFIGURATION_PATH'
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

GREEN real:

```text
✔ debe_rechazar_lectura_de_configuracion_sensible (6.4502ms)
ℹ tests 1
ℹ pass 1
ℹ fail 0
```

La resolución usa el ancestro existente más cercano, comprueba su `realpath` y
recompone únicamente los segmentos inexistentes contenidos. No lee contenido de
configuración ni de persistencia.

### T-001-04 · Persistencia observable y pruebas no vacuas

Comportamiento: datos o sidecars existentes quedan protegidos y bloqueados; sin datos
pero con preparación pendiente se mantiene el bloqueo; sin datos y con
`preparationStatus: "prepared"` el obligatorio queda `ok`.

RED real que detectó el anterior `blocked` hardcodeado:

```text
✖ debe_declarar_persistencia_lista_cuando_fue_preparada_sin_datos (10.7663ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
'blocked' !== 'ok'
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

GREEN real que triangula los estados pendiente y preparado:

```text
✔ debe_requerir_persistencia_antes_de_ready (1.941ms)
✔ debe_declarar_persistencia_lista_cuando_fue_preparada_sin_datos (5.353ms)
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

Los anteriores callbacks inertes `readContent`, `create`, `migrate` y `remove` fueron
eliminados de las pruebas. Sus reemplazos usan el `resolveProjectPath` real y una
dependencia `exists` observable sobre directorios temporales:

- un candidato inexistente produce `present: false`;
- un enlace de escape se rechaza antes de consultar `exists`;
- una base y un sidecar existentes producen `protection: "protected"` y `blocked`;
- las APIs expuestas son solo `observePresence` e `inspect`, sin operaciones mutantes.

Verificaciones específicas del refactor:

```text
✔ debe_requerir_persistencia_antes_de_ready (12.2626ms)
✔ debe_preservar_datos_detectados (9.8322ms)
```

Suite contractual completa final:

```text
✔ debe_seleccionar_la_primera_pieza_aunque_exista_indice_heredado (0.2759ms)
✔ debe_requerir_persistencia_antes_de_ready (8.4862ms)
✔ debe_declarar_persistencia_lista_cuando_fue_preparada_sin_datos (4.4954ms)
✔ debe_preservar_datos_detectados (6.5669ms)
✔ debe_resolver_candidato_inexistente_desde_ancestro_seguro (4.7269ms)
✔ debe_rechazar_lectura_de_configuracion_sensible (4.0795ms)
ℹ tests 87
ℹ pass 87
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Comando: `npm run test:contracts`. Exit code `0`. npm mantuvo el aviso preexistente
`Unknown env config "devdir"`; no afectó la suite.

## T-001-04 · Controles y cierre originales

### SEC-003

La inspección de puerto se inyecta y devuelve una observación normalizada. La terminación solo
construye `taskkill /PID <pid> /T /F` si la confirmación coincide con el PID y puerto observados.
`taskkill /IM`, `Stop-Process -Name`, `pkill` y `killall` se rechazan antes de invocar el doble.

### SEC-005

Los descriptores de instalación global de npm (`-g`/`--global`) y modificación de PATH mediante
`setx PATH` se clasifican `outside-project`, `allowed:false`, y su invocación se rechaza. No se
añadieron dependencias ni se modificó PATH.

### Definición de hecho

- [x] Los cinco RED válidos fallaron por `AssertionError` observable.
- [x] Todo proceso usa `executable`, `argv` y `shell:false`; comandos string y `shell:true` se rechazan.
- [x] Solo un PID/puerto detectado y confirmado puede producir un descriptor de terminación.
- [x] Instalación global y modificación de PATH quedan clasificadas y rechazadas.
- [x] Persistencia no comprobada/preparada no produce `ready`.
- [x] La detección de DB/sidecars usa exclusivamente `exists`; no lee, crea, migra ni borra.
- [x] Los tests usan dobles y rutas sintéticas; no lanzan procesos ni tocan `.env`, PATH o `prisma/dev.db`.
- [x] `scripts/install-local.test.mjs` está incluido en `test:contracts`.
- [x] No se creó `scripts/install-local.mjs`.
- [x] No se añadieron dependencias.

---

## T-001-05 · Asistente de consola lineal con consentimientos y recibo

- Cubre: OBJ-004 → PRD-RF-006 → UC-012 → **RF-05, RF-07, RF-08** → CA-05, CA-07, CA-08
- Tests: [`scripts/install-local.test.mjs`](../../../scripts/install-local.test.mjs)
- Implementación: [`scripts/install-local.mjs`](../../../scripts/install-local.mjs)
- Runner: `node --test` directo sobre JavaScript ESM, sin `node_modules`

### RED (2026-08-21)

Cada comportamiento se añadió y ejecutó por separado. Todos los RED fallaron por
`AssertionError` real, no por import ausente:

1. Confirmación independiente y no afirmativa de `data-reset`:

```
✖ debe_exigir_confirmacion_separada_para_reset (3.5047ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
actual:   []
expected: [{ effect: 'data-reset', scope: 'datos locales protegidos', rejectionOutcome: 'blocked' }]
ℹ tests 1 · pass 0 · fail 1
```

2. Rechazo sin efecto ni fallo técnico:

```
✖ debe_conservar_estado_al_rechazar_confirmacion (2.5147ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
actual: undefined
expected: false
ℹ tests 1 · pass 0 · fail 1
```

3. Una única conclusión:

```
✖ debe_terminar_en_una_sola_conclusion (3.2914ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
0 !== 1
ℹ tests 1 · pass 0 · fail 1
```

4. Reanudación sin estado heredado:

```
✖ debe_repetir_estado_tras_interrupcion (3.246ms)
AssertionError [ERR_ASSERTION]: The input did not match /runtime: comprobada/u
Input: 'Preparación bloqueada'
ℹ tests 1 · pass 0 · fail 1
```

5. Bloqueo previo a efectos fuera de Windows 11:

```
✖ debe_bloquear_fuera_de_windows_11 (2.8552ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
1 !== 0
ℹ tests 1 · pass 0 · fail 1
```

6. Normalización de errores sin datos sensibles:

```
✖ debe_omitir_datos_sensibles_en_la_salida (2.8789ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
actual: undefined
expected: true
ℹ tests 1 · pass 0 · fail 1
```

7. Matriz observable de seis estados:

```
✖ debe_cubrir_los_seis_estados_de_consola (2.8408ms)
AssertionError [ERR_ASSERTION]: The input did not match
/El asistente todavía no ha comprobado este equipo\./u
ℹ tests 1 · pass 0 · fail 1
```

8. Despacho estable de `check`, `prepare`, `reset` y `start`:

```
✖ debe_estabilizar_operaciones_check_prepare_reset_start (3.4442ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
1 !== 2
ℹ tests 1 · pass 0 · fail 1
```

9. Consentimientos operativos separados y falsos por defecto:

```
✖ debe_mantener_consentimientos_operativos_separados_y_denegados_por_defecto (3.8296ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
'ready' !== 'blocked'
ℹ tests 1 · pass 0 · fail 1
```

10. Precondición de datos bloqueados para `reset`:

```
✖ debe_limitar_reset_al_bloqueo_de_datos (2.9972ms)
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
1 !== 0
ℹ tests 1 · pass 0 · fail 1
```

### GREEN (2026-08-21)

Cada caso pasó de forma aislada antes de la suite completa:

```
✔ debe_exigir_confirmacion_separada_para_reset (2.5722ms)
✔ debe_conservar_estado_al_rechazar_confirmacion (2.1285ms)
✔ debe_terminar_en_una_sola_conclusion (1.5826ms)
✔ debe_repetir_estado_tras_interrupcion (2.2029ms)
✔ debe_bloquear_fuera_de_windows_11 (2.7492ms)
✔ debe_omitir_datos_sensibles_en_la_salida (2.6823ms)
✔ debe_cubrir_los_seis_estados_de_consola (3.2001ms)
✔ debe_estabilizar_operaciones_check_prepare_reset_start (3.2962ms)
✔ debe_mantener_consentimientos_operativos_separados_y_denegados_por_defecto (1.9848ms)
✔ debe_limitar_reset_al_bloqueo_de_datos (1.8477ms)
```

La última suite completa del GREEN:

```
ℹ tests 84
ℹ pass 84
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 873.9019
```

### REFACTOR (2026-08-21)

Se sustituyó el cargador tolerante del primer RED por un import ESM directo, se separaron
comprobación segura, ejecución, consentimiento y renderizado, y se limitaron las etiquetas impresas
a categorías conocidas para que un `id` de adaptador no pueda filtrar datos. La plataforma y los
recibos bloqueados quedaron en funciones pequeñas sin estado global mutable.

Verificación específica posterior:

```
✔ debe_exigir_confirmacion_separada_para_reset (2.8027ms)
✔ debe_conservar_estado_al_rechazar_confirmacion (0.3139ms)
✔ debe_terminar_en_una_sola_conclusion (0.3285ms)
✔ debe_repetir_estado_tras_interrupcion (0.707ms)
✔ debe_bloquear_fuera_de_windows_11 (0.383ms)
✔ debe_omitir_datos_sensibles_en_la_salida (0.6358ms)
✔ debe_cubrir_los_seis_estados_de_consola (0.4837ms)
✔ debe_estabilizar_operaciones_check_prepare_reset_start (0.5063ms)
✔ debe_mantener_consentimientos_operativos_separados_y_denegados_por_defecto (0.4232ms)
✔ debe_limitar_reset_al_bloqueo_de_datos (0.3186ms)
ℹ tests 15 · pass 15 · fail 0
```

### SEC-003 y SEC-004

La consola solo solicita `process` cuando la entrada declara una acción concreta, y el adaptador de
proceso conserva la vinculación PID/puerto confirmada de `T-001-04`. `data-reset`,
`project-preparation` y `process` son consentimientos distintos, falsos por defecto. Los errores de
adaptador se convierten en categoría y recuperación constantes; no se imprime el error crudo,
`nextStep`, `id`, variables, rutas, PID no confirmado ni contenido local.

### UX-FORM-001

El reset solo aparece ante un bloqueo de datos y una solicitud explícita. Su petición usa
`effect: "data-reset"`, advierte la posible pérdida y no tiene opción afirmativa predeterminada.
Cancelar conserva el recibo bloqueado y devuelve `technicalFailure: false`.

### Definición de hecho

- [x] Los diez RED fallaron por `AssertionError` observable.
- [x] `check`, `prepare`, `reset` y `start` se orquestan mediante adaptadores inyectados.
- [x] Los tests no lanzan procesos ni escriben disco.
- [x] Fuera de Windows 11 se bloquea antes de consultar adaptadores o ejecutar efectos.
- [x] Cada ejecución termina exactamente en preparación lista o bloqueada.
- [x] Los seis estados de `design.md` §5 son observables en texto lineal sin color.
- [x] La salida de éxito y error omite datos sensibles y errores crudos.
- [x] No se añadieron dependencias, README, UI ni efectos destructivos.

### Suite final (2026-08-21)

Comando exigido: `npm run test:contracts`.

```
✔ debe_exigir_confirmacion_separada_para_reset (4.3896ms)
✔ debe_conservar_estado_al_rechazar_confirmacion (0.4861ms)
✔ debe_terminar_en_una_sola_conclusion (0.5258ms)
✔ debe_repetir_estado_tras_interrupcion (0.7394ms)
✔ debe_bloquear_fuera_de_windows_11 (0.4538ms)
✔ debe_omitir_datos_sensibles_en_la_salida (0.8781ms)
✔ debe_cubrir_los_seis_estados_de_consola (0.5607ms)
✔ debe_estabilizar_operaciones_check_prepare_reset_start (0.7358ms)
✔ debe_mantener_consentimientos_operativos_separados_y_denegados_por_defecto (0.6834ms)
✔ debe_limitar_reset_al_bloqueo_de_datos (0.4999ms)
ℹ tests 84
ℹ pass 84
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 846.2171
```

Exit code 0. npm emitió el aviso preexistente `Unknown env config "devdir"`; no afectó la suite.

---

## T-001-06 · Unificar la pieza activa en ContentTray y PieceCarousel

- Cubre: OBJ-005 → PRD-RF-007, PRD-RF-012 → UC-010 → RF-01, RF-02, RF-03 → CA-01, CA-02, CA-03
- Tests: [`src/components/ContentTray.test.tsx`](../../../src/components/ContentTray.test.tsx),
  [`src/components/PieceCarousel.test.tsx`](../../../src/components/PieceCarousel.test.tsx)
- Comando: `npm run test:ui`
- Runner: Vitest + Testing Library (`jsdom`)

| Control | Tarea | Test |
|---|---|---|
| UX-A11Y-001 | T-001-06 | `ContentTray.test.tsx::debe_mantener_contraste_y_estado_activo` |
| UX-A11Y-002 | T-001-06 | `ContentTray.test.tsx::debe_exponer_estado_activo_en_texto` |
| UX-A11Y-003 | T-001-06 | `ContentTray.test.tsx::debe_conservar_foco_del_control_activado` |
| UX-A11Y-004 | T-001-06 | `ContentTray.test.tsx::debe_mantener_controles_accesibles` |
| UX-A11Y-005 | T-001-06 | `PieceCarousel.test.tsx::debe_nombrar_indicador_y_pieza_activa` |
| UX-A11Y-006 | T-001-06 | `ContentTray.test.tsx::debe_anunciar_detalle_actualizado` |
| UX-A11Y-007 | T-001-06 | `PieceCarousel.test.tsx::debe_conservar_seleccion_sin_movimiento` |
| UX-PERF-001 | T-001-06 | `ContentTray.test.tsx::debe_actualizar_detalle_en_una_activacion` |

`UX-A11Y-001` y `UX-A11Y-004` quedan **unverified** en contraste medido y área al 200 %: jsdom no
calcula layout ni resuelve tokens CSS. Motivo: limitación declarada en `tasks.md`. La medición
pertenece a `code-reviewer` en `/sdd-verify`.

### Implementación (2026-08-22)

`ContentTray` es la fuente única de la pieza activa (`reconcileActivePiece`). `PieceCarousel`
propaga `active`/`onActive`. La lista empieza plegada; «Abrir detalle» y «Ver viral fuente»
quedan en columna con separador. Los seis estados usan el microcopy de `design.md` §2 y §3.

### Suite `test:ui`

Instalación puntual con `NODE_TLS_REJECT_UNAUTHORIZED=0` y `--strict-ssl=false` (no se persistió
en `.npmrc`). Comando: `npm run test:ui`. Exit code 0.

```
 RUN  v3.2.7

 ✓ src/components/PieceCarousel.test.tsx (3 tests) 236ms
 ✓ src/components/ContentTray.test.tsx (10 tests) 1095ms

 Test Files  2 passed (2)
      Tests  13 passed (13)
   Duration  3.51s
```

Los nueve casos de `tasks.md` más la cobertura de los seis estados y la parte semántica de
`UX-A11Y-001`/`UX-A11Y-004` quedan en verde. El contraste medido y el área al 200 % siguen
unverified para `/sdd-verify`.

---

## DOC-README-INSTALACION

## T-001-07 · Documentar el recorrido de clonación limpia en el README

- Cubre: OBJ-004 → PRD-RF-005, PRD-RF-008 → UC-011 → RF-04, RF-06, RF-07 → CA-04, CA-06, CA-07
- Artefacto: [`README.md`](../../../README.md)
- Gate: `node scripts/check-sdd.mjs --spec 001 --json`
- Revisión de clonación: `node scripts/install-local.mjs check` sobre el árbol de trabajo, sin
  leer `.env` ni imprimir valores reales

DOC-README-INSTALACION · T-001-07 · README.md

declared-direct: revisión documental del README contra el contrato CLI y el recibo real de `check`.

### Contrato de preparación

El README abre con «persistencia comprobada», «arranque comprobado» y «opcionales identificados».
Clasifica capacidades en obligatoria, opcional bloqueada y opcional degradada. No contiene
`DATABASE_URL` con valor, secretos ni rutas personales. `.env.example` ya no cita una ruta de
usuario.

### Recibo real de `check` (2026-08-22)

Comando: `node scripts/install-local.mjs check`. Exit code 1 (bloqueo de persistencia, esperado
en este equipo).

```
plataforma: comprobada
runtime: comprobada
dependencias: comprobada
configuración: comprobada
persistencia: bloqueada
Siguiente paso: Conserva los datos locales y solicita un reset separado. Alternativa segura: detén la preparación sin modificar los datos.
proceso: comprobada
IA autenticada: opcional no comprobada
proveedores externos: opcional no comprobada
herramientas audiovisuales: comprobada
navegación automatizada: comprobada
Preparación bloqueada
```

Una persona que clona en limpio y no tiene datos locales sigue el README hasta `prepare` +
`start`. En este árbol, el único bloqueo accionable es la persistencia protegida: no se lanzó
`reset` ni `iniciar.bat`.

### Gate SDD

Comando: `node scripts/check-sdd.mjs --spec 001 --json`.

```
{"ok":false,"mode":"normal","scope":{"spec":"001"},"counts":{"specs":1,"tasksDone":1,"warnings":28,"problems":22}}
```

`ok: false` persiste por problemas preexistentes de matriz SEC/WCAG en `plan.md` (IDs `SEC-00N` y
citas WCAG). No se reescribe el plan en esta tarea. El aviso de `DOC-README-INSTALACION` ya no
aparece: tasks, test-plan y evidence enlazan DOC-ID, T-001-07 y `README.md`.
