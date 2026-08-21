# Documentación viva y versionada

Esta guía explica cómo mantener la documentación oficial de un proyecto instalado con la
plantilla. El objetivo es que un `git clone` recupere el contexto compartido sin copiar secretos,
estado local ni artefactos que se pueden regenerar.

## Primera puesta a punto

Después de instalar, crea un baseline documental a partir de hechos comprobables:

```text
Greenfield: /sdd-intake → /sdd-init → /docs-sync bootstrap
Brownfield: /onboard → /docs-sync bootstrap
```

`bootstrap` inventaría lo que ya existe. No crea código, contratos, Swagger, Storybook ni
TypeDoc. El resultado queda pendiente hasta que una persona lo revise y apruebe.

```powershell
node scripts/sdd-project.mjs docs-status --json
node scripts/sdd-project.mjs approve-docs --approved-by "<persona>" --json
```

No ejecutes `approve-docs` para silenciar un gate. Antes comprueba que `.sdd/docs.json` describe
las superficies reales, sus fuentes, artefactos, propietarios y comandos.

## Qué se sube al repositorio

Versiona todo lo necesario para reconstruir el proyecto y su forma de trabajo:

- Código, tests, contratos y fuentes de documentación generada.
- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, perfiles de agentes, skills, reglas, workflows y hooks.
- Configuración compartida y segura de Claude, GitHub/VS Code, Cursor, Codex, Gemini CLI y
  Antigravity.
- `.sdd/checks.json`, `.sdd/docs.json`, `.sdd/territories.json` y `.sdd/installed.json`.
- `.sdd/agent-audit.jsonl` y los `execution-log.jsonl` de las specs como evidencia durable.
- Specs, planes, tareas, evidencias, informes, README, ADR, guías, runbooks, documentación de
  API y CI/CD, changelog y bitácora.
- `.env.example`, únicamente con nombres y explicaciones; nunca con valores secretos.

Revisa esos cambios y haz un commit deliberado. El instalador no ejecuta `git add`, commit ni
push.

## Qué permanece local

No subas:

- `.env`, tokens, claves, certificados, credenciales MCP ni otros secretos.
- Preferencias personales, estados de confianza del IDE, `.claude/settings.local.json`,
  `.cursor/local/` o `.idea/`.
- `.sdd/state/`, `.sdd/conflicts/`, cachés, dependencias, cobertura, logs y resultados temporales.
- Builds de Swagger UI, Storybook, TypeDoc o del sitio documental, salvo que el proyecto decida
  explícitamente que uno de ellos es una fuente versionada.
- Worktrees, ramas locales o estado efímero de subagentes.

Una configuración MCP compartida solo referencia variables de entorno. Las credenciales se
configuran en cada equipo.

## Elegir el circuito correcto

Una tarea editorial no necesita una spec funcional ni TDD de aplicación:

```text
"Corrige el README"                    → /docs-sync update
"Documenta este endpoint existente"   → /docs-sync update
"Registra una decisión ya tomada"     → propietario de bitácora o ADR
"Cambia el endpoint y documéntalo"     → /sdd-specify + TDD
"Decidamos una arquitectura nueva"    → architect + ADR
```

Si documentar exige cambiar comportamiento, contrato público, arquitectura, seguridad o
persistencia, `/docs-sync` se detiene y devuelve el control al circuito SDD/TDD. El escritor no
toma esa decisión ni cambia código.

Cuando el cambio ya tiene spec, la documentación forma parte del mismo PR:

```text
spec → impacto documental → plan → tarea de código
     → tarea documental → verify → ship
```

Cada superficie aplicable mantiene la cadena:

```text
DOC-ID → tarea → artefacto → comprobación → evidencia
```

Código y documentación pueden estar en commits distintos, pero deben llegar juntos al PR.

## Modos de `/docs-sync`

| Comando | Cuándo usarlo | Escritura |
|---|---|---|
| `/docs-sync bootstrap` | Primera reconstrucción documental de un proyecto | Propone un baseline; requiere aprobación |
| `/docs-sync update --spec NNN` | Documentación comprometida por una spec aprobada | Solo los `DOC-ID` declarados |
| `/docs-sync update` | Corrección o actualización manual sin cambio de comportamiento | Sí, en superficies del propietario |
| `/docs-sync audit` | Buscar deriva, enlaces rotos o gates ausentes | No; entrega un informe |

La implementación canónica vive en `.agents/skills/docs-sync/`. Los hosts usan esa fuente o un
adaptador mínimo; no se crean comandos paralelos con el mismo nombre.

## Quién mantiene cada documento

| Superficie | Propietario |
|---|---|
| Contratos OpenAPI, AsyncAPI o GraphQL | `api-designer` |
| Narrativa y guías de API | `docs-writer` |
| ADR y constitución | `architect` |
| Stories y catálogo de componentes | `frontend-expert` o `implementer` |
| JSDoc/TSDoc de una interfaz | Implementador propietario |
| README y guías de usuario/desarrollo | `docs-writer` |
| Runbooks y documentación CI/CD | `devops-expert` |
| Changelog y resumen de entrega | `release-manager` |
| Bitácora | `bitacora-keeper` |

`docs-writer` devuelve producto, specs, ADR, diseño, bitácora, changelog y comentarios internos a
su propietario. No existe un segundo agente documental.

## Gates y momento de ejecución

| Momento | Gate | Qué comprueba |
|---|---|---|
| Antes del commit | `node scripts/sdd-project.mjs run --fast` | Esquema, rutas, enlaces, placeholders y trazabilidad rápida |
| Antes del push | `node scripts/sdd-project.mjs run --slow` | Gates lentos configurados y generación documental |
| Pre-push documental | `node scripts/check-sdd.mjs --docs-diff --base <sha>` | Cambio agregado de código y docs contra la base exacta |
| CI | workflow SDD | Validación autoritativa contra el SHA base del PR |
| Ship | `/sdd-ship` | Bloquea documentación aplicable pendiente |

Si la base Git no se puede resolver, el diff documental falla como `NO EJECUTADO`; no lo presenta
como verde. Si un host no ejecuta hooks, lanza los comandos manualmente.

Los hooks Git se instalan como ficheros compartidos, pero se activan de forma explícita:

```powershell
git config core.hooksPath .sdd/githooks
git update-index --chmod=+x .sdd/githooks/pre-commit .sdd/githooks/pre-push
```

El instalador muestra estas instrucciones. No cambia la configuración Git ni los permisos por su
cuenta.

## Herramientas documentales opt-in

La plantilla no instala Swagger, Storybook, TypeDoc ni un generador universal. Solo configura un
gate si el proyecto ya dispone de un comando real:

- `docs:openapi`
- `docs:storybook`
- `docs:typedoc`
- `docs:links`

`node scripts/sdd-project.mjs detect --json` propone únicamente comandos detectados. Revisa la
propuesta antes de incorporarla con `configure --accept-detected`.

`/docs-sync audit` consume `node scripts/check-sdd.mjs --json` y, cuando hay una spec concreta,
`node scripts/sdd-project.mjs trace-status --spec NNN --json`. Estas salidas conservan el
veredicto real y permiten localizar deriva sin releer todo el árbol ni modificar documentos. El
scaffold de `evidence.md` solo crea la estructura después de los gates; no declara resultados.

## Trabajo en paralelo

El orquestador puede paralelizar inventarios y auditorías de solo lectura. Las escrituras se
ejecutan en serie salvo que todas estas condiciones se cumplan:

1. Las tareas están marcadas `[P]`.
2. Los ficheros son disjuntos.
3. Cada escritor está aislado en su propia rama o worktree.
4. Un responsable reconcilia el resultado y ejecuta los gates sobre el árbol final.

Un agente especialista siempre devuelve `HANDOFF` al invocador; no encadena otro especialista.

## Continuar en otro equipo

Un `git clone` recupera documentación, historia SDD, agentes, skills, reglas y hooks versionados.
En el nuevo equipo todavía debes instalar el IDE y sus extensiones, configurar credenciales
locales, confiar en el workspace, recargar la ventana y activar los hooks Git si los quieres usar.
