# Modelo de datos · 002-e2e-mock-offline-v1

No se modifica `prisma/schema.prisma` ni se añade migración. Cada ejecución crea una base SQLite
nueva con el esquema vigente y una raíz de ficheros exclusiva.

## Contexto efímero de ejecución

| Campo | Tipo | Restricción | Persistencia |
|---|---|---|---|
| `profile` | literal `mock` | obligatorio | entorno del proceso |
| `runId` | slug seguro | obligatorio y único | entorno/informe |
| `dataRoot` | ruta absoluta canónica | dentro del contenedor E2E y distinta de `data/` | entorno |
| `databaseUrl` | URL `file:` absoluta | apunta dentro de `dataRoot` | entorno |
| `mockCounts` | mapa capacidad→entero | sin datos de usuario | informe JSON |
| `blockedEgress` | entero | debe ser 0 en el camino feliz | informe JSON |

## Invariantes

- `dataRoot` nunca puede ser la raíz del repo, `data/`, HOME, una unidad ni un ancestro de ellas.
- `databaseUrl`, Vault, sesiones, cachés y medios se resuelven bajo la misma raíz E2E.
- La limpieza solo acepta el subdirectorio exacto asociado al `runId` actual.
- La base empieza sin filas de negocio y no utiliza seeds productivos.
- No se leen ni copian secretos o medios del perfil normal.

## Relaciones y migraciones

El esquema relacional es el existente. Las relaciones, índices y `ON DELETE` no cambian. No hay
migración, backfill, doble escritura ni impacto en datos existentes. La reversión consiste en
retirar el perfil y sus artefactos de test.

## Datos personales y retención

Las fixtures son ficticias y no contienen PII. Los datos de una ejecución verde se eliminan al
terminar; en fallo solo se conservan traza/captura/informe redactados durante 3 días en CI. La base,
Vault y medios temporales no se publican como artefactos.

## Tests de datos

- Rechazo de rutas inseguras y de `DATABASE_URL` fuera de `dataRoot`.
- Dos ejecuciones obtienen raíces distintas.
- SQLite nueva contiene cero filas de negocio antes del escenario.
- Hash y conteos de una instalación normal sintética permanecen iguales.
