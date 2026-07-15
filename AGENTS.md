# AGENTS.md — Contexto operativo para el agente

> Lee este fichero al empezar cada sesión. Resume **cómo trabajar en este repo** sin
> tener que redescubrirlo. El *qué* y el *porqué* del producto están en `docs/`.

---

## 1. Qué es este proyecto

App **web local** (corre en `localhost`) = cadena de automatización para crear
contenido de redes sociales (RRSS) a partir de una appweb. Se construye por
requisitos **REQ-001 … REQ-009**, uno a uno, con validación del usuario entre cada uno.

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
  proyecto/[id]/page.tsx      Vista de proyecto: pipeline + logs + dossier + competencia (client, SSE)
  ajustes/                    Pantalla de conectores/API keys (REQ-008)
  api/
    projects/                 CRUD proyectos (POST crea+lanza run, DELETE, [id] GET/rerun)
                              [id]/competencia/run  POST lanza run REQ-002
    runs/[id]/stream/         Endpoint SSE del run
    dossier/[projectId]/      GET/PUT del dossier
    competencia/[projectId]/  GET/PUT de la competencia (REQ-002); GET incluye su lastRun
src/components/               PipelineGraph, DossierEditor, RecentProjects,
                              CompetenciaPanel, CompetenciaEditor
src/core/
  pipeline/                   req001.ts / req002.ts (definen nodos), bus.ts (eventos), engine
  ai/claude-cli.ts            Motor Claude CLI (resolución de binario, exec con timeout)
  dossier/                    Tipos + generación del dossier (REQ-001)
  competencia/                Tipos + discover.ts (propone competidores) + generate.ts (REQ-002)
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
- **REQ-007** (skills): **pase de curación hecho** (DA-06 resuelta). 3 skills de proyecto en
  `.claude/skills/` + catálogo en `docs/05-skills.md`. Feature de UI aplazada.
- **Siguiente:** REQ-003 (scraping de clientes potenciales + estrategia) — resolver antes DA-02 (fuente
  de leads). Apoyarse en el skill `rrss-lead-research` (+ plugin `apollo` cuando el usuario lo instale).
