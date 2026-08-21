# .sdd/

Estado y auditoría del circuito SDD.

| Fichero | Qué es |
|---|---|
| `agent-audit.jsonl` | Eventos de subagente que no pudieron asociarse a una spec activa. Append-only, lo escriben los hooks. |
| `generators.json` | Registro versionado y opt-in de generadores existentes; nace vacío. |

Cuando hay una spec activa, los eventos van a `docs/specs/NNN-slug/execution-log.jsonl`.
Este fichero es la red de seguridad para no perder ninguno.

**No lo edites a mano.** `guard-write.mjs` bloquea la escritura sobre él: si un agente pudiera
reescribir su propio registro, el registro no serviría como evidencia de nada.

## Formato de cada línea

```json
{"ts":"AAAA-MM-DDTHH:mm:ss.sssZ","evento":"subagent-stop","agente":"backend-expert","sesion":"<id-sesion>","verificacion":"observed"}
```

`verificacion: observed` significa que un hook del host vio el ciclo real del subagente.
Es el único nivel que no depende de lo que el modelo afirme en el chat.

## Atribución y rectificaciones

Una spec solo está activa si un bloque real `### T-*` declara una tarea `pendiente` o
`en curso`. Si no hay ninguna, el evento se registra aquí con `sin-spec-activa`; si hay varias,
se registra con `spec-activa-ambigua` y la lista de candidatas. El hook nunca elige por orden.

Si una versión anterior atribuyó una sesión a una spec incorrecta, no se borra ni reescribe el
historial. Se añade una rectificación idempotente:

```powershell
node scripts/sdd-project.mjs trace-correct --from-spec 001 --to-spec 009 --session <id> --reason "motivo verificable"
```

El comando añade `trace-correction` al origen, `trace-attribution` al destino y una nota a la
bitácora mensual. Solo acepta IDs `NNN`, valida la sesión y rechaza rutas, enlaces y entradas
hostiles antes de escribir. Un lock efímero en `.sdd/state/` serializa procesos concurrentes:
quien espera relee el resultado durable y no duplica ningún append.

## Generadores deterministas

`.sdd/generators.json` declara `program`, `args`, `inputs`, `outputs`, `owner` y un `timeoutMs`
opcional entre 1 y 300 segundos. Se ejecutan con `shell:false` y 120 segundos de límite por defecto;
un gestor de paquetes solo puede invocar un script `run` ya instalado. Nunca se descargan
dependencias ni se activa un generador por detección automática.

```powershell
node scripts/sdd-project.mjs generate <id> --dry-run
node scripts/sdd-project.mjs generate <id>
```

La huella local vive en `.sdd/state/generators/`: si los outputs cambian sin una generación
registrada, el CLI bloquea por drift. El registro sí se versiona; el estado efímero, no.
