---
name: tdd
description: Ejecuta un ciclo TDD rojo-verde-refactor sobre un comportamiento concreto, mostrando la salida real de los tests en cada paso.
---

# /tdd — Un ciclo rojo-verde-refactor

Agente responsable: `@implementer`, con apoyo de `@test-engineer` y `@refactor-specialist`.

Úsalo para un comportamiento suelto (un bug, una regla nueva) fuera del bucle completo de
`/sdd-implement`. El rigor es el mismo.

## 0 · Definir el comportamiento

Una frase: *"Cuando \<condición\>, el sistema debe \<resultado observable\>."*
Si no cabe en una frase, son varios comportamientos: haz uno por ciclo.

Nombre del test: `debe_<comportamiento>_cuando_<condición>`.

## 1 · 🔴 RED

- Escribe **solo ese test**.
- Ejecútalo.
- **Pega la salida real del fallo.**
- Comprueba que falla por el assert, no por un import roto ni por un fichero inexistente.
  Un rojo por el motivo equivocado no demuestra nada.

## 2 · 🟢 GREEN

- El código **mínimo**. Está permitido devolver una constante si eso pone el test en verde:
  el siguiente test te obligará a generalizar. Eso es la disciplina, no una trampa —tiene nombre,
  **fingirlo hasta lograrlo**, y sirve para separar "hacer pasar el test" de "diseñar la solución",
  que son dos actividades distintas y se hacen mal a la vez.
- Ejecuta el test → verde. Pega la salida.
- Ejecuta la suite completa → verde.

**Triangular**: cuando la constante ya no cuela, es que el segundo test ha hecho su trabajo. Un
test permite fingir; dos obligan a generalizar; tres confirman la regla. Si te descubres adivinando
la implementación en vez de derivarla, te falta un test que la fuerce.

## 3 · 🔵 REFACTOR

Con verde, y solo con verde:
- Nombres que revelan intención.
- Elimina duplicación de **conocimiento** (no de líneas).
- Extrae funciones; un nivel de abstracción por función.
- Guard clauses en lugar de anidamiento.
- Aplica SOLID. Si aparece un patrón, justifícalo.
- Refactoriza también **el test**: los tests son código de primera clase.

Ejecuta después de cada paso. Verde siempre.

## 4 · Siguiente

¿Falta un caso límite? Vuelve a 🔴. Casos que casi siempre faltan: vacío, nulo, límite exacto,
negativo, duplicado, concurrencia, permiso denegado, dependencia externa caída.

## Reglas

- Sin rojo demostrado, no hay código.
- Un test por ciclo. Nada de escribir cinco tests y luego el código.
- No refactorices en rojo. No añadas comportamiento en refactor.
- Pega **siempre** la salida real. "Los tests pasan" sin salida no cuenta.

## Cierre

```
Comportamiento: <frase>
🔴 <salida del fallo>
🟢 <salida en verde>
🔵 Refactors: <lista>
Suite completa: <salida>
Siguiente caso pendiente: <cuál o "ninguno">
```
