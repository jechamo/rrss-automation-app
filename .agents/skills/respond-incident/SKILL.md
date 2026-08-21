---
name: respond-incident
description: Responde a un incidente en producción — contener, recuperar, comunicar y aprender. Úsalo cuando algo está fallando AHORA para usuarios reales.
---

# /respond-incident — Algo está roto en producción

Agente responsable: `@devops-expert`, con `@research-analyst` para la causa y
`@security-auditor` si hay sospecha de compromiso.

Esta skill es la cara **reactiva**. Depende de que exista la proactiva: `/observability` y su
artefacto `docs/ops/OBSERVABILITY.md`. Si al llegar aquí no hay clasificación de errores, salud
por versión ni rastro de eventos, la Fase 3 va a ser mucho más larga — y esa es la lección que
hay que llevarse al post-mortem.

> **Regla que gobierna todo lo demás: primero se para el dolor, después se entiende.**
> Diagnosticar con usuarios cayéndose es el error clásico. Mitiga, y luego investiga con calma.

## Fase 0 · Encuadrar (2 minutos, no más)

| Pregunta | Por qué importa |
|---|---|
| ¿Qué no puede hacer el usuario? | Define el impacto real, no el síntoma técnico |
| ¿Cuántos afectados y desde cuándo? | Determina la severidad |
| ¿Hay pérdida o corrupción de datos? | Cambia por completo la estrategia: **nunca** reintentes a ciegas sobre datos corruptos |
| ¿Hay sospecha de compromiso de seguridad? | Si sí → **no borres nada**, preserva evidencia y llama a `@security-auditor` |
| ¿Qué cambió en las últimas 24 h? | El 80 % de los incidentes son un despliegue reciente |

**Severidad**: SEV1 (caído o pérdida de datos) · SEV2 (degradado) · SEV3 (molesto, puede esperar).

## Fase 1 · Contener

Aplica la mitigación **menos arriesgada que funcione**, en este orden:

1. **Apagar el feature flag** de lo que se desplegó. Es reversible en segundos y no toca datos.
2. **Revertir el despliegue** a la versión anterior conocida buena.
3. **Degradar con gracia**: desactivar la función concreta, servir caché, cola en vez de síncrono.
4. **Escalar recursos** si es saturación pura y está medida.

Nunca como primera medida: reiniciar a ciegas, subir un "hotfix" sin test, o tocar la base
de datos a mano. Un `UPDATE` de madrugada sin `WHERE` es cómo un SEV2 se convierte en SEV1.

**Confirma la mitigación con una métrica**, no con la sensación de que ya va mejor.

## Fase 2 · Comunicar

Mientras se mitiga, en paralelo:
- Quién está afectado y qué no puede hacer.
- Qué se está haciendo y **cuándo será la próxima actualización** (esto es lo que más calma).
- Sin especular sobre la causa en público. "Estamos investigando" es una respuesta correcta.

Si hay datos personales implicados, avisa al responsable de privacidad: los plazos de
notificación regulatoria corren desde que lo sabes, no desde que lo resuelves.

## Fase 3 · Diagnosticar

Ya con el sistema estable, entra `@research-analyst`:

1. Reproduce en un entorno que no sea producción.
2. Recorre la línea temporal: despliegues, cambios de configuración, picos de tráfico, cambios
   en dependencias externas.
3. **Regla de las tres hipótesis**: si tres intentos de explicación no confirman la causa,
   **para de parchear**. Revisa supuestos, arquitectura y datos, y escala. La espiral de
   parches por ensayo y error es como se degradan los sistemas después de un incidente.
4. Distingue **causa** de **desencadenante**. El despliegue fue el desencadenante; la causa
   suele ser una frontera sin validar, un límite sin definir o un supuesto no escrito.

## Fase 4 · Arreglar de verdad

El arreglo de fondo **no se hace a las 3 de la madrugada**. Entra por el circuito normal:

- ¿El código no hacía lo que la spec decía? → defecto: `/tdd` con test de regresión rojo.
- ¿La spec nunca lo contempló? → hueco de especificación: `/sdd-specify`.

En ambos casos, el test que reproduce el incidente **se escribe antes** que el arreglo.

## Fase 5 · Aprender

Post-mortem **sin culpables**. Las personas actúan racionalmente con la información que
tienen; si el resultado fue malo, el sistema permitió que lo fuera.

```markdown
## Incidente YYYY-MM-DD · <título>

- **Severidad**: SEV1 | SEV2 | SEV3
- **Duración**: detección HH:MM · mitigación HH:MM · resolución HH:MM
- **Impacto**: <cuántos usuarios, qué no pudieron hacer, pérdida de datos sí/no>

### Línea temporal
| Hora | Qué pasó | Quién |

### Causa raíz
<La causa, no el desencadenante>

### Por qué no lo detectamos antes
<La pregunta más valiosa del post-mortem>

### Por qué los tests no lo cogieron
<La segunda más valiosa>

### Acciones
| Acción | Tipo (detección/prevención/mitigación) | Dueño | Fecha |
```

**Mide los dos tiempos, no los estimes**: del primer error a la alerta (detección) y de la alerta a
la mitigación (recuperación). Van a `docs/quality/METRICS.md`. Si la detección
la hizo un usuario y no el sistema, la primera acción del post-mortem ya está escrita.

Cada acción se convierte en **tarea real**, no en una buena intención. Una acción sin dueño
y sin fecha es una acción que no existe.

Registra el incidente en `docs/bitacora/DECISIONS.md` con tipo `incidente`, y actualiza o
crea el runbook en `docs/ops/runbooks/` con lo aprendido. **Un runbook que no se actualiza
tras usarlo desperdicia el incidente.**

## Salida

```
### HANDOFF
- Agente origen: devops-expert
- Severidad: SEV<n> · Estado: mitigado | resuelto | en curso
- Impacto: <usuarios, duración, pérdida de datos>
- Detección: <tiempo real, y si la hizo el sistema o un usuario> · Recuperación: <tiempo real>
- Mitigación aplicada: <cuál y con qué métrica se confirmó>
- Causa raíz: <o "en investigación">
- Arreglo de fondo: <spec o tarea creada>
- Runbook actualizado: <ruta>
- Acciones con dueño y fecha: <lista>
```
