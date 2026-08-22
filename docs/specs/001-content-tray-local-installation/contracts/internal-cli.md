# Contrato interno · Asistente de instalación local

## Alcance y compatibilidad

Contrato interno versión `1` para el futuro asistente de consola de Windows 11. No modifica rutas
HTTP ni contratos de contenido. La implementación propuesta será un script Node versionado y sus
adaptadores; no se reutilizan los efectos automáticos de `iniciar.bat`.

## Operaciones

| Operación | Efecto | Precondición |
|---|---|---|
| `check` | Ninguno. Detecta plataforma, runtime, dependencias, plantilla, SQLite, puerto y opcionales. | Ninguna. |
| `prepare` | Solo acciones declaradas dentro del proyecto para una clonación limpia. | Recibo `check` correcto y consentimiento para el plan mostrado. |
| `reset` | Resguarda datos SQLite protegidos y reinicia la preparación. | Bloqueo de datos, solicitud explícita y confirmación separada. |
| `start` | Inicia el proceso local. | Obligatorios correctos y puerto disponible o acción sobre PID concreto confirmada. |

Ninguna operación instala globalmente, modifica PATH, autentica IA, configura proveedores, lee
secretos ni termina procesos por imagen global.

## Resultado estable

```ts
type StepStatus = "ok" | "blocked" | "optional-blocked" | "optional-degraded" | "skipped";

interface CheckResult {
  id: string;
  classification: "required" | "optional";
  status: StepStatus;
  category: "platform" | "runtime" | "dependencies" | "configuration" | "data" | "process" | "cache" | "capability";
  nextStep: string;
}

interface ConsentRequest {
  effect: "project-preparation" | "process" | "cache" | "data-reset" | "outside-project";
  scope: string;
  rejectionOutcome: "blocked" | "skipped";
}

interface PreparationReceipt {
  version: 1;
  required: CheckResult[];
  optional: CheckResult[];
  requiredComplete: boolean;
  overallStatus: "ready" | "blocked";
}
```

`scope` es una descripción de categoría segura, no una ruta absoluta, variable de entorno, PID no
confirmado, salida de proceso ni contenido local. Un resultado `ready` exige `requiredComplete=true`.

## Reglas de consentimiento

1. `check` no pide consentimiento porque no cambia estado.
2. `prepare` anuncia las acciones dentro del proyecto antes de ejecutarlas.
3. Cualquier proceso, caché, instalación global, PATH o recurso fuera del proyecto tiene una
   petición separada; esta spec no autoriza instalación global ni PATH.
4. `reset` requiere una segunda confirmación propia, sin opción afirmativa predeterminada, e indica
   posible pérdida de datos. Rechazar conserva datos y el bloqueo.
5. El asistente nunca invoca `taskkill /IM node.exe`; una acción de proceso solo puede referirse al
   PID o puerto detectado y confirmado.

## Errores y evolución

Los errores se normalizan a `CheckResult` con categoría y siguiente paso. No se propagan errores
crudos de Prisma, npm o procesos que incluyan configuración, rutas personales, valores de entorno,
contenido SQLite, credenciales o argumentos.

El consumidor debe tolerar categorías y pasos desconocidos como bloqueados. Añadir categorías es
aditivo; cambiar `version`, el significado de `ready` o las reglas de consentimiento exige un nuevo
contrato y revisión de seguridad.