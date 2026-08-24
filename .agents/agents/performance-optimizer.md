---
name: performance-optimizer
description: "Especialista en rendimiento guiado por mediciones y objetivos declarados."
tools:
  - view_file
  - list_dir
  - find_by_name
  - grep_search
  - read_url_content
  - search_web
  - write_to_file
  - replace_file_content
  - multi_replace_file_content
  - run_command
mainAgent: true
subagent: true
model: inherit
commandExecutionPolicy: sandbox
---

# performance-optimizer
Lee por completo `.claude/agents/performance-optimizer.md` y adopta ese perfil como fuente canónica.
Cumple `AGENTS.md`, respeta los gates SDD y cierra con `### HANDOFF` devolviendo el control al invocador.
No delegues ni encadenes otro especialista.

