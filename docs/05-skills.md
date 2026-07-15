# Catálogo de Skills — RRSS Studio (REQ-007, pase de curación)

> Fuente de verdad del **toolkit de skills** del proyecto. Resuelve **DA-06**.
> Contexto operativo: `AGENTS.md`. Requisitos: `docs/01-requisitos.md §REQ-007`.
> Estado: pase de curación v1 (2026-07-15). La *feature* de UI de REQ-007 (catálogo dentro
> de la app) queda **aplazada** hasta que existan los REQs que la consumen (003–006).

---

## 1. Qué es un "skill" aquí (DA-06 resuelto)

**Skill = capacidad del entorno de Claude Code**, no una pantalla de la app. Dos tipos:

1. **Skills de proyecto** (`.claude/skills/<nombre>/SKILL.md`): conocimiento de dominio
   escrito a mano. Se auto-descubren **sin red, sin plugin, sin reinicio** y los carga
   tanto mi sesión interactiva como el **motor headless de la app** (`claude -p`, que corre
   con `cwd` = raíz del proyecto). Son el toolkit del motor **disponible hoy**.
2. **Plugins del marketplace** (`anthropics/claude-plugins-official`): skills + MCP + comandos
   empaquetados por proveedor/funcionalidad. Muchos requieren **red** para instalarse y
   **API key + servidor MCP** para funcionar. Se instalan **curados** (revisados uno a uno),
   nunca de forma automática.

**Política de instalación:** curada/revisada. Nada se instala "en masa".

---

## 2. Skills de proyecto (creados en este pase) — cargados por el motor

| Skill (`.claude/skills/…`) | Alimenta | Qué aporta |
|---|---|---|
| `rrss-lead-research` | **REQ-003** | Buyer personas, segmentación por intención, fuentes de leads, cualificación FIT+INTENT desde dossier+competencia. |
| `rrss-viral-analysis` | **REQ-004** | Descompone virales (hook/retención/estructura/formato), define criterio de "viral", extrae patrones transferibles. |
| `rrss-content-generation` | **REQ-005/006** | Guiones short-form + copy por plataforma con hooks, CTAs y tono de marca del dossier. |

> ⚠️ **Activación en el motor (importante):** en modo `-p` headless los skills de proyecto se
> **descubren**, pero para que el modelo **auto-invoque** un skill sin colgarse en el prompt de
> permisos, la llamada `claude -p` debe pasar `--allowedTools "Skill"` (o
> `--permission-mode bypassPermissions`). Hoy `src/core/ai/claude-cli.ts` **no** los pasa.
> - **Plan A (recomendado, mejora futura):** añadir `--allowedTools "Skill"` en `run()` de
>   `claude-cli.ts` y verificar en la app (necesita red del server; no se puede probar desde
>   la shell del agente).
> - **Plan B (siempre válido):** en cada REQ, **referenciar el conocimiento del skill en el
>   prompt** del pipeline (el SKILL.md es la fuente canónica del texto). Así el motor lo usa
>   aunque no auto-invoque la herramienta.

---

## 3. Plugins recomendados que requieren red — los instala el usuario

La shell del agente **no tiene red** (AGENTS.md §2), así que estos se instalan **en tu máquina**.
Comando por plugin (uno a uno, cuando el REQ lo necesite):

```
/plugin install <nombre>@claude-plugins-official
```

| REQ | Plugin | Alternativas | Aporta |
|---|---|---|---|
| **REQ-003** leads | `apollo` | `lusha`, `vibe-prospecting`, `zoominfo` | Prospección y enriquecimiento de leads B2B. |
| **REQ-004** virales | `brightdata-plugin`, `exa` | `youdotcom-agent-skills` | Scraping web + búsqueda/extracción de contenido. |
| **REQ-005** vídeo | `runway-api`, `hyperframes` (HeyGen) | `togetherai-skills` | Generación de vídeo/ads e IA de vídeo. |
| **REQ-006** contenido | `canva`, `cloudinary` | `adobe-for-creativity`, `figma` | Diseño/gráficos de RRSS y gestión de media. |
| Publicación | `postiz` | — | Scheduling y publicación multi-RRSS. |

> Cada uno trae su MCP + API key propia; su **integración real** va en el REQ correspondiente
> (y las keys en REQ-008 Ajustes). Instalarlos ahora sirve para **informar el diseño**.

## 4. Plugins dev útiles (ya locales, sin red) — opcionales, mejoran cómo se construye

Activar con `/plugin` cuando quieras. No son de RRSS pero ayudan al desarrollo:

| Plugin | Uso en el proyecto |
|---|---|
| `frontend-design` | Interfaces distintivas (REQ-009 experiencia visual). |
| `feature-dev` | Flujo de desarrollo de features por REQ. |
| `code-review`, `code-simplifier`, `pr-review-toolkit` | Calidad/revisión antes de commit. |
| `playwright` (external) | Crawler / grabación móvil (REQ-001/006). |
| `skill-creator` | Crear/afinar más skills de proyecto. |

---

## 5. Cómo evolucionar este catálogo

- Al abordar un REQ: revisar su fila, instalar el plugin de red si aplica, y **enriquecer el
  skill de proyecto** correspondiente con lo aprendido.
- Si un skill de proyecto crece mucho o se reutiliza fuera, considerar empaquetarlo como plugin.
- Mantener esta tabla y `AGENTS.md §7` sincronizados.
