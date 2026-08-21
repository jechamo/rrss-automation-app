---
name: front
description: Implementa una tarea de frontend — componentes, estado, formularios, routing, consumo de API, accesibilidad y rendimiento de UI. Aplica el documento de diseño, patrones de front y TDD. Úsala cuando la tarea toque interfaz.
---

# /front — Implementación de frontend

Agente responsable: `@frontend-expert`. Apoyo: `@ux-designer` y `@test-engineer`. Devuelve el control a quien invocó.

## Puerta de entrada

- Tarea `T-NNN-XX` con CA, terreno y `UX-*` aplicables.
- `design.md` y flujo con estados; dirección visual/tokens aprobados.
- Contrato en `contracts/` si consume datos. Si falta o contradice el diseño, para y devuelve HANDOFF; no adivines.

## Ciclo TDD

1. 🔴 Test de comportamiento observable que falla, con salida real. Consulta por rol/texto, no por DOM interno.
2. 🟢 Implementación mínima. E2E solo en flujos críticos.
3. ♻️ Refactor con suite verde.

## Reglas siempre cargadas

- `docs/design/DIRECCION-VISUAL.md` es vinculante: escala, densidad, paleta, movimiento y el elemento con carácter no se sustituyen por defaults del framework.
- Usa composición, separa presentación/datos y mantiene el estado en el nivel más bajo útil.
- Todo componente con datos cubre vacío, cargando, parcial, error, sin permiso y éxito.
- Cero lógica de negocio o secretos en cliente; la autorización real está en backend.
- Una desviación de diseño se acuerda y registra; no se normaliza silenciosamente.

## Carga progresiva

Abre [`references/implementation-checklists.md`](references/implementation-checklists.md) solo para las áreas de la tarea:

- formularios o UX → formularios, estados y velocidad percibida;
- UI interactiva → accesibilidad WCAG 2.2 AA;
- objetivo de rendimiento → rendimiento medido;
- HTML externo, auth o dependencias → seguridad del cliente.

Consulta además los checklists versionados del proyecto. Para APIs/versiones actuales usa documentación oficial; no inventes de memoria.

## Antes de devolver

- RED/GREEN/REFACTOR y gates de la tarea con salida real.
- Seis estados, dirección visual, tokens y controles `UX-*` aplicables verificados.
- Lo no ejecutado declara riesgo, owner y siguiente paso; ausente no equivale a verde.

## Salida

```markdown
### HANDOFF
- Agente origen: frontend-expert
- Tarea y criterio: <T-NNN-XX · CA-NN>
- Ficheros tocados: <rutas>
- Ciclo TDD: <rojo → verde → refactor>
- Estados: <vacío/cargando/parcial/error/sin permiso/éxito>
- Dirección visual y elemento con carácter: <resultado>
- Accesibilidad/usabilidad: <comprobaciones y UX-*>
- Rendimiento/seguridad: <medición o no aplica>
- Desviaciones, bloqueos y supuestos: <lista>
- Devuelvo control a: <invocador>
```
