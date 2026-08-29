# Contrato interno del perfil E2E

## Activación

El perfil solo está activo si `RRSS_E2E_MODE=mock`. En ese caso son obligatorios:

- `RRSS_E2E_RUN_ID`: `^[a-z0-9][a-z0-9-]{5,63}$`.
- `RRSS_DATA_DIR`: ruta absoluta contenida en `.e2e-runtime/<runId>/data`.
- `DATABASE_URL`: URL SQLite absoluta contenida en esa raíz.

Un valor ausente, desconocido o inconsistente produce `E2E_PROFILE_INVALID` antes de abrir DB,
Vault, red o procesos. Si el modo no está presente, la aplicación conserva el comportamiento
normal y `RRSS_DATA_DIR` puede seguir ausente.

El runner crea además una instantánea de fuente mínima dentro del run. No copia `.env*`, `data/`,
Vault, sesiones ni medios, y los procesos hijos reciben una lista permitida de variables del sistema
en vez del entorno completo del operador.

## Egreso

En modo mock solo son destinos HTTP permitidos `localhost`, `127.0.0.0/8` y `::1`, en cualquier
puerto. Credenciales embebidas, esquemas distintos de HTTP(S) y cualquier otro host producen
`E2E_EGRESS_BLOCKED`. Las capacidades `claude`, `provider`, `web-search`, `download` y equivalentes
deben resolver un fake registrado; de lo contrario producen `E2E_CAPABILITY_UNMOCKED`.

## Reporte

El informe local contiene únicamente:

```json
{
  "profile": "mock",
  "runId": "run-slug",
  "status": "passed|failed",
  "externalRequestsPerformed": 0,
  "mockRuntime": {
    "simulatedRequests": 0,
    "providers": {},
    "blockedExternalAttempts": 0,
    "allowedLoopbackRequests": 0,
    "performedExternalRequests": 0
  },
  "durationMs": 0
}
```

No incluye rutas absolutas, URLs con query, cabeceras, prompts, cuerpos, variables de entorno,
credenciales, Vault, SQLite ni medios. Una capacidad desconocida, evidencia ausente o una petición
externa efectivamente realizada hace fallar el proceso aunque los asserts funcionales hubieran
terminado. Los intentos externos que la propia prueba negativa bloquea antes de conectar se cuentan
como evidencia del control y no invalidan por sí solos el resultado.
