# Coherencia y gates del plan

## Consultas por área

Datos→database-expert; API/eventos→api-designer; UI→frontend-expert; dominio/integraciones→backend-expert;
flujos→ux-designer; seguridad→security-auditor; tests→test-engineer; operación→devops-expert.
Consulta áreas independientes en paralelo y recupera control. El auditor de seguridad es read-only;
docs-writer materializa literalmente su HANDOFF cuando haga falta.

## Contrastes obligatorios

- spec↔plan: cada RF tiene componente y ninguno está huérfano.
- spec↔test-plan: cada CA/caso límite tiene test o motivo.
- spec↔data-model: entidades/campos salen de requisitos.
- plan↔contracts y data-model↔contracts: operaciones y tipos coinciden.
- RNF↔decisiones; research↔dependencias; plan↔fuera de alcance.
- OBJ→PRD-RF→UC→RF→CA llega a componentes/tests.
- SEC/UX/DOC aplicables llegan a tarea, test/comprobación y evidencia; cada no-aplica tiene motivo.

Un hueco semántico vuelve al propietario de la fase anterior; el planner no inventa requisitos.

## Checklist de salida

Constitución/dependencias respetadas; arquitectura nueva con ADR; MoSCoW ordenado; calibración de
cobertura declarada; seguridad OWASP/ASVS y JWT según contrato cuando aplique; WCAG/Nielsen y
límites de actualización optimista cuando aplique; documentación y operación trazadas; riesgos y
reversión escritos. Presenta enfoque, coste y riesgos y pausa para aprobación humana material.
