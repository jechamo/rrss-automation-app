# Documento de Arquitectura — App de Automatización de Contenido para RRSS

> Metodología: **SDD**. Depende de: [Requisitos v1](01-requisitos.md), [Diseño v1](02-diseno.md).
> Alcance: stack, módulos, ejecución del pipeline, almacenamiento, conectores, seguridad.
> Estado: **APROBADO por el usuario (v1).**
> Fecha: 2026-07-13

---

## 1. Stack tecnológico (definitivo)

| Capa | Tecnología | Motivo |
|------|-----------|--------|
| Runtime/lenguaje | **Node.js + TypeScript** | Un solo lenguaje en todo el proyecto (D-13). |
| Framework | **Next.js (App Router)** | UI + API en un mismo proyecto, corre en `localhost`. |
| UI/estilos | **React + Tailwind CSS** | Tema oscuro/neón/glass (Diseño §2) con tokens. |
| Grafo de nodos | **React Flow (@xyflow/react)** | Pipeline visual animado (Diseño §5). |
| Estado cliente | **Zustand** (ligero) + React Query | Estado de UI y sincronización con API. |
| Base de datos | **SQLite + Prisma** | Historial/runs/piezas, tipado, multiproyecto (D-14). |
| Navegación web | **Playwright** | Crawl de la appweb (REQ-001) y grabación móvil (REQ-006). |
| Vídeo/montaje | **FFmpeg local** (principal) + conector cloud opcional | Montaje pluggable (D-12). |
| IA (motor) | **Claude Code CLI** y **Claude Agent SDK** (seleccionable) | Sin coste de API con plan Pro (D-02). |
| IA vídeo | **Gemini API** | Comprensión de vídeo cuando sea indispensable (D-03). |
| Secretos | **AES-256-GCM** + derivación de clave (passphrase/DPAPI) | Keys cifradas en reposo (REQ-008). |

**Gestor de paquetes:** npm. **Entorno:** Windows 11.

---

## 2. Vista de alto nivel

```
┌──────────────────────────────────────────────────────────────┐
│                      Next.js (localhost)                       │
│                                                                │
│  UI (React + Tailwind + React Flow)                            │
│   ├─ Dashboard / Proyecto / Dossier / RRSS / Ajustes ...       │
│   └─ Live updates (SSE) del estado de nodos                    │
│                                                                │
│  API Layer (Route Handlers)                                    │
│   ├─ /api/projects, /api/dossier, /api/runs ...                │
│   ├─ /api/connectors/:id/test  (botón "probar conexión")       │
│   └─ /api/runs/:id/stream       (SSE de progreso)              │
│                                                                │
│  Core / Orquestación                                           │
│   ├─ Pipeline Engine (runs, nodos, estados, reintentos)        │
│   ├─ AiEngine (CLI | Agent SDK)  ◄─ seleccionable + test       │
│   ├─ Connectors (fal.ai, HeyGen, ElevenLabs, Gemini, GitHub)   │
│   ├─ Montage (FFmpeg local | Cloud)                            │
│   ├─ WebCrawler (Playwright)                                   │
│   └─ RepoAnalyzer (git + AiEngine)                             │
│                                                                │
│  Persistencia                                                  │
│   ├─ SQLite (Prisma)  → proyectos, dossier, runs, piezas       │
│   └─ Secret Vault (AES) → API keys / tokens (fuera de git)     │
│                                                                │
│  Artefactos en disco: /data (vídeos, capturas, logs)           │
└──────────────────────────────────────────────────────────────┘
        │                 │                 │
     Playwright        FFmpeg          APIs externas
   (web objetivo)   (local video)   (fal/HeyGen/11L/Gemini)
```

---

## 3. Estructura de carpetas (propuesta)

```
rrss-automation-app/
├─ docs/                     # SDD (requisitos, diseño, arquitectura)
├─ prisma/
│  └─ schema.prisma          # modelo de datos
├─ src/
│  ├─ app/                   # Next.js App Router (páginas + /api)
│  │  ├─ (dashboard)/...
│  │  └─ api/...
│  ├─ components/            # UI (cards glass, nodos, carrusel 360)
│  ├─ core/
│  │  ├─ pipeline/           # engine de runs/nodos/estados
│  │  ├─ ai/                 # AiEngine + impl CLI y Agent SDK
│  │  ├─ connectors/         # conectores externos (interfaz común)
│  │  ├─ crawler/            # Playwright
│  │  ├─ repo/               # análisis de repos (local/GitHub)
│  │  ├─ montage/            # FFmpeg / cloud
│  │  └─ secrets/            # vault cifrado
│  ├─ lib/                   # utilidades, db client
│  └─ styles/                # tema/tokens
├─ data/                     # artefactos (git-ignored)
├─ .env.example
└─ ...
```

---

## 4. Motor de IA (AiEngine) — seleccionable CLI / Agent SDK

Requisito del usuario: **poder elegir y configurar** entre **Claude Code CLI** y **Claude Agent SDK**, y **probar la conexión con un botón** (igual que el resto de conectores).

**Interfaz común:**

```ts
interface AiEngine {
  id: 'claude-cli' | 'claude-agent-sdk';
  test(): Promise<{ ok: boolean; detail: string }>;   // botón "probar"
  run(task: AiTask): Promise<AiResult>;                // análisis, guion, etc.
  stream?(task: AiTask): AsyncIterable<AiChunk>;       // progreso en vivo
}
```

- **`ClaudeCliEngine`**: ejecuta el binario `claude` en modo headless (`claude -p "<prompt>" --output-format json`) como subproceso, usando la **sesión Pro logueada** → **sin coste de API** (D-02). `test()` comprueba que el binario existe y responde.
- **`ClaudeAgentSdkEngine`**: usa el Claude Agent SDK; para no gastar API se apoya en la misma sesión de Claude Code. `test()` valida credenciales/entorno.
- **Selección**: en **Ajustes** el usuario elige el motor activo y lo prueba. El resto del sistema depende solo de la interfaz `AiEngine` (intercambiable).

> Nota: se confirmará en implementación el flag exacto del CLI para salida estructurada; la abstracción aísla ese detalle.

---

## 5. Conectores externos (interfaz común + test)

**Todos los conectores** exponen un **`test()`** para el botón "probar conexión" (REQ-008 y petición explícita del usuario).

```ts
interface Connector {
  provider: 'fal' | 'heygen' | 'elevenlabs' | 'gemini' | 'github' | 'montage-cloud';
  test(): Promise<{ ok: boolean; detail: string }>;
  // métodos específicos por proveedor
}
```

- **fal.ai**: generación de vídeos/cortes (REQ-005/006).
- **HeyGen**: avatar foto + voz (REQ-005 opción b).
- **ElevenLabs**: TTS por ID de voz (REQ-005/006).
- **Gemini**: comprensión de vídeo (REQ-004/005).
- **GitHub token**: clonar repos privados (REQ-001).
- **Montage cloud** (Creatomate, futuro): implementación alternativa de `MontageProvider`.

Las **keys** se leen del **Secret Vault** (nunca hardcodeadas). Estado de cada conector (OK/Error + última verificación) se guarda para la UI de Ajustes.

---

## 6. Motor de pipeline (runs y nodos)

Ejecución **in-process** (mono-usuario, local), con estado **persistido** para trazabilidad y reanudación.

- Un **Run** representa la ejecución de un requisito para un proyecto.
- Cada Run tiene **nodos** (etapas) con estado: `pendiente | en curso | ok | error`.
- Cada nodo es una función `async` que recibe el contexto del run y produce artefactos.
- **Progreso en vivo** hacia la UI mediante **SSE** (`/api/runs/:id/stream`); la UI ilumina los nodos (React Flow).
- **Reintentar/regenerar por nodo** (RNF-07): se puede re-ejecutar una etapa sin rehacer las anteriores (se cachean artefactos previos).
- Los pipelines se definen de forma declarativa por requisito (REQ-001, REQ-005, …) → el grafo de la UI se deriva de esa definición.

```ts
type NodeState = 'pending' | 'running' | 'ok' | 'error';
interface PipelineNode { id: string; label: string; run(ctx): Promise<Artifact>; }
interface PipelineDef { requisito: string; nodes: PipelineNode[]; edges: [string,string][]; }
```

---

## 7. Seguridad de secretos (Secret Vault)

- Cifrado **AES-256-GCM**. Clave derivada de:
  - una **passphrase** del usuario (derivación con **scrypt/argon2**), y/o
  - el almacén del SO (**Windows DPAPI**) como alternativa.
- Vault en un fichero local (p. ej. `secrets/vault.enc`), **git-ignored**.
- Las keys **nunca** se escriben en claro en logs, DB ni repo.
- En arranque, la app pide desbloquear el vault (passphrase) si no usa DPAPI.
- `.env` solo para configuración no sensible; `.env.example` documenta variables.

---

## 8. Modelo de datos (Prisma — esquema inicial)

Refleja el modelo conceptual del Diseño §10 (multiproyecto). Esquema **inicial**, crecerá por requisito:

```prisma
model Project {
  id         String   @id @default(cuid())
  name       String
  url        String
  codeType   String?  // local | github_public | github_private | none
  codePath   String?  // ruta local o URL de repo
  logoPath   String?  // logo manual bajo data/media/project-<id>/
  niche      String?
  createdAt  DateTime @default(now())
  dossier    Dossier?
  runs       Run[]
  pieces     ContentPiece[]
}

model Dossier {
  id         String   @id @default(cuid())
  projectId  String   @unique
  project    Project  @relation(fields: [projectId], references: [id])
  content    Json     // secciones: negocio, marca, CTAs, dolor, pros, contras, persona, features
  status     String   // draft | approved
  version    Int      @default(1)
  updatedAt  DateTime @updatedAt
}

model Run {
  id         String   @id @default(cuid())
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id])
  requisito  String   // REQ-001 ...
  status     String   // pending | running | ok | error
  nodes      Json     // estado por nodo
  logs       Json?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model ContentPiece {
  id         String   @id @default(cuid())
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id])
  origin     String   // viral | own
  script     String?
  videoPath  String?
  target     String?  // youtube | tiktok | instagram
  status     String   // pending | review | published | error | deleted
  createdAt  DateTime @default(now())
}

model ConnectorState {
  provider     String   @id  // fal | heygen | elevenlabs | gemini | github | ai-engine
  status       String        // ok | error | unset
  lastChecked  DateTime?
  // NOTA: las API keys NO se guardan aquí, van al Secret Vault cifrado
}
```

> Competidores (REQ-002), Leads (REQ-003) y Virales (REQ-004) ya están en el esquema.

---

## 8.1. Arquitectura concreta de REQ-003 (leads + estrategia)

**Modelo:** `Leads` (1-a-1 con `Project`, espejo de `Competencia`): `content` JSON
`{ resumen, zona, personas[], leads[], estrategiaGlobal[] }` + `status`/`version`.

**Nodos del pipeline** (`src/core/pipeline/req003.ts`):
`[Entrada] → [Perfil de cliente] → [Buscar negocios (web)] → [Estrategia IA]`

- **Entrada** (`input`): exige dossier (REQ-001); carga competencia (REQ-002) si existe (dependencia
  laxa); conserva los leads `origen:"manual"` previos para no perderlos al regenerar.
- **Perfil de cliente** (`research.ts`): la IA deriva del dossier+competencia las buyer personas, la
  **zona** objetivo y el **tipo de negocio local** a buscar. Sin web. Apoyo: skill `rrss-lead-research`.
- **Buscar negocios (web)** (`discover.ts`): la IA con **WebSearch/WebFetch** localiza negocios locales
  reales y extrae **solo datos públicos de empresa** (nombre, dirección, web, teléfono/email públicos).
  Prompt acotado: nada de PII personal; respetar ToS. Dedupe por web/nombre; conserva semillas manuales.
- **Estrategia IA** (`strategy.ts`): por lead → `temperatura`, `canalRecomendado` (correo/visita/otro),
  `estrategia` y `borrador` (correo con asunto o guión de visita) en el tono de marca del dossier;
  `fitScore`/`intentScore`. `upsert` de `Leads`.

**Motor (`AiEngine`):** `AiTask` gana `allowedTools?: string[]` (se une a `"Skill"`, siempre presente)
y `timeoutMs?`. El nodo `discover` pide `["WebSearch","WebFetch"]` y timeout 300s (la búsqueda web es
lenta). Cableado en `claude-cli.ts` (`--allowedTools Skill,WebSearch,WebFetch`).

**Endpoints:** `POST /api/projects/:id/leads/run` (409 si no hay dossier; body opcional `{ zona }`),
`GET/PUT /api/leads/:projectId` (GET incluye su `lastRun` de REQ-003; PUT guarda/aprueba y conserva
manuales). **UI:** `LeadsPanel` + `LeadsEditor` en `/proyecto/[id]`, bajo la competencia.

---

## 8.2. Arquitectura concreta de REQ-004 (virales del nicho)

**Modelo:** `Virales` (1-a-1 con `Project`, espejo de `Competencia`/`Leads`): `content` JSON
`{ nicho, criterio{metrica,umbral,ventanaDias}, virales[], patronesRecurrentes[] }` + `status`/`version`.
Cada `Viral` guarda `{url, plataforma(youtube|tiktok|instagram), titulo, autor, vistas, fecha,
ratioAutor, viralScore(0-100), formato, hook{tipo,texto,segundos}, estructura[], shareTrigger,
porQueFunciona, patronTransferible, origen(ia|manual)}`.

**Nodos del pipeline** (`src/core/pipeline/req004.ts`):
`[Entrada] → [Buscar virales (web)] → [Ranking Top 20] → [Análisis de patrones]`

- **Entrada** (`input`): exige dossier (REQ-001); conserva los virales `origen:"manual"` previos
  (semillas) para no perderlos al regenerar.
- **Buscar virales (web)** (`discover.ts`): la IA con **WebSearch/WebFetch** localiza virales
  públicos del nicho en YT/TikTok/IG y estima vistas/`ratioAutor`/`viralScore`. Dedupe por URL;
  las semillas manuales van primero. `allowedTools:["WebSearch","WebFetch"]`, timeout 300s.
- **Ranking Top 20** (`rank`): puro código; ordena manuales primero, luego por `viralScore` desc,
  y corta al Top 20 (`TOP_N`). Marca `origen` casando URLs con las semillas manuales.
- **Análisis de patrones** (`analyze.ts`): la IA descompone cada viral (hook, estructura,
  share-trigger, **patrón transferible** — concepto, no copia) en el contexto del dossier y extrae
  `patronesRecurrentes` del nicho. `upsert` de `Virales`. Definición de viralidad **relativa al
  autor** (≈5× la mediana del canal); ventana configurable (`ventanaDias`: 7/14/30/0=histórico).
  Apoyo: skill `rrss-viral-analysis`. **Timeout 600s** (`TIMEOUT_MS`): descomponer el Top 20 supera
  el timeout por defecto del motor (180s), así que no debe cortarse por tiempo.

**Endpoints:** `POST /api/projects/:id/virales/run` (409 si no hay dossier; body opcional
`{ ventanaDias }`), `GET/PUT /api/virales/:projectId` (GET incluye su `lastRun` de REQ-004; PUT
guarda/aprueba y conserva manuales). **UI:** `ViralesPanel` (con selector de ventana) + `ViralesEditor`
en `/proyecto/[id]`, bajo los leads.

---

## 8.3. Arquitectura concreta de REQ-005 (generación de contenido / clonado de viral)

**Modelo:** `ContentPiece` — a diferencia de los contenedores 1-a-1, es **muchos por proyecto**
(bandeja de estados). Campos: `origin(viral|own)`, `sourceUrl`, `titulo`, `plataforma`,
`content` JSON (`{plataforma, guion{gancho,desarrollo,cta,locucion,hashtags[],duracionTotal},
escaleta:Shot[], patronAplicado, notaLegal}`), `config` JSON (`MediaConfig{rama, videoAuto,
videoModelo, vozProveedor, vozAuto, vozId, usarGemini, heygen?{avatarId,avatarLabel,
narracion(voice|audio),voiceId,audioAssetId,audioLabel}}`), `assets` JSON (`{videoPath,
presenterPath, audioPath, clips[], recordingPath, externalUrl, logs[]}`), `runId`,
`status(borrador|generando|listo|publicado|error)`,
`version`. `rowToPiece()` parsea los JSON a objetos tipados.

**Módulos de media** (`src/core/media/`, cada uno tira su key del vault):
- `fal.ts`: catálogo curado **Seedance V1 Pro Fast** (predeterminado), **Kling v3 Standard** y
  **Luma Ray 2**. `buildFalRequestBody()` aplica el esquema exacto por modelo: siempre 9:16;
  Seedance `5..10`, Kling `5|10`, Luma `5s|9s`. Usa la cola `queue.fal.run`, polling de hasta
  10 min y descarga `clip-N.mp4`. No existe fallback que descarte `aspect_ratio`: un modelo sin
  contrato o un body rechazado produce error visible antes de generar un vídeo incorrecto.
- `heygen.ts`: API v3 oficial. Pagina `GET /v3/avatars/looks` (50/página, públicos + propios) y
  `GET /v3/voices` (100/página) con previews; `POST /v3/assets` sube PNG/JPEG/MP3/WAV (máx.
  32 MB); `POST /v3/avatars` crea Photo Avatar; `POST /v3/videos` genera 9:16/1080p con
  exactamente `script+voice_id` o `audio_asset_id`; `GET /v3/videos/:id` espera
  `completed|failed`. Mutaciones con `Idempotency-Key`; 429/5xx reintentan respetando
  `Retry-After`; los mensajes nunca incluyen la API key.
- `elevenlabs.ts`: `listVoices()`, `tts(pieceId,text,voiceId)` (guarda `locucion.mp3`).
- `gemini.ts`: `describeViral(...)` **multimodal** — YouTube público por `file_data.file_uri`
  nativo; otras redes vía `yt-dlp` (ver `ytdlp.ts`) + **Files API** (subida resumable → espera
  `ACTIVE` → análisis → borrado remoto + temporal). Modelo `gemini-2.0-flash`. Degrada a REQ-004.
- `ytdlp.ts`: `hasYtDlp()` + `downloadVideo()` — binario del sistema **opcional** (como FFmpeg).
- `contracts.ts` → `resolveFalDuration(model, requested)`: duración de corte por modelo
  (Kling 5/10/15 · Seedance 5–12 · Luma 5s/9s), con segundos efectivos + etiqueta para UI/coste.
- `index.ts`: `listOptions(provider,kind)` despacha modelos/voces/avatares para el modal.
- `storage.ts`: assets bajo `data/media/<pieceId>/`, rutas **relativas** a `data/`, guard
  anti-traversal. `http.ts`: fetch con timeout.
- `ffmpeg.ts`: detección cacheada de `ffmpeg`/`ffprobe`, duración y ejecución con
  `execFileSync(args[])` sin shell (quoting seguro en Windows).
- `assemble.ts`: montaje determinista vertical 1080×1920, concat/recortes, audio, SRT,
  subtítulos quemados y frames QC. `assemblePresenterDemo()` conserva el audio continuo de
  HeyGen mientras muestra presentador al inicio/final y screencast en el centro. Degrada por
  combinaciones de assets y permite conservar el original si el render falla.

**Lógica IA** (`src/core/content/`): `extract.ts` reutiliza el `Viral` de REQ-004 (+ Gemini si
`usarGemini`) → `ViralExtract`; `guion.ts` genera un `PieceContent` **original** (system prompt:
reinterpreta el concepto, no copies; español; JSON) tirando del dossier (marca, público, CTAs).

**Nodos del pipeline** (`src/core/pipeline/req005.ts`):
`[Entrada] → [Extraer] → [Guion] → [Vídeo] → [Locución] → [Montaje]`
- **Entrada** (`input`): carga pieza/dossier/virales, casa el viral por URL normalizada, pone
  `status:generando` + `runId`.
- **Extraer**/**Guion**: guion se **persiste pronto** (revisable aunque el render falle luego).
- **Vídeo** (`media`): bifurca — `heygen` → `generateAvatarVideo` con avatar + voz elegida o
  audio subido (`presenterPath` conserva el original); `fal` → recorre la escaleta (máx.
  `MAX_CLIPS=6`) `generateClip` (duración por `config.falClipSeconds` 5/10/15, ajustada por modelo)
  → `clips[]`, `videoPath=clips[0]`. Reintento seguro a 5s si el modelo rechaza la duración (4xx).
- **Locución** (`voz`): `fal` → ElevenLabs TTS; `heygen` → se omite (ya lleva voz).
- **Montaje** (`montaje`): `assemble()` concatena clips, locución y subtítulos en `final.mp4`;
  `assets.videoPath` pasa a la salida final, genera frames QC cada 10s y pone `status:listo`,
  `version++`. Sin FFmpeg o ante fallo conserva el preview y deja aviso en `assets.logs`.

**Endpoints:** `POST /api/projects/:id/content/run` (valida sourceUrl + config, 409 sin
dossier/virales, crea pieza + run, fire-and-forget `executeRun` con reconciliación de estado),
`GET /api/content/:projectId` (piezas + runs), `PUT/DELETE /api/content/:projectId/:pieceId`,
`GET …/:pieceId/asset?path=` (sirve asset local, valida prefijo `media/<pieceId>/`),
`GET /api/providers/:provider/options?kind=` (modelos/voces/avatares; devuelve `error` si falta
key, sin romper el modal), `POST /api/providers/heygen/upload` (multipart seguro: foto → avatar,
audio → asset). **UI:** `ContentTray` (bandeja + SSE por pieza en generación) +
`GenerateContentModal` + `MediaProviderConfigurator` (selector de viral, vídeo generativo/avatar,
Photo Avatar, voz con preview o audio propio) en `/proyecto/[id]`, bajo virales.

> El punto de entrada de generación vive en `ContentTray` (selector de viral dentro del propio
> modal), no en un botón dentro de `ViralesEditor`.

---

## 8.4. Arquitectura concreta de REQ-006 (contenido propio / mostrar la app)

**Reutiliza REQ-005** — misma `ContentPiece` con `origin="own"`, misma bandeja `ContentTray`, mismos
endpoints de listado/asset/PUT/DELETE. Sin cambio de esquema Prisma: la config del demo viaja dentro
del blob `config` JSON.

**Tipos nuevos** (`src/core/content/types.ts`): `DemoConfig{funcion, funcionUrl, pasos[],
navSteps?:NavStep[], usarLogin, grabacionModo(auto|manual), videosPrevios?}` como campo opcional
`demo?` de `MediaConfig`; `NavStep` soporta `goto|tap|fill|wait|scroll`; `PieceAssets` gana
`recordingPath` (screencast real de la app) y `presenterPath` (HeyGen original).
`coerceDemo()` + `EMPTY_DEMO`.

**Credenciales (DA-05)** (`src/core/secrets/login.ts`): `setLogin/getLogin/hasLogin/deleteLogin` sobre
el Vault existente (AES-256-GCM) con clave `login:<projectId>`. La contraseña **nunca** sale de la API.

**Grabación** (`src/core/media/recorder.ts`): `recordDemo({projectId,pieceId,url,pasos,navSteps,
login,log,dryRun?})` con **import dinámico** de Playwright (chromium + iPhone 13 + vídeo 390×844).
Reutiliza `storageState` en `data/sessions/<projectId>.json`, ejecuta pasos tipados y escribe
`nav_log.json` con `t_inicio/t_fin`; captura `error.jpg` al fallar. Si hay FFmpeg normaliza WebM a
`screen.mp4` (30fps/yuv420p). Sin `navSteps` conserva el scroll guiado anterior. Los errores de
paquete/navegador siguen degradando a subida manual.

**Lógica IA** (`src/core/content/demo.ts`): `analyzeFunctions` propone 3-6 funciones y, para
`codeType=local`, construye un inventario acotado de rutas/selectores (`data-testid`, `href`, etc.)
del repo para devolver `navSteps` reales; sin evidencia omite los pasos tipados. El guion
**product-led** alterna grabación y B-roll y recibe el nº de vídeos previos de la función para evitar
repetir ángulo/hook.

**Nodos del pipeline** (`src/core/pipeline/req006.ts`):
`[Entrada] → [Grabar app] → [Guion] → [Generar vídeo] → [Locución] → [Montaje]`
- **Entrada** (`input`): carga pieza/dossier, exige `config.demo`, preserva `recordingPath` previo,
  pone `status:generando` + `runId`.
- **Grabar app** (`grabacion`): manual → usa el `recordingPath` subido; auto → `getLogin` si
  `usarLogin` y `recordDemo(...)`; si falla, **loguea y continúa** (no lanza) para permitir subida
  manual posterior.
- **Guion** (`guion`): `generateDemoGuion` (plataforma `youtube` fija en esta pasada), persiste pronto.
- **Generar vídeo** (`media`): `fal` filtra planos con prompt → `generateClip` (máx. 6);
  `heygen` crea `presenter.mp4` con voz elegida o audio propio.
- **Locución** (`voz`): `fal` usa ElevenLabs TTS; `heygen` la omite porque ya está embebida.
- **Montaje** (`montaje`): `fal` aplica hook → demo recortada por `nav_log` → cierre; `heygen`
  aplica presentador → demo → presentador preservando su pista de audio continua. Con voz de
  catálogo mantiene subtítulos; con audio propio los omite para no desincronizar. Produce
  `final.mp4`; sin grabación conserva el avatar completo y ante fallo conserva el original.

**Endpoints nuevos:** `POST /api/projects/:id/content/demo/run` (crea pieza `own` + run REQ-006,
acepta `rama=fal|heygen`, valida proveedor y devuelve 409 sin dossier),
`POST /api/projects/:id/functions` (analiza funciones con IA), `GET/PUT/DELETE
/api/projects/:id/login` (credenciales cifradas; GET solo informa `configured`),
`POST /api/projects/:id/demo/dryrun` (valida URL/selectores sin vídeo),
`POST /api/content/:projectId/:pieceId/upload` (multipart, sube screencast manual → `recordingPath`).
El endpoint `asset` amplía content-type a `.webm`/`.mov`.

**UI:** `DemoContentModal` (analizar funciones con IA + elegir/editar, modo grabación auto/manual,
login cifrado y configurador compartido fal/HeyGen con avatar/voz/audio) lanzado desde el botón
«+ Contenido propio» de `ContentTray`.
`PieceCard` distingue piezas propias (chip «Propio · app»), reproduce la grabación (`recordingPath`)
y ofrece subida/reemplazo manual de vídeo.

**Refinamientos UX (2026-07-18):** ambos modales usan `MediaProviderConfigurator` y `SelectorAuto`;
cargan opciones vía `GET /api/providers/:provider/options` y muestran previews de voz/avatar.
El modal explica los modos de grabación; en modo
manual la zona de subida de `PieceCard` se resalta (borde de acento) cuando la pieza propia aún no
tiene grabación. La **fuente de código** del proyecto es editable tras crearlo vía
`PUT /api/projects/:id` (valida `codeType`/`codePath`) + editor «Fuente de código» en `/proyecto/[id]`.

**D-12 resuelto (2026-07-18):** FFmpeg local es la implementación principal de montaje. Es una
dependencia opcional del sistema: su ausencia no impide generar/revisar una pieza, pero deja el
preview y un aviso instalable (`winget install ffmpeg`). Las rutas del filtro `subtitles` son
relativas con `cwd=pieceDir` para evitar escapes frágiles de `C:\...`.

**Contratos externos revisados el 2026-07-18:** HeyGen
[Photo Avatar](https://developers.heygen.com/photo-avatar.md),
[Create Video](https://developers.heygen.com/reference/create-video.md),
[List Voices](https://developers.heygen.com/reference/list-voices.md),
[List Avatar Looks](https://developers.heygen.com/reference/list-avatar-looks.md) y
[Upload Asset](https://developers.heygen.com/reference/upload-asset.md); fal.ai
[Queue](https://docs.fal.ai/model-endpoints/queue),
[Kling v3](https://fal.ai/models/fal-ai/kling-video/v3/standard/text-to-video/api),
[Seedance](https://fal.ai/models/fal-ai/bytedance/seedance/v1/pro/fast/text-to-video/api) y
[Luma Ray 2](https://fal.ai/models/fal-ai/luma-dream-machine/ray-2/api).

> Playwright con navegador real y las llamadas a proveedores solo se validan en la máquina del
> usuario (la shell del agente no tiene red; requiere `npx playwright install chromium` + keys).

---

## 8.5. Arquitectura concreta de REQ-009 (experiencia visual)

**Enfoque:** pase transversal de pulido, **sin dependencias nuevas** (solo Tailwind v4 + CSS en
`globals.css`), respetando `prefers-reduced-motion` (regla global que anula animaciones) y RNF-08.

**Primitivas CSS reutilizables** (`src/app/globals.css`):
- `.hero` + `@keyframes aurora-drift`: dos capas de gradientes radiales desenfocados en movimiento
  lento (aurora) tras el contenido (`z-index` gestionado).
- `.animate-in` + `@keyframes fade-in-up`: entrada escalonada (el retardo se pasa por
  `style={{ animationDelay }}` en cada tarjeta).
- `.card-lift`: elevación 3D ligera + glow al hover (transform + box-shadow).
- `.skeleton` + `@keyframes shimmer`: placeholders de carga.
- `.coverflow` (perspectiva) + `.coverflow-item` (transición de transform/opacidad) para el carrusel.

**Componentes:**
- `app/page.tsx`: dashboard con **hero** (aurora + CTAs), `Stat`/`Card` con `card-lift` + `animate-in`
  escalonado; `RecentProjects` idem.
- `components/PieceCarousel.tsx` (**nuevo**, cliente): carrusel **360° cover-flow** de `ContentPiece`.
  Estado `active`; cada ítem se posiciona con `translateX`/`rotateY`/`scale` según su offset al centro
  (ventana de ±2, `z-index`/opacidad decrecientes); el centro renderiza un `<video>` con el
  `recordingPath`/`videoPath`; indicadores de puntos + navegación ‹/›. `onSelect` eleva el id enfocado.
- `components/ContentTray.tsx`: toggle **Lista / Carrusel** (visible con ≥2 piezas); en carrusel, la
  pieza central abre su `PieceCard` completo debajo. `PieceCard` gana `card-lift`; **skeletons** de
  carga mientras resuelve `GET /api/content/:projectId` (`loading`).
- `components/PipelineGraph.tsx`: transición suave de borde/sombra al cambiar de estado un nodo.

> Sin cambios de datos ni de API; es capa de presentación. Verificado con `tsc` + `next build`.

---

## 8.7. Rediseño visual + carruseles con expandir + «buscar más» (2026-07-18)

**Enfoque:** sin paquetes ni keys. Componentes de presentación reutilizables + cambio incremental en
los pipelines de descubrimiento.

**Componentes** (`src/components/`): `Carousel3D` (cover-flow genérico; `PieceCarousel` lo reutiliza),
`ExpandableCarousel` (carrusel + detalle desplegable del ítem activo), `ScoreBar`, `EntityLogo`
(Clearbit → Google favicon → iniciales), `MiniMap` (iframe `maps.google.com/…&output=embed`, sin key),
`CardArt` (imagen de `public/img/` con fallback CSS), `ProjectsCarousel`. CSS nuevo en `globals.css`
(`.score-bar`, `.glow-hover`, `.float`, `.card-art`). Los `*Editor` (competencia/leads/virales) montan
el `ExpandableCarousel` arriba y dejan el formulario completo tras un toggle.

**«Buscar más» (incremental):** `buildReq00{2,3,4}Pipeline({ modo, cantidad })`. En `modo:"ampliar"`
el nodo `input` conserva TODOS los ítems, `discover*(…, excluir[])` inyecta en el prompt la lista a no
repetir, y el nodo final genera/analiza sólo los nuevos y los **añade** (dedupe por url/nombre/dominio),
conservando los agregados previos (resumen, patrones…). En `reemplazar` se mantiene el comportamiento
anterior. Endpoints `.../run` leen `{ modo, cantidad }`; virales expone `cantidad` (10/20/30/50).

> Capa de presentación + descubrimiento incremental; sin cambios de esquema Prisma. Verificado con
> `tsc` + `next build`. Logos/mapas/miniaturas YT dependen de la red del navegador del usuario.

---

## 8.8. Refinamientos de identidad, dossier y scoring (2026-07-18)

- `Project.logoPath` permite un logo manual en `data/media/project-<id>/`; el endpoint
  `GET/POST/DELETE /api/projects/:id/logo` valida PNG/JPG/WebP (máx. 2 MB). `EntityLogo` aplica
  cascada: logo manual → Clearbit → Google favicon → iniciales.
- `DossierEditor` separa vista de lectura y edición, se pliega (aprobado cerrado por defecto) y
  agrupa la información en cuatro áreas. `CardArt` usa `bg-dossier.webp` generado para la cabecera.
- Competencia guarda `scores? {producto,presenciaRRSS,amenaza,justificacion}` dentro del JSON.
  Datos antiguos sin scores conservan el cálculo legacy. Leads añade `scoreRazon`; ambos prompts
  usan rúbricas comparativas para evitar notas uniformes/infladas.
- `PipelineGraph` asocia los 16 ids de nodo a iconos IA en `public/img/nodes/`; el estado running
  dibuja un anillo CSS animado y ok/error un badge. Si falla un asset vuelve al punto anterior.

---

## 8.6. Arquitectura concreta de REQ-010 (publicación asistida)

**Enfoque:** materializa **D-06** sin APIs oficiales ni OAuth. Todo cliente + una mejora
mínima en la ruta de assets; ningún proveedor externo, ningún token.

**Módulo de dominio** (`src/core/content/publish.ts`):
- `PUBLISH_TARGETS` / `PUBLISH_TARGET_LIST`: por `Plataforma`, la URL web de subida
  (`youtube.com/upload`, `tiktok.com/upload`, `instagram.com`) + `hint`.
- `composeCaption(piece)`: copy sugerido = título/gancho + CTA + hashtags.
- `finalVideoPath(piece)`: `assets.videoPath || assets.recordingPath` (montaje > grabación).

**UI** (`components/PublishModal.tsx`, cliente): modal de 4 pasos por pieza —
(1) descargar vídeo, (2) copiar copy (`navigator.clipboard`, editable), (3) abrir la red
(`window.open(uploadUrl, "_blank", "noopener,noreferrer")`), (4) marcar publicado. Selector de
red. Se abre desde el botón **«Publicar ↗»** del `PieceCard` (`ContentTray`) en piezas
`listo`/`publicado`.

**API (sin endpoints nuevos):**
- `GET …/:pieceId/asset?path=…&download=1` → añade `Content-Disposition: attachment` para forzar
  descarga (mismo guardado de prefijo `media/<pieceId>/`).
- `PUT …/:pieceId` con `{ status:"publicado", publishedTo }` → persiste `publishedTo` +
  `publishedAt` (ISO) dentro del blob `assets` (sin cambio de esquema Prisma).

**Datos:** `PieceAssets` gana `publishedTo` y `publishedAt` (string, "" por defecto), normalizados
en `coerceAssets`. La subida 100% automática por API oficial queda fuera de alcance (§6 requisitos).

> Verificado con `tsc --noEmit` + `next build` (EXIT=0). Sin dependencias nuevas.

---

## 8.9. Arquitectura concreta de REQ-011 (mediateca, REC y MIX)

**Compatibilidad:** implementación aditiva. `ContentPiece.assets`, `assemble()` y
`assemblePresenterDemo()` permanecen. La mediateca indexa recursos existentes idempotentemente y
los nuevos pipelines registran el mismo fichero sin duplicar bytes.

**Datos Prisma:**
- `MediaAsset`: proyecto, pieza opcional, tipo, origen, nombre, ruta, MIME, tamaño, duración,
  dimensiones, metadata JSON y fechas; ruta única por proyecto.
- `MixComposition`: proyecto, pieza opcional, nombre, estado, receta JSON, salida/error y fechas.

**Módulos:** `bintools.ts` resuelve yt-dlp/FFmpeg/ffprobe sin importar ni modificar
`claude-cli.ts`; `library.ts` registra e indexa assets; `subtitles.ts` genera ASS 1080×1920;
`mix.ts` valida la receta y ejecuta `assembleMix()`.

**API:** `GET /api/system/tools`; CRUD bajo `/api/projects/:id/media`; servicio protegido de
ficheros; y CRUD/render/usar-final bajo `/api/projects/:id/mixes`.

**Grabador:** `SelfRecordModal` usa `getDisplayMedia` + `MediaRecorder`. La captura permanece local
hasta Guardar; se sube como WebM y se normaliza de forma best-effort sin perder el original.

**Subtítulos:** ASS con `PlayResX=1080`, `PlayResY=1920`, alineación inferior, margen de zona segura,
máximo dos líneas y alto contraste. El audio propio exige texto. El final falla cerrado si no puede
quemar subtítulos.

**MIX:** receta determinista por bloques. `assembleMix()` concatena vídeo normalizado, usa la
locución como pista maestra, mezcla música opcional, quema ASS y crea `mix-<id>.mp4`. No cambia
`PieceAssets.videoPath` hasta la acción explícita `useAsFinal`.

---

## 9. Arquitectura concreta de REQ-001 (primer requisito)

**Nodos del pipeline** (Diseño §5):
`[Entrada] → [Crawl web] → [Análisis código] → [Fusión IA] → [Dossier listo]`

- **Entrada**: valida URL y fuente de código; si es GitHub privado, usa el token del vault.
- **Crawl web** (`core/crawler`): Playwright renderiza landing + páginas clave (pricing, features, about); extrae textos, CTAs, capturas → artefacto JSON + imágenes en `/data`.
- **Análisis código** (`core/repo`):
  - `local` → lee la ruta directamente.
  - `github_public/private` → `git clone` superficial a carpeta temporal (token si privado).
  - `none` → se omite.
  - Pasa el repo al `AiEngine` para extraer stack, funcionalidades y features.
- **Fusión IA**: `AiEngine` combina web + código → **Dossier** con las 8 secciones (Diseño §7.3).
- **Dossier listo**: se persiste (`Dossier.status = draft`), se muestra editable; al aprobar → `approved`.

**Endpoints:** `POST /api/projects` (crea + lanza run), `GET /api/runs/:id/stream` (SSE), `GET/PUT /api/dossier/:projectId`.

---

## 10. Mapeo requisitos → módulos

| Requisito | Módulos principales |
|-----------|--------------------|
| REQ-001 | crawler, repo, ai, pipeline, dossier |
| REQ-002 | ai, connectors(web/search), pipeline |
| REQ-003 | ai, connectors, pipeline |
| REQ-004 | ai(WebSearch/WebFetch), virales, pipeline |
| REQ-005 | ai, connectors(fal/heygen/elevenlabs), montage, pipeline |
| REQ-006 | crawler(Playwright móvil), ai, fal, elevenlabs, montage |
| REQ-007 | skills (catálogo/instalación) |
| REQ-008 | secrets, connectors (test), Ajustes UI |
| REQ-009 | UI (React Flow, carrusel 360, tema) |
| REQ-010 | content/publish, PublishModal, asset route (download) |

---

## 11. No funcionales (cómo se cumplen)

- **RNF-01 Local-first**: todo en `localhost`; datos en SQLite/`/data`.
- **RNF-02 Sin coste IA base**: `AiEngine` sobre CLI/SDK con sesión Pro.
- **RNF-03 Secretos**: Secret Vault AES.
- **RNF-04 Pluggable**: interfaces `AiEngine`, `Connector`, `MontageProvider`.
- **RNF-05 Trazabilidad**: modelo `Run` + logs + artefactos.
- **RNF-07 Resiliencia**: reintento/regeneración por nodo.
- **RNF-08 Windows**: rutas, Playwright y FFmpeg validados en Windows 11.

---

## 12. Dudas de arquitectura (resueltas)

- **DA-A1:** ✅ Gestor de paquetes: **pnpm**.
- **DA-A2:** ✅ Desbloqueo del vault: **Windows DPAPI por defecto** (transparente); passphrase como refuerzo opcional futuro.
- **DA-A3:** ⏳ Localización del binario `claude` en el PATH: se verifica al implementar el test del motor de IA.

---

## 13. Próximos pasos

1. **OK del usuario** a este documento de Arquitectura.
2. **Scaffolding** del proyecto (Next.js + TS + Tailwind + Prisma + React Flow) y estructura de carpetas.
3. Implementar **REQ-001** de punta a punta (crawler + repo + AiEngine + Dossier + UI de nodos).
