# RRSS Studio

App **web local** (`localhost`) para analizar una appweb y generar contenido de
redes sociales: dossier, competencia, leads, virales y piezas de vídeo.

Se desarrolla por requisitos, con validación entre cada uno. La especificación
activa de bandeja e instalación local es
[`docs/specs/001-content-tray-local-installation/`](docs/specs/001-content-tray-local-installation/).

## Preparar RRSS Studio en Windows 11

La guía cubre dos declaraciones visibles:

1. **Uso local básico**: dependencias, persistencia local y arranque comprobados.
2. **Capacidades opcionales**: análisis con herramienta de IA autenticada,
   proveedores externos y herramientas audiovisuales o de navegación. Su ausencia
   limita una función concreta, pero no invalida el uso local básico.

Aún no hay preparación local. Empieza comprobando los requisitos de Windows 11.

### Instalador guiado

El punto de entrada recomendado en Windows 11 es **doble clic en `preparar.bat`**.
Recorre, en este orden:

1. Diagnóstico (`check`), sin cambios.
2. Preparación (`prepare`), solo si confirmas.
3. **Sesión de Claude**: te indica que abras la app y ejecutes `/login`. No pide
   secretos ni lanza el login. Después comprueba la sesión en solo lectura.
4. Arranque (`start`), solo si confirmas.
5. Resultado: uso local básico y efecto de la IA si falta la sesión.

La falta de Claude **no bloquea** el uso local básico. Equivale a:

```bat
npm run setup:guide
```

o `node scripts/prepare-guide.mjs`.

### Contrato de preparación

Una clonación está lista para uso local básico cuando se cumplen las tres
garantías:

- **persistencia comprobada**
- **arranque comprobado**
- **opcionales identificados**

El asistente de consola termina en una sola conclusión: **«Uso local básico
preparado»** o **«Preparación bloqueada»**. No declares éxito si falta un
obligatorio.

### Requisitos obligatorios

Estos bloquean el uso local básico si fallan:

| Comprobación | Qué se verifica | Si no ocurre |
|---|---|---|
| Plataforma | Windows 11 | Usa un equipo con Windows 11 y vuelve a comprobar. |
| Runtime | Node.js ≥ 20 y npm local | Instala Node.js 20 o superior y repite el diagnóstico. |
| Dependencias | Paquetes del proyecto | Ejecuta la preparación dentro del proyecto y confirma el plan. |
| Configuración | Plantilla local copiada a `.env` | Completa la configuración local aprobada. No se imprime el valor de ninguna variable. |
| Persistencia | SQLite gestionada por el asistente | Completa o repara la persistencia local y vuelve a comprobar. Datos desconocidos se conservan y bloquean. |
| Proceso | Puerto local libre o PID concreto confirmado | Confirma el proceso o puerto detectado; el asistente no mata procesos por imagen global. |

### Capacidades opcionales

| Clase | Se comunica como | Ejemplo |
|---|---|---|
| **Obligatoria** | Bloquea el uso local básico | Persistencia no preparada: no se declara arranque correcto. |
| **Opcional bloqueada** | No impide el uso local básico | IA sin sesión local: no estarán disponibles los análisis que dependan de ella. |
| **Opcional degradada** | Puedes continuar con esta limitación | FFmpeg ausente: se conserva la previsualización, no el montaje final. |

El asistente identifica, no configura, estas capacidades:

- IA autenticada (sesión local de la herramienta de IA)
- Proveedores externos (claves en Ajustes, cifradas; nunca en `.env`)
- Herramientas audiovisuales (FFmpeg/ffprobe)
- Navegación automatizada (Playwright en el proyecto)

La guía no solicita, muestra, guarda ni valida secretos. Tampoco inicia sesión
en la herramienta de IA ni configura proveedores.

### Pasos

Cada paso es regresable: si uno falla, corrige y vuelve a ejecutarlo. No
continúes hasta ver el resultado del paso actual.

#### 1. Comprobar Windows 11 y el diagnóstico

Qué se comprueba: plataforma, runtime, dependencias, plantilla, persistencia,
puerto y opcionales. Sin cambios en disco.

```bat
npm run setup:local
```

Equivale a `node scripts/install-local.mjs` (operación `check` por defecto).

Resultado esperado: un recibo lineal por categoría (`plataforma`, `runtime`,
`dependencias`, `configuración`, `persistencia`, `proceso`) y las capacidades
opcionales. Termina en preparación lista o bloqueada.

Si no ocurre: lee la categoría y el siguiente paso del recibo. El diagnóstico de
persistencia habla de la categoría, nunca del valor: «Falta la configuración
local de persistencia» o «No se pudo comprobar la persistencia local». No
imprime `DATABASE_URL`, secretos, rutas personales ni contenido local.

#### 2. Preparar dependencias y plantilla

Qué se comprueba: acciones declaradas **dentro del proyecto** (dependencias y
configuración local).

```bat
node scripts/install-local.mjs prepare
```

Resultado esperado: el asistente muestra el plan y pide consentimiento
`project-preparation`. Si aceptas, instala dependencias y deja la plantilla
lista. Si rechazas, no hay efecto.

Si no ocurre: confirma el plan o resuelve el bloqueo del `check` anterior.
`prepare` no instala nada global ni modifica el PATH.

#### 3. Comprobar la persistencia local

Qué se comprueba: que la base local sea gestionada por el asistente o que no
existan datos desconocidos.

Comprobando la persistencia local. No continúes hasta ver el resultado de este
paso.

- Clonación limpia: `prepare` puede crear la persistencia gestionada.
- Datos locales existentes o incompatibles: **Arranque bloqueado para proteger
  datos locales**. El asistente los conserva y no arranca.
- Reinicio deliberado (no forma parte del recorrido feliz):

```bat
node scripts/install-local.mjs reset
```

`reset` solo aparece ante un bloqueo de datos y una solicitud explícita. Pide
una segunda confirmación (`data-reset`) **sin opción afirmativa por defecto** e
indica posible pérdida. Rechazar conserva los datos y el bloqueo. Antes de
escribir, copia un resguardo bajo `data/installation/backups/`.

Si no ocurre: «No se pudo comprobar la persistencia local. Completa la
configuración local y vuelve a ejecutar esta comprobación.»

#### 4. Arrancar

Qué se comprueba: obligatorios en verde y puerto disponible, o un PID concreto
confirmado.

```bat
node scripts/install-local.mjs start
```

Resultado esperado: consentimiento `process` (también con el puerto libre) y,
si aceptas, el servidor local en marcha. Rechazar no se interpreta como fallo
técnico.

Si no ocurre: confirma el proceso o puerto detectado, o libera el puerto a
mano. El asistente **no** ejecuta `taskkill /IM node.exe`.

Hay un arranque limpio histórico (`iniciar.bat`) que puede afectar procesos de
servidor y la caché de compilación. **No es inocuo** y esta guía no lo dispara.
Si necesitas un arranque con confirmación previa, usa el asistente.

#### 5. Revisar el resultado

Qué se comprueba: el contrato de las tres garantías.

- Éxito: «Uso local básico preparado. La aplicación puede iniciarse sin un
  bloqueo de persistencia.» Abre `http://localhost:3000`.
- Parcial: el uso local básico está preparado y alguna opcional queda
  bloqueada o degradada. Ejemplo: «RRSS Studio está preparado para uso local
  básico. El análisis con IA sigue bloqueado hasta que inicies sesión
  localmente.»
- Bloqueo: una sola conclusión bloqueada, con categoría y siguiente paso. No
  hay secretos en la salida.

#### 6. Capacidades opcionales

Tras el uso local básico, habilita solo lo que necesites:

| Capacidad | Clase si falta | Efecto |
|---|---|---|
| IA autenticada | Opcional bloqueada | Los análisis que dependen de la sesión local no estarán disponibles. El instalador te indica `/login` y comprueba la sesión; no autentica por ti. |
| Proveedores externos | Opcional bloqueada | La generación con proveedores remotos queda fuera. Configúralos en Ajustes. |
| Herramientas audiovisuales | Opcional degradada | Se conserva la previsualización; no el montaje que depende de FFmpeg. |
| Navegación automatizada | Opcional degradada | La grabación automática de la app no estará disponible; puedes usar la subida manual. |

#### 7. Recuperar bloqueos frecuentes

| Señal | Qué hacer |
|---|---|
| Fuera de Windows 11 | Cambia de equipo. El asistente se detiene antes de tocar nada. |
| Falta Node.js 20+ | Instálalo y vuelve a `check`. |
| Dependencias ausentes | `prepare` y confirma el plan. |
| Falta la configuración local de persistencia | Copia la plantilla `.env.example` a `.env` y ajusta solo valores no sensibles. No pegues secretos. |
| Datos locales protegidos | Conserva los datos. Solo usa `reset` si quieres un reinicio explícito. |
| Puerto ocupado | Confirma el PID/puerto que muestre el asistente, o libéralo tú. |
| Permiso de escritura | «La preparación está bloqueada por permisos de escritura. Usa una ubicación con permiso y vuelve a comprobarla.» |
| IA o FFmpeg ausentes | Sigue; el uso local básico no depende de ellos. |

### Operaciones del asistente

| Comando | Efecto |
|---|---|
| `preparar.bat` o `npm run setup:guide` | Recorrido guiado: check, prepare, indicar `/login`, comprobar sesión, start. |
| `npm run setup:local` o `node scripts/install-local.mjs` | `check`. Sin cambios. |
| `node scripts/install-local.mjs prepare` | Preparación dentro del proyecto, con consentimiento. |
| `node scripts/install-local.mjs start` | Arranque local, con consentimiento de proceso. |
| `node scripts/install-local.mjs reset` | Resguardo y reinicio de persistencia, con confirmación separada. |

Ninguna operación instala globalmente, modifica PATH, autentica IA, configura
proveedores, lee secretos ni termina procesos por imagen global.

## Stack

Node.js ≥ 20 · TypeScript · Next.js (App Router) · Tailwind · React Flow ·
SQLite/Prisma · Playwright (opcional) · FFmpeg (opcional) · Claude Code CLI
(opcional, sesión local).

## Documentación

- [Requisitos](docs/01-requisitos.md)
- [Diseño](docs/02-diseno.md)
- [Arquitectura](docs/03-arquitectura.md)
- [Constitución](docs/architecture/constitution.md)
- [Bitácora](docs/bitacora/DECISIONS.md)
- Spec 001: [spec](docs/specs/001-content-tray-local-installation/spec.md) ·
  [diseño](docs/specs/001-content-tray-local-installation/design.md) ·
  [contrato CLI](docs/specs/001-content-tray-local-installation/contracts/internal-cli.md)
