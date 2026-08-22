# 001 · Bandeja de contenido e instalación local

| Campo | Valor |
|---|---|
| **ID** | `001-content-tray-local-installation` |
| **Estado** | aprobada |
| **Autor** | spec-analyst |
| **Fecha** | 2026-08-21 |
| **Rama** | No creada por solicitud de la persona usuaria. |
| **Depende de** | ninguna |
| **Corte vertical** | FEAT-002 y FEAT-006: revisión consistente de piezas y clonación limpia preparada. |
| **Baseline de producto** | [`docs/product/PRD.md`](../../product/PRD.md) · estado `approved` asumido por instrucción de la persona usuaria. |
| **Fuentes** | [`docs/product/SOURCES.md`](../../product/SOURCES.md) · `SRC-001`, `SRC-002`, `SRC-009` a `SRC-016` |
| **Impacto de seguridad** | `sensible` |
| **Impacto de usabilidad** | `aplicable` |
| **Impacto de documentación** | `aplicable · DOC-README-INSTALACION` |

> Esta spec describe qué debe ocurrir y por qué. No decide estructura, interfaces de programación, herramientas ni mecanismo de configuración.

---

## 0. Origen y trazabilidad de producto

| Objetivo | Requisito de producto | Caso de uso | Requisito de esta spec | Fuente |
|---|---|---|---|---|
| OBJ-005 | PRD-RF-007 | UC-010 | RF-01, RF-02 | SRC-001, SRC-013, SRC-014, SRC-016 |
| OBJ-005 | PRD-RF-012 | UC-010 | RF-03 | SRC-001, SRC-013, SRC-016 |
| OBJ-004 | PRD-RF-005 | UC-011 | RF-04 | SRC-001, SRC-002, SRC-012, SRC-015, SRC-016 |
| OBJ-004 | PRD-RF-006 | UC-012 | RF-05, RF-07, RF-08 | SRC-001, SRC-002, SRC-011, SRC-016 |
| OBJ-004 | PRD-RF-008 | UC-011 | RF-06 | SRC-001, SRC-002, SRC-009, SRC-010, SRC-016 |

**Discrepancias que afectan a esta spec**: `DISC-008`, `DISC-009` y `DISC-010` están resueltas en el baseline aprobado. La decisión `P1` preserva los datos locales existentes, incompletos o incompatibles y bloquea el arranque con diagnóstico hasta su resolución.

## 1. Problema

La persona responsable de contenido puede ver una pieza activa en el carrusel y el detalle de otra, porque varias formas de cambiar la selección no actualizan el mismo detalle. Además, necesita desplegar guiones de varias piezas sin que una acción altere las demás.

La persona que clona el proyecto en Windows 11 no dispone todavía de un recorrido verificable que deje preparada la persistencia local y el arranque. El arranque existente puede afectar procesos y caché sin diagnóstico ni confirmación, y no diferencia un bloqueo obligatorio de una capacidad opcional. Esto provoca errores de configuración de persistencia, resultados ambiguos y exposición innecesaria de información local durante la recuperación.

## 2. Objetivo y métrica de éxito

**Objetivo**: permitir revisar una colección de piezas sin contradicciones y preparar una clonación limpia en Windows 11 para el uso local básico, con diagnósticos seguros y capacidades opcionales visibles.

**Cómo sabremos que funcionó**:
- El 100% de los cambios de pieza activa mediante tarjeta lateral, control anterior/siguiente o indicador muestra el detalle de esa misma pieza en una única activación.
- El 100% de las unidades visibles en una lista recién abierta empiezan plegadas y cada acción de despliegue conserva el estado de las demás unidades.
- En una clonación limpia de Windows 11, la guía y el asistente permiten alcanzar el arranque local sin un error de configuración de persistencia obligatoria, o terminan con un único bloqueo accionable y su siguiente paso.
- El 100% de las capacidades externas o herramientas opcionales ausentes se identifican por separado, sin declararlas requisito para considerar preparado el uso local básico.

## 3. Usuarios y contexto de uso

| Perfil | Qué necesita | Frecuencia | Contexto |
|---|---|---|---|
| Responsable de contenido | Revisar la pieza seleccionada y consultar varios guiones sin perder el contexto. | Durante cada revisión de piezas. | Colección local de una o más piezas, con teclado o puntero. |
| Persona que instala o clona el proyecto | Preparar y arrancar una copia local sin conocer configuración interna ni divulgar datos locales. | Primera clonación y recuperación tras un fallo. | Equipo con Windows 11 y una copia limpia del proyecto. |

## 4. Requisitos funcionales (EARS) con prioridad MoSCoW

| Id | Requisito | Prioridad | Esfuerzo |
|---|---|---:|---:|
| **RF-01** | CUANDO la persona cambia la pieza activa mediante una tarjeta lateral, un control anterior/siguiente o un indicador, el sistema DEBE actualizar inmediatamente el detalle para identificar y mostrar esa misma pieza sin una segunda activación. | M | 3 |
| **RF-02** | SI la pieza activa deja de estar disponible y queda una pieza vecina, ENTONCES el sistema DEBE convertir una pieza vecina en la pieza activa y actualizar su detalle; SI no queda ninguna, DEBE mostrar un estado vacío sin detalle residual. | M | 2 |
| **RF-03** | CUANDO la persona abre la vista de lista de una colección, el sistema DEBE presentar cada unidad plegada inicialmente y DEBE permitir cambiar el despliegue de una unidad sin cambiar el de las demás. | C | 3 |
| **RF-04** | CUANDO una persona sigue la guía desde una clonación limpia en Windows 11, el sistema DEBE indicar los requisitos obligatorios, la preparación de dependencias, la configuración de persistencia local y el arranque necesario para evitar un error de configuración de persistencia ausente. | M | 3 |
| **RF-05** | CUANDO una persona inicia el asistente de instalación en consola en Windows 11, el sistema DEBE comprobar el entorno antes de efectuar cambios; si detecta datos locales existentes, incompletos o incompatibles, DEBE preservarlos y bloquear el arranque con un diagnóstico accionable. Cualquier reinicio que pueda descartarlos DEBE requerir una confirmación separada de la confirmación del diagnóstico. | M | 5 |
| **RF-06** | MIENTRAS la guía o el asistente informa el estado de preparación, el sistema DEBE diferenciar los requisitos obligatorios de las capacidades opcionales bloqueadas y DEBE indicar el efecto funcional de cada capacidad opcional ausente. | S | 3 |
| **RF-07** | SI falla una comprobación, preparación o arranque, ENTONCES el sistema DEBE identificar la categoría que falló, ofrecer un siguiente paso de recuperación y evitar divulgar valores de configuración, credenciales, rutas personales o datos locales. | S | 5 |
| **RF-08** | CUANDO una persona vuelve a ejecutar el asistente tras una interrupción o tras corregir un bloqueo, el sistema DEBE volver a mostrar el estado comprobado de cada paso y NO DEBE declarar funcional el proyecto sin que las comprobaciones obligatorias hayan concluido correctamente. | C | 2 |

### Reparto MoSCoW

| Prioridad | Esfuerzo | % | Límite recomendado |
|---|---:|---:|---|
| Must | 13 | 50% | **≤ 60%** |
| Should | 8 | 31% | ~20% |
| Could | 5 | 19% | ~20% — contingencia deliberada |
| **Total** | **26** | **100%** | |

Por decisión humana, **RF-06** se clasifica como Should. El esfuerzo Must queda en el 50% y conserva margen de contingencia; Should concentra el 31% al incorporar este requisito, mientras Could mantiene el 19% de contingencia deliberada.

**Won't have this time**

| Id | Qué se descarta | Por qué ahora no | ¿Volverá? |
|---|---|---|---|
| **RF-W01** | Instalar, guardar, modificar o rotar secretos, claves o credenciales. | La instalación debe ser segura sin gestionar valores sensibles. | Solo mediante una spec dedicada. |
| **RF-W02** | Autenticar automáticamente la herramienta de IA. | La sesión debe iniciarla explícitamente la persona en su entorno local. | Podrá evaluarse como capacidad local separada. |
| **RF-W03** | Configurar proveedores externos. | No es necesario para preparar el uso local básico. | Sí, mediante su flujo de configuración existente o una spec posterior. |
| **RF-W04** | Convertir herramientas audiovisuales o de navegación opcionales en prerrequisitos del arranque local. | Su ausencia debe degradar capacidades concretas, no bloquear la preparación básica. | No en esta iteración. |

## 5. Requisitos no funcionales

| Categoría | Requisito | Valor objetivo |
|---|---|---|
| Rendimiento | El cambio de pieza activa debe reflejarse en la respuesta perceptible del detalle. | p95 menor de 100 ms desde la interacción local hasta el cambio perceptible. |
| Disponibilidad | El recorrido de revisión y el diagnóstico local deben comunicar estados recuperables. | No se declara éxito si falta una comprobación obligatoria. |
| Escala | La colección debe conservar coherencia de selección y despliegue al crecer. | Al menos 100 piezas en una colección local. |
| Seguridad y privacidad | Diagnósticos, guía y asistente no deben revelar configuración sensible ni datos locales. | Cero valores sensibles, rutas personales o contenidos de datos locales en la salida normal o de error. |
| Accesibilidad | La revisión de piezas y el asistente deben poder usarse sin depender de color, movimiento o puntero. | WCAG 2.2 AA; foco visible, estado activo perceptible y salida de consola lineal. |
| Internacionalización | La experiencia de esta iteración se dirige a la persona hispanohablante del producto local. | Español por defecto; no se introduce requisito de otro idioma. |
| Observabilidad | Los fallos y degradaciones deben poder diagnosticarse sin exponer información sensible. | Cada resultado identifica paso, categoría y estado final. |
| Coste | La preparación básica no exige capacidades de pago ni servicios externos. | Cero coste externo obligatorio para declarar preparado el uso local básico. |
| Retención de datos | La preparación no debe ocultar, eliminar ni presentar como válido un estado local no verificable. | Los datos locales existentes, incompletos o incompatibles se preservan y bloquean el arranque con diagnóstico; un reinicio potencialmente destructivo exige confirmación separada. |

### 5.1 · Clasificación de seguridad

| Señal | Aplica | Requisito / caso afectado | Fuente o motivo |
|---|---|---|---|
| Autenticación o sesión | No | RF-06, RF-W02 | La autenticación automática está expresamente fuera de alcance. |
| Autorización, roles, IDOR o multi-tenant | No | Todos | El alcance es local y no incorpora roles ni acceso entre personas. |
| PII, pagos, ficheros o administración | Sí | RF-04 a RF-08, UC-011, UC-012 | Puede inspeccionar o preparar estado local; sus mensajes deben proteger configuración y datos. |
| Integración externa, webhook o agente/LLM | No | RF-06, RF-W02 a RF-W04 | Las capacidades externas se limitan a informar su bloqueo visible; no se configuran ni autentican. |

La clasificación es `sensible` por el tratamiento de configuración y datos locales durante la preparación. La solución y sus controles se decidirán en fases posteriores.

### 5.2 · Clasificación documental

| DOC-ID / estado | Superficie afectada | Audiencia | Motivo o comportamiento que cambia |
|---|---|---|---|
| `DOC-README-INSTALACION` pendiente de alta en el contrato documental | Guía de inicio para personas instaladoras | Persona que clona el proyecto en Windows 11 | Debe ofrecer el recorrido verificable de clonación, preparación, degradaciones visibles y recuperación solicitados por RF-04, RF-06 y RF-07. |

### 5.3 · Clasificación de usabilidad

| Señal | Aplica | Requisito / caso afectado | Fuente o motivo |
|---|---|---|---|
| Pantalla nueva o modificada | Sí | RF-01 a RF-03, UC-010 | El carrusel, el detalle y la lista deben conservar la misma selección perceptible. |
| Formulario o entrada de datos | Sí | RF-05, UC-012 | La confirmación de efectos debe ser visible y comprensible antes de ejecutarlos. |
| Espera perceptible (> 300 ms) | Sí | RF-04 a RF-08, UC-011, UC-012 | La instalación y las comprobaciones pueden durar; su estado debe ser explícito. |
| Texto de interfaz nuevo | Sí | RF-04 a RF-08 | Guía y consola necesitan mensajes seguros, accionables y no ambiguos. |

## 6. Criterios de aceptación

### CA-01 — Sincronizar detalle de carrusel *(cubre RF-01)*
```gherkin
Escenario: Cambiar la pieza activa desde cualquier control del carrusel
  Dado una colección con al menos dos piezas
  Cuando la persona cambia la pieza activa mediante una tarjeta lateral, un control anterior/siguiente o un indicador
  Entonces el detalle identifica y muestra inmediatamente la misma pieza activa
  Y no necesita una segunda activación
```

### CA-02 — Sustituir una pieza activa ausente *(cubre RF-02)*
```gherkin
Escenario: Desaparecer la pieza activa con vecina disponible
  Dado una colección cuya pieza activa tiene una pieza vecina disponible
  Cuando la pieza activa deja de estar disponible
  Entonces una pieza vecina pasa a ser la pieza activa
  Y el detalle muestra esa pieza vecina

Escenario: Vaciar la colección activa
  Dado una colección cuya pieza activa es la última disponible
  Cuando la pieza activa deja de estar disponible
  Entonces se muestra un estado vacío
  Y no permanece visible el detalle de la pieza eliminada
```

### CA-03 — Mantener despliegues independientes *(cubre RF-03)*
```gherkin
Escenario: Consultar piezas desde la lista
  Dado una vista de lista con varias piezas
  Cuando la persona abre Contenido generado
  Entonces cada pieza aparece plegada
  Cuando despliega una pieza
  Entonces las demás piezas conservan su estado plegado o desplegado anterior
```

### CA-04 — Preparar clonación mediante guía *(cubre RF-04)*
```gherkin
Escenario: Seguir la guía desde una clonación limpia
  Dado una clonación limpia en Windows 11
  Cuando la persona sigue la guía de inicio
  Entonces conoce los requisitos obligatorios y los pasos de preparación local
  Y puede llegar al arranque local sin un error de configuración de persistencia ausente
```

### CA-05 — Confirmar efectos del asistente *(cubre RF-05)*
```gherkin
Escenario: Ejecutar un paso con efecto local
  Dado que el asistente ha detectado una acción que afecta procesos, caché o recursos fuera de la carpeta del proyecto
  Cuando la persona alcanza ese paso
  Entonces conoce el efecto y los recursos potencialmente afectados antes de actuar
  Y debe confirmarlo visiblemente antes de que el paso se ejecute

Escenario: Detectar datos locales no verificables
  Dado que el asistente detecta datos locales existentes, incompletos o incompatibles
  Cuando finaliza la comprobación previa al arranque
  Entonces conserva esos datos y bloquea el arranque con un diagnóstico accionable
  Y no ofrece un reinicio potencialmente destructivo como continuación automática del diagnóstico

Escenario: Solicitar un reinicio tras un bloqueo de datos
  Dado que el arranque está bloqueado por datos locales existentes, incompletos o incompatibles
  Cuando la persona solicita un reinicio que puede descartar esos datos
  Entonces recibe una confirmación separada que identifica la posible pérdida de datos
  Y el reinicio no se ejecuta sin esa confirmación separada
```

### CA-06 — Distinguir capacidades opcionales *(cubre RF-06)*
```gherkin
Escenario: Finalizar la preparación básica con capacidades opcionales ausentes
  Dado que los requisitos obligatorios de uso local básico están preparados
  Y falta una o más capacidades opcionales
  Cuando la persona consulta la guía o el resultado del asistente
  Entonces conoce que el proyecto local está preparado con el alcance aprobado
  Y ve cada capacidad opcional bloqueada junto con el efecto funcional de su ausencia
```

### CA-07 — Recuperar un fallo sin divulgar información *(cubre RF-07)*
```gherkin
Escenario: Fallar una comprobación de preparación local
  Dado que una comprobación, preparación o arranque falla
  Cuando la persona consulta el resultado
  Entonces conoce la categoría y el paso que fallaron
  Y recibe un siguiente paso de recuperación
  Y el mensaje no muestra valores de configuración, credenciales, rutas personales ni datos locales

Escenario: Bloquear el arranque por datos locales incompatibles
  Dado que una comprobación detecta datos locales incompatibles
  Cuando la persona consulta el resultado
  Entonces el diagnóstico indica que el arranque está bloqueado y cómo resolverlo
  Y no elimina ni expone el contenido de esos datos
```

### CA-08 — Repetir comprobaciones tras una interrupción *(cubre RF-08)*
```gherkin
Escenario: Reanudar el asistente después de corregir un bloqueo
  Dado que una ejecución anterior se interrumpió o terminó con un bloqueo
  Cuando la persona vuelve a iniciar el asistente
  Entonces vuelve a ver el estado comprobado de cada paso
  Y el resultado no declara funcional el proyecto hasta que los requisitos obligatorios estén comprobados correctamente

Escenario: Reintentar sin reinicio confirmado
  Dado que una ejecución anterior terminó bloqueada por datos locales existentes, incompletos o incompatibles
  Cuando la persona vuelve a iniciar el asistente sin haber confirmado un reinicio
  Entonces los datos permanecen preservados
  Y el asistente mantiene el bloqueo con su diagnóstico accionable
```

### Matriz RF → CA

| OBJ | PRD-RF | UC | RF | CA |
|---|---|---|---|---|
| OBJ-005 | PRD-RF-007 | UC-010 | RF-01 | CA-01 |
| OBJ-005 | PRD-RF-007 | UC-010 | RF-02 | CA-02 |
| OBJ-005 | PRD-RF-012 | UC-010 | RF-03 | CA-03 |
| OBJ-004 | PRD-RF-005 | UC-011 | RF-04 | CA-04 |
| OBJ-004 | PRD-RF-006 | UC-012 | RF-05 | CA-05 |
| OBJ-004 | PRD-RF-008 | UC-011 | RF-06 | CA-06 |
| OBJ-004 | PRD-RF-006 | UC-012 | RF-07 | CA-07 |
| OBJ-004 | PRD-RF-006 | UC-012 | RF-08 | CA-08 |

## 7. Casos límite

| Situación | Comportamiento esperado |
|---|---|
| Colección vacía | Mostrar estado vacío claro, sin detalle de una pieza anterior. |
| Colección con una pieza | Mantener esa única pieza como activa y mostrar su mismo detalle. |
| La colección cambia durante la revisión | No dejar el detalle asociado a una pieza inexistente; seleccionar vecina o vacío según RF-02. |
| Dos cambios rápidos de selección | El detalle termina identificando la última pieza activa, sin contradicción intermedia persistente. |
| Dos despliegues en lista | Cada unidad conserva su estado independiente. |
| Equipo fuera de Windows 11 | El asistente no declara preparación; comunica el alcance de plataforma y detiene el recorrido de instalación. |
| Falta un requisito obligatorio | No declarar el proyecto funcional; mostrar la categoría y recuperación correspondiente. |
| Falta una capacidad opcional o no hay red | Informar la degradación visible sin impedir el resultado básico si los requisitos obligatorios están preparados. |
| La persona rechaza una confirmación | No ejecutar la acción afectada; terminar o continuar solo con un estado que indique el bloqueo pendiente. |
| Reintento tras fallo o interrupción | Repetir las comprobaciones y no perder el diagnóstico disponible. |
| Datos locales existentes, incompletos o incompatibles | Preservarlos, bloquear el arranque y mostrar un diagnóstico accionable sin revelar su contenido; un reinicio potencialmente destructivo exige confirmación separada. |

## 8. Reglas de negocio

- **RN-01** — La pieza identificada como activa en el carrusel y la pieza del detalle deben ser siempre la misma.
- **RN-02** — El estado de despliegue pertenece a cada unidad de lista y una acción sobre una unidad no altera las demás.
- **RN-03** — El proyecto solo se declara funcional cuando los requisitos obligatorios de preparación y arranque han sido comprobados correctamente.
- **RN-04** — La ausencia de una capacidad opcional debe ser visible, pero no puede transformar esa capacidad en prerrequisito del uso local básico.
- **RN-05** — Ningún mensaje de guía, comprobación, error o recuperación revela secretos, valores de configuración, rutas personales ni datos locales.
- **RN-06** — Toda acción con efecto fuera de la carpeta del proyecto, sobre procesos o sobre caché requiere confirmación visible previa.
- **RN-07** — Los datos locales existentes, incompletos o incompatibles se preservan y bloquean el arranque hasta su resolución; un reinicio que pueda descartarlos requiere una confirmación separada.

## 9. Fuera de alcance

- Instalar, gestionar, almacenar, mostrar, modificar o rotar secretos, claves o credenciales.
- Autenticar automáticamente la herramienta de IA o pedir credenciales mediante la guía o el asistente.
- Configurar proveedores externos, sus claves o su conectividad.
- Convertir herramientas audiovisuales, de navegación o capacidades externas opcionales en prerrequisitos de la preparación básica local.
- Reiniciar o eliminar automáticamente datos locales existentes, incompletos o incompatibles.
- Añadir soporte de instalación guiada fuera de Windows 11.
- Publicar contenido, modificar el contenido de una pieza o cambiar sus flujos de generación.
- Diseñar la apariencia, estructura interna o mecanismos concretos de la guía, asistente, persistencia o carrusel.

## 10. Riesgos y dependencias

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| La preparación modifica o elimina datos locales existentes. | Baja | Alto | Preservar y bloquear con diagnóstico; exigir una confirmación separada para cualquier reinicio potencialmente destructivo. |
| Un mensaje de diagnóstico revela información local sensible. | Media | Alto | Aplicar RN-05 y validar mensajes de éxito, error y recuperación. |
| La persona confunde una capacidad opcional con un bloqueo obligatorio. | Media | Medio | Mantener clasificación visible y conclusión inequívoca en RF-06. |
| La selección y el detalle divergen tras cambios rápidos o eliminación. | Media | Medio | Validar CA-01 y CA-02 incluyendo colección cambiante. |
| La clasificación detallada de capacidades opcionales se retrasa. | Media | Medio | RF-06 permanece trazado como Should y el uso local básico no depende de esa clasificación. |
| Falta contrato documental para la guía requerida. | Alta | Medio | Dar de alta `DOC-README-INSTALACION` antes del plan y conservar su trazabilidad documental. |

## 11. Supuestos

- La aprobación de producto indicada por la persona usuaria cubre los límites de Windows 11, npm, RRSS Studio como nombre de guía, la definición de uso local básico y las capacidades opcionales visibles.
- La persona que ejecuta la guía o el asistente puede revisar y conceder o rechazar confirmaciones sobre su propio equipo.
- El objetivo de p95 menor de 100 ms para el cambio local de detalle es una propuesta de calidad que debe validarse en la fase de diseño.
- `DOC-README-INSTALACION` es un identificador propuesto para trazar la guía obligatoria y deberá incorporarse al contrato documental por su propietario antes de la planificación.

## 12. Glosario

| Término | Definición |
|---|---|
| Pieza activa | Pieza que la colección marca como seleccionada para revisión. |
| Detalle | Información y acciones visibles de la pieza activa. |
| Vecina | Pieza disponible inmediatamente anterior o posterior a la pieza que deja de estar disponible. |
| Uso local básico | Arranque local con persistencia obligatoria preparada, sin exigir capacidades externas u opcionales. |
| Capacidad opcional bloqueada | Función no disponible cuya ausencia se comunica sin invalidar el uso local básico. |
| Bloqueo accionable | Resultado que identifica qué impide continuar y qué persona debe hacer a continuación. |

## 13. Preguntas abiertas

No quedan preguntas abiertas ni marcadores de clarificación.

## 14. Gate humano de especificación

| Campo | Valor |
|---|---|
| **Estado** | `approved` |
| **Aprobado / rechazado por** | norkc |
| **Fecha** | 2026-08-21 |
| **Alcance de la decisión** | RF-01 a RF-08, CA-01 a CA-08 y `DOC-README-INSTALACION`; P1 y P2 ya están resueltas en `clarifications.md`. |
| **Condiciones** | Ninguna. |

### HANDOFF
- Agente origen: spec-analyst
- Fase completada: clarify
- Fuentes consultadas: SRC-001, SRC-002, SRC-009, SRC-010, SRC-011, SRC-012, SRC-013, SRC-014, SRC-015, SRC-016
- Artefactos: `docs/specs/001-content-tray-local-installation/spec.md`, `docs/specs/001-content-tray-local-installation/clarifications.md`
- Requisitos / casos cubiertos: FEAT-002 y FEAT-006; OBJ-005 → PRD-RF-007, PRD-RF-012 → UC-010; OBJ-004 → PRD-RF-005, PRD-RF-006, PRD-RF-008 → UC-011, UC-012
- Discrepancias: DISC-008, DISC-009 y DISC-010 cubiertas como resueltas por el baseline; ninguna abierta en esta spec.
- Decisiones tomadas: P1 preserva los datos locales existentes, incompletos o incompatibles y bloquea el arranque con diagnóstico; cualquier reinicio potencialmente destructivo exige confirmación separada. P2 baja RF-06 a Should y deja Must en el 50% del esfuerzo.
- Supuestos: los indicados en la sección 11.
- Bloqueos: alta del identificador documental antes de planificar.
- Siguiente agente sugerido: ux-designer — motivo: diseñar la interfaz y los recorridos de consola de la spec aprobada.
- Comando / contexto durable: `/sdd-design`; releer `docs/specs/001-content-tray-local-installation/spec.md`, `clarifications.md`, `docs/product/SOURCES.md` y `docs/design/INTAKE-REVIEW.md`.