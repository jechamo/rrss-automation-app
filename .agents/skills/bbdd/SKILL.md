---
name: bbdd
description: Implementa una tarea de base de datos — modelado, migraciones, índices, integridad, consultas, RLS y políticas de acceso. Aplica patrones de datos y despliegue reversible. Úsala cuando la tarea toque el esquema o el rendimiento de consultas.
---

# /bbdd — Implementación de base de datos

Agente responsable: `@database-expert`. Devuelve el control a quien invocó.

## Puerta de entrada

- [ ] Tarea con id (`T-NNN-XX`) y criterio de aceptación que la origina
- [ ] `data-model.md` de la spec: entidades, invariantes, propiedad del dato
- [ ] Volumen y patrón de acceso esperados. Sin eso no se puede indexar con criterio
- [ ] Si la tarea es "arregla la consulta lenta": **el plan de ejecución actual**, medido

Esta capa **va primero**. Si `/middle` ya está escribiendo contra un esquema que no existe, el
orden es incorrecto: avisa al jefe de proyecto.

## Regla de oro: toda migración es reversible o no se aplica

| Regla | Por qué |
|---|---|
| Una migración, un cambio, con nombre que lo describa | Revertir media migración no existe |
| **Reversión escrita y probada** antes de aplicar hacia adelante | Descubrir que no hay vuelta atrás durante un incidente es el peor momento |
| Migración de esquema separada de migración de datos | Tiempos, riesgos y reversiones distintos |
| Idempotente cuando se pueda (`IF NOT EXISTS`) | Los reintentos existen |
| Sin bloqueos largos en tablas calientes: índices en concurrente, lotes con pausa | Un `ALTER` ingenuo en una tabla grande es una caída |
| Probada contra un volumen **parecido** al real | Lo que tarda 2 ms con 100 filas tarda 40 s con 10 millones |
| Commiteada al repositorio. **Nunca** un cambio a mano en producción | Si no está en el repo, no ha pasado |

### Cambio con despliegue en caliente: expandir → migrar → contraer

Nunca en un solo paso, porque durante el despliegue **conviven las dos versiones del código**:

1. **Expandir** — añade lo nuevo, opcional y compatible hacia atrás. Nada lo usa aún.
2. **Migrar** — rellena datos por lotes; el código empieza a escribir en ambos sitios y leer del
   nuevo con respaldo del viejo.
3. **Contraer** — cuando ninguna versión viva usa lo viejo, se elimina. **En otro despliegue.**

Renombrar una columna en un paso rompe la versión anterior en cuanto empieza el despliegue.

## Modelado

- **Integridad en la base, no solo en la aplicación.** `NOT NULL`, `UNIQUE`, `CHECK`, claves
  ajenas. La aplicación tiene bugs; la restricción no negocia. Toda invariante de
  `data-model.md` que se pueda declarar, se declara.
- **Normaliza primero.** Desnormaliza después, con una medición y un comentario que explique
  por qué, y con la responsabilidad de mantener la copia sincronizada.
- **Tipos correctos**: dinero en decimal exacto —nunca coma flotante—, tiempo con zona
  (`timestamptz`), enumerados como enum o tabla de referencia, no texto libre.
- **Claves**: sustitutas para identidad interna, naturales como `UNIQUE` cuando existan. Si el
  id se expone, considera UUIDv7 o ULID: ordenables y no enumerables.
- **Borrado**: decide y documenta si es físico o lógico. Si es lógico, **todas** las consultas y
  todos los índices únicos deben contemplarlo, o aparecerán registros fantasma.
- **Auditoría**: `created_at`, `updated_at` y quién, desde el principio. Añadirlos después
  significa datos históricos sin origen.
- **Nombres consistentes**: singular o plural, elige y no lo mezcles. Sin abreviaturas crípticas.

## Índices

- Índice **para una consulta concreta**, no "por si acaso". Cada índice cuesta escritura y
  espacio.
- Compuestos: el orden de columnas importa; igualdad antes que rango.
- Índices parciales para el subconjunto que se consulta de verdad.
- Cubriente cuando evita ir a la tabla en una consulta caliente.
- Toda clave ajena que se use para filtrar necesita índice: casi ningún motor lo crea solo.
- Índices no usados: se eliminan. Solo penalizan.
- **Verifica con el plan de ejecución real**, antes y después. `EXPLAIN ANALYZE` pegado en
  `evidence.md`. Sin plan, la afirmación "es más rápido" no vale.

## Consultas

- **Siempre parametrizadas.** Concatenar SQL es rechazo automático.
- **N+1**: el defecto de rendimiento más frecuente. Búscalo explícitamente.
- `SELECT *` fuera de exploración manual: rompe cuando cambia el esquema y trae lo que no usas.
- Paginación por cursor en listas grandes, no `OFFSET` alto.
- Transacciones cortas. Nada de esperar una llamada HTTP con una transacción abierta.
- Nivel de aislamiento **decidido explícitamente**, y las condiciones de carrera reproducidas en
  un test cuando importan.
- Bloqueo optimista (columna de versión) para edición concurrente.
- Consultas analíticas fuera de la base transaccional cuando compitan por recursos.

## Seguridad

- **Menor privilegio**: la cuenta de la aplicación no es superusuario y no puede hacer DDL.
- **RLS** activado donde haya multi-tenant o datos por usuario. Con Supabase: RLS **por defecto**;
  una tabla nueva sin política es una tabla pública. Pruébalo con dos tenants distintos, no lo
  supongas.
- Cifrado en tránsito y en reposo. Datos personales sensibles cifrados a nivel de columna.
- **Ningún dato personal real en entornos de desarrollo.** Anonimizado o sintético.
- Credenciales por entorno, en gestor de secretos, rotables. Nunca en el repo.
- Copias de seguridad **con restauración probada**. Una copia que nadie ha restaurado es una
  hipótesis, no una copia.
- Sin PII en logs de consultas lentas.

## Operaciones destructivas

`DROP`, `TRUNCATE`, `DELETE` sin `WHERE` acotado, `ALTER` que pierde datos: **requieren
confirmación humana explícita**. Los hooks del proyecto las paran; no busques la vuelta.
Antes de proponerlas: copia verificada, ventana acordada, reversión escrita.
Con el MCP de Supabase, modo lectura por defecto; `apply_migration` va contra el proyecto
remoto de verdad.

## Cómo se prueba esto

- **Migración**: aplicar y **revertir** en una base limpia, en CI. Con datos de ejemplo.
- **Restricciones**: un test que intenta violar cada invariante y espera el fallo. Si no falla,
  la restricción no está donde creías.
- **Repositorios**: contra base real —contenedor efímero—, no mocks. Mockear el driver no prueba
  que la consulta sea válida.
- **Rendimiento**: plan de ejecución con volumen realista, antes y después.
- **RLS**: dos tenants, y el test comprueba que uno no ve al otro.

## Antes de devolver el control

- [ ] Migración aplicada y **revertida** con éxito en limpio, con la salida pegada
- [ ] Invariantes de `data-model.md` declaradas en el esquema
- [ ] Índices justificados con plan de ejecución antes/después
- [ ] Sin consultas concatenadas, sin N+1 introducido
- [ ] RLS y permisos verificados con más de un actor
- [ ] `data-model.md` actualizado si el modelo cambió
- [ ] Nada destructivo ejecutado sin confirmación humana

## Stack concreto

Prácticas oficiales del fabricante en `docs/agents/SKILLS-EXTERNAS.md`:
`supabase/postgres-best-practices`, `neondatabase/neon-postgres`, `netlify/netlify-db`.
Para el esquema vivo, advisors y migraciones, MCP `supabase` en lectura.

## Salida

```
### HANDOFF
- Agente origen: database-expert
- Tarea: T-NNN-XX — <título>
- Criterio que cubre: CA-NN
- Migraciones: <ficheros> · reversión probada: <sí/no + salida>
- Cambios de esquema: <tablas, columnas, restricciones>
- Índices: <cuáles y para qué consulta> · plan antes/después: <resumen>
- Seguridad: <RLS, permisos, qué se verificó>
- Riesgo de despliegue: <expandir/migrar/contraer, ventana, bloqueos>
- Bloqueos / supuestos: <lista, o "ninguno">
- Devuelvo control a: <quien me invocó>
```
