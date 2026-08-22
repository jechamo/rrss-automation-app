# Modelo de datos · 001-content-tray-local-installation

## Decisión

No se modifica `prisma/schema.prisma`. `ContentPiece` ya identifica una pieza con `id` y la
colección llega a `ContentTray`; la pieza activa y el plegado son estado efímero de presentación,
no hechos de dominio persistibles. Persistirlos añadiría una preferencia por proyecto que la spec no
pide y no resolvería la coherencia entre carrusel y detalle.

## Estado efímero de revisión

| Concepto | Forma lógica | Invariante |
|---|---|---|
| Pieza activa | `pieceId: string | null` | Es `null` si y solo si no hay piezas; si existe, pertenece a la colección actual. |
| Plegado de lista | `Record<pieceId, boolean>` | Solo afecta a su propia pieza; una colección recién cargada inicia con mapa vacío. |
| Índice de carrusel | Derivado de `pieceId` y orden actual | No es una segunda fuente de verdad. |

Regla de reconciliación: conservar el ID si continúa presente; de no estar, elegir primero la pieza
que ocupa el índice anterior y, si no existe, la inmediatamente anterior; si no hay piezas, devolver
`null`. Esta regla materializa la decisión de diseño siguiente y después anterior, sin residuo visual.

## Estado de preparación local

Los resultados no se persisten inicialmente. El asistente devuelve un recibo reproducible en cada
ejecución; conservarlo en SQLite, archivos de log o telemetría sería alcance adicional y elevaría el
riesgo de datos locales.

| Tipo lógico | Campos públicos | Invariante de privacidad |
|---|---|---|
| `CheckResult` | `id`, `classification`, `status`, `nextStep` | No tiene valor de variable, ruta absoluta, argumento de proceso ni contenido de archivo. |
| `ConsentRequest` | `effect`, `scope`, `rejectionOutcome` | Representa una sola clase de efecto: proceso/puerto, caché, dato o fuera del proyecto. |
| `PreparationReceipt` | `required[]`, `optional[]`, `overallStatus` | Solo puede ser `ready` si todos los obligatorios están correctos. |

`classification` distingue obligatorio, opcional bloqueada y opcional degradada. Los datos SQLite
existentes o sidecars detectados se representan como bloqueo protegido, nunca como detalle del
contenido.

## Persistencia SQLite y reset

| Situación observada | Acción permitida por defecto | Acción tras consentimiento separado |
|---|---|---|
| No hay base ni sidecars | Crear/preparar SQLite después de mostrar el plan de preparación. | No aplica. |
| Hay base o sidecars | Preservar y bloquear; no leer ni imprimir contenido. | Crear un resguardo con nombre no expuesto en salida y volver a comprobar antes de crear una base limpia. |
| Estado incompleto o incompatible | Preservar y bloquear con categoría y recuperación. | Igual que el caso anterior; no hay migración o borrado automático. |

## Migración

- **Prisma:** no hay migración ni `db push` sobre una base existente durante el precheck.
- **Clonación limpia:** el flujo futuro podrá ejecutar la preparación Prisma solo después de las
  comprobaciones obligatorias y consentimientos aplicables.
- **Compatibilidad:** las piezas y proyectos existentes no cambian; no hay transformación de datos.

## Datos de prueba

Fixtures sintéticas: IDs de pieza ficticios y archivos SQLite vacíos o nombres de sidecars temporales.
Nunca usar nombres de usuario, rutas reales, `.env`, valores de `DATABASE_URL`, claves ni bases de
datos existentes.