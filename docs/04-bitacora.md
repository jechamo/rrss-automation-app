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
| REQ-005 | Generación de vídeo (clonado de viral) | 🟡 Implementado (fal.ai por contrato + HeyGen v3 Photo Avatar/voz/audio + montaje FFmpeg) — pendiente prueba real con red+keys |
| REQ-006 | Generación de contenido propio de la app | 🟡 Implementado (fal/HeyGen elegible, recorder v2 y montaje presentador+screencast) — pendiente prueba real con red+keys+navegador Playwright |
| REQ-007 | Skills | 🟡 Pase de curación hecho (skills de proyecto + catálogo, DA-06 resuelta); feature UI aplazada |
| REQ-008 | Configuración de herramientas/APIs (Ajustes) | 🟡 Base construida (shell de Ajustes) |
| REQ-009 | Experiencia visual | 🟡 Implementado (dashboard por vistas con carruseles 360, arte IA, tarjetas 3D, loaders, sidebar fija y transiciones de estado) — pendiente visto bueno del usuario |
| REQ-010 | Publicación asistida en redes | 🟡 Implementado (D-06: descargar vídeo + copiar copy + abrir red; sin APIs/tokens; marca `publicado` con `publishedTo`/`publishedAt`) — pendiente pruebas del usuario |
| REQ-011 | Estudio multimedia + REC/STOP + MIX + Guía | 🟡 Implementado — herramientas y subtítulos verificados; pendiente prueba manual del selector de captura |
| REQ-012 | Plan audiovisual + cortes configurables + montador ligero | 🟡 Implementado — contratos/build correctos; pendiente prueba del usuario con un render MIX v2 real |
| REQ-013 | Revisión de prompts + catálogo fal.ai ampliado | 🟡 Implementado — pendiente prueba real con créditos fal.ai |
| REQ-014 | Confianza operativa y navegación autenticada | 🟡 Implementado — pendiente validar recorrido real en ChaFit tras login |
| REQ-015 | Mapa funcional multimenú de la app | 🟡 Implementado — pendiente regenerar un proyecto y validar sus rutas privadas con login real |
| REQ-016 | Pulido visual, SSE y login Playwright | 🟡 Implementado — dry-run ICG Vault validado; pendiente prueba del usuario con grabación real |

Leyenda: ⚪ pendiente · 🟡 en curso/parcial · 🟢 aprobado por el usuario

---

## Historial

### 2026-07-19 — REQ-017: navegación autocorregible y remontaje sin créditos

- El análisis dirigido deja de considerar ejecutable un recorrido por inferencia estática: cuando hay
  objetivo y pasos Playwright, realiza un dry-run autenticado automático antes de devolverlos a la UI.
- El recorder inspecciona únicamente elementos visibles/habilitados, corrige tags/textos contra el DOM
  real y puede descubrir de forma acotada tabs o filtros intermedios dentro del último contenedor
  verificado. Nunca explora submit, enlaces ni acciones con semántica de mutación.
- Los pasos reparados se devuelven al modal, se guardan como `nav_plan.json` y sustituyen el JSON
  propuesto. Si el usuario edita URL, login o pasos, debe volver a probar antes de generar.
- Nueva pipeline aditiva `REQ-006-NAV` (`Reutilizar recursos → Navegación → Remontar sin créditos`):
  regraba Playwright o usa la grabación manual/mediateca actual, y conserva clips fal.ai, audio
  ElevenLabs, presentador HeyGen, guion, prompts y subtítulos sin llamar a proveedores.
- Los remontajes escriben un final versionado (`final-remount-<timestamp>.mp4`), por lo que un fallo no
  pisa el montaje anterior. La tarjeta ofrece `Regrabar navegación` y `Remontar sin créditos`.
- Al adjuntar REC, subida manual o mediateca se reinician solo las marcas temporales Playwright de la
  pieza, evitando recortar una grabación nueva con los tiempos de una navegación anterior.
- Guía actualizada para los flujos automático, subida manual y REC/STOP. Verificado con TypeScript,
  23/23 contratos (incluido el caso PlayStation → PlayStation 5) y build de producción.

### 2026-07-19 — REQ-016: navegación compacta, SSE resiliente y login previo a grabación

- PipelineGraph aumenta el aire real entre tarjetas y refuerza conectores; verificación visual a ancho
  de escritorio confirma unos 51 px visibles entre nodos frente a la compactación anterior.
- Cursor propio de anillo cian/violeta en dispositivos con puntero fino; inputs mantienen I-beam y
  táctil conserva comportamiento nativo. Scrollbars globales y sidebar compacta modernizadas.
- Sidebar sin «Automatización de contenido RRSS» ni bloque «Proyecto activo / En este proyecto»;
  todas las secciones caben en la altura de prueba sin scroll práctico.
- Competencia, leads y virales ya no cierran EventSource ante un error transitorio. La reconexión nativa
  recupera desde SQLite los nodos actuales, evitando que virales quede gris hasta volver del dashboard.
- Nuevo preflight compartido `auth-session.ts`: valida/corrige storage state, reconoce campos de email,
  usuario e `identifier`, puede abrir el acceso y autentica en un contexto sin grabación. El vídeo empieza
  después de aplicar la sesión; credenciales y formulario quedan fuera de la captura.
- Cierre seguro de avisos informativos dentro de diálogos (`Saltar`, `Cerrar`, `Entendido`, `Ahora no`,
  `Omitir`) antes de cada paso; no toca confirmaciones ni acciones de negocio.
- Causa real ICG Vault confirmada en código: su campo es `input[name="identifier"]`, ausente en el detector
  antiguo. Primer dry-run autenticó pero detectó que “Best of the Week” interceptaba el tap; tras el cierre
  seguro, el recorrido real `/my-list` `goto → wait → tap → scroll` terminó OK sin vídeo ni consumo fal.ai.

### 2026-07-19 — REQ-015: mapa funcional multimenú de hasta tres niveles

- Nuevo nodo `Mapa funcional` en REQ-001. Analiza rutas, enlaces, `navigate`/router, layouts y
  componentes de navegación sin asumir un diseño concreto: admite simultáneamente navbar, barra
  inferior, sidebar izquierda/derecha, drawer, pestañas, breadcrumbs y cuadrículas de tarjetas.
- Árbol tipado y defensivo con varias raíces, máximo tres niveles y 120 nodos; conserva rutas
  dinámicas como `:id`, roles, login, condiciones, acciones y evidencias `fichero:línea` sin inventar
  destinos. Si no hay código, crea un borrador desde el crawl y lo marca pendiente.
- Persistencia aditiva `NavigationMap`, API de lectura/edición y panel visual con resumen, filtros por
  superficie/estado y copia en Markdown. Los proyectos anteriores muestran un estado vacío claro
  hasta que se regenere REQ-001. El panel comienza plegado para no ocupar la página y conserva el
  resumen, métricas y un control accesible para desplegar o volver a plegar todo el detalle.
- Verificación Playwright opcional y segura: reutiliza el login cifrado, visita únicamente rutas
  conocidas del mismo origen, descubre enlaces visibles adicionales y nunca pulsa botones de negocio.
  Las rutas dinámicas sin un ID real permanecen condicionales.
- El mapa alimenta el dossier y el análisis dirigido de funcionalidades de contenido propio. La guía
  explica que el contexto sirve para audiencia/exclusiones y que ya no hace falta pegar un mapa manual.
- Migración SQLite aplicada. Verificado con TypeScript, 21/21 contratos, build de producción y navegador
  local: enlace lateral, estado vacío retrocompatible y guía visibles, sin errores de consola.

### 2026-07-19 — REQ-014: navegación autenticada, contexto y confianza operativa

- El análisis dirigido de contenido propio amplía rutas/selectores de código y, con login guardado,
  inspecciona en Playwright móvil la primera superficie privada. Puede usar un cliente/dato de ejemplo,
  no inventa IDs dinámicos y avisa cuando solo existe guía humana sin JSON ejecutable.
- `NavStep.commit` separa validación de mutación: el dry-run localiza el control final y se detiene;
  la grabación real conserva el clic. Las credenciales no entran en prompts ni logs.
- Catálogos de vídeo/voz independientes con reintento dentro del modal y mensajes distintos para
  credencial, límite temporal y fallo 5xx/red.
- Auditoría y recalibración FIT+INTENT sin WebSearch: intención máxima 3 sin señal explícita,
  justificación obligatoria y límite de calientes. Los lotes antiguos muestran CTA de corrección.
- Logos con iniciales inmediatas y fade-in de imagen; desaparece el hueco durante carga/fallback.
- `Project.context` opcional, persistente y editable; orienta crawl, fragmentos focalizados de código
  y dossier como fuente aportada, nunca como evidencia verificada por sí sola.
- Migración SQLite aditiva aplicada. Verificado con TypeScript, 19/19 contratos, build de producción
  y navegador local (nuevo proyecto, editor de contexto, aviso de leads y modal de contenido propio).

### 2026-07-19 — REQ-013: preflight de prompts y nuevos modelos fal.ai

- Nuevo paso sin consumo fal.ai para preparar guion/storyboard en viral y contenido propio; todos
  los prompts B-roll se pueden editar antes del CTA «Aprobar prompts y generar».
- Firma de plan en cliente y validación defensiva en servidor: cambios de fuente/modelo/duración/
  cantidad invalidan la revisión; prompts vacíos o cantidades incoherentes no crean la pieza.
- Los pipelines reutilizan exactamente el contenido aprobado y omiten el segundo análisis de guion.
- Catálogo: Seedance 1.0/2.0, Kling 2.5/3.0, Veo 3.1 y Luma Ray 2, con contratos verticales,
  audio nativo desactivado cuando procede, duración efectiva visible y coste por segundo.
- Guía general y especificaciones SDD actualizadas. Verificado con TypeScript, build de producción,
  `git diff --check` y 17/17 contratos (incluido quemado ASS real); sin consumir créditos fal.ai.

### 2026-07-18 — REQ-012: plan audiovisual y montador ligero

**Plan y control de coste:**
- Rama fal.ai con cantidad **Automática** o manual **0–6** (el clonado viral exige al menos uno),
  duración por corte y coste calculado con la cantidad aprobada.
- Tarjeta previa con objetivo, demo protegida/estimada, tiempo de B-roll, cortes, segundos solicitados
  y CTA explícito «Aprobar plan y generar». El guion y ambos pipelines respetan el límite persistido.
- Contrato puro `planning.ts`, coerción retrocompatible de `MediaConfig` y guía integrada actualizada.

**Timeline y armonización:**
- MIX v2 por segmentos con asset, entrada/salida, etiqueta, tipo, candado y plano opcional; MIX v1
  conserva lectura y render sin migración Prisma.
- Timeline visual con previsualización vertical, drag/reordenación, recorte, insertar/quitar, protección,
  recursos usados/sin usar y comparación exacta vídeo/locución.
- «Ajustar a locución» modifica solo bloques desbloqueados. El servidor rechaza diferencias mayores
  de 0,25s y límites fuera del recurso: no congela ni trunca silenciosamente.
- `nav_log` Playwright se indexa como marcadores protegidos incluyendo la pausa posterior a cada
  acción. Las grabaciones reutilizadas se enlazan por ruta aunque sean assets libres (`pieceId=null`).

**Verificación:** 15/15 contratos (incluye MIX v1/v2, planificación y libass real), TypeScript,
`git diff --check` y build de producción correctos. Verificación visual local confirma la nueva
pantalla, selección de pieza, cuatro clips, locución 27,45s, timeline armonizada y coste/estados.
El navegador detectó que una grabación libre reutilizada no entraba por `pieceId`; quedó corregido
mediante las rutas de `ContentPiece.assets`. No se consumieron créditos ni se creó un MIX de prueba.

### 2026-07-18 — Refinamiento REQ-004/005/006: recorridos dirigidos, pipeline y cortes fal.ai

**Contenido propio / Playwright:**
- «Analizar con IA» tiene dos modos: sin nombre conserva las propuestas múltiples; con un nombre
  analiza esa funcionalidad concreta en el repositorio local, devuelve evidencias/confianza y
  rellena el recorrido Playwright, incluidos varios cambios de ruta.
- La URL raíz se hereda del proyecto y la ruta inicial queda como opción avanzada. Descripción,
  evidencias y pasos del análisis se conservan en la pieza y alimentan el guion.
- El login sigue fuera del prompt: la IA sólo conoce si está configurado; Playwright recupera las
  credenciales cifradas y autentica antes del recorrido.

**Estado, errores y etiquetas:**
- Las pipelines se muestran también al terminar o fallar, restauran nodos/logs desde BD y ya no
  dependen de alternar Lista/Carrusel. El estado persistido se fusiona por progreso de nodo.
- El clon guarda título/plataforma al crearse: TikTok no aparece provisionalmente como YouTube.
- Ranking dinámico (`Top N` o `+N nuevos`) según la cantidad solicitada.
- Errores fal.ai de saldo, autenticación y rate limit se traducen a mensajes accionables. Todos los
  registros y detalles ocultan keys/tokens, incluidos los runs antiguos al pintarlos.

**Cortes y montaje:**
- Manifiesto retrocompatible por corte: plano, prompt, modelo, duración solicitada/real, ruta y
  estado. Se persiste después de cada corte, por lo que un fallo posterior no oculta los anteriores.
- La tarjeta distingue preview provisional de montaje final y ofrece «Recursos generados» con un
  reproductor individual por clip, también para piezas legacy.
- Causa del montaje verde que sólo enseñaba el primer corte: con screencast + 2 o más clips la rama
  antigua usaba únicamente `clips[0]`, la grabación y `clips.at(-1)`, omitiendo los intermedios sin
  lanzar error. Ahora la escaleta gobierna la timeline: cada plano con prompt consume su clip fal.ai
  y cada plano sin prompt consume el siguiente segmento de grabación. Una prueba exige 4/4 clips.
- El montaje rechaza assets locales ausentes y deja de usar `-shortest`, evitando además que una
  locución más corta elimine silenciosamente los últimos cortes.

**Verificación:** TypeScript, 11/11 contratos y `next build` correctos. Prueba visual local confirma
pipeline de error persistente en Lista/Carrusel, TikTok correcto, error real de fal.ai por saldo
visible de forma segura y galería legacy de 4/4 cortes. El análisis dirigido llegó al Claude CLI,
pero su respuesta real quedó bloqueada por el límite temporal de la sesión Pro; la UI lo traduce a
un aviso breve y reintentable. Validación posterior con el `final.mp4` descargado por el usuario
(hash idéntico al asset de la pieza): el original de 27,446s contiene sólo `clip-1` y screencast.
El último clip quedaba detrás del screencast y `-shortest` cortaba a la duración de la locución;
los dos intermedios ni siquiera estaban en la timeline antigua. Un montaje diagnóstico no destructivo
con la nueva planificación dura 30,5s y muestra, en orden, clip 1 → pantalla → clip 4 → pantalla →
clip 6 → clip 7. Añadido fallback de duración por último PTS para WebM de MediaRecorder sin
`format.duration` (la grabación real medía 25,387s y antes ffprobe devolvía `N/A`).

### 2026-07-18 — REQ-011: herramientas, mediateca, REC/STOP, MIX y Guía

**Herramientas sin tocar Claude CLI:**
- `bintools.ts` resuelve yt-dlp/FFmpeg/ffprobe por override, PATH y WinGet. Ajustes muestra ruta,
  versión y permite revalidar mediante `GET /api/system/tools`.
- Verificado desde Next: yt-dlp `2026.07.04` y FFmpeg/ffprobe `8.1.2`, todos encontrados en WinGet.
- `claude-cli.ts` no se modificó; conserva el binario gestionado con la sesión Pro.

**Subtítulos obligatorios:**
- ASS 1080×1920, zona inferior segura (`MarginV=230`), alto contraste y bloques cortos.
- `captionVideo()` cubre HeyGen. REQ-005/006 conservan el preview pero no marcan listo un vídeo con
  locución si FFmpeg/libass no puede quemar texto.
- Prueba real local genera un vídeo y quema ASS con el FFmpeg detectado: OK.

**Mediateca, grabador y MIX:**
- Tablas aditivas `MediaAsset`/`MixComposition`; assets legacy indexados sin mover ni duplicar bytes.
- `/proyecto/:id/estudio`: filtros, previews, subida, renombrado, descarga y borrado protegido.
- `SelfRecordModal`: ventana móvil, REC/STOP, temporizador, preview y guardado WebM; disponible también
  desde piezas propias y `DemoContentModal`.
- `assembleMix()` nuevo: orden de vídeos, locución, música/volumen, normalización vertical, ASS y
  salida versionada. «Usar como final» es explícito; los montadores existentes permanecen.
- `/guia` enlazada en el menú con secciones y siete flujos paso a paso.

**Verificación:** contratos ampliados 9/9 (incluye libass real), TypeScript, rutas HTTP de
herramientas/mediateca/MIX/Estudio/Guía y `git diff --check` correctos. El selector REC requiere el
permiso interactivo del navegador y queda para la prueba manual del usuario.

### 2026-07-18 — Duración de corte fal.ai (5/10/15) + Gemini multimodal real

**Duración de corte fal.ai (selector explícito):**
- `MediaConfig.falClipSeconds` (5/10/15, default 5, coerción defensiva → piezas antiguas siguen).
- `resolveFalDuration(model, requested)` en `contracts.ts`: mapeo por modelo → **Kling v3** 5/10/15,
  **Seedance Pro Fast** 5–12 (15→12), **Luma Ray 2** 5s/9s (10 y 15→9s). Devuelve el valor del body,
  los **segundos efectivos** y una etiqueta para la UI. `clampSeconds` sube a 15.
- UI en `MediaProviderConfigurator` (solo rama fal): botones 5/10/15 con nota «este modelo enviará Xs».
  El coste (`pricing.ts`) usa los **segundos efectivos** (Luma 15 se cobra como 9s).
- Pipelines REQ-005/006 pasan `config.falClipSeconds` a `generateClip` (antes `shot.segundos`).
- **Red de seguridad** en `fal.ts`: si la cola responde 4xx por la duración, reintenta una vez el
  corte a 5s y lo loguea (un enum equivocado no tumba el run).

**Gemini analiza el vídeo de verdad (multimodal):**
- `gemini.ts` reescrito: YouTube público → `file_data.file_uri` nativo; otras redes → `yt-dlp` local
  + **Files API** (subida resumable, espera `ACTIVE`, análisis, borrado remoto + temporal en `finally`).
  Modelo `gemini-2.0-flash` (fallback `gemini-1.5-flash`). Timeout amplio.
- `ytdlp.ts` nuevo: `hasYtDlp()` + `downloadVideo()` (binario del sistema **opcional**, patrón FFmpeg).
- `extract.ts` conserva la degradación: sin key/red/yt-dlp → log claro y sigue con datos de REQ-004.
- Checkbox del modal actualizado; coste de Gemini pasa de residual a rango de análisis de vídeo.

**Verificación:** `npm run test:contracts` 7/7 (incluye mapeo 5/10/15 por modelo), `tsc --noEmit`,
`next build` EXIT=0.

### 2026-07-18 — Integración robusta HeyGen v3 + fal.ai

**HeyGen:**
- Migración completa desde endpoints v1/v2 a API v3: voces y avatar looks paginados con previews,
  subida de assets, creación/espera de Photo Avatar, generación 9:16/1080p y polling de vídeo.
- Mutaciones idempotentes; reintentos 429/5xx con `Retry-After`; errores del proveedor sin exponer
  la API key. Ruta multipart server-side para foto PNG/JPEG y audio MP3/WAV (máx. 32 MB).
- Configurador compartido en ambos modales: avatar existente/foto propia y exactamente una
  narración (voz obligatoria con preescucha o audio propio).

**Pipelines y montaje:**
- REQ-006 deja de forzar fal.ai. La rama HeyGen genera `presenter.mp4`, muestra el presentador al
  inicio/final y el screencast en el centro conservando el audio continuo. El original queda en
  `presenterPath`; el montaje en `final.mp4`. Con audio propio no quema subtítulos del guion.
- Degradación conservada: sin grabación o si falla FFmpeg queda el avatar completo. Validación de
  proveedor también en servidor. Corregidas matrices de assets compartidas entre runs.

**fal.ai y verificación:**
- Catálogo sustituido por Seedance Pro Fast (predeterminado), Kling v3 Standard y Luma Ray 2.
  Bodies 9:16/duración específicos; eliminado el fallback que podía generar horizontal.
- Contratos externos revisados contra documentación oficial el 2026-07-18.
- Pruebas sin coste para bodies, narración exclusiva, parsing HTTP, reintentos, polling y errores
  de cola (`npm run test:contracts`).
- Verificación final: 5/5 contratos, `tsc --noEmit`, `next build` (incluye lint/typecheck) y
  `git diff --check` correctos. `npm run lint` aislado sigue abriendo el configurador legado de
  Next porque el repo no tiene una configuración ESLint independiente.
- Estimación de costes aproximados en el configurador de proveedores (fal/HeyGen/ElevenLabs/Gemini)
  antes de lanzar; Kling se fuerza sin audio nativo (`generate_audio:false`) porque la locución
  va por ElevenLabs.

### 2026-07-18 — Dashboard por vistas + navegación persistente

**Dashboard:**
- Cabecera reducida al logo de LeadView; eliminados el claim, «Fase actual» y las tarjetas CTA
  grandes. «Nuevo análisis» y «Ajustes» pasan a botones compactos.
- Nuevo `DashboardHub`: dos cards seleccionables (Proyectos / Piezas de contenido) con los contadores
  integrados. Cada selección muestra sólo su carrusel 360; Proyectos es la vista inicial.
- Nuevo `DashboardPiecesCarousel`: reúne piezas recientes de todos los proyectos, sirve su preview
  por el endpoint de assets y abre el proyecto directamente en `#contenido`.
- Dos ilustraciones generadas con IA (`dashboard-projects.webp` / `dashboard-pieces.webp`),
  recortadas a 1280×720 y optimizadas (58/49 KB), con fallback CSS.

**Navegación:**
- Spinner desde el clic en una tarjeta de proyecto y loader compartido durante la transición/fetch
  inicial (`ProjectLoading` + `proyecto/[id]/loading.tsx`).
- Eliminados los códigos `REQ-00X` de los textos visibles (menú, títulos, ayudas y nuevo proyecto);
  los identificadores internos de pipeline/BD/API y la documentación se conservan.
- App shell de altura de viewport: sidebar fija con scroll propio y contenido principal desplazable.

### 2026-07-18 — Adopción de video-factory + refinamientos visuales y scoring

**Objetivo:** completar el montaje que REQ-005/006 tenían como stub reutilizando el patrón probado
de `video-factory`, con degradación obligatoria, y resolver el feedback visual del usuario. Trabajo
ejecutado por fases con aprobación explícita entre cada una.

**Vídeo y grabación:**
- `media/ffmpeg.ts`: detección de FFmpeg/ffprobe, duración y ejecución por array de argumentos.
  `fal.generateClip` solicita 9:16 y 5-10s, con reintento compatible sin extras ante 4xx.
- Recorder v2: `NavStep` tipado, tiempos por paso en `nav_log.json`, `storageState` por proyecto,
  captura `error.jpg`, normalización a `screen.mp4` si hay FFmpeg y modo dry-run. Endpoint
  `/api/projects/:id/demo/dryrun` + botón «Probar pasos».
- `media/assemble.ts`: montaje vertical real a `final.mp4` (clips/grabación, recortes por nav_log,
  locución, SRT proporcional, subtítulos, concat y QC). REQ-005/006 actualizan `assets.videoPath`;
  sin FFmpeg o si falla conservan el preview y el run puede terminar.
- El análisis de funciones usa contexto acotado del repo local para proponer selectores reales;
  el modal permite editar `navSteps`. Los guiones propios reciben el recuento previo de la función
  para variar ángulo y hook.
- `ContentTray` muestra «Montaje ✓», logs y aviso de instalación; el carrusel prioriza `final.mp4`.

**Feedback visual y de datos:**
- Logo manual por proyecto (PNG/JPG/WebP, 2 MB) con API, editor en la cabecera y uso en dashboard.
- Dossier plegable, lectura estructurada, edición separada y arte `bg-dossier.webp`.
- Competencia: scores explícitos de producto/RRSS/amenaza con rúbrica y justificación; fallback
  legacy. Leads: rúbrica calibrada, máximo 25% calientes, `scoreRazon` y aviso si el lote es uniforme.
- Pipeline: 16 iconos generados con IA, spinner anular durante ejecución, badges ok/error y fallback.

**Verificación global:**
- `npm exec tsc -- --noEmit` → EXIT=0.
- `npm run build` (Next.js 15.5.20) → EXIT=0; incluye las rutas nuevas de logo y dry-run.
- Detección FFmpeg probada en ambos entornos simulados: `{false,false}` con `PATH` vacío y
  `{true,true}` con la instalación del sistema.
- Prisma: 1 proyecto existente; columna `logoPath` legible. No había piezas guardadas para una
  prueba de datos legacy; la compatibilidad queda cubierta por campos opcionales/coerción y build.

**Pendiente de validación end-to-end por el usuario:** generar una pieza real con red, keys,
Playwright Chromium y FFmpeg para revisar el resultado audiovisual (cortes, voz y subtítulos).

### 2026-07-18 — Rediseño visual + carruseles con expandir + «buscar más» + mapas

**Contexto:** el usuario pide una app **mucho más potente visualmente** y funciones por sección.
Restricción: **sin paquetes npm nuevos ni API keys** (todo Tailwind + CSS/SVG + iframes/URLs públicas
que resuelve el navegador del usuario).

**Componentes nuevos reutilizables** (`src/components/`):
- `Carousel3D` (cover-flow genérico, extraído de `PieceCarousel`, que ahora lo reutiliza),
  `ExpandableCarousel` (carrusel siempre visible + detalle desplegable del ítem activo),
  `ScoreBar` (barra de scoring animada), `EntityLogo` (logo por dominio: Clearbit → Google favicon →
  iniciales), `MiniMap` (iframe Google `output=embed`, sin key), `CardArt` (arte de `public/img/` con
  fallback CSS), `ProjectsCarousel` (dashboard).
- CSS: `.score-bar`/`.score-fill` (+`score-grow`), `.glow-hover`, `.float`, `.card-art` en `globals.css`.

**UI por sección:**
- **Dashboard:** carrusel 360 de proyectos (logo + estado); la card central navega al proyecto.
- **Competencia / Leads / Virales:** cada `*Editor` muestra arriba un `ExpandableCarousel` (cards con
  logo/plataforma + `ScoreBar`); al clicar una card se despliega su detalle debajo (leads incluyen
  `MiniMap` de la dirección; virales muestran miniatura de YouTube cuando aplica). El formulario de
  edición completo queda tras un toggle «✎ Editar en detalle».

**«Buscar más» (incremental) + nº configurable:**
- Pipelines `req002/req003/req004` aceptan `{ modo: "reemplazar" | "ampliar", cantidad }`. En `ampliar`
  se conservan **todos** los ítems, `discover*` recibe `excluir[]` (inyectado en el prompt: «no repitas
  estos») y el nodo final **añade** sólo los nuevos (dedupe), conservando los agregados previos.
- Endpoints `.../{competencia,leads,virales}/run` leen `{ modo, cantidad }`. Virales: `TOP_N` fijo →
  `cantidad` (10/20/30/50) con selector en el panel. Botón **«+ Buscar más»** en los 3 paneles.

**Arte generado (opcional):** `CardArt` usa `public/img/<name>` si existe; si no, gradiente CSS. Prompts
y nombres entregados al usuario (hero-aurora, bg-competencia, bg-leads, bg-virales, empty-carousel).

**Verificado:** `tsc --noEmit` EXIT=0; `next build` EXIT=0. Logos/mapas/discovery/miniaturas dependen
de la red del navegador del usuario.

### 2026-07-18 — Refinamientos UX (REQ-006) + fix timeout análisis virales (REQ-004)

**Contexto:** feedback del usuario al probar la app.

**A) Modal «Contenido propio» (REQ-006, `DemoContentModal`):**
- **Selectores en lugar de texto libre:** modelo de vídeo (fal.ai) y voz (ElevenLabs) pasan a
  **desplegables** con las listas reales, reutilizando el componente `SelectorAuto` de REQ-005
  (extraído a `src/components/SelectorAuto.tsx` junto con `loadOptions`/`Option`; `GenerateContentModal`
  ahora lo importa). Si falta la key, aviso a Ajustes y sigue disponible «Auto».
- **Ayuda de grabación:** texto explicando **Automática (Playwright móvil)** vs **Manual (subir vídeo)**.
- **Subida manual visible:** en modo Manual la pieza se crea sin grabar y el vídeo se sube **después**
  en su tarjeta. Se aclara en el modal y se **resalta** la zona de subida en `ContentTray` (borde de
  acento + botón «Subir vídeo de la app ↑») cuando la pieza propia aún no tiene grabación.
- **«Analizar con IA»:** nota de que propone funciones de la app desde el dossier (REQ-001) y
  autorrellena URL y pasos.
- **Editar fuente de código (A4):** nuevo `PUT /api/projects/:id` + editor «Fuente de código» en la
  página del proyecto (chips de tipo + ruta local/URL + Guardar). Antes solo se fijaba al crear el
  proyecto; ahora se corrige sin recrearlo.

**B) Virales (REQ-004):** el paso «análisis de patrones» se cortaba a los 180 s — era el **timeout
por defecto del motor de IA**, no un corte por duración. `analyzeVirales` (`analyze.ts`) ahora pasa
`timeoutMs = 600_000` (10 min) a `engine.run`, como ya hacía `discover`.

**Verificado:** `tsc --noEmit` EXIT=0; `next build` EXIT=0.

### 2026-07-15 — REQ-010: Publicación asistida en redes (D-06, opción manual)

**Contexto:** el usuario preguntó si la app puede "autosubir" a TikTok/Instagram/YouTube. No: la
subida 100% automática por API oficial exige OAuth + apps aprobadas por cada plataforma (§6 fuera
de alcance). Se implementa la **opción A** ya prevista en **D-06**: publicación **manual asistida**.

**Decisión (con el usuario, "haz A"):** dejar la pieza lista para publicar en un par de clics, sin
APIs ni tokens: descargar el vídeo final + copiar el copy al portapapeles + abrir la red destino.

**Hecho:**
- `core/content/publish.ts` (**nuevo**): `PUBLISH_TARGETS` (URL de subida web por red + hint),
  `composeCaption` (título + CTA + hashtags) y `finalVideoPath` (montaje > grabación).
- `components/PublishModal.tsx` (**nuevo**): modal de 4 pasos (descargar · copiar copy editable ·
  abrir red en pestaña nueva · marcar publicado) + selector de red.
- `ContentTray`/`PieceCard`: botón **«Publicar ↗»** en piezas `listo`/`publicado` que abre el modal;
  recarga la bandeja al marcar publicado. Se retira el antiguo botón "Marcar publicado" (lo cubre el modal).
- Ruta de assets: `?download=1` fuerza `Content-Disposition: attachment`.
- `PUT …/:pieceId`: al marcar publicado persiste `publishedTo` + `publishedAt` en el blob `assets`
  (nuevos campos en `PieceAssets`/`coerceAssets`, sin cambio de esquema Prisma).
- Verificado: `tsc --noEmit` EXIT=0; `next build` EXIT=0.

**Siguiente:** pruebas del usuario (descargar + pegar en cada red). Subida automática por API queda
para un requisito futuro (OAuth por plataforma).

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
- **Fix de navegación (barra lateral):** la `Sidebar` enlazaba a rutas inexistentes (`/proyecto`,
  `/analisis`, `/rrss`, `/historial`, `/skills`) → todas daban **404**. Reconstruida para enlazar
  **solo rutas reales** (Dashboard, Nuevo análisis, Ajustes) + **navegación por secciones** dentro de
  un proyecto (anclas `#pipeline/#dossier/#competencia/#leads/#virales/#contenido`, añadidas con
  `scroll-mt` en `proyecto/[id]`). El carrusel 360 aparece con **≥1 pieza** (toggle Lista/Carrusel).
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
