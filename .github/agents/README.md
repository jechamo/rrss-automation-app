# Agentes para GitHub Copilot y VS Code

## Por qué hay dos carpetas de agentes

| Carpeta | La leen | Contenido |
|---|---|---|
| `.claude/agents/*.md` | **Claude Code** y **VS Code** (Copilot lo soporta como ubicación alternativa) | **Perfiles canónicos completos.** Aquí vive la definición real de los 20 agentes |
| `.github/agents/*.agent.md` | **Copilot** (VS Code, Visual Studio, Copilot CLI y agente en la nube) | **Envoltorios finos** que apuntan al perfil canónico y añaden `handoffs`, que es una función propia de VS Code |

La regla: **una sola fuente de verdad**. Los envoltorios no duplican el contenido, lo
referencian. Si cambias un comportamiento, cámbialo en `.claude/agents/`.

## Envoltorios disponibles

Solo los agentes del eje principal del circuito SDD, que son los que se seleccionan a mano
desde el picker:

**Los 20.** Y tiene que ser así, por un motivo concreto.

VS Code lee `.github/agents/` **y además** `.claude/agents/`, y **no deduplica por nombre**
([bug conocido](https://github.com/microsoft/vscode/issues/312256)). Con los 20 agentes en las dos
carpetas, el selector los mostraba **dos veces cada uno**.

`.vscode/settings.json` lo resuelve desactivando la lectura de `.claude/agents`:

```jsonc
"chat.agentFilesLocations": {
  ".github/agents": true,
  ".claude/agents": false
}
```

Se desactiva esa y no la otra porque los envoltorios llevan dos campos que **solo entiende VS
Code** y que no caben en el perfil canónico:

| Campo | Para qué |
|---|---|
| `handoffs:` | Botones que pasan el trabajo al siguiente agente del circuito |
| `agents:` | **Lista blanca de a quién puede delegar cada uno** |

El segundo es el que impide que el orquestador programe o que un especialista llame a quien no le
toca. Perderlo sería perder el aislamiento en VS Code.

**Consecuencia**: a partir de este ajuste, un agente sin envoltorio **no existe** en VS Code.
Por eso `scripts/check-sdd.mjs` falla si falta alguno.

Su procedimiento de trabajo vive en las 27 skills, que **sí son portables sin duplicar**:
`/sdd-intake`, `/middle`, `/front` y `/bbdd` valen igual aquí que en Claude Code, Cursor o Codex.

Las skills canónicas están en `.agents/skills/*/SKILL.md` y aparecen directamente como
comandos `/` en VS Code y Copilot. No se mantienen prompts paralelos con el mismo nombre,
porque ambas entradas aparecerían duplicadas en el selector.

`/sdd-intake` no tiene prompt propio: cuando llega un PRD en texto/ruta/carpeta/URL o un diseño
opcional, el `orchestrator` coordina los perfiles existentes `spec-analyst`, `ux-designer` y de
nuevo `spec-analyst`. Se mantienen 20 agentes; intake es una fase, no un agente número 21.

## Handoffs

El campo `handoffs` del frontmatter genera botones en el chat de VS Code para pasar el
trabajo al siguiente agente del circuito. Con `send: false` el prompt se rellena pero no se
envía: te da oportunidad de revisarlo antes.

Es la implementación de VS Code del protocolo de handoff descrito en
[`AGENTS.md`](../../AGENTS.md) §10.

El bloque durable incluye fuentes, artefactos, requisitos/casos cubiertos, discrepancias,
decisiones, supuestos, bloqueos y el siguiente comando/contexto. Si un botón o la delegación no
están disponibles, se muestra el agente/comando exacto y la siguiente fase relee los documentos
del repositorio. El contexto efímero del chat no es un mecanismo de continuidad.

## Otros ficheros de esta carpeta

| Ruta | Función |
|---|---|
| `.github/copilot-instructions.md` | Instrucciones de repo, siempre activas |
| `.github/instructions/*.instructions.md` | Instrucciones por glob (`applyTo`) |
| `.agents/skills/*/SKILL.md` | Skills portables: el circuito SDD como comandos `/` |
| `.github/workflows/` | CI con los gates de calidad |
