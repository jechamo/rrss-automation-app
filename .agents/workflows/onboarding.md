# Workflow: adoptar un repositorio existente

Para un repo que ya tiene código pero **no** tiene el circuito SDD.
**No refactoriza nada**: documenta la realidad, aunque la realidad sea fea.

Reglas del proyecto: @AGENTS.md · Detalle: @.agents/skills/onboard/SKILL.md

---

## 0. Preservar y clasificar producto

No sobrescribas PRD, visión, casos, arquitectura, diseño ni specs existentes. Si el usuario aporta
un PRD global o diseño opcional, el `orchestrator` ejecuta `/sdd-intake` primero y después reanuda
`/onboard` leyendo `docs/product/`. Si no hay baseline, conserva el estado `legacy-pending` como
aviso no bloqueante: onboarding documenta la realidad técnica, no inventa producto.

Si el host no delega, muestra perfil/comando exactos y usa el handoff durable; no dependas del
contexto del chat.

## 1. Investigar

Adopta el perfil de @.claude/agents/research-analyst.md. **Solo lectura.**

1. Superficie: README, manifiestos, scripts, Dockerfile, CI, `.env.example`.
2. Estructura: árbol de 2 niveles. ¿Organización por capas, por features o por tipo?
3. Arquitectura **real** (no la declarada): grafo de imports. ¿El dominio conoce la
   infraestructura? ¿Dónde está de verdad la lógica de negocio?
4. Puntos de entrada: rutas HTTP, CLI, colas, cron, webhooks.
5. Datos: esquema, migraciones, ORM, dónde se construyen las consultas.
6. Tests: qué hay, qué cubren, cuánto tardan, qué no está probado.
7. Historia (`git log`): zonas calientes — los ficheros que cambian siempre suelen ser los
   peor diseñados.
8. Riesgos: CVEs, dependencias abandonadas, secretos en el repo, versiones EOL, código muerto.

Entregable: `docs/architecture/CURRENT-STATE.md` con mapa, C4 nivel 2 en mermaid y riesgos
priorizados. **Separa lo observado de lo inferido.**

## 2. Formalizar

Adopta el perfil de @.claude/agents/architect.md.

- `docs/architecture/constitution.md` describiendo la arquitectura **que hay**, con las
  desviaciones marcadas como deuda conocida.
- `ADR-0001-arquitectura-heredada.md`.
- Rellena la tabla §1 de @AGENTS.md.
- Si lo que el equipo cree diverge de lo que el código hace, **dilo en voz alta**: suele ser
  el hallazgo más valioso del onboarding.

## 3. Andamiaje

- Crea `docs/specs/`, `docs/bitacora/`, `docs/quality/`, `docs/security/`.
- Primera entrada en `DECISIONS.md`: adopción del circuito SDD y estado inicial.
- `docs/quality/TECH-DEBT.md` priorizado por riesgo × frecuencia de cambio.
- Si no hay CI con gates, propón el pipeline mínimo.

## 4. Retro-especificación (solo bajo demanda)

**No** especifiques retroactivamente todo el sistema: coste enorme, valor bajo.
Especifica solo lo que vayas a tocar, cuando lo vayas a tocar.

---

Siguiente paso: @.agents/workflows/sdd-nueva-funcionalidad.md

Cierra cada fase con el HANDOFF ampliado de AGENTS.md y respeta los gates humanos aplicables.
