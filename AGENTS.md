# AGENTS.md — Contexto operativo para el agente

> Lee este fichero al empezar cada sesión. Resume **cómo trabajar en este repo** sin
> tener que redescubrirlo. El *qué* y el *porqué* del producto están en `docs/`.

---

## 1. Qué es este proyecto

App **web local** (corre en `localhost`) = cadena de automatización para crear
contenido de redes sociales (RRSS) a partir de una appweb. Se construye por
requisitos **REQ-001 … REQ-009**, uno a uno, con validación del usuario entre cada uno.

- **Metodología:** SDD (Spec-Driven Development). Orden: Requisitos → Diseño → Arquitectura → Código.
- **Documentos fuente de verdad:** `docs/01-requisitos.md`, `docs/02-diseno.md`, `docs/03-arquitectura.md`.
- **Estado y progreso:** `docs/04-bitacora.md` (actualízala al cerrar cada tarea relevante).

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
  Auto-descubre el binario versionado en `AppData/Roaming/Claude/claude-code/<ver>/claude.exe`
  (`src/core/ai/claude-cli.ts`).
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
  proyecto/[id]/page.tsx      Vista de proyecto: pipeline + logs + dossier (client, SSE)
  ajustes/                    Pantalla de conectores/API keys (REQ-008)
  api/
    projects/                 CRUD proyectos (POST crea+lanza run, DELETE, [id] GET/rerun)
    runs/[id]/stream/         Endpoint SSE del run
    dossier/[projectId]/      GET/PUT del dossier
src/components/               PipelineGraph, DossierEditor, RecentProjects
src/core/
  pipeline/                   req001.ts (define nodos), bus.ts (eventos), runner
  ai/claude-cli.ts            Motor Claude CLI (resolución de binario, exec con timeout)
  crawler/                    Crawl de la web
src/lib/                      prisma, vault (cifrado)
prisma/schema.prisma          Modelo de datos multiproyecto
```

---

## 6. Convenciones

- **Idioma:** español en UI, contenido y docs. Sin tildes en identificadores de código si complican.
- **Commits:** `tipo(REQ-00X): descripción` (feat/fix/docs). Co-autoría de Claude. Git + GitHub (cuenta `jechamo`).
- **SDD:** no escribir código de un REQ hasta que sus docs estén aprobados por el usuario.
- **Validación entre REQs:** el usuario prueba y aprueba cada requisito antes de pasar al siguiente.
- **Al terminar una tarea relevante:** anota en `docs/04-bitacora.md` (qué, estado, commit).

---

## 7. Estado actual (resumen — detalle en bitácora)

- **REQ-001** (análisis appweb → dossier): **implementado**, en fase de pruebas del usuario.
- **Siguiente:** REQ-002 (análisis de competencia) — empezar por docs de diseño/arquitectura del REQ.
