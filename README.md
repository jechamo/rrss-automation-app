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

La preparación local está disponible mediante el instalador guiado. Antes de
ejecutarlo, comprueba los requisitos de Windows 11.

### Instalador guiado

El punto de entrada recomendado en Windows 11 es **doble clic en `preparar.bat`**.
Recorre, en este orden:

1. Diagnóstico (`check`), sin cambios.
2. Preparación (`prepare`), solo si confirmas.
3. **Sesión de Claude**: muestra `claude auth login` y `claude auth status`. No pide
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
- Herramientas audiovisuales básicas (FFmpeg/ffprobe)
- Navegación automatizada (Playwright y Chromium instalados)

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

En automatizaciones controladas puede usarse `prepare --yes`; solo confirma la preparación
dentro del proyecto y nunca autoriza `reset` ni la detención de procesos.

Resultado esperado: el asistente muestra el plan y pide consentimiento
`project-preparation`. Si aceptas, instala dependencias, prepara SQLite y exige
un `npm run build` correcto antes de escribir el marcador de preparación. Si
rechazas, no hay efecto.

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
- Actualización de un local ya usado: no ejecutes `reset`. Conserva el snapshot,
  integra la nueva versión del código y valida la base/Vault antes de usar `iniciar.bat`;
  el instalador limpio no adopta una base histórica sin marcador.
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
si aceptas, el servidor de producción en marcha y limitado a `127.0.0.1`. El éxito requiere que
`/api/health/ready` confirme aplicación, SQLite y Vault; ocupar el puerto no
basta. Rechazar no se interpreta como fallo técnico.

Si no ocurre: confirma el proceso o puerto detectado, o libera el puerto a
mano. El asistente **no** ejecuta `taskkill /IM node.exe`.

Hay un arranque limpio histórico (`iniciar.bat`) que puede afectar procesos de
servidor y la caché de compilación. **No es inocuo** y esta guía no lo dispara.
Si necesitas un arranque con confirmación previa, usa el asistente.

#### 5. Revisar el resultado

Qué se comprueba: el contrato de las tres garantías.

- Éxito: «Uso local básico preparado. La aplicación puede iniciarse sin un
  bloqueo de persistencia.» Abre `http://localhost:3000/ajustes` y configura
  manualmente solo los conectores que vayas a utilizar.
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
| IA autenticada | Opcional bloqueada | Los análisis que dependen de la sesión local no estarán disponibles. Ejecuta `claude auth login` y comprueba con `claude auth status`; el instalador no autentica por ti. |
| Proveedores externos | Opcional bloqueada | La generación con proveedores remotos queda fuera. Configúralos en Ajustes. |
| Herramientas audiovisuales | Opcional degradada | Se conserva la previsualización; no el montaje que depende de FFmpeg. |
| Navegación automatizada | Opcional degradada | Si Chromium no existe realmente, ejecuta tú `npx playwright install chromium`; el instalador no lo descarga. Mientras tanto puedes usar la subida manual. |

#### 7. Recuperar bloqueos frecuentes

| Señal | Qué hacer |
|---|---|
| Fuera de Windows 11 | Cambia de equipo. El asistente se detiene antes de tocar nada. |
| Falta Node.js 20+ | Instálalo y vuelve a `check`. |
| Dependencias ausentes | `prepare` y confirma el plan. |
| Falta la configuración local de persistencia | Copia la plantilla `.env.example` a `.env` y ajusta solo valores no sensibles. No pegues secretos. |
| Datos locales protegidos | Conserva los datos. Solo usa `reset` si quieres un reinicio explícito. |
| Puerto ocupado | Confirma el PID/puerto que muestre el asistente, o libéralo tú. |
| Readiness indica Vault bloqueado tras un cierre abrupto | Detén RRSS Studio, comprueba que no quede otro proceso usándolo y elimina únicamente `data/.vault.lock`; nunca separes `.vaultkey` de `vault.enc`. |
| Permiso de escritura | «La preparación está bloqueada por permisos de escritura. Usa una ubicación con permiso y vuelve a comprobarla.» |
| IA o FFmpeg ausentes | Sigue; el uso local básico no depende de ellos. |

### Operaciones del asistente

| Comando | Efecto |
|---|---|
| `preparar.bat` o `npm run setup:guide` | Recorrido guiado: check, prepare, indicar `claude auth login/status`, comprobar sesión, start. |
| `npm run setup:local` o `node scripts/install-local.mjs` | `check`. Sin cambios. |
| `node scripts/install-local.mjs prepare [--yes]` | Preparación dentro del proyecto; `--yes` solo automatiza este consentimiento. |
| `node scripts/install-local.mjs start` | Arranque local, con consentimiento de proceso. |
| `node scripts/install-local.mjs reset` | Resguardo y reinicio de persistencia, con confirmación separada. |

Ninguna operación instala globalmente, modifica PATH, autentica IA, configura
proveedores, lee secretos ni termina procesos por imagen global.

## Herramientas locales: instalación y alcance

El instalador prepara las dependencias npm del proyecto, `.env`, SQLite y el
build. **No instala herramientas globales ni descarga navegadores o modelos.**
Después de instalar una herramienta, reinicia RRSS Studio y pulsa **Volver a
comprobar** en `http://localhost:3000/ajustes`.

| Herramienta | Para qué se usa | ¿La instala `preparar.bat`? | Cómo habilitarla |
|---|---|---|---|
| Claude Code CLI | Dossier, análisis, búsqueda, guiones y planificación de contenido. | Sí, como dependencia local del proyecto; también puede reutilizar una instalación gestionada existente. No inicia sesión. | Ejecuta `claude auth login` y verifica con `claude auth status`. No necesita una API key en Ajustes. |
| FFmpeg + ffprobe | Montaje, recorte, subtítulos, MIX y validación de audio/vídeo. | No. | `winget install Gyan.FFmpeg` instala ambos. Reinicia la aplicación para refrescar la detección. |
| yt-dlp | Descarga y subtítulos de YouTube; apoyo para vídeo de TikTok e Instagram. | No. | `winget install yt-dlp.yt-dlp` |
| Chromium de Playwright | Login, verificación de rutas, navegación y grabación automática. | No. | Desde el proyecto: `npx playwright install chromium` |
| Whisper local | Transcripción sin créditos cuando no hay cues editoriales ni CC de YouTube. | No. | No hay descarga automatizada en el instalador actual. Provisiona `whisper.cpp v1.9.1` en `data/tools/whisper-cpp`, con `bin/Release/whisper-cli.exe` y el modelo multilingüe `models/ggml-small.bin`. |

FFmpeg, ffprobe y yt-dlp se resuelven desde una ruta configurada, `PATH` o una
instalación de WinGet. Whisper se mantiene dentro del proyecto. Si falta una
herramienta opcional, la aplicación debe mostrar la limitación concreta en vez
de declarar un éxito falso.

## Configurar Ajustes y claves

1. Arranca RRSS Studio y abre `http://localhost:3000/ajustes`.
2. En **Motor de IA**, selecciona Claude y pulsa **Probar conexión**. La sesión
   es local; no pegues una API key de Anthropic.
3. En **Proveedores**, configura únicamente los servicios que vayas a usar.
   Pulsa **Guardar** y después **Probar**.
4. Revisa **Herramientas del sistema** y usa **Volver a comprobar** tras una
   instalación o un cambio de ruta.

Las claves se guardan cifradas en el Vault local y no en `.env`. La interfaz no
vuelve a mostrar su valor completo. La prueba de Scrape Creators consulta el
saldo real y puede consumir un crédito; fal.ai realiza una validación inicial de
formato y la validación completa sucede en el primer uso.

| Ajuste | Cuándo se usa | ¿Es obligatorio? | Obtener credencial |
|---|---|---|---|
| Claude | Dossier, mapa funcional, competencia, leads, virales y guiones. | Solo para flujos con IA; no usa API key, sino la sesión local de Claude Code. | `claude auth login` |
| Gemini | Comprensión de vídeo y verificación opcional en el Laboratorio de clips. | No; depende del modo elegido. | [Google AI Studio](https://aistudio.google.com/apikey) |
| ElevenLabs | Locución por voz seleccionada. | Solo si eliges esa rama de voz. | [ElevenLabs](https://elevenlabs.io/app/settings/api-keys) |
| HeyGen | Vídeos con avatar y voz. | Solo si eliges HeyGen. | [HeyGen](https://app.heygen.com/settings) |
| fal.ai | Generación de vídeos o cortes. | Solo si eliges fal.ai. | [fal.ai](https://fal.ai/dashboard/keys) |
| GitHub Token | Clonar repositorios privados para analizar código. | No para repositorios públicos ni rutas locales. | [GitHub](https://github.com/settings/tokens) |
| Scrape Creators | Búsqueda estructurada de virales públicos en YouTube, TikTok e Instagram. | Solo en el modo que usa este proveedor. | [Scrape Creators](https://app.scrapecreators.com/) |

No introduzcas en Ajustes contraseñas de la app analizada. Cuando una demo
necesita login, sus credenciales se guardan desde el proyecto en un registro
cifrado independiente del Vault.

## Zonas de la aplicación y dependencias

| Zona | Qué permite hacer | Claves o herramientas que puede usar |
|---|---|---|
| Dashboard | Abrir proyectos y piezas recientes. | Ninguna. |
| Nuevo análisis | Crear un proyecto desde una URL, repositorio o ruta local. | Sesión de Claude para generar el análisis; GitHub Token solo si el repositorio es privado. |
| Pipeline, mapa y dossier | Rastrear la app, extraer funciones y mantener la verdad de negocio. | Claude; Chromium para verificar rutas o navegación dinámica. |
| Competencia | Descubrir, comparar y editar competidores. | Claude. |
| Leads | Localizar negocios públicos y proponer una estrategia. | Claude con búsqueda web; no requiere una key de proveedor adicional. |
| Virales | Buscar, ordenar y descomponer patrones virales. | Claude; Scrape Creators solo en los modos de scraping o híbridos. |
| Contenido desde viral | Generar guion, vídeo, voz y montaje. | Claude; según la elección, fal.ai o HeyGen, ElevenLabs y Gemini opcional; FFmpeg/ffprobe para el final. yt-dlp puede enriquecer fuentes de TikTok/Instagram. |
| Contenido propio | Grabar o subir una demo de la app y montarla. | Claude; Chromium para automatización; credenciales cifradas del proyecto si hay login; fal.ai o HeyGen y ElevenLabs según la rama; FFmpeg/ffprobe para el final. |
| Laboratorio de clips | Convertir un vídeo o YouTube en clips 9:16 subtitulados. | FFmpeg, ffprobe y Whisper local; yt-dlp para YouTube; Gemini solo en **Descubrir con IA** o **Verificar con Gemini**. |
| Estudio multimedia | Mediateca, grabación REC/STOP y MIX. | FFmpeg/ffprobe; permiso del navegador para compartir pantalla. No requiere API key. |
| Publicación asistida | Descargar vídeo, copiar el texto y abrir la red social. | Ninguna key de la red social; la app no publica automáticamente. |
| Ajustes | Elegir motor, guardar/probar claves y comprobar herramientas. | Solo las credenciales que el usuario decida configurar. |
| Guía | Consultar los flujos detallados y sus posibles errores. | Ninguna. |

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
