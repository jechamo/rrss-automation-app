# Workflow: proyecto nuevo (circuito A)

Flujo para arrancar un proyecto **desde cero**. Si el repo ya tiene código, usa
@.agents/workflows/onboarding.md.

Reglas del proyecto: @AGENTS.md

---

## 1. Intake — aprobar el producto

Coordina con el perfil @.claude/agents/orchestrator.md y ejecuta `/sdd-intake` siguiendo
@.agents/skills/sdd-intake/SKILL.md. Acepta PRD en texto, fichero, carpeta, URL o dentro del repo;
el diseño de Stitch/Figma, un boceto o una descripción es opcional.

El orquestador coordina `spec-analyst` → retorno → `ux-designer` → retorno → `spec-analyst`.
Los especialistas no se delegan entre sí. Produce `docs/product/PRD.md`, `USE-CASES.md`,
`FEATURE-MAP.md` y `SOURCES.md`, registra discrepancias y pausa en el gate humano de producto.
No genera código, arquitectura ni MCP. Si no hay delegación automática, muestra perfil y comando
exactos y reanuda desde esos documentos y `docs/design/INTAKE-REVIEW.md`, si existe.

Sin aprobación explícita del producto no se entra en el paso 2.

## 2. Init — decidir la arquitectura

Adopta el perfil de @.claude/agents/architect.md.
Procedimiento detallado: @.agents/skills/sdd-init/SKILL.md

### 2.1 Entrevista (máximo 8 preguntas, con opciones y recomendación)

Parte del baseline de producto aprobado. Pregunta solo por decisiones arquitectónicas: tipo
(web/API/móvil/CLI/data/librería) · escala al año 1 · equipo (tamaño y experiencia) · restricciones
(cloud, presupuesto, normativa) · datos sensibles (nivel ASVS) · horizonte · integraciones.

### 2.2 Decisión

Recorre el árbol de decisión. Presenta **la opción recomendada + 1 alternativa seria**, con
coste y consecuencias. **Espera confirmación antes de escribir nada.**

Ley del proyecto: **monolito modular con fronteras hexagonales** por defecto.
Microservicios prohibidos sin CI/CD, observabilidad y ownership por equipo.

### 2.3 Artefactos

- `docs/architecture/constitution.md` — estilo, C4 nivel 1 y 2 en mermaid, contextos acotados,
  reglas de dependencia, estructura de carpetas, stack con versiones, estándares transversales,
  nivel ASVS, prohibiciones
- `docs/architecture/adr/ADR-0001-arquitectura-inicial.md`
- `docs/architecture/adr/ADR-0002-stack-tecnologico.md`
- Tabla §1 de @AGENTS.md rellenada
- Esqueleto de carpetas con un README por capa (qué va ahí y qué **no**)
- `docs/quality/TEST-STRATEGY.md` y `docs/security/THREAT-MODEL.md`
- Linter, formateador, tipado estricto, runner de tests, `.gitignore`, `.env.example` sin valores
- CI con los gates de AGENTS.md §7
- Primera entrada en `docs/bitacora/DECISIONS.md`

### 2.4 Test de humo

Un test trivial que pase. **Ejecuta y pega la salida real.** Verifica el andamiaje antes de
escribir nada de negocio.

---

## 3. Primera funcionalidad

A partir de aquí, sigue @.agents/workflows/sdd-nueva-funcionalidad.md desde el paso 1.

El `architect` **ya no interviene** salvo que un cambio toque fronteras.

---

Cierra cada paso con el bloque `### HANDOFF` ampliado de AGENTS.md. El circuito completo pausa
en los seis gates humanos definidos en `docs/sdd/OPERATING-MODEL.md`.
