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

**Gestor de paquetes:** pnpm (a confirmar; npm si prefieres). **Entorno:** Windows 11.

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

> Competidores (REQ-002) y Leads (REQ-003) ya están en el esquema. Virales (REQ-004) se añadirá al abordarlo.

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
| REQ-004 | connectors(gemini/APIs RRSS), pipeline |
| REQ-005 | ai, connectors(fal/heygen/elevenlabs), montage, pipeline |
| REQ-006 | crawler(Playwright móvil), ai, fal, elevenlabs, montage |
| REQ-007 | skills (catálogo/instalación) |
| REQ-008 | secrets, connectors (test), Ajustes UI |
| REQ-009 | UI (React Flow, carrusel 360, tema) |

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
