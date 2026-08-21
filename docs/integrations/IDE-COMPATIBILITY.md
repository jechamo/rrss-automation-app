# Compatibilidad de hosts

| Capacidad | Claude | VS Code/Copilot | Cursor | Antigravity | Codex |
|---|---|---|---|---|---|
| Reglas SDD | `CLAUDE.md` → `AGENTS.md` | instrucciones GitHub → `AGENTS.md` | reglas → `AGENTS.md` | `GEMINI.md` → `AGENTS.md` | `AGENTS.md` nativo |
| Agentes | `.claude/agents` | `.github/agents` | `.cursor/agents` | adopción de perfil | `.codex/agents` |
| Skills | adaptadores Claude | `.agents/skills` | `.agents/skills` | `.agents/skills` | `.agents/skills` |
| Hooks | contrato Claude | contrato GitHub | contrato Cursor | contrato Antigravity | contrato Codex |
| Gate común | `scripts/check-sdd.mjs` | igual | igual | igual | igual |

Los contratos de fichero se validan determinísticamente. Una capacidad de hook o delegación solo
se considera verificada en vivo después de un smoke real en la versión concreta del host. Sin ese
smoke, usa `declared-direct` y deja que CI sea el juez.
