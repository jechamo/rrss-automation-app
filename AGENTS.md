# AGENTS.md — Contexto operativo para el agente

> Lee este fichero al empezar cada sesión. Resume **cómo trabajar en este repo** sin
> tener que redescubrirlo. El *qué* y el *porqué* del producto están en `docs/`.

---

## 1. Qué es este proyecto

App **web local** (corre en `localhost`) = cadena de automatización para crear
contenido de redes sociales (RRSS) a partir de una appweb. Se construye por
requisitos **REQ-001 … REQ-011**, uno a uno, con validación del usuario entre cada uno.

- **Metodología:** SDD (Spec-Driven Development). Orden: Requisitos → Diseño → Arquitectura → Código.

**Documentos del repo (léelos según necesites):**

| Doc | Contenido | Cuándo leerlo |
|-----|-----------|---------------|
| `docs/01-requisitos.md` | Qué se construye (REQ-001…009) + dudas abiertas (DA-xx) | Antes de empezar/planear un REQ |
| `docs/02-diseno.md` | Diseño de UI/UX y pantallas | Al tocar interfaz |
| `docs/03-arquitectura.md` | Stack, módulos, pipeline, datos, seguridad | Al tocar arquitectura/módulos |
| `docs/04-bitacora.md` | Estado y progreso vivo (actualízala al cerrar cada tarea) | Al empezar y al cerrar tarea |
| `docs/05-skills.md` | Catálogo de skills (REQ-007): skill→REQ, plugins a instalar | Al empezar un REQ que use skills |

- **Skills de proyecto:** en `.claude/skills/` (los carga tu sesión y el motor headless de la
  app). Detalle y política en `docs/05-skills.md`. Ver §5 (mapa) y §7 (estado).

---

## 2. Restricciones de entorno (CRÍTICO — respetar siempre)

- **SO:** Windows 11. Rutas con `\`.
- **Shell:** usar la tool **Bash**, **NO** PowerShell. Norton (IDP.HELU.PSE80) bloquea `powershell.exe`.
- **Paquetes:** usar **npm**, **NO** pnpm (hay guard en build-script).
- **Red en el sandbox del shell:** el DNS externo NO resuelve desde la shell del agente
  (`curl` → 000, `node` → ENOTFOUND). La máquina del usuario SÍ tiene red: los crawls y
  llamadas a Claude CLI funcionan cuando corren dentro del server Next, no en la shell del agente.
- **Arranque limpio:** siempre por `iniciar.bat` (ver §4). Un `.next` viejo o un `node.exe`
  colgado sirve código antiguo → causa de errores fantasma ("claude no reconocido", "no va al flujo").

---

## 3. Stack

- **Next.js 15.5.x** App Router + TypeScript, en `localhost:3000`.
- **Tailwind CSS v4** (tokens `@theme` en `src/app/globals.css`).
- **Prisma 6.x + SQLite** (`DATABASE_URL="file:./dev.db"`). JSON se guarda como `String`.
- **React Flow (@xyflow/react)** para el grafo de nodos del pipeline.
- **SSE** (ReadableStream) para progreso en vivo; bus EventEmitter en memoria (`src/core/pipeline/bus.ts`).
- **FFmpeg/ffprobe del sistema** para montaje final (opcional: si falta, la pieza conserva el preview
  y muestra el comando `winget install ffmpeg`; no debe romper el run).
  Resolución por PATH/override/WinGet en `src/core/media/bintools.ts`.
- **yt-dlp del sistema** (opcional, como FFmpeg): para el análisis multimodal de Gemini de
  TikTok/Instagram (`ytdlp.ts` → `hasYtDlp()`). YouTube no lo necesita (URL nativa). Si falta,
  el análisis degrada a los datos de REQ-004 sin romper el run.
  También se detecta dentro de WinGet aunque no esté en PATH.
- **Motor IA:** Claude Code CLI en modo headless (`-p --output-format json`), plan Pro = sin coste de API.
  Resolución del binario en `src/core/ai/claude-cli.ts` (`resolveBinary`), en este orden:
  1. `CLAUDE_CLI_PATH` (env, override manual).
  2. **Binario gestionado de la app de escritorio** `AppData/Roaming/Claude/claude-code/<ver>/claude.exe`
     → **es el que tiene la sesión Pro iniciada**, por eso es el preferido.
  3. Candidatos en `.local/bin`, `npm`, etc.
  4. Copia local del proyecto `node_modules/@anthropic-ai/claude-code/bin/claude.exe` (respaldo).
  5. `claude` del PATH.
  - **Autenticación:** una copia recién instalada por npm NO está logueada (`Not logged in · run /login`).
    El binario gestionado sí lo está (login de la app de escritorio). Por eso se prioriza el gestionado.
  - **Spawn:** para un `.exe` real se usa `shell:false` (cada argumento intacto). Con `shell:true` en
    Windows los args multilínea (p.ej. `--append-system-prompt`) se rompen vía `cmd.exe`.
- **Secret Vault** AES-256-GCM para API keys (Ajustes).

---

## 4. Cómo arrancar / parar

- **Arrancar (recomendado):** doble clic en `iniciar.bat`. Hace: mata `node.exe`, libera puerto 3000,
  borra `.next`, arranca `npm run dev` en ventana nueva, espera al puerto, abre el navegador.
- **Parar:** cerrar la ventana "RRSS Studio Server" (o Ctrl+C en ella).
- **Manual (agente):** `npm run dev` desde la raíz. Si algo va raro: `taskkill //F //IM node.exe`,
  `rm -rf .next`, y reiniciar.

---

## 5. Mapa del código

```
src/app/                      Rutas (App Router)
  page.tsx                    Dashboard (server) + <RecentProjects/>
  proyecto/nuevo/page.tsx     Formulario de nuevo análisis
  proyecto/[id]/page.tsx      Vista de proyecto: pipeline + logs + dossier + competencia + leads + virales + contenido (client, SSE)
  ajustes/                    Pantalla de conectores/API keys (REQ-008)
  api/
    projects/                 CRUD proyectos (POST crea+lanza run, DELETE, [id] GET/rerun)
                              [id]/competencia/run  POST lanza run REQ-002
                              [id]/content/run      POST crea pieza + lanza run REQ-005
                              [id]/content/demo/run POST crea pieza own + lanza run REQ-006
                              [id]/functions        POST analiza funciones de la app con IA (REQ-006)
                              [id]/demo/dryrun       POST valida pasos Playwright sin grabar
                              [id]/login            GET/PUT/DELETE credenciales cifradas (REQ-006/DA-05)
                              [id]/logo             GET/POST/DELETE logo manual del proyecto
    runs/[id]/stream/         Endpoint SSE del run
    dossier/[projectId]/      GET/PUT del dossier
    competencia/[projectId]/  GET/PUT de la competencia (REQ-002); GET incluye su lastRun
    content/[projectId]/      GET piezas+runs; [pieceId] PUT/DELETE; [pieceId]/asset sirve asset local (REQ-005)
                              [pieceId]/upload      POST sube screencast manual → recordingPath (REQ-006)
    providers/[provider]/options  GET modelos/voces/avatares para el modal (REQ-005)
    providers/heygen/upload       POST foto/audio seguro → asset/avatar HeyGen v3
    system/tools                  GET estado/ruta/versión yt-dlp/FFmpeg/ffprobe (REQ-011)
    projects/[id]/media           Mediateca: listar/subir/renombrar/eliminar/servir
    projects/[id]/mixes           MIX: renderizar, usar como final y eliminar
src/components/               PipelineGraph, DossierEditor, RecentProjects, CompetenciaPanel,
                              CompetenciaEditor, ContentTray, GenerateContentModal, DemoContentModal,
                              MediaProviderConfigurator, PieceCarousel (carrusel 360, REQ-009)
                              MediaStudio, SelfRecordModal, MixStudioPanel (REQ-011)
src/core/
  pipeline/                   req001..req006.ts (definen nodos), bus.ts (eventos), engine
  ai/claude-cli.ts            Motor Claude CLI (resolución de binario, exec con timeout)
  dossier/                    Tipos + generación del dossier (REQ-001)
  competencia/                Tipos + discover.ts (propone competidores) + generate.ts (REQ-002)
  leads/                      Tipos + research.ts (perfil) + discover.ts (IA+WebSearch) + strategy.ts (REQ-003)
  virales/                    Tipos + discover.ts (IA+WebSearch) + analyze.ts (patrones) (REQ-004)
  content/                    Tipos + extract.ts + guion.ts (REQ-005) + demo.ts (analyze/guion demo, REQ-006)
  media/                      Conectores fal/heygen/elevenlabs/gemini + storage/http/listOptions (REQ-005)
                              + recorder.ts (Playwright móvil, nav_log, storageState, dry-run)
                              + ffmpeg.ts/assemble.ts (montaje vertical, presentador+demo, SRT+QC)
                              + contracts.ts (bodies/errores/polling puros y testeables)
                              + bintools/library/subtitles/mix (REQ-011)
  secrets/login.ts            Credenciales de login cifradas por proyecto sobre el vault (REQ-006/DA-05)
  crawler/                    Crawl de la web (reutilizado por REQ-001 y REQ-002)
src/lib/                      prisma, vault (cifrado)
prisma/schema.prisma          Modelo de datos multiproyecto
.claude/skills/               Skills de PROYECTO (REQ-007): rrss-lead-research (REQ-003),
                              rrss-viral-analysis (REQ-004), rrss-content-generation (REQ-005/006).
                              Los carga tu sesión Y el motor headless de la app (claude -p corre
                              con cwd = raíz del proyecto). Catálogo: docs/05-skills.md.
```

> **Skills (REQ-007):** ver `docs/05-skills.md` (catálogo skill→REQ + plugins que instala el
> usuario, que requieren red). Para que el MOTOR auto-invoque un skill en `-p` haría falta
> `--allowedTools "Skill"` en `src/core/ai/claude-cli.ts` (aún no puesto); si no, referencia el
> conocimiento del skill en el prompt del pipeline de cada REQ.

---

## 6. Convenciones

- **Idioma:** español en UI, contenido y docs. Sin tildes en identificadores de código si complican.
- **Commits:** `tipo(REQ-00X): descripción` (feat/fix/docs). Co-autoría de Claude. Git + GitHub (cuenta `jechamo`).
- **SDD:** no escribir código de un REQ hasta que sus docs estén aprobados por el usuario.
- **Validación entre REQs:** el usuario prueba y aprueba cada requisito antes de pasar al siguiente.
- **Al terminar una tarea relevante:** anota en `docs/04-bitacora.md` (qué, estado, commit).

---

## 7. Estado actual (resumen — detalle en bitácora)

- **REQ-001** (análisis appweb → dossier): **implementado** y verificado.
- **REQ-002** (análisis de competencia): **implementado** (DA-01 resuelta: descubrimiento híbrido IA+manual),
  en fase de pruebas del usuario.
- **REQ-003** (clientes potenciales + estrategia): **implementado** (DA-02 resuelta: negocios locales
  reales vía **IA+WebSearch**, solo datos públicos; estrategia IA editable). Pipeline `req003.ts`
  (`input → research → discover(web) → strategy`), motor con `--allowedTools WebSearch`. En pruebas del usuario.
- **REQ-004** (virales del nicho YT/TikTok/IG): **implementado** (DA-03 resuelta: fuente seleccionable
  **IA+WebSearch / Scrape Creators / híbrida**, ventana configurable y **Top 20**). Pipeline
  `req004.ts` (`input → discover → rank → enrich → analyze`). Scrape Creators ofrece modo rápido
  (3 búsquedas base) o preciso: histórico por autor con caché de 7 días, tope de créditos y ratio
  contra la mediana (`verified` ≥10 piezas, `estimated` 5–9, nunca inventado con <5). Cada viral se
  descompone (hook/estructura/share-trigger/patrón transferible) para alimentar REQ-005. Apoyo:
  skill `rrss-viral-analysis`. En pruebas.
  **Refinamiento (2026-07-18):** el análisis de patrones usa `timeoutMs=600_000` (no cortar por tiempo;
  el default del motor era 180s).
- **REQ-005** (generación de contenido — clonado de viral): **implementado** (DA-04 resuelta:
  **reinterpretación conceptual**, no copia). Cableado a **proveedores reales** (fal.ai/HeyGen/
  ElevenLabs/Gemini) con keys de Ajustes, **atributos auto/manual por pieza**, **rama fal|heygen
  elegible**. `ContentPiece` **muchos por proyecto** (bandeja de estados). Pipeline `req005.ts`
  (`input → extract → guion → media → voz → montaje`; montaje FFmpeg real a `final.mp4`, con
  degradación a preview si falta el binario). UI `ContentTray` +
  `GenerateContentModal`. **Proveedores revisados (2026-07-18):** HeyGen API v3 (Photo Avatar,
  voz con preview o audio propio, 9:16/1080p, idempotencia/polling) y fal.ai por contrato
  (Seedance Pro Fast predeterminado, Kling v3, Luma Ray 2; sin fallback horizontal).
  Apoyo: skill `rrss-content-generation`. **Solo verificable con red+keys en
  la máquina del usuario** (la shell del agente no tiene red).
- **REQ-006** (contenido propio — mostrar la app): **implementado** (DA-05 resuelta:
  **credenciales cifradas en el vault por proyecto**, `login:<projectId>`; la contraseña nunca la
  devuelve la API). **Grabación** = **Playwright** móvil (import dinámico, iPhone 13 + `recordVideo`
  + login scriptado) con **fallback a subida manual**. IA propone funciones del dossier; guion
  **product-led** con **vídeo generativo o presentador HeyGen** intercalado con el screencast.
  Con HeyGen conserva el audio continuo, guarda `presenterPath` y degrada al avatar completo.
  Reutiliza
  `ContentPiece` (`origin="own"`) y `ContentTray`. Pipeline `req006.ts` (`input → grabacion → guion →
  media → voz → montaje`; montaje FFmpeg real). Recorder v2: pasos `goto|tap|fill|wait|scroll`,
  `nav_log` temporal, sesión persistente, captura de error, normalización MP4 y dry-run; análisis
  de funciones usa selectores del repo local y evita repetir ángulos. UI `DemoContentModal` +
  `PieceCard`. **Solo verificable con red+keys+`npx playwright install chromium` en la máquina del
  usuario.** **Refinamiento UX (2026-07-18):** vídeo/voz del modal por **desplegable** (`SelectorAuto`
  compartido); ayuda de modos de grabación + realce de la subida manual en `PieceCard`; **fuente de
  código editable** tras crear el proyecto (`PUT /api/projects/:id` + editor en `/proyecto/[id]`).
- **REQ-007** (skills): **pase de curación hecho** (DA-06 resuelta). 3 skills de proyecto en
  `.claude/skills/` + catálogo en `docs/05-skills.md`. Feature de UI aplazada.
- **REQ-008** (Ajustes/APIs): **implementado**. Selector de motor + modelo, tarjeta por proveedor con
  guardar/probar, keys cifradas, **test de conexión real** (Gemini/ElevenLabs/HeyGen/GitHub; fal.ai
  valida formato). `src/core/connectors/` + `app/ajustes/` + `api/connectors/`.
- **REQ-009** (experiencia visual): **implementado** (pase transversal, solo Tailwind+CSS). Dashboard
  con **hero de aurora**, tarjetas con **elevación 3D** + entrada escalonada, **carrusel 360°
  cover-flow** de piezas (`PieceCarousel`, toggle Lista/Carrusel en `ContentTray`), **skeletons** y
  transiciones de estado. Respeta `prefers-reduced-motion`. Primitivas en `globals.css`.
- **REQ-010** (publicación asistida): **implementado** (materializa **D-06**, sin APIs/tokens).
  Modal `PublishModal` de 4 pasos (descargar vídeo · copiar copy · abrir red · marcar publicado),
  `core/content/publish.ts` (targets + `composeCaption`), descarga por `?download=1`, y persistencia
  de `publishedTo`/`publishedAt` en `assets`. Botón **«Publicar ↗»** en `PieceCard`. Subida automática
  por API oficial (OAuth por plataforma) queda **fuera de alcance**.
- **REQ-011** (estudio audiovisual): **implementado**. Detección WinGet de herramientas, subtítulos
  ASS obligatorios abajo, mediateca, grabador REC/STOP, `assembleMix()` aditivo y Guía detallada.
  Pendiente validación manual del selector de pantalla en el navegador del usuario.
- **REQ-015** (mapa funcional): **implementado**. Nodo REQ-001 que extrae un árbol de hasta tres
  niveles sin asumir un menú concreto (navbar, barra inferior, sidebar, drawer, tabs, tarjetas),
  persiste evidencias y permite verificación segura de rutas con Playwright + login cifrado. Alimenta
  dossier y análisis de funciones de contenido propio. Pendiente regeneración y validación privada real.
- **REQ-016** (pulido UX/ejecución): **implementado**. Pipelines con mayor separación y SSE reconectable,
  cursor/scrollbars/sidebar compacta, y preflight de login compartido que reconoce `identifier`, valida
  sesiones y autentica fuera del vídeo. Dry-run real de ICG Vault `/my-list` verificado; falta grabación real.
- **Rediseño visual (2026-07-18):** componentes reutilizables `Carousel3D`/`ExpandableCarousel`/
  `ScoreBar`/`EntityLogo`/`MiniMap`/`CardArt`/`ProjectsCarousel` (sin paquetes ni keys). Dashboard y
  secciones competencia/leads/virales con **carrusel 360 + detalle desplegable**, scoring, logos por
  dominio y mapa embebido en leads. **«Buscar más»** incremental en REQ-002/003/004 (`modo:"ampliar"`
  + `discover(excluir[])` + merge sin duplicar) y **nº de virales** configurable. Arte opcional en
  `public/img/` con fallback CSS.
- **Refinamientos transversales (2026-07-18):** logo manual por proyecto (`Project.logoPath`),
  dossier plegable y reorganizado con arte, scoring calibrado/justificado para competencia y leads,
  e iconos IA por nodo con spinner CSS y badges de estado.
- **Siguiente:** roadmap **REQ-001→010 implementado** + pase visual. Queda el **visto bueno end-to-end
  del usuario** (pruebas reales con red+keys+`npx playwright install chromium` en su máquina) para cerrar v1.
