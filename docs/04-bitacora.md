# Bitácora de trabajo — RRSS Studio

> Registro vivo del progreso. Se actualiza al cerrar cada tarea relevante.
> Contexto operativo: `AGENTS.md`. Especificaciones: `docs/01..03`.

---

## Estado de los requisitos

| REQ | Nombre | Estado |
|-----|--------|--------|
| REQ-001 | Análisis de la appweb → dossier de negocio | 🟢 Verificado end-to-end (run status "ok") — pendiente visto bueno final del usuario |
| REQ-002 | Análisis de competencia | 🟡 Implementado — pendiente pruebas del usuario |
| REQ-003 | Scraping de clientes potenciales + estrategia | ⚪ Pendiente |
| REQ-004 | Scraping de virales del nicho (YT/TikTok/IG) | ⚪ Pendiente |
| REQ-005 | Generación de vídeo (clonado de viral) | ⚪ Pendiente |
| REQ-006 | Generación de contenido propio de la app | ⚪ Pendiente |
| REQ-007 | Skills | 🟡 Pase de curación hecho (skills de proyecto + catálogo, DA-06 resuelta); feature UI aplazada |
| REQ-008 | Configuración de herramientas/APIs (Ajustes) | 🟡 Base construida (shell de Ajustes) |
| REQ-009 | Experiencia visual | 🟡 Transversal — grafo de nodos ya animado |

Leyenda: ⚪ pendiente · 🟡 en curso/parcial · 🟢 aprobado por el usuario

---

## Historial

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
