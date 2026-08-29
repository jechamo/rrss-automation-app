# 002 · Validación E2E simulada y sin red para v1

| Campo | Valor |
|---|---|
| **ID** | `002-e2e-mock-offline-v1` |
| **Estado** | aprobada |
| **Autor** | spec-analyst |
| **Fecha** | 2026-08-27 |
| **Rama** | `codex/e2e-mock-v1` |
| **Depende de** | `001-content-tray-local-installation` |
| **Baseline de producto** | [`docs/product/PRD.md`](../../product/PRD.md) · `legacy-pending`; FEAT-007 autorizado |
| **Fuentes** | [`docs/product/SOURCES.md`](../../product/SOURCES.md) · `SRC-017` a `SRC-021` |
| **Impacto de seguridad** | `sensible` |
| **Impacto de usabilidad** | `sin-ui · valida recorridos existentes sin añadir ni modificar interfaz` |
| **Impacto de documentación** | `aplicable · DOC-README-INSTALACION` |

## 0. Origen y trazabilidad de producto

| Objetivo | Requisito de producto | Caso de uso | Requisito de esta spec | Fuente |
|---|---|---|---|---|
| OBJ-006 | PRD-RF-015 | UC-013 | RF-01 | SRC-017, SRC-018 |
| OBJ-006 | PRD-RF-016, PRD-RF-017 | UC-013 | RF-02 | SRC-017, SRC-018 |
| OBJ-006 | PRD-RF-018 | UC-013 | RF-03 | SRC-017, SRC-019, SRC-020 |
| OBJ-006 | PRD-RF-018 | UC-013 | RF-04 | SRC-017, SRC-020, SRC-021 |

**Corte aprobado**: `FEAT-007`. **Discrepancias que afectan a esta spec**: `DISC-012` y
`DISC-013`, resueltas para este corte. `DISC-011` solo mantiene pendiente el gate universal
brownfield y no altera la autorización de FEAT-007.

## 1. Problema

La entrega actual demuestra instalación y arranque, pero no que los recorridos funcionales
principales continúen operativos. Validarlos manualmente con proveedores reales arriesga créditos,
secretos, red y datos locales, y no produce evidencia repetible para cada cambio.

## 2. Objetivo y métrica de éxito

**Objetivo**: disponer de una validación automática de los recorridos críticos de v1 que sea
repetible, aislada, sin coste externo y bloqueante ante regresiones.

**Cómo sabremos que funcionó**:

- El 100 % de los recorridos obligatorios termina sin credenciales reales ni accesos externos.
- Dos ejecuciones consecutivas parten de estado independiente y dejan los datos normales intactos.
- Un intento externo o una simulación ausente hace fallar el control antes de usar la capacidad real.
- El control obligatorio bloquea la entrega cuando un recorrido falla.

## 3. Usuarios y contexto de uso

| Perfil | Qué necesita | Frecuencia | Contexto |
|---|---|---|---|
| Persona responsable de entrega | Evidencia fiable sin riesgo económico o de datos | En cada cambio candidato | Equipo local y automatización de entrega |
| Persona mantenedora | Diagnóstico reproducible de una regresión | Cuando falla un recorrido | Copia limpia y estado temporal |

## 4. Requisitos funcionales (EARS) con prioridad MoSCoW

| Id | Requisito | Prioridad | Esfuerzo |
|---|---|---|---:|
| **RF-01** | MIENTRAS se ejecuta la validación simulada, el sistema DEBE mantener persistencia, credenciales, sesiones, cachés y recursos completamente separados del uso normal. | M | 5 |
| **RF-02** | SI una parte del sistema intenta usar un destino externo o una capacidad sin simulación, ENTONCES el sistema DEBE bloquearla antes de realizar el efecto y fallar sin alternativa real. | M | 5 |
| **RF-03** | CUANDO se ejecuta un escenario simulado, el sistema DEBE reproducir respuestas y transiciones deterministas para preparación, análisis, mercado, contenido, demostración propia, clips y recuperación. | S | 8 |
| **RF-04** | CUANDO se valida una entrega, el sistema DEBE ejecutar los recorridos obligatorios sin secretos, conservar evidencia mínima y bloquear la entrega si alguno falla. | C | 3 |

### Reparto MoSCoW

| Prioridad | Esfuerzo | % | Límite recomendado |
|---|---:|---:|---|
| Must | 10 | 47,6 % | ≤ 60 % |
| Should | 8 | 38,1 % | contingencia funcional |
| Could | 3 | 14,3 % | contingencia operativa |
| **Total** | 21 | 100 % | |

**Won't have this time**:

| Id | Qué se descarta | Por qué ahora no | ¿Volverá? |
|---|---|---|---|
| RF-W01 | Validaciones automáticas contra proveedores reales | Podrían consumir créditos y requieren secretos/red | Solo mediante ejecución manual autorizada |
| RF-W02 | Gate de cobertura y accesibilidad | No existe una medición calibrada y ampliaría el corte | Sí, en corte posterior |

## 5. Requisitos no funcionales

| Categoría | Requisito | Valor objetivo |
|---|---|---|
| Rendimiento | La suite no debe convertirse en un cono de E2E | objetivo inicial inferior a 10 minutos, medido antes de fijarlo como umbral |
| Disponibilidad | No depende de proveedores remotos durante la ejecución | 100 % local |
| Escala | Una ejecución aislada por proceso de entrega | concurrencia rechazada o aislada explícitamente |
| Seguridad y privacidad | Sin secretos, datos reales ni salida externa | ASVS 5.0.0 L2; fallo cerrado |
| Accesibilidad | No se modifica UI | sin gate nuevo en este corte |
| Observabilidad | Resumen de capacidades simuladas y accesos externos | cero accesos externos; conteo de simulaciones |
| Coste | No consumir servicios externos | 0 créditos y 0 llamadas pagadas |
| Retención de datos | Estado temporal eliminable tras la ejecución | artefactos solo ante fallo y con retención corta |

### 5.1 · Clasificación de seguridad

| Señal | Aplica | Requisito / caso afectado | Fuente o motivo |
|---|---|---|---|
| Autenticación o sesión | sí | RF-01, CA-07 | credenciales ficticias y sesión privada local |
| Autorización, roles, IDOR o multi-tenant | no | — | aplicación local de un operador; no se añade autorización |
| PII, pagos, ficheros o administración | sí | RF-01, CA-01 | ficheros temporales, Vault y medios |
| Integración externa, webhook o agente/LLM | sí | RF-02, RF-03, CA-02, CA-03 | proveedores HTTP, CLI y búsqueda deben quedar simulados |

### 5.2 · Clasificación documental

| DOC-ID / estado | Superficie afectada | Audiencia | Motivo o comportamiento que cambia |
|---|---|---|---|
| DOC-README-INSTALACION | developer-readme | personas mantenedoras | documentar ejecución E2E, aislamiento y ausencia de proveedores reales |

### 5.3 · Clasificación de usabilidad

| Señal | Aplica | Requisito / caso afectado | Fuente o motivo |
|---|---|---|---|
| Pantalla nueva o modificada | no | — | solo se validan pantallas existentes |
| Formulario o entrada de datos | no | — | no cambia contratos de formularios |
| Espera perceptible (> 300 ms) | no | — | el tiempo pertenece al runner, no a una nueva experiencia |
| Texto de interfaz nuevo | no | — | los mensajes existentes son aserciones, no cambios |

## 6. Criterios de aceptación

### CA-01 — Estado temporal aislado *(cubre RF-01)*
```gherkin
Escenario: Ejecutar junto a una instalación con datos
  Dado que existen proyectos, Vault, sesiones y medios de uso normal
  Cuando se ejecuta dos veces la validación simulada
  Entonces cada ejecución usa estado independiente
  Y los hashes y conteos de los datos normales no cambian
```

### CA-02 — Salida externa bloqueada *(cubre RF-02)*
```gherkin
Escenario: Intentar una petición externa
  Dado el modo de validación activo
  Cuando navegador o servidor intenta acceder a un destino no local
  Entonces el intento falla antes de conectar
  Y el resultado identifica la política sin revelar secretos
```

### CA-03 — Simulación sin fallback *(cubre RF-02, RF-03)*
```gherkin
Escenario: Solicitar una respuesta no simulada
  Dado un escenario sin fixture registrado
  Cuando una capacidad intenta resolverlo
  Entonces falla de forma cerrada
  Y no ejecuta proveedor, búsqueda, descarga o CLI real
```

### CA-04 — Arranque básico *(cubre RF-03)*
```gherkin
Escenario: Abrir una instalación temporal vacía
  Dado un entorno sin claves
  Cuando arranca la aplicación
  Entonces salud, panel principal y Ajustes están disponibles
  Y las capacidades ausentes se muestran degradadas sin romper el recorrido
```

### CA-05 — Proyecto, dossier y mercado *(cubre RF-03)*
```gherkin
Escenario: Analizar una web local
  Dado una fuente web local de prueba
  Cuando se crea un proyecto y se completan análisis y ampliación de mercado
  Entonces el progreso es observable
  Y dossier, competencia, leads y virales quedan persistidos sin duplicados
```

### CA-06 — Contenido simulado *(cubre RF-03)*
```gherkin
Escenario: Generar por las dos ramas audiovisuales
  Dado un viral y recursos locales
  Cuando se ejecutan las ramas de vídeo generativo y avatar con voz
  Entonces ambas atraviesan estados pendientes y completados deterministas
  Y las piezas quedan revisables con recursos locales
```

### CA-07 — Contenido propio y clips *(cubre RF-01, RF-03)*
```gherkin
Escenario: Validar acceso privado y laboratorio
  Dado credenciales ficticias y recursos audiovisuales locales
  Cuando se navega una ruta privada, se remonta una pieza y se reanuda un trabajo de clips
  Entonces la contraseña nunca se devuelve
  Y los resultados terminados no se regeneran ni usan red externa
```

### CA-08 — Recuperación y gate bloqueante *(cubre RF-03, RF-04)*
```gherkin
Escenario: Encontrar una regresión simulada
  Dado un error, espera agotada o respuesta inválida controlada
  Cuando se ejecuta el control de entrega
  Entonces muestra un error seguro y una recuperación representativa
  Y el gate falla con evidencia de cero accesos externos
```

### Matriz RF → CA

| OBJ | PRD-RF | UC | RF | CA |
|---|---|---|---|---|
| OBJ-006 | PRD-RF-015 | UC-013 | RF-01 | CA-01, CA-07 |
| OBJ-006 | PRD-RF-016, PRD-RF-017 | UC-013 | RF-02 | CA-02, CA-03 |
| OBJ-006 | PRD-RF-018 | UC-013 | RF-03 | CA-03 a CA-08 |
| OBJ-006 | PRD-RF-018 | UC-013 | RF-04 | CA-08 |

## 7. Casos límite

| Situación | Comportamiento esperado |
|---|---|
| Modo ausente o valor desconocido | comportamiento normal o rechazo de configuración; nunca mock implícito |
| Dos ejecuciones simultáneas | aislamiento por ejecución o rechazo comprensible |
| Ruta con espacios | mismo resultado que una ruta simple |
| Credencial real presente accidentalmente | no se lee, usa ni muestra |
| Fixture corrupto | fallo cerrado antes del proveedor |
| Sistema externo caído | irrelevante para el resultado; la suite no lo consulta |
| Ejecución interrumpida | estado temporal limpiable y siguiente ejecución independiente |

## 8. Reglas de negocio

- **RN-01** — El modo simulado nunca puede recurrir a un adaptador real.
- **RN-02** — Solo se permiten destinos locales explícitos durante la validación.
- **RN-03** — Ningún dato de prueba comparte almacenamiento con el uso normal.
- **RN-04** — Ausencia de evidencia equivale a control no ejecutado, nunca a éxito.

## 9. Fuera de alcance

- Pruebas automáticas con proveedores reales, claves reales o Internet.
- Cambiar pantallas o comportamiento productivo por necesidades del test.
- Certificar compatibilidad vigente con APIs externas reales.
- Configurar cobertura, regresión visual, accesibilidad o mutación.
- Incluir modelos grandes, medios de terceros o contenido generado de pago.

## 10. Riesgos y dependencias

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Un camino evita la simulación | media | alto | política de salida fail-closed y prueba negativa |
| Contaminación de datos locales | baja | crítico | raíz temporal completa y prueba de hashes/conteos |
| Mocks que replican detalles y mienten | media | alto | puertos propios, contratos y fixtures centrados en comportamiento |
| Suite lenta o inestable | media | medio | pocos E2E, estados exhaustivos en contratos, espera por condiciones |
| API real cambia | alta | medio | riesgo explícito; validación manual separada |

## 11. Supuestos confirmados

- Windows 11 sigue siendo la plataforma de referencia.
- El modo simulado es explícito y el comportamiento normal permanece inalterado por defecto.
- Los estados exhaustivos viven en contratos/integración y E2E conserva una recuperación representativa.
- Coverage y a11y quedan fuera del núcleo.

## 12. Glosario

| Término | Definición |
|---|---|
| Capacidad simulada | Doble determinista de una integración controlado por la suite |
| Acceso externo | Comunicación fuera de los destinos locales autorizados |
| Estado temporal | Persistencia, Vault, sesiones, cachés y medios exclusivos de una ejecución |
| Fail-closed | Rechazo seguro ante una simulación o configuración ausente |

## 13. Preguntas abiertas

Ninguna.

## 14. Gate humano de especificación

| Campo | Valor |
|---|---|
| **Estado** | approved |
| **Aprobado por** | norkc |
| **Fecha** | 2026-08-27 |
| **Alcance de la decisión** | FEAT-007 · RF-01 a RF-04 · CA-01 a CA-08 |
| **Condiciones** | cero llamadas reales, cero créditos, datos locales intactos y sin merge/push a main sin autorización |

La aprobación corresponde al mensaje «OK hazlo» tras la presentación del plan proporcional.
