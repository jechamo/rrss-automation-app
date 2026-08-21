---
name: sdd-clarify
description: Resuelve las ambigüedades de una spec. Recorre los marcadores [NEEDS CLARIFICATION], pregunta al humano con opciones concretas y actualiza la spec. Gate obligatorio antes de planificar.
---

# /sdd-clarify — Cerrar ambigüedades

Agente responsable: `@spec-analyst`.

Esta fase existe porque **el coste de una ambigüedad crece por diez en cada fase**.
Resolverla aquí cuesta una pregunta; en implementación cuesta una semana.

## Paso 1 — Inventario

Localiza todos los `[NEEDS CLARIFICATION]` de `docs/specs/NNN-slug/spec.md`.

Relee también `docs/product/SOURCES.md`, `docs/product/FEATURE-MAP.md` y
`docs/design/INTAKE-REVIEW.md` si existe. Incluye las `DISC-*` abiertas que afecten al corte
vertical o a la cadena `OBJ → PRD-RF → UC → RF → CA`; una discrepancia de producto/diseño no
desaparece porque la spec no tenga marcador.

Además, busca ambigüedades **no marcadas** en estas categorías, que casi siempre faltan:

- Permisos: ¿quién puede hacerlo? ¿ve datos de otros?
- Estados y transiciones: ¿qué pasa si ya estaba en ese estado?
- Concurrencia: ¿dos usuarios a la vez?
- Volumen y límites: ¿cuántos como máximo? ¿qué pasa al superarlo?
- Errores: ¿qué ve el usuario cuando falla el sistema externo?
- Datos: ¿se borran? ¿cuánto se guardan? ¿son personales?
- Notificaciones: ¿se avisa a alguien? ¿por qué canal?
- Histórico: ¿hace falta auditoría de quién hizo qué?
- Reversión: ¿se puede deshacer?
- i18n y zonas horarias.

Y si `Impacto de usabilidad = aplicable`, estas cuatro, que se descubren tarde y caras:

- **Estados de la pantalla**: ¿qué se ve mientras carga, si está vacío, si falla, si el usuario no
  tiene permiso? Una spec que solo describe el camino feliz esconde cuatro pantallas sin diseñar.
- **Texto real**: ¿qué dice exactamente el botón? ¿y el mensaje de error de cada validación? "Se
  muestra un error" no es un requisito: es un hueco.
- **Espera**: ¿cuánto puede tardar esta operación de verdad, con datos reales? De ahí sale si hace
  falta esqueleto, progreso o estimación.
- **Reversibilidad**: ¿se puede pintar el resultado antes de que el servidor confirme? Si la
  respuesta es "depende", hay que resolverla ahora, no en la revisión.

## Paso 2 — Preguntar

**Máximo 5 preguntas por ronda.** Cada pregunta:

```
❓ <pregunta cerrada y concreta>
   a) <opción> — consecuencia: <...>
   b) <opción> — consecuencia: <...>
   c) <opción> — consecuencia: <...>
   👉 Recomendación: <a/b/c> porque <motivo>
```

Prioriza las que más cambian el alcance. La confirmación humana es obligatoria antes de cerrar una
respuesta que cambie requisitos, cobertura, discrepancias o alcance. Si el usuario dice
explícitamente "lo que veas tú", aplica la recomendación, registra esa delegación como decisión y
su alcance; una recomendación del agente por sí sola nunca equivale a aprobación.

## Paso 3 — Registrar

En `docs/specs/NNN-slug/clarifications.md`:

```markdown
## Ronda N — YYYY-MM-DD

### P1: <pregunta>
- Opciones planteadas: <...>
- **Respuesta**: <la del usuario>
- Impacto en la spec: <qué RF/CA cambia>
- Decidido por: usuario | agente (por defecto aceptado)
- Evidencia de confirmación: <respuesta o delegación explícita del usuario>
- Trazabilidad afectada: <OBJ-* → PRD-RF-* → UC-* → RF-* → CA-*>
```

## Paso 4 — Actualizar la spec

- Elimina el marcador y escribe el requisito resuelto.
- Añade los `CA` nuevos que salgan de la respuesta.
- Si la respuesta amplía el alcance, dilo explícitamente y confirma antes de incorporarla.
- Si la respuesta cambia el "fuera de alcance", actualízalo.
- Si cambia el baseline de producto o el corte vertical, **no** edites esos artefactos desde esta
  fase: vuelve a `/sdd-intake`, resuelve allí la discrepancia y repite el gate humano de producto.

## Puerta de salida

**La spec no sale de esta fase con marcadores pendientes, `DISC-*` materiales abiertas ni cambios
sin confirmación humana.** Si quedan, o se responden, o se mueven a "fuera de alcance" de esta
iteración con acuerdo explícito.

Cambia el estado de la spec a `aprobada` solo después de registrar quién confirmó, cuándo y qué
alcance aprobó. Un especialista no puede autoaprobarla.

## Cierre

```
### HANDOFF
- Agente origen: spec-analyst
- Fase completada: clarify
- Rondas: <n> · Preguntas resueltas: <n>
- Cambios de alcance: <lista o "ninguno">
- Cobertura confirmada: <OBJ-* → PRD-RF-* → UC-* → RF-* → CA-*>
- Confirmación humana: <actor · fecha · alcance>
- Discrepancias abiertas: 0
- Marcadores pendientes: 0
- Impacto de usabilidad: <aplicable/sin-ui · motivo/ux-pending> · huecos de UI resueltos: <n>
- Estado de la spec: aprobada
- Siguiente agente sugerido: ux-designer — comando: /sdd-design (si el impacto es aplicable)
                              o planner — comando: /sdd-plan
```
