# Bitácora de trabajo — RRSS Studio

> Registro vivo del progreso. Se actualiza al cerrar cada tarea relevante.
> Contexto operativo: `AGENTS.md`. Especificaciones: `docs/01..03`.

---

## Estado de los requisitos

| REQ | Nombre | Estado |
|-----|--------|--------|
| REQ-001 | Análisis de la appweb → dossier de negocio | 🟡 Implementado — en pruebas del usuario |
| REQ-002 | Análisis de competencia | ⚪ Pendiente (siguiente) |
| REQ-003 | Scraping de clientes potenciales + estrategia | ⚪ Pendiente |
| REQ-004 | Scraping de virales del nicho (YT/TikTok/IG) | ⚪ Pendiente |
| REQ-005 | Generación de vídeo (clonado de viral) | ⚪ Pendiente |
| REQ-006 | Generación de contenido propio de la app | ⚪ Pendiente |
| REQ-007 | Skills | ⚪ Pendiente |
| REQ-008 | Configuración de herramientas/APIs (Ajustes) | 🟡 Base construida (shell de Ajustes) |
| REQ-009 | Experiencia visual | 🟡 Transversal — grafo de nodos ya animado |

Leyenda: ⚪ pendiente · 🟡 en curso/parcial · 🟢 aprobado por el usuario

---

## Historial

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

**Pendiente de confirmar por el usuario:** que tras `iniciar.bat` en frío, un análisis "solo web"
va directo al flujo, sin error de "claude", con nodos actualizándose en vivo.

**Siguiente:** al validar REQ-001 → arrancar REQ-002 por sus docs (diseño/arquitectura del REQ).
Resolver antes DA-01 (cómo se descubren los competidores: búsqueda web IA / manual / directorios).
