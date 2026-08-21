---
name: sdd-implement
description: Ejecuta las tareas de tasks.md en ciclo TDD estricto rojo-verde-refactor, una a una, mostrando la salida real de los tests.
---

# /sdd-implement — Construir con TDD

Agente responsable: `@implementer`, con delegación a especialistas.

## Puerta de entrada

`tasks.md` existe, con tareas trazadas a `spec.md` y test asociado.
Si no existe → `/sdd-tasks`.

## Bucle principal

Repite hasta agotar el alcance acordado. **Una tarea por ciclo.**

### 0 · Seleccionar
Primera tarea `pendiente` sin dependencias abiertas. Márcala `en curso` en `tasks.md`.
Anuncia: *"T-042-03 · <título> — test: `<ruta>`"*.
Lee también `Controles de seguridad`. Si referencia `SEC-*`, conserva la cadena de `plan.md` y
`test-plan.md`; si dice `no aplica`, verifica que incluya la justificación material aprobada.

Lo mismo con `Controles de usabilidad`. Si referencia `UX-*`, arrastra la cadena hasta la evidencia
y delega en `@frontend-expert` con `/front`, que aplica las dos checklists. Una tarea de interfaz
no está hecha con el camino feliz: los seis estados —vacío, cargando, parcial, error, sin permiso,
éxito— son parte de la misma tarea, no un seguimiento posterior.

### 1 · 🔴 RED
- Escribe **solo** el test de esta tarea.
- Ejecútalo.
- **Pega la salida real del fallo.** Sin rojo demostrado no se continúa.
- Verifica que falla por el motivo correcto (assert que no se cumple), no por un import roto
  o un fichero que no existe.

### 2 · 🟢 GREEN
- El código **mínimo** que pone el test en verde. Nada de generalizar por adelantado.
- Ejecuta el test → verde. Pega la salida.
- Ejecuta la **suite completa** → verde. Si rompiste otra cosa, arréglalo ahora.

### 3 · 🔵 REFACTOR
- Con verde, limpia: nombres, duplicación de conocimiento, funciones largas, niveles de
  abstracción mezclados, condicionales anidados.
- Aplica los patrones del plan. Si aparece un patrón no previsto, anótalo para el handoff.
- Si el olor es grande, delega en `@refactor-specialist`.
- Vuelve a ejecutar. Verde otra vez.

### 4 · Cerrar tarea
- **Gates rápidos del proyecto**, y pega la salida:
  ```bash
  node scripts/sdd-project.mjs run --fast
  ```
  No lo dejes para los git hooks: solo existen donde hay git local, y hay hosts sin ninguno.
- `tasks.md` → `hecho`.
- **Registra la evidencia** en `evidence.md`: agente que ejecutó, comando exacto, resultado
  (🔴 y 🟢 con su salida) y artefacto. Si algún control previsto **no** se ejecutó, escríbelo
  en la sección de controles no ejecutados con su riesgo y su dueño. "No ejecutado" es un
  resultado válido; "pasa" sin ejecución, no.
- Para cada `SEC-*` aplicable registra comando/caso adverso, salida real y artefacto en la tabla
  de seguridad. Un control no ejecutado conserva riesgo, propietario y siguiente paso; no se
  convierte en aprobado. El `security-auditor` no corrige código ni escribe informes.
- Verifica la DoD de `AGENTS.md` §7 aplicable a la tarea.
- Si hubo decisión relevante → `@bitacora-keeper`.
- Si el plan resultó incorrecto → **para** y vuelve a `@planner`. No parchees el plan sobre la marcha.

## Delegación

Cada terreno tiene su **procedimiento escrito**: puerta de entrada, ciclo, patrones y lista de
comprobación. Delega con la skill, no con una instrucción genérica.

| Terreno | Agente | Skill |
|---|---|---|
| UI, estado, accesibilidad | `@frontend-expert` | `/front` |
| Dominio, casos de uso, integraciones | `@backend-expert` | `/middle` |
| Esquema, migraciones, consultas | `@database-expert` | `/bbdd` |
| Contratos | `@api-designer` | — |
| Test difícil, fixtures, dobles | `@test-engineer` |
| Lentitud medida | `@performance-optimizer` |
| Olor de diseño | `@refactor-specialist` |
| Documentación oficial tras estabilizar la interfaz | `@docs-writer` | `/docs-sync update --spec NNN` |

Una tarea exclusivamente documental no necesita demostrar RED/GREEN de aplicación. Ejecuta su
comprobación documental, registra la salida y devuelve el HANDOFF. Si documentar exige cambiar
comportamiento, detén la tarea y vuelve al planner.

Los especialistas **devuelven el control**; no encadenan ellos la siguiente fase.

## Prohibido

- Código de producción sin test rojo previo.
- Marcar un control de seguridad como verificado sin ejecutar su test/comando real.
- Implementar lo que la spec no pide.
- Tocar ficheros fuera del alcance de la tarea.
- Decir "los tests pasan" sin pegar la salida.
- Hacer commit o push sin que te lo pidan.
- Continuar con la suite en rojo.

## Cierre (al agotar el alcance de la sesión)

```
### HANDOFF
- Agente origen: implementer
- Tareas completadas: <lista>  ·  Pendientes: <n>
- Tests: <n> nuevos · suite: <salida real resumida>
- Cobertura dominio/aplicación: <%>
- Ficheros tocados: <rutas>
- Controles de seguridad: <SEC-* verificados · no ejecutados · no aplica>
- Controles de usabilidad: <UX-* verificados · no ejecutados · no aplica>
- Desviaciones del plan: <lista o "ninguna">
- Deuda anotada: <lista o "ninguna">
- Siguiente agente sugerido: implementer (siguiente tarea) | code-reviewer — comando: /sdd-verify
```
