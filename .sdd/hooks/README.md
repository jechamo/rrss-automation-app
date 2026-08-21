# Hooks

Implementados en **Node ≥ 18** (`.mjs`, sin dependencias) para que funcionen igual en
Windows, macOS y Linux. Cada host los registra en su adaptador: `.claude/settings.json`,
`.cursor/hooks.json`, `.agents/hooks.json`, `.codex/hooks.json` o `.github/hooks/sdd.json`.

| Fichero | Evento | Qué hace | Decisión |
|---|---|---|---|
| `session-context.mjs` | `SessionStart` | Inyecta arquitectura, spec activa, tareas y últimas decisiones | — |
| `sdd-router.mjs` | `UserPromptSubmit` | Detecta la intención y recuerda la fase SDD correcta | — |
| `guard-write.mjs` | `PreToolUse` (Edit\|Write\|MultiEdit\|NotebookEdit) | `.env`, secretos, artefactos generados, lockfiles, bitácora de ejecución → `deny`. Agentes, skills, hooks, constitución y `.mcp.json` → `ask` | `deny` / `ask` / `allow` |
| `guard-bash.mjs` | `PreToolUse` (Bash) | Destructivo sin retorno → `deny`. Push, commit, IaC, kubectl, publicación → `ask` | `deny` / `ask` / `allow` |
| `format-and-lint.mjs` | `PostToolUse` (Edit\|Write\|MultiEdit) | Formatea y linta el fichero tocado con la herramienta que detecte | Devuelve el error a Claude |
| `subagent-log.mjs` | `SubagentStart` · `SubagentStop` | Registra qué subagente arrancó y terminó en `execution-log.jsonl` | — |
| `session-log.mjs` | `Stop` | Registra la sesión en `docs/bitacora/sessions/YYYY-MM.md` | — |

## Protocolo

Cada hook recibe un JSON por **stdin** (`session_id`, `cwd`, `tool_name`, `tool_input`,
`prompt`, …) y responde de una de dos formas:

**Por código de salida** — para hooks que solo informan:
- `0` — permite. En `SessionStart` y `UserPromptSubmit`, lo escrito en **stdout** se añade
  al contexto de la conversación.
- `2` — **bloquea**. Lo escrito en **stderr** lo ve Claude para corregirse.
- Cualquier otro código — error del hook; no bloquea nada.

**Por JSON en stdout** — lo que usan las guardas, porque permite tres decisiones y no dos:

```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"..."}}
```

`deny` bloquea · **`ask` escala al humano** · `allow` deja pasar. La distinción importa:
bloquear un `terraform apply` legítimo frustra, y dejarlo pasar sin preguntar arruina.

## Portabilidad entre hosts

`toolCall()` en `_lib.mjs` normaliza las formas de payload soportadas:

| Host | Forma del payload | Forma de la respuesta |
|---|---|---|
| Claude Code, Copilot | `{ tool_name, tool_input }` | `hookSpecificOutput.permissionDecision` |
| Antigravity | `{ toolCall: { name, args } }` | `{ decision, reason }` con `force_ask` |
| Cursor | Payload plano del evento | `{ continue, permission, agentMessage }` |
| Codex | Payload de hook de proyecto | `hookSpecificOutput`; un `ask` se convierte en `deny` y exige reintento humano |

Las rutas y comandos se extraen recursivamente por nombre de clave (`path`, `file`, `target`,
`command`, …), así que los hooks no dependen del nombre exacto que cada IDE dé a su herramienta
de escritura.

## Trazabilidad de subagentes

`subagent-log.mjs` existe porque la narración del chat no demuestra nada: que el modelo escriba
*"ahora el `backend-expert` implementa…"* no prueba que se creara ese subagente. Los eventos
`SubagentStart`/`SubagentStop` los emite el **host**, no el modelo, y por eso valen como evidencia.

Escribe en `docs/specs/NNN-slug/execution-log.jsonl`, o en `.sdd/agent-audit.jsonl` si no hay
spec activa. `guard-write.mjs` **impide que un agente reescriba esos ficheros**: si el propio
agente pudiera editar su registro, el registro no serviría de nada.

La selección se hace por bloques `### T-*`: una única spec con tareas `pendiente` o `en curso`
recibe el evento. Con cero candidatas se declara `sin-spec-activa`; con varias,
`spec-activa-ambigua`. `_TEMPLATE`, carpetas no canónicas y tareas ya hechas no participan.

`SDD_SPECS_DIR` puede señalar una carpeta relativa personalizada. El resolver la confina al
repositorio y descarta rutas absolutas, traversal y enlaces que escapen de la raíz.

Una atribución histórica errónea se corrige de forma append-only con
`node scripts/sdd-project.mjs trace-correct`; consulta [`.sdd/README.md`](../README.md) para el
contrato y el ejemplo. Nunca edites un JSONL a mano.

Donde el host no emita esos eventos, la trazabilidad degrada a `declared-direct` y hay que
documentarlo. Eso es una limitación real, no un fallo de la plantilla.

## Desactivar temporalmente

```bash
SDD_GATES=off
```

Desactiva los gates contextuales, como territorios y escalado de política. Las prohibiciones
incondicionales —`.env`, credenciales, material criptográfico o comandos destructivos— siguen
activas. Úsalo con cabeza y vuelve a activarlo.

## Probar un hook a mano

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"git push --force"}}' | node .sdd/hooks/guard-bash.mjs
```

Debe devolver un JSON con `"permissionDecision":"ask"`. Cambia el comando por uno destructivo
y debe devolver `"deny"`; por `npm test` y debe devolver `"allow"`.

> Ojo al probar desde el propio Claude Code: si el comando de prueba contiene el patrón
> peligroso, la guarda bloquea **tu propio comando de prueba**. Es señal de que funciona.
> Para evitarlo, mete los payloads en un fichero `.mjs` y ejecútalo.

## Añadir uno nuevo

1. Crea `.sdd/hooks/<nombre>.mjs` importando las utilidades de `_lib.mjs`.
2. Regístralo en cada adaptador de host aplicable.
3. Un hook **nunca** debe romper la sesión: envuelve en `try/catch` todo lo que toque disco
   o procesos externos.
