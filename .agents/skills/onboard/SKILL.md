---
name: onboard
description: Documenta un repositorio existente que aún no tiene el circuito SDD. Reconstruye la arquitectura real, crea la constitución y deja el proyecto listo para trabajar con specs.
---

# /onboard — Adoptar un repo existente

Agentes: `@research-analyst` (investiga) → `@architect` (formaliza).

Este comando es el puente entre "un repo que ya existe" y "un repo que funciona con SDD".
**No refactoriza nada.** Documenta la realidad, incluso si la realidad es fea.

También **preserva el contexto**: no vacía, reemplaza ni reinterpreta como plantilla ningún PRD,
visión, caso de uso, feature map, fuente, spec, ADR, arquitectura, diseño, bitácora o changelog que
ya exista. Inventaría una historia distinta del proyecto.

## Paso 0 — ¿Está la estructura instalada?

Comprueba que existen `AGENTS.md`, `.claude/agents/` y `.sdd/territories.json`. Si falta alguno,
la estructura no está puesta y este comando no tiene dónde escribir:

Instala primero la distribución SDD desde una versión fijada por el equipo y vuelve a ejecutar
`/onboard`. El comando exacto pertenece a la guía de distribución, no al proyecto instalado.

Y avisa de lo que casi siempre se olvida tras instalar: **`.sdd/territories.json` nace en modo
`audit` y sin rutas de aplicación asumidas**. Detectar la estructura real y proponer territorios
concretos es parte de tu trabajo en la fase 3.

## Fase 1 — Investigación (`@research-analyst`)

1. **Contexto de producto**: inventaría, sin sobrescribir, `docs/product/`, PRD/visión existentes,
   specs, documentación funcional y diseños. Registra qué existe, procedencia, estado y huecos.
2. **Superficie**: README, manifiestos de dependencias, scripts, Dockerfile, CI, `.env.example`.
3. **Estructura**: árbol de 2 niveles. ¿Organización por capas, por features o por tipo?
4. **Arquitectura real** (no la declarada): grafo de imports. ¿El dominio conoce la
   infraestructura? ¿Dónde está de verdad la lógica de negocio?
5. **Puntos de entrada**: rutas HTTP, CLI, consumidores de cola, cron, webhooks.
6. **Datos**: esquema, migraciones, ORM, dónde se construyen las consultas.
7. **Tests**: qué hay, qué cubren, cuánto tardan, qué no está probado.
8. **Generación existente**: scripts que ya generan OpenAPI, DTO, tipos, clientes o docs. Propón
   entradas para `.sdd/generators.json`, pero no las actives ni apruebes automáticamente.
9. **Historia**: `git log` — zonas calientes (los ficheros que cambian siempre suelen ser
   los peor diseñados), autores, ritmo.
10. **Riesgos**: dependencias sin mantenimiento o con CVEs, secretos en el repo, versiones EOL,
   TODOs antiguos, código muerto, ausencia de CI.

Entregable: `docs/architecture/CURRENT-STATE.md` con el mapa, diagrama C4 nivel 2 en mermaid,
y riesgos priorizados. **Separa lo observado de lo inferido.**

## Fase 2 — Formalización (`@architect`)

1. Crea `docs/architecture/constitution.md` describiendo la arquitectura **que hay**,
   no la ideal. Marca explícitamente las desviaciones como deuda conocida.
2. `ADR-0001-arquitectura-heredada.md`: contexto, qué se encontró, qué se acepta y qué se
   quiere cambiar, con condiciones para revisarlo.
3. Rellena la tabla §1 de `AGENTS.md`.
4. Si hay divergencia entre lo que el equipo cree y lo que el código hace, **dilo en voz alta**:
   suele ser el hallazgo más valioso de todo el onboarding.

## Fase 3 — Andamiaje SDD

1. Crea `docs/specs/`, `docs/bitacora/`, `docs/quality/`, `docs/security/` si no existen. Si ya
   contienen material, consérvalo íntegramente; el onboarding solo añade lo que falta.
2. Primera entrada en `docs/bitacora/DECISIONS.md`: "adopción del circuito SDD, estado inicial".
3. Documenta el backlog de deuda encontrado en `docs/quality/TECH-DEBT.md`, priorizado por
   riesgo × frecuencia de cambio.
4. Si no hay CI con gates, propón el pipeline mínimo (`@devops-expert`).

## Estado de producto brownfield

Si el baseline universal de producto no existe o está incompleto, conserva el estado
`legacy-pending` de la instalación y muestra un aviso; **no bloquees el onboarding ni los checks
existentes**. No fabriques `OBJ-*`, `PRD-RF-*` o `UC-*` a partir de inferencias para aparentar
cobertura.

Si ya existen documentos de producto, úsalos como evidencia observada y mantenlos sin reescribir.
Al cerrar, recomienda `/sdd-intake` para normalizar las fuentes y aprobar el baseline de forma
controlada. El original no se copia ni se mueve salvo petición explícita.

## Fase 4 — Retro-especificación (opcional, bajo demanda)

**No** especifiques retroactivamente todo el sistema: es trabajo enorme y de valor bajo.
Especifica solo lo que vayas a tocar, cuando lo vayas a tocar.

## Cierre

Deriva a `/docs-sync bootstrap` para proponer el mapa documental brownfield. Conserva todos los
documentos existentes; el estado permanece `legacy-pending` hasta aprobación humana.

```
### HANDOFF
- Agente origen: architect (tras research-analyst)
- Fase completada: onboard
- Artefactos: CURRENT-STATE.md, constitution.md, ADR-0001, TECH-DEBT.md
- Arquitectura real detectada: <cuál>
- Riesgos críticos: <lista>
- Divergencias entre lo declarado y lo real: <lista>
- Contexto de producto preservado: <rutas y estado>
- Estado de producto: <approved | legacy-pending>
- Siguiente agente sugerido: orchestrator — comando: /sdd-intake si legacy-pending;
  spec-analyst — comando: /sdd-specify si approved
```
