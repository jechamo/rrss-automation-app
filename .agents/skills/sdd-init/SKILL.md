---
name: sdd-init
description: Arranca un proyecto NUEVO con el baseline de producto aprobado. Define arquitectura y stack, crea la constitución, el ADR-0001 y el esqueleto de carpetas. Solo para greenfield; si producto está en bootstrap redirige a /sdd-intake.
---

# /sdd-init — Bootstrap de proyecto nuevo

**Solo para proyectos nuevos.** Si el repo ya tiene código, usa `/onboard`.
Agente responsable: `@architect`, con apoyo de `@bitacora-keeper`.

## Paso 0 — Verificación

Si existe `docs/architecture/constitution.md`, **para** y avisa: el proyecto ya está
inicializado. Ofrece `/sdd-specify` o `/sdd-status`.

Antes de decidir arquitectura, lee:

- `docs/product/PRD.md`;
- `docs/product/USE-CASES.md`;
- `docs/product/FEATURE-MAP.md`;
- `docs/product/SOURCES.md`.

Ejecuta `node scripts/sdd-project.mjs product-status --json`. El estado durable en
`.sdd/installed.json` debe ser `approved`; no deduzcas la aprobación solo de una palabra en el
PRD. Si `node scripts/check-sdd.mjs --strict` detecta drift de sus hashes, vuelve al gate humano
de `/sdd-intake` antes de continuar.

`PRD.md` debe registrar el mismo gate humano de producto con estado `approved`, fecha, actor y alcance.
Si el estado es `bootstrap`, `intake`, `pending-approval`, falta alguno de los cuatro documentos o
no hay aprobación explícita, **para y redirige a `/sdd-intake`**. No conviertas la entrevista de
arquitectura en un PRD improvisado ni simules la aprobación.

`legacy-pending` pertenece a adopciones brownfield: este comando no lo transforma ni reinicia. Si
aparece en un repositorio con código, usa `/onboard` y conserva su contexto.

## Paso 1 — Entrevista (máximo 8 preguntas, con opciones)

Parte del baseline aprobado y pregunta solo lo que **cambia la decisión arquitectónica**. No
vuelvas a pedir objetivos, requisitos o casos de uso ya confirmados. Ofrece siempre una
recomendación por defecto para que el usuario pueda decir "lo que tú veas".

1. Tipo de sistema: web app · API · móvil · CLI · data/ML · librería · monorepo con varios.
2. Escala esperada al año 1: usuarios concurrentes, volumen de datos, picos.
3. Equipo: tamaño, experiencia, stack que ya dominan.
4. Restricciones técnicas u operativas: cloud obligado, on-premise, presupuesto, normativa.
5. Nivel ASVS objetivo según los datos y riesgos ya descritos en producto.
6. Horizonte técnico: MVP para validar en semanas · producto a años.
7. Integraciones externas confirmadas y sus restricciones.
8. Requisitos operativos que sigan abiertos y condicionen la arquitectura.

Si el usuario no sabe algo, propón el default razonable y **márcalo como supuesto**.

## Paso 2 — Decisión de arquitectura

Aplica el árbol de decisión de `@architect` y de `docs/architecture/DECISION-GUIDE.md`.

Presenta al usuario: **opción recomendada + 1 alternativa seria**, con coste y consecuencias
de cada una en 5 líneas. Espera confirmación antes de escribir nada.

Relaciona la recomendación con `OBJ-*`, `PRD-RF-*`, `UC-*` y los cortes de `FEATURE-MAP.md`. La
aprobación de producto no sustituye este segundo gate humano: arquitectura y stack también deben
quedar confirmados explícitamente.

Recuerda la ley del proyecto: **monolito modular con fronteras hexagonales por defecto**.
Cualquier otra cosa necesita justificación explícita.

## Paso 3 — Artefactos

Crea, en este orden:

1. `docs/architecture/constitution.md` — estilo arquitectónico y por qué; C4 nivel 1 y 2 en
   mermaid; contextos acotados; reglas de dependencia; estructura de carpetas canónica;
   stack con versiones; estándares transversales (errores, logs, config, validación, auth,
   i18n); nivel ASVS objetivo; prohibiciones; cómo se modifica esta constitución.
2. `docs/architecture/adr/ADR-0001-arquitectura-inicial.md` (formato MADR).
3. `docs/architecture/adr/ADR-0002-stack-tecnologico.md`.
4. Rellena la tabla §1 de `AGENTS.md` (nombre, tipo, estado, arquitectura, stack).
5. Esqueleto de carpetas de código según la arquitectura elegida, con un `README.md` en cada
   carpeta raíz explicando qué va ahí y qué **no**.
6. `docs/quality/TEST-STRATEGY.md` adaptado al stack.
7. `docs/security/THREAT-MODEL.md` inicial (STRIDE sobre el diagrama C4 nivel 2).
8. Configuración base: linter, formateador, tipado estricto, runner de tests, hooks de
   pre-commit, `.gitignore`, `.env.example` (**sin valores reales**).
9. Pipeline de CI mínimo con los gates de `AGENTS.md` §7.
10. Primera entrada en `docs/bitacora/DECISIONS.md`.

## Paso 4 — Test de humo

Crea **un** test trivial que pase y ejecuta la suite. Pega la salida real.
Sirve para verificar que el andamiaje funciona antes de escribir nada de negocio.

## Paso 5 — Cierre

Indica `/docs-sync bootstrap` para preparar README, índice y contrato documental desde hechos
verificables, sin crear código ni imponer Swagger, Storybook o TypeDoc.

```
### HANDOFF
- Agente origen: architect
- Fase completada: init
- Baseline de producto: approved · <fecha/actor/alcance>
- Arquitectura elegida: <cuál> — motivo: <1 línea>
- Stack: <resumen>
- Artefactos: <lista de rutas>
- Supuestos asumidos: <lista>
- Siguiente agente sugerido: spec-analyst — comando: /sdd-specify
```

Termina diciendo al usuario: *"El proyecto está inicializado. Elegimos el primer corte vertical
aprobado de `FEATURE-MAP.md` y ejecutamos `/sdd-specify`."*
