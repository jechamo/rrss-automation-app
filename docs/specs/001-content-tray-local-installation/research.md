# Investigación técnica · 001-content-tray-local-installation

| Campo | Valor |
|---|---|
| **Estado** | investigación histórica + decisiones técnicas posteriores al gate del plan |
| **Fecha** | 2026-08-21 (ampliado el mismo día tras aprobar el gate del plan) |
| **Spec funcional** | `approved` |
| **Diseño** | `approved` |
| **Plan técnico** | `approved` por norkc, 2026-08-21 |
| **Constitución** | `aprobada-vigente` · ASVS 5.0.0 L2 |
| **Producto canónico** | `legacy-pending` · riesgo aceptado expresamente en el gate del plan |

## Resultado de la investigación

La constitución aprobada permite planificar dentro del monolito local: UI en React, adaptadores de
entrada, reglas puras en `src/core/`, Prisma/SQLite y procesos como infraestructura. No se requiere
ADR porque no se añade servicio, worker, base de datos, broker ni dependencia cloud.

La recomendación es una corrección local y controlada del estado de selección, sin cambio de API ni
Prisma, y un asistente interno Node para Windows 11. El asistente diagnostica sin efectos, bloquea
cualquier SQLite existente que no pueda considerar clonación limpia y pide consentimientos separados
antes de tocar procesos, caché o datos. El plan, modelo, contrato y pruebas se documentan en los
artefactos de esta spec; `tasks.md` no se crea hasta el gate humano del plan.

El baseline durable de producto y documentación continúa `legacy-pending` en `.sdd/installed.json`.
No se interpreta como verde: el gate humano del plan debe resolver o aceptar expresamente ese riesgo.

## Evidencia local

### Carrusel y detalle

- `src/components/ContentTray.tsx` mantiene `focusedPieceId`, pero `PieceCarousel` sólo recibe
  `onSelect` para la activación de la tarjeta central. El detalle usa `focusedPieceId` o la primera
  pieza como fallback.
- `src/components/Carousel3D.tsx` posee un índice interno cuando no recibe `active` y sólo llama a
  `onActive` si el consumidor le proporciona esa prop. Las tarjetas laterales, anterior, siguiente
  e indicadores actualizan ese índice interno; no invocan `onSelectCenter`.
- Hipótesis falsable confirmada por lectura: después de pulsar un lateral, flecha o indicador, la
  tarjeta central puede cambiar mientras el detalle conserva `focusedPieceId` anterior. La causa
  es la doble fuente de verdad de selección, no los datos de `ContentPiece` ni la API.
- `ExpandableCarousel.tsx` ya consume `Carousel3D` de forma controlada con `active` y `onActive`.
  Es evidencia de un patrón existente que el futuro plan puede evaluar para la bandeja, sin asumir
  que deba modificar todos los consumidores del carrusel.
- La lista ya inicializa `expanded` como mapa vacío y cambia una clave por pieza. Falta especificar
  el contrato de reinicio al entrar, recargar o cambiar colección y la semántica accesible diseñada:
  control nombrado, estado expandido, foco estable y contenido asociado.

### Persistencia y arranque local

- `prisma/schema.prisma` usa SQLite con `env("DATABASE_URL")`; `src/lib/prisma.ts` crea
  `PrismaClient` sin inicialización, diagnóstico ni preparación de esquema.
- `package.json` declara Node `>=20`, `db:generate` y `db:push`; no declara un comando de
  instalación ni un runner de pruebas de interfaz, integración o E2E para esta superficie.
- `.gitignore` excluye `.env`, `*.db`, `prisma/dev.db*` y `data/`. La configuración y los datos
  locales no se deben incluir en documentación, diagnósticos ni fixtures.
- `iniciar.bat` mata todos los procesos `node.exe`, termina cualquier PID que escuche en el puerto
  3000 y borra `.next` antes de iniciar el servidor. Es el comportamiento que RF-05 exige
  convertir en comprobación previa, explicación y confirmación; no es un asistente seguro para una
  clonación limpia.
- En la reanudación se confirmó `.env.example`: declara `DATABASE_URL="file:./dev.db"` sin
  secretos. El README existe pero aún no ofrece el recorrido requerido; se actualizará mediante
  `DOC-README-INSTALACION`, sin leer `.env`.

### Patrones de seguridad reutilizables

- `src/core/media/bintools.ts` detecta herramientas mediante `spawnSync` con argumentos separados,
  `windowsHide` y timeout; clasifica origen y ofrece un `installHint`. Sólo cubre herramientas
  opcionales de medios.
- `src/core/media/storage.ts` guarda rutas relativas bajo `data/` y valida contra traversal. Las
  rutas API de media verifican pertenencia de proyecto antes de leer o borrar un recurso.
- `src/app/api/system/tools/route.ts` expone el estado de las herramientas opcionales al proceso
  que realmente las usará. Es evidencia para distinguir capacidad opcional de requisito básico;
  no cubre Node, npm, Windows, Prisma ni SQLite.
- La nueva superficie no puede reutilizar directamente los efectos de `iniciar.bat`: debe acotar
  explícitamente cualquier ruta al repositorio, no seguir enlaces para operaciones locales,
  evitar `shell` y confirmar de forma separada los efectos sobre procesos, caché y cualquier
  reinicio de datos.

### Contrato documental y pruebas

- `.sdd/docs.json` está en modo `audit` y declara `DOC-README-INSTALACION` como
  `developer-readme`, manual, con `README.md` como artefacto y `docs-writer` como propietario.
- `.sdd/checks.json` sólo configura el gate SDD; deja sin configurar lint, test, typecheck, build,
  seguridad, accesibilidad y documentación. `package.json` sólo tiene `test:contracts` basado en
  `node --test` para módulos existentes; no hay evidencia de Vitest, Jest o configuración de
  Playwright para esta spec.
- Los contratos actuales relevantes son `GET /api/content/:projectId` y los endpoints de piezas y
  media. El cambio de carrusel no necesita una API nueva. El asistente de consola sí necesitará un
  contrato estable de resultados de comprobación antes de implementarse, pero elegir su ubicación,
  formato y comando pertenece al plan bloqueado.

## Alternativas investigadas, pendientes de decisión arquitectónica

| Decisión | Alternativas observables | Criterios | Estado |
|---|---|---|---|
| Fuente de selección del carrusel | Estado controlado desde `ContentTray`; adaptar sólo `PieceCarousel`; conservar índice interno y emitir cada cambio | Una identidad activa para carrusel y detalle, compatibilidad con otros consumidores y pruebas de eliminación | Requiere plan tras constitución; la evidencia favorece estado controlado o notificación de cada cambio, no dos estados independientes. |
| Asistente Windows | Extender `iniciar.bat`; añadir un ejecutable Node versionado; documentar sólo pasos manuales | Comprobación sin cambios, confirmaciones, salida estructurada, Windows 11, no secretos y ejecución sin shell | Requiere decisión de `architect`; la documentación sola no satisface RF-05/RF-08. |
| Persistencia SQLite | Declarar ruta relativa de ejemplo y ejecutar Prisma; preparar por script con detección previa; exigir preparación manual documentada | No exponer `DATABASE_URL`, preservar datos existentes/incompletos/incompatibles, distinguir clon limpio y reinicio confirmado | Requiere contrato de configuración y clasificación precisa de datos antes de planificar. |
| Datos detectados | Bloquear y conservar; reset solicitado y confirmado por separado | No pérdida silenciosa, repetibilidad tras interrupción, diagnóstico sin contenido de base de datos | El comportamiento de producto está aprobado; falta la decisión técnica de detección, copia/retención y operación autorizada. |
| Herramientas opcionales | Reutilizar detección `bintools`; comprobar en el asistente; mencionar sólo en README | Ausencia no bloquea uso básico, efecto funcional visible y sin instalación automática | Requiere catálogo final de obligatorios/opcionales sin añadir tecnologías no declaradas. |

## Decisiones técnicas tomadas tras el gate del plan (2026-08-21)

El gate humano del plan quedó `approved` (norkc, 2026-08-21) con el alcance de `plan.md` §15. Las tres
decisiones siguientes son las únicas que la fase de troceo necesitaba resolver y que la investigación
original había dejado abiertas.

### D-RUNNER-UI · Runner de pruebas de interfaz

`T-001-06` concentra `CA-01`, `CA-02`, `CA-03` y diez controles `UX-*`. Sin un runner capaz de montar
componentes React no existe un RED demostrable, y sin RED demostrable no hay TDD: la tarea se
convertiría en implementación primero y comprobación manual después.

| Alternativa | Coste real | Resultado |
|---|---|---|
| No automatizar la UI y verificar solo a mano | 0 dependencias | **Descartada.** Incumple la regla dura de TDD y deja diez controles `UX-*` sin test asociado. |
| `node:test` + `jsdom` + `react-dom/test-utils` a mano | 2 dependencias, más un paso de compilación TSX propio | **Descartada.** `tsc` no produce el bundle que `node --test` puede cargar con JSX de React 19, y habría que reimplementar `act()`, limpieza entre casos y consultas accesibles. Es construir un runner, no usarlo. |
| Playwright component testing | `playwright` ya está, pero añade `@playwright/experimental-ct-react`, su propio build y `npx playwright install` | **Descartada.** Requiere descargar navegadores (red) para probar una regla de selección y un `aria-expanded`. Desproporcionado. |
| **Vitest + Testing Library** | 5–6 devDependencies (detalle abajo) | **Elegida.** Aprobada por norkc el 2026-08-21. |

**Coste honesto: no son dos paquetes, son cinco o seis.** La opción se pidió como «vitest +
@testing-library/react»; su instalación real es:

| Paquete | Papel | Imprescindible |
|---|---|---|
| `vitest` | Runner, aserciones y selección de entorno. | Sí |
| `@vitejs/plugin-react` | Transforma TSX/JSX de React 19 antes de ejecutar. | Sí |
| `jsdom` | Implementación de DOM en Node (`environment: "jsdom"`). | Sí |
| `@testing-library/react` | `render`, consultas accesibles por rol/nombre y `act()`. | Sí |
| `@testing-library/user-event` | Teclado real (`Tab`, `Enter`, `Espacio`) que exigen `UX-A11Y-003` y `UX-A11Y-005`. | Sí para los controles de teclado |
| `@testing-library/jest-dom` | Matchers (`toHaveAttribute`, `toHaveAccessibleName`). | **Opcional**: sustituible por aserciones nativas, a costa de mensajes de fallo peores. |

Se añade además un `vitest.config.ts` versionado y un script `test:ui` en `package.json`. Ninguna de
estas dependencias entra en el bundle de producción: todas son `devDependencies`.

**Restricción de red (AGENTS.md §2).** El DNS externo no resuelve desde la shell del agente, así que
`npm install -D …` debe ejecutarlo la persona en su máquina. Es una **precondición humana exclusiva de
`T-001-06`**: `T-001-01` a `T-001-05` y `T-001-07` no necesitan ninguna dependencia nueva porque usan
`node --test`, ya disponible con Node ≥ 20, o son documentación.

**Límite de lo automatizable.** `UX-A11Y-001` (contraste real sobre tokens finales) y `UX-A11Y-004`
(área de los controles con zoom al 200 %) no son verificables en `jsdom`, que no calcula layout ni
resuelve variables CSS. El test automático cubre la parte semántica —estado en texto además de color,
nombre accesible, `aria-expanded`— y la medición de contraste y área queda como revisión manual de
`code-reviewer` en `/sdd-verify`. No se declara verde lo que no se ha medido.

### D-TEST-CONTRACTS · El script `test:contracts` necesita dos ediciones, no una

`package.json` define `test:contracts` como una cadena de tres pasos: `tsc` compila una lista
explícita de ficheros a `.contract-tests/`, `node --test` ejecuta una lista explícita de globs, y un
tercer paso borra el directorio. Como todas las entradas de `tsc` cuelgan de `src/core/`, el `rootDir`
inferido es `src/core` y la salida conserva el subdirectorio: `src/core/content/selection.test.ts`
compila a `.contract-tests/content/selection.test.js`.

Hoy los globs de `node --test` son `clips`, `media`, `leads`, `navigation` y `virales`. **No existe
`.contract-tests/content/*.test.js`**, de modo que añadir solo el fuente y el test a la lista de `tsc`
produce un **verde falso**: el test compila sin error, nadie lo ejecuta y el paso pasa. Cada test de
contrato nuevo de esta spec exige por tanto las dos ediciones:

| Tarea | Edición 1 — lista de `tsc` | Edición 2 — globs de `node --test` |
|---|---|---|
| `T-001-01` | `src/core/content/selection.ts` y `src/core/content/selection.test.ts` | `.contract-tests/content/*.test.js` |
| `T-001-02` a `T-001-04` | ficheros de `src/core/installation/*` y sus `*.test.ts` | `.contract-tests/installation/*.test.js` |
| `T-001-05` | ninguna: `scripts/install-local.test.mjs` es JavaScript y no pasa por `tsc` | `scripts/install-local.test.mjs` en la lista de `node --test` |

La comprobación de que la edición está completa es observable: el RED de la tarea debe **fallar al
ejecutarse**, no limitarse a compilar. Un `test:contracts` que pasa sin haber escrito todavía el
módulo bajo prueba es la señal de que falta la edición 2.

### D-CLI-RUNTIME · El asistente debe arrancar sobre un clon sin `node_modules`

Detectado al trocear, no antes. `RF-04` y la operación `prepare` del contrato interno incluyen
**preparar las dependencias**, de modo que el asistente se ejecuta necesariamente *antes* de que
exista `node_modules`. Eso descarta cualquier puente que necesite compilación:

| Puente evaluado | Por qué no sirve |
|---|---|
| `scripts/install-local.mjs` importa `src/core/installation/*.ts` | Node no ejecuta TypeScript. |
| Compilar con el `tsc` del repo, como hace `test:contracts` | `typescript` es una `devDependency`: no está instalada cuando el asistente arranca. Círculo vicioso. |
| `--experimental-strip-types` de Node | Requiere Node ≥ 22.6; `engines` declara `>=20`. El asistente impondría un requisito más estricto que la propia aplicación. |
| Duplicar la lógica dentro del `.mjs` | Viola DRY y garantiza deriva entre el asistente y el resto del núcleo. |

**Decisión:** `src/core/installation/*` se escribe en **JavaScript ESM (`.mjs`) con anotaciones
JSDoc**, sin dependencias y ejecutable con Node ≥ 20 sobre un clon recién descargado.
`scripts/install-local.mjs` los importa directamente. Se pierde la verificación de tipos del
compilador sobre esos módulos; se compensa con JSDoc, con los tipos ya fijados en
[`contracts/internal-cli.md`](contracts/internal-cli.md) y con tests que comprueban la forma del
recibo, no solo su valor.

**Efecto secundario favorable:** al no pasar por `tsc`, los tests de instalación solo necesitan la
edición 2 de `D-TEST-CONTRACTS` (añadirlos a `node --test`), no las dos. La doble edición sigue siendo
obligatoria para `T-001-01`, que sí es TypeScript.

**Desviación registrada:** `plan.md` §9 y `test-plan.md` nombran `installation.test.ts`. Se
materializa como `installation.test.mjs`. Los nombres de caso (`::debe_…`) no cambian, así que la
trazabilidad de cada `SEC-*` se conserva íntegra. No hay cambio de alcance.

### D-SELECTION-CONTRACT · `design.md` fija el contrato de la regla, no `data-model.md`

`data-model.md` describe la reconciliación en prosa —conservar el ID, si no está elegir la vecina
siguiente y después la anterior, y si no hay piezas devolver `null`— pero solo modela el **valor**
resultante. `design.md` es autoritativo sobre el comportamiento observable y exige **tres microcopys
distinguibles** para esa misma transición: la revisión normal (línea 144), «La pieza que revisabas ya
no está disponible. Se ha abierto [título vecina].» (líneas 125-127) y «La colección ya no tiene
piezas» (línea 157). Devolver únicamente `string | null` obligaría a la interfaz a reconstruir por su
cuenta cuál de los tres casos ocurrió, comparando con el estado anterior: sería una segunda fuente de
verdad, exactamente el defecto que la spec corrige.

La regla devuelve por tanto valor y desenlace en la misma respuesta:

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

`previousIndex` es necesario porque, cuando el ID desaparece de la colección, la posición que ocupaba
es la única información que permite localizar a su vecina; buscarla por ID ya no es posible. Las dos
fuentes no se contradicen: `data-model.md` sigue siendo válido sobre el valor y esta firma añade el
desenlace que `design.md` requiere.

## Bloqueos que debe resolver `architect` y el gate humano

> **Registro histórico.** Los puntos 1, 2, 4 y 5 quedaron resueltos por la constitución aprobada, el
> nivel ASVS 5.0.0 L2, el alta de `DOC-README-INSTALACION` en `.sdd/docs.json` y la política de
> persistencia de `data-model.md`. El punto 3 **no** se resolvió: el baseline de producto sigue en
> `legacy-pending` y norkc lo aceptó expresamente como riesgo en el gate del plan. No es verde.

1. Completar `docs/architecture/constitution.md` mediante `/onboard` o decisión equivalente: estilo,
   fronteras y dependencias permitidas para un asistente local que lee configuración, consulta
   Prisma/SQLite, gestiona archivos del repositorio y puede iniciar procesos.
2. Declarar el nivel ASVS objetivo aplicable a esta spec sensible. Sin él no se puede completar la
   matriz `SEC-*` exigida por `OPERATING-MODEL.md` §8.
3. Resolver la contradicción de producto: aprobar el PRD canónico o registrar una corrección durable
   que permita que la aprobación de `spec.md` prevalezca sobre `legacy-pending` y sus cinco
   marcadores. El plan no puede afirmar un gate de producto verde mientras el origen canónico no lo
   está.
4. Dar de alta `DOC-README-INSTALACION` en `.sdd/docs.json` con fuente, artefacto versionable,
   propietario y gate documental, o decidir formalmente el mecanismo de bootstrap documental.
5. Confirmar la política de migración Prisma para una clonación limpia y para datos existentes:
   qué evidencia permite clasificar una base como verificable, incompleta o incompatible; dónde se
   conserva; y qué operación exacta puede realizarse sólo tras la confirmación de reinicio.

## Precondiciones para reanudar `/sdd-plan`

- Constitución no `bootstrap`, con nivel ASVS y frontera aprobada para el asistente.
- PRD en estado aprobado o excepción durable aprobada que elimine sus marcadores.
- `DOC-README-INSTALACION` declarado en el contrato documental o una decisión explícita sobre su
  alta dentro del mismo cambio.
- Evidencia revisada de `README.md` y `.env.example` si existen, sin leer `.env` ni datos locales.

Cuando el entorno de implementación disponga de terminal, el implementer deberá comprobar como
mínimo el estado real antes de modificar nada:

```bash
npm --version
node --version
npm run db:generate
npm run db:push
npm run test:contracts
node scripts/check-sdd.mjs --spec 001
```

No se han ejecutado comandos en esta fase de planificación; los comandos anteriores no son
evidencia verde y deberán registrarse posteriormente en `evidence.md`.

### HANDOFF

> Bloque histórico de la investigación bloqueada. La ampliación del 2026-08-21 (sección «Decisiones
> técnicas tomadas tras el gate del plan») lo supera: el plan está aprobado y `tasks.md` existe.

- Agente origen: planner
- Fase completada: investigación de plan; plan bloqueado por gobierno SDD
- Fuentes consultadas: `AGENTS.md`, `.claude/agents/planner.md`, `docs/sdd/OPERATING-MODEL.md`, `docs/architecture/constitution.md`, `docs/product/`, `spec.md`, `clarifications.md`, `design.md`, `ContentTray`, `PieceCarousel`, `Carousel3D`, `iniciar.bat`, Prisma, rutas API, contrato documental y configuración de pruebas.
- Artefactos: `research.md` únicamente; no se crean `plan.md`, `data-model.md`, `contracts/` ni `test-plan.md` mientras falten los gates.
- Decisiones técnicas: ninguna tomada sin autoridad; se documentaron alternativas compatibles con el código existente.
- Riesgos: pérdida o exposición de datos locales, terminación indiscriminada de procesos, borrado de caché sin confirmación, éxito falso de instalación y divergencia entre carrusel/detalle.
- Seguridad: spec sensible; matriz `SEC-*` pendiente del nivel ASVS y de la decisión arquitectónica. No hay aprobación de seguridad.
- Documentación pendiente: alta de `DOC-README-INSTALACION` y verificación de README/.env.example sin acceder a secretos.
- Precondiciones para `/sdd-tasks`: plan técnico posterior aprobado por humano; antes, resolver constitución, ASVS, gate de producto y contrato documental.
- Siguiente agente sugerido: architect para `/onboard` o decisión de constitución; después, responsable del gate humano de producto y `docs-writer` para el contrato documental. Volver a `planner` para `/sdd-plan`.