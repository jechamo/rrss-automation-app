# ADR-0001: Arquitectura heredada como monolito modular local

- Estado: aceptado (vigente)
- Fecha: 2026-08-21
- Decisores: architect; norkc (aprobador)
- Spec relacionada: `docs/specs/001-content-tray-local-installation/`

## Contexto

RRSS Studio es un brownfield que ejecuta una aplicación Next.js local en Windows 11. El mismo
proceso contiene interfaz, rutas API, ejecuciones de pipeline y SSE; Prisma persiste en SQLite y
los assets, cachés y vault viven bajo `data/`. El código integra proveedores HTTP, Claude CLI,
Playwright, FFmpeg/ffprobe, yt-dlp y Whisper local, pero no evidencia despliegues separados,
cola, broker, CI/CD, observabilidad distribuida, on-call ni equipos con ownership autónomo.

La spec 001 es sensible: inspeccionará configuración y datos locales y podrá preparar un arranque.
Su planificación exige una frontera para esos efectos y un nivel ASVS objetivo. El script histórico
`iniciar.bat` termina todos los `node.exe`, libera el puerto 3000 y borra `.next`; es útil como
evidencia de operación actual, pero no satisface el consentimiento granular de la spec.

## Opciones consideradas

1. Conservar una estructura ad hoc sin constitución - menor trabajo documental inmediato, pero no
   proporciona frontera, ASVS ni política para datos, caché y procesos; bloquea el plan sensible.
2. Monolito modular local con fronteras hexagonales pragmáticas - conserva la topología existente,
   separa contexto de infraestructura en cambios nuevos y permite endurecer módulos gradualmente.
3. Web con worker/cola independiente - aislaría trabajos largos, pero introduce coordinación,
   recuperación, operación y consistencia sin evidencia de necesidad ni plataforma que lo sostenga.
4. Microservicios, EDA distribuido, CQRS/ES o serverless - añaden red, datos distribuidos,
   observabilidad y ownership que no están presentes; no resuelven una necesidad medida del
   producto local.
5. Clean/onion completa aplicada retroactivamente - elevaría el coste y crearía capas vacías en
   módulos existentes; no es necesaria para fijar fronteras incrementales.

## Decisión

Se adopta un **monolito modular local con fronteras hexagonales pragmáticas**:

- un único despliegue Next.js/Node con SQLite y `data/` locales;
- módulos lógicos de proyecto/inteligencia, contenido/publicación, media/estudio, clips,
  pipeline y configuración/secretos;
- integración síncrona en proceso, HTTP/CLI con timeout y SSE en memoria solo para progreso;
- datos compartidos físicamente por instalación, con propiedad lógica por contexto y consistencia
  local mediante Prisma/SQLite;
- App Router con UI cliente donde corresponde, sin microfrontends;
- organización existente por capacidades, admitiendo vertical slice de forma local para features
  nuevas;
- OWASP ASVS 5.0.0 L2 como baseline para specs sensibles.

La instalación y recuperación deben separar comprobación de efectos. Procesos, puertos, cachés,
datos persistidos, esquema y cualquier recurso fuera del repositorio se detectan antes de tocarse
y requieren confirmación humana explícita y contextual. Datos existentes no verificables se
preservan y bloquean; un reset potencialmente destructivo exige una segunda confirmación.

## Consecuencias

- Positivas: permite al planner trazar límites, ASVS L2 y controles de efectos locales sin
  introducir infraestructura distribuida; alinea el plan con los módulos y contratos existentes.
- Negativas / deuda aceptada: las fronteras son parciales; los pipelines importan Prisma de forma
  directa y la ejecución/progreso no es durable entre procesos. Estas deudas se registran en
  `docs/quality/TECH-DEBT.md` y no autorizan una reescritura en la spec 001.
- Restricciones: no se añaden servicios, brokers, bases de datos, workers persistentes, cloud,
  exposición de red ni borrados/reset automáticos sin ADR posterior y gate humano aplicable.
- Revisión: reconsiderar solo con métricas de carga, requisito de disponibilidad/aislamiento,
  equipo propietario y plataforma operativa que justifiquen el coste. Una necesidad de entrega
  asíncrona fiable requiere además idempotencia y outbox antes de adoptar una cola.
- Salida: las fronteras permiten extraer un adaptador o contexto cuando exista una necesidad real;
  este ADR se reemplaza por el ADR que documente esa decisión, no por una migración implícita.