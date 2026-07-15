# Bitácora de trabajo — RRSS Studio

> Registro vivo del progreso. Se actualiza al cerrar cada tarea relevante.
> Contexto operativo: `AGENTS.md`. Especificaciones: `docs/01..03`.

---

## Estado de los requisitos

| REQ | Nombre | Estado |
|-----|--------|--------|
| REQ-001 | Análisis de la appweb → dossier de negocio | 🟢 Verificado end-to-end (run status "ok") — pendiente visto bueno final del usuario |
| REQ-002 | Análisis de competencia | 🟡 Implementado — pendiente pruebas del usuario |
| REQ-003 | Scraping de clientes potenciales + estrategia | 🟡 Implementado (DA-02 resuelta: negocios locales reales vía IA+WebSearch) — pendiente pruebas del usuario |
| REQ-004 | Scraping de virales del nicho (YT/TikTok/IG) | 🟡 Implementado (DA-03 resuelta: IA+WebSearch, viral relativo al autor, ventana 30d, Top 20) — pendiente pruebas del usuario |
| REQ-005 | Generación de vídeo (clonado de viral) | 🟡 Implementado (DA-04 resuelta: reinterpretación conceptual + cableado real fal/HeyGen/ElevenLabs/Gemini, atributos auto/manual, montaje stub) — pendiente pruebas del usuario (red+keys) |
| REQ-006 | Generación de contenido propio de la app | 🟡 Implementado (DA-05 resuelta: login cifrado en vault por proyecto, grabación Playwright móvil + fallback manual, cortes B-roll + locución, montaje stub) — pendiente pruebas del usuario (red+keys+navegador Playwright) |
| REQ-007 | Skills | 🟡 Pase de curación hecho (skills de proyecto + catálogo, DA-06 resuelta); feature UI aplazada |
| REQ-008 | Configuración de herramientas/APIs (Ajustes) | 🟡 Base construida (shell de Ajustes) |
| REQ-009 | Experiencia visual | 🟡 Implementado (hero con aurora, tarjetas con elevación 3D + entrada escalonada, carrusel 360 cover-flow de piezas, skeletons, transiciones de estado) — pendiente visto bueno del usuario |

Leyenda: ⚪ pendiente · 🟡 en curso/parcial · 🟢 aprobado por el usuario

---

## Historial

### 2026-07-15 — REQ-009: Experiencia visual (hero, carrusel 360, animaciones)

**Decisión (con el usuario):** pase transversal de pulido visual sobre lo existente, **sin
dependencias nuevas** (solo Tailwind + CSS), respetando `prefers-reduced-motion` y RNF-08 (Windows).

**Hecho:**
- `globals.css`: utilidades reutilizables — `.hero` (aurora en movimiento con `aurora-drift`),
  `.animate-in` (entrada escalonada `fade-in-up`), `.card-lift` (elevación 3D + glow al hover),
  `.skeleton` (shimmer de carga), `.coverflow`/`.coverflow-item` (carrusel 360 en perspectiva).
- Dashboard (`app/page.tsx`): cabecera **hero** con aurora + CTAs, `Stat`/`Card` con entrada
  escalonada y elevación; `RecentProjects` con las mismas micro-animaciones.
- **Carrusel 360** (`components/PieceCarousel.tsx`): cover-flow de piezas (rotación `rotateY` en 3D,
  centro con preview de vídeo/grabación, indicadores + navegación ‹/›). Integrado en `ContentTray`
  con toggle **Lista / Carrusel** (aparece con ≥2 piezas); la pieza central abre su `PieceCard`.
- Pulido de estados: transición suave del borde/sombra en los nodos del `PipelineGraph`, transición
  de color en los chips de estado y **skeletons** de carga en `ContentTray`.
- Verificado: `tsc --noEmit` EXIT=0; `next build` EXIT=0.

**Siguiente:** roadmap REQ-001→009 implementado; queda el **visto bueno end-to-end del usuario**
(pruebas con red+keys+Playwright en su máquina) antes de cerrar v1.

### 2026-07-15 — REQ-005: Generación de contenido (clonado de viral) + cableado real

**Decisión DA-04 (con el usuario):** **anti-copyright = reinterpretación conceptual** (usar el
`patronTransferible` del viral para un guion **original** de la marca, no copia literal). **Alcance
ampliado por el usuario:** cableado a **proveedores reales** (fal.ai/HeyGen/ElevenLabs/Gemini) con
keys en Ajustes + test de conexión, y **selección de atributos por pieza** (modelo/voz/avatar en
**auto** = decide la IA, o **manual**). **Comprensión del viral:** reutiliza datos de REQ-004 +
Gemini opcional. **Rama de vídeo:** ambas elegibles por pieza (fal.ai cortes | HeyGen avatar).
**Montaje** (FFmpeg) = stub en esta pasada.

**Hecho (primer modelo *muchos por proyecto* → bandeja de estados):**
- Modelo `ContentPiece` en Prisma (muchos por `Project`): `origin/sourceUrl/titulo/plataforma/
  content/config/assets` (JSON) + `runId/status/version`. `rowToPiece()` parsea a tipos.
- Tipos en `src/core/content/types.ts` (`Rama`, `Guion`, `Shot`, `PieceContent`, `MediaConfig`,
  `PieceAssets`, `PieceStatus`) con `coerce*` defensivo.
- Módulos de media `src/core/media/` (cada uno tira su key del vault): `fal.ts` (modelos curados +
  `generateClip` por cola/polling), `heygen.ts` (avatares/voces + `generateAvatarVideo` vertical),
  `elevenlabs.ts` (voces + `tts`), `gemini.ts` (`describeViral` opcional), `index.ts`
  (`listOptions`), `storage.ts` (assets en `data/media/<pieceId>/`, guard anti-traversal), `http.ts`.
- Lógica IA: `extract.ts` (reutiliza el `Viral` de REQ-004 + Gemini si `usarGemini`) y `guion.ts`
  (guion **original**: reinterpreta el concepto, no copia; español; tira del dossier).
- Pipeline `req005.ts`: `input → extract → guion → media → voz → montaje`. Guion se persiste pronto
  (revisable aunque el render falle); `media` bifurca fal (cortes, máx. 6)/heygen (avatar); `voz`
  ElevenLabs solo en fal; `montaje` stub → `status:listo`, `version++`.
- API: `POST /api/projects/[id]/content/run` (409 sin dossier/virales, fire-and-forget con
  reconciliación de estado), `GET /api/content/[projectId]`, `PUT/DELETE …/[pieceId]`,
  `GET …/[pieceId]/asset?path=` (sirve asset local validado), `GET /api/providers/[provider]/
  options?kind=` (modelos/voces/avatares; `error` si falta key sin romper el modal).
- UI: `ContentTray` (bandeja, SSE por pieza en generación, reproductores vídeo/audio, guion+escaleta,
  acciones publicar/regenerar/eliminar) + `GenerateContentModal` (selector de viral + rama +
  auto/manual de modelo/voz/avatar). Montado en `/proyecto/[id]` bajo virales. Apoyo de conocimiento:
  skill `rrss-content-generation`.
- Verificado: `tsc --noEmit` EXIT=0; `prisma db push` en sync.

**Desviación vs. plan:** el punto de entrada de generación vive en `ContentTray` (selector de viral
dentro del propio modal), no en un botón dentro de `ViralesEditor` — se eligió el patrón de panel
autocontenido, coherente con el resto de REQs.

**Pendiente (usuario, necesita red+keys):** configurar keys en Ajustes + test de conexión, y generar
contenido end-to-end (fal/HeyGen/ElevenLabs/Gemini) — la shell del agente no tiene red ni keys, así
que el render real solo se puede validar en la máquina del usuario. **Riesgo:** cada proveedor tiene
su forma de API/estado; mitigado con `coerce`/timeouts/logs por pieza y guion persistido pronto.
**Siguiente:** al validar → REQ-006 (resolver antes DA-05: credenciales de login de la appweb).

### 2026-07-15 — REQ-006: Contenido propio (mostrar la app) + grabación Playwright

**Decisión DA-05 (con el usuario):** **credenciales** de login de la appweb en el **Vault por
proyecto** (AES-256-GCM, clave `login:<projectId>`; la contraseña nunca la devuelve la API).
**Grabación** = **Playwright real** (móvil iPhone 13 + `recordVideo` + login scriptado) con
**fallback a subida manual**. **Función** = la IA la propone leyendo el dossier y el usuario
elige/edita. **Render/bandeja** = reutiliza REQ-005 (misma `ContentPiece` con `origin="own"`;
fal.ai cortes B-roll + locución ElevenLabs; montaje stub).

**Hecho (reutiliza infra de REQ-005, sin cambio de esquema Prisma):**
- Tipos en `types.ts`: `DemoConfig{funcion,funcionUrl,pasos[],usarLogin,grabacionModo}` (campo
  opcional `demo?` de `MediaConfig`); `PieceAssets.recordingPath`; `coerceDemo`/`EMPTY_DEMO`.
- `src/core/secrets/login.ts`: `setLogin/getLogin/hasLogin/deleteLogin` sobre el vault existente.
- `src/core/media/recorder.ts`: `recordDemo()` con **import dinámico** de `playwright` (chromium +
  `devices["iPhone 13"]` + `recordVideo` 390×844), login best-effort por selectores, recorre pasos,
  guarda `screencast.webm`; errores amistosos si falta paquete/navegador → degrada a manual.
- `src/core/content/demo.ts`: `analyzeFunctions()` (propone 3-6 funciones del dossier) y
  `generateDemoGuion()` (guion **product-led**; escaleta alterna grabación de pantalla + cortes
  B-roll con prompt en inglés para fal.ai).
- Pipeline `req006.ts`: `input → grabacion → guion → media(cortes) → voz → montaje`. `grabacion`
  no lanza si Playwright falla (permite subida manual posterior); `videoPath = recordingPath ||
  clips[0]`; `montaje` stub → `status:listo`, `version++`.
- API: `POST /api/projects/[id]/content/demo/run` (pieza `own` + run REQ-006, 409 sin dossier),
  `POST …/functions` (analiza con IA), `GET/PUT/DELETE …/login` (credenciales cifradas),
  `POST /api/content/[projectId]/[pieceId]/upload` (screencast manual → `recordingPath`); `asset`
  amplía content-type a `.webm`/`.mov`.
- UI: `DemoContentModal` (analizar funciones con IA, elegir/editar, grabación auto/manual, login
  cifrado, atributos vídeo/voz) + botón «+ Contenido propio» en `ContentTray`; `PieceCard` distingue
  piezas propias (chip «Propio · app»), reproduce la grabación y ofrece subida/reemplazo manual.
- Verificado: `tsc --noEmit` EXIT=0; `prisma db push` en sync (sin cambio de esquema).

**Pendiente (usuario, necesita red+keys+navegador):** `npx playwright install chromium`, configurar
login y keys, y generar contenido propio end-to-end. Playwright real y proveedores solo se validan en
la máquina del usuario (la shell del agente no tiene red). **Siguiente:** al validar → REQ-003 (leads),
apoyándose en el skill `rrss-lead-research`.

### 2026-07-15 — REQ-004: Virales del nicho (YT/TikTok/IG) + patrones

**Decisión DA-03 (con el usuario):** **Fuente:** IA + **WebSearch/WebFetch** (el motor `claude -p`
localiza virales públicos de YT/TikTok/IG; sin claves API ni scraping directo — usa la sesión Pro).
**Definición de "viral":** **relativo al autor** (≈5× la mediana de vistas del propio canal), para no
sesgar hacia cuentas ya grandes. **Ventana:** **30 días** por defecto, configurable en la UI
(7/14/30/histórico). **Salida:** **Top 20** con cada pieza descompuesta (hook, estructura,
share-trigger, patrón transferible) + patrones recurrentes → alimenta REQ-005.

**Hecho (mismo patrón que REQ-002/003 → máximo reuso):**
- Modelo `Virales` en Prisma (espejo de `Competencia`/`Leads`: content JSON + status/version) + relación
  en `Project`.
- Tipos `Virales`/`Viral`/`PatronViral`/`CriterioViral` con `coerce*` defensivo en
  `src/core/virales/types.ts` (`DEFAULT_CRITERIO.ventanaDias=30`).
- Lógica IA en 2 pasos: `discover.ts` (IA + **WebSearch/WebFetch** localiza virales del nicho, estima
  vistas/`ratioAutor`/`viralScore`, dedupe por URL, conserva semillas manuales; `timeoutMs` 300s) y
  `analyze.ts` (descompone cada viral: hook, estructura, share-trigger, **patrón transferible** —
  concepto, no copia — + patrones recurrentes; conserva metadatos y `origen`, corta Top 20).
- Pipeline `req004.ts`: nodos `input → discover → rank → analyze`. `input` exige dossier y conserva
  virales manuales; `rank` (puro código) ordena manuales primero y luego por `viralScore`, corta al
  Top 20; `analyze` hace `upsert` de `Virales`.
- API: `POST /api/projects/[id]/virales/run` (body opcional `{ ventanaDias }`) y
  `GET/PUT /api/virales/[projectId]` (GET incluye su `lastRun` de REQ-004 para restaurar el grafo).
- UI: `ViralesPanel` (autocontenido, SSE propio, reusa `PipelineGraph`, selector de **ventana**) +
  `ViralesEditor` (tarjeta por viral con plataforma/autor/URL/vistas/score + hook/share-trigger/porqué/
  patrón transferible, patrones recurrentes, añadir/quitar viral manual, Guardar/Aprobar/Regenerar).
  Montado en `/proyecto/[id]` bajo los leads. Apoyo de conocimiento: skill `rrss-viral-analysis`.
- Verificado: `tsc --noEmit` EXIT=0; `prisma db push` en sync.

**Riesgo conocido:** la calidad/exactitud de WebSearch para métricas de vistas concretas es variable;
mitigado con prompt estricto (`ratioAutor` relativo, no vistas absolutas) + `coerce` defensivo + edición
manual. **Pendiente:** pruebas del usuario end-to-end (dossier → «Buscar virales» → editar/aprobar);
verificar auto-invocación de WebSearch en `-p` (necesita red). Al validar → REQ-005 (resolver antes DA-04).

### 2026-07-15 — REQ-003: Clientes potenciales (negocios locales reales) + estrategia

**Decisión DA-02 (con el usuario):** leads = **negocios locales reales** (encaja con «correo» y
«visita al local»). **Fuente:** el motor `claude -p` con **WebSearch** localiza los negocios y extrae
**solo datos públicos de empresa** (nombre, dirección, web, teléfono/email públicos) — sin clave API
extra (usa la sesión Pro). **Legal:** solo datos públicos de empresa, **sin PII de personas físicas**,
respetando ToS. **Estrategia:** la IA genera canal + estrategia + borrador (correo/guión) por lead y el
usuario edita/aprueba.

**Hecho (mismo patrón que REQ-002 → máximo reuso):**
- Modelo `Leads` en Prisma (espejo de `Competencia`: content JSON + status/version) + relación en `Project`.
- Tipos `Leads`/`Lead`/`Persona`/`Borrador` con `coerce*` defensivo (los datos de WebSearch vienen poco
  estructurados) en `src/core/leads/types.ts`.
- Lógica IA en 3 pasos: `research.ts` (perfil de cliente: personas + zona + tipo de negocio, desde
  dossier+competencia, sin web), `discover.ts` (IA + **WebSearch/WebFetch** localiza negocios reales,
  solo datos públicos, dedupe, conserva semillas manuales) y `strategy.ts` (por lead: temperatura, canal,
  estrategia y borrador en tono de marca + scores). Todos respetan `settings.aiModel`.
- **Motor:** `AiTask` gana `allowedTools?: string[]` (se une a `"Skill"`) y `timeoutMs?`; `claude-cli.ts`
  los cablea (`--allowedTools Skill,WebSearch,WebFetch` y timeout 300s para `discover`).
- Pipeline `req003.ts`: nodos `input → research → discover → strategy`. `input` exige dossier, carga
  competencia si existe (laxo) y conserva leads manuales; `strategy` hace `upsert` de `Leads`.
- API: `POST /api/projects/[id]/leads/run` (body opcional `{ zona }`) y `GET/PUT /api/leads/[projectId]`
  (GET incluye su `lastRun` de REQ-003 para restaurar el grafo).
- UI: `LeadsPanel` (autocontenido, SSE propio, reusa `PipelineGraph`, input opcional de **zona**) +
  `LeadsEditor` (resumen/zona, tarjeta por lead con datos + temperatura/canal/scores + estrategia +
  borrador correo/guión, añadir/quitar lead manual, Guardar/Aprobar/Regenerar). Montado en `/proyecto/[id]`
  bajo la competencia. Apoyo de conocimiento: skill `rrss-lead-research`.
- Verificado: `tsc --noEmit` EXIT=0; `prisma db push` en sync.

**Riesgo conocido:** la calidad de WebSearch para negocios locales concretos es variable; mitigado con
prompt estricto + `coerce` defensivo + edición manual. **Pendiente:** pruebas del usuario end-to-end
(dossier → «Buscar clientes potenciales» → editar/aprobar); verificar que el motor auto-invoca WebSearch
en `-p` (necesita red, la shell del agente no la tiene). Al validar → REQ-004.

### 2026-07-15 — REQ-007: Pase de curación de skills

**Decisión DA-06 (con el usuario):** un "skill" = **capacidad del entorno de Claude Code**
(skills de proyecto + plugins del marketplace) como **toolkit del agente y del motor headless
de la app**, NO una feature de UI. Instalación **curada**. Alcance: pase ligero ahora → seguir
con REQ-003. La pantalla de Skills dentro de la app queda aplazada.

**Hallazgo de entorno (clave):** el marketplace oficial `anthropics/claude-plugins-official`
está instalado (254 plugins en catálogo, ~52 clonados localmente). Los plugins de
marketing/vídeo/leads (apollo, runway-api, postiz, canva, brightdata, exa…) **no están locales**
→ requieren red, que la shell del agente no tiene (los instala el usuario en su máquina). El
mecanismo **offline** que carga tanto mi sesión como el motor headless de la app (`claude -p`
con `cwd`=raíz del proyecto) son los **skills de proyecto** en `.claude/skills/`.

**Hecho:**
- 3 skills de proyecto en `.claude/skills/`: `rrss-lead-research` (REQ-003),
  `rrss-viral-analysis` (REQ-004), `rrss-content-generation` (REQ-005/006).
- `docs/05-skills.md`: catálogo curado (skill→REQ→estado→aporta) + comandos `/plugin install`
  para los plugins que requieren red + lista de plugins dev locales opcionales.
- DA-06 marcada resuelta en `docs/01-requisitos.md` (§REQ-007 y §7).
- **Verificado (vía agente experto en Claude Code):** los skills de proyecto SÍ se descubren en
  modo `-p` headless. **Matiz:** para que el motor los **auto-invoque** sin colgarse en permisos,
  `claude -p` necesitaría `--allowedTools "Skill"` (hoy `claude-cli.ts` no lo pasa). Documentado
  como mejora (Plan A) + Plan B (referenciar el conocimiento del skill en el prompt de cada REQ).

**Pendiente:** (usuario) instalar en su máquina los plugins de red que apliquen por REQ; (opcional)
añadir `--allowedTools "Skill"` en `src/core/ai/claude-cli.ts` y verificar en la app. **Siguiente:**
REQ-003 apoyándose en `rrss-lead-research` (+ apollo cuando esté instalado).

### 2026-07-15 — REQ-002: Análisis de competencia

**Decisión DA-01 (con el usuario):** descubrimiento **híbrido** — la IA propone competidores
desde el dossier y el usuario puede añadir/quitar/editar; los manuales se conservan al regenerar.
Dependencia laxa (basta con que el dossier exista, aunque sea borrador). UI integrada en
`/proyecto/[id]`, bajo el dossier.

**Hecho (mismo patrón que REQ-001 → máximo reuso):**
- Modelo `Competencia` en Prisma (espejo de `Dossier`: content JSON + status/version) + relación en `Project`.
- Tipos `Competencia`/`Competidor` con `coerceCompetencia` defensivo (`src/core/competencia/types.ts`).
- Lógica IA en dos pasos: `discover.ts` (propone competidores desde nicho/propuesta de valor, dedupe por
  dominio, tope 5, conserva semillas manuales) y `generate.ts` (ficha comparativa con crawl de cada
  competidor). Ambos respetan `settings.aiModel`.
- Pipeline `req002.ts`: nodos `input → discover → crawl → compare`. `input` exige dossier; `crawl` reusa
  `crawlSite(url,3)` y es tolerante a fallos; `compare` hace `upsert` de la Competencia.
- API: `POST /api/projects/[id]/competencia/run` (lanza run REQ-002) y `GET/PUT /api/competencia/[projectId]`
  (el GET incluye su propio `lastRun` de REQ-002 para restaurar el grafo tras recargar).
- **Fix**: `GET /api/projects/[id]` ahora filtra `lastRun` a REQ-001 (antes cogía el último run de cualquier
  requisito → habría roto el grafo de REQ-001 al existir runs de REQ-002).
- UI: `CompetenciaPanel` (autocontenido, SSE propio, reusa `PipelineGraph`) + `CompetenciaEditor` (espejo de
  `DossierEditor`: resumen, tarjetas por competidor, ventajas/amenazas/oportunidades, Guardar/Aprobar/Regenerar).
  Montado en `/proyecto/[id]` bajo el dossier.

**Pendiente:** pruebas del usuario end-to-end (arrancar por `iniciar.bat`, generar dossier → «Analizar
competencia» → editar/aprobar). Al validar → REQ-003.

### 2026-07-14 — Auto-refresh SSE + selección de modelo

**Hecho:**
- **Fix auto-refresh del pipeline:** la UI se quedaba en "En curso…" al terminar el run
  y solo se actualizaba al navegar fuera y volver. Causa raíz: `src/core/pipeline/bus.ts`
  usaba un `Map` a nivel de módulo que **Next.js dev NO comparte entre bundles de rutas**
  (el route que publica —`executeRun`— y el SSE que se suscribe cargaban Maps distintos),
  así que los eventos en vivo nunca llegaban al cliente. **Fix:** el Map ahora vive en
  `globalThis` (singleton real). Además, red de seguridad en el endpoint SSE
  (`src/app/api/runs/[id]/stream/route.ts`): sondea la BD cada 1.5s y, si el run llega a
  `ok`/`error`, envía el estado final de nodos + `done` y cierra — garantiza refresco aunque
  el bus falle. Añadido `cancel()` para limpiar suscripción y poll al cerrar el stream.
- **Selección de modelo:** nuevo ajuste `aiModel` (`default`/`sonnet`/`opus`/`haiku`) en
  `src/core/settings.ts`. `AiTask.model` opcional; `claude-cli.ts` añade `--model <alias>`
  (salvo en "default"). `generateDossier` pasa el modelo de Ajustes. API `ai-engine` acepta
  `{model}`; `connectors` GET devuelve `aiModel`. Nuevo selector "Modelo de Claude" en Ajustes.

### 2026-07-13 — Fundación + REQ-001

**Hecho:**
- Scaffold Next.js (App Router + TS + Tailwind v4 + Prisma/SQLite). Shell de UI, Ajustes, motor IA. — `a8f2342`
- REQ-001: pipeline de análisis de appweb → dossier de negocio (crawl web + análisis código opcional + fusión IA). — `7cfee6f`
- Grafo de nodos animado (React Flow) con progreso en vivo por SSE.
- Editor de dossier con 8 secciones editables + Guardar/Aprobar/Regenerar.

**Arreglos de UX/bugs (REQ-001):**
- SSE sin race condition (se suscribe antes de leer estado → no se pierde el evento `done`). — `23f73e2`
- Nodo "Análisis código" ahora es condicional: no aparece en modo "solo web".
- Borrado de análisis (botón en dashboard y en vista de proyecto; cascade en BD).
- `.glow-border::before` con `pointer-events:none` (bug: overlay bloqueaba clicks del formulario).
- Auto-descubrimiento del binario de Claude CLI (`resolveManaged`) + timeout en `exec()`.
- Navegación dura al pipeline tras crear proyecto (`window.location.href`). — `ad6fde2`
- `iniciar.bat` reescrito: mata servidores viejos + limpia `.next` para arranque 100% limpio. — `e950b3f`
- Documentación de agente: `AGENTS.md` + esta bitácora.

**Diagnóstico raíz DEFINITIVO del "claude no se reconoce":** no era caché ni PATH.
En `claude-cli.ts` el `exec()` usaba `spawn(bin, args, { shell: true })` en Windows. Con
`shell:true` Node **concatena los argumentos sin escaparlos** (DEP0190) y los manda por
`cmd.exe`. El `run()` del dossier pasa `--append-system-prompt` con un texto **multilínea**;
`cmd.exe` lo partía en los espacios/saltos de línea y ejecutaba los fragmentos como comandos
sueltos → "claude"/palabra no reconocida. El `test()` (`--version`, sin args complejos) no lo
sufría, por eso "Probar conexión" daba OK pero el análisis fallaba.
**Fix:** usar `shell:false` cuando el binario es un `.exe` real (spawn directo, cada arg intacto);
shell solo para `claude` a secas o `.cmd/.bat`. Verificado: con `shell:false` el system prompt
multilínea llega íntegro como un solo argumento.
Refuerzo: `CLAUDE_CLI_PATH` fijado en `.env` al binario exacto, y log `[claude-cli] exec: …`
en el server para depurar. **Verificación end-to-end:** rerun de chafit contra servidor con el
código nuevo → run `status: "ok"`, dossier generado.

**Segundo factor que confundía el diagnóstico:** un **servidor zombi en el puerto 3000**
(código viejo) sobrevivía a los reinicios; el `iniciar.bat` esperaba a que el 3000 respondiera y
abría el navegador contra ESE servidor viejo. Endurecido `iniciar.bat`: bucle que mata cualquier
PID en el 3000 hasta dejarlo libre antes de arrancar, para no volver a abrir un servidor viejo.

**Pendiente de confirmar por el usuario:** que tras `iniciar.bat` en frío, un análisis "solo web"
va directo al flujo, sin error de "claude", con nodos actualizándose en vivo.

**Siguiente:** al validar REQ-001 → arrancar REQ-002 por sus docs (diseño/arquitectura del REQ).
Resolver antes DA-01 (cómo se descubren los competidores: búsqueda web IA / manual / directorios).
