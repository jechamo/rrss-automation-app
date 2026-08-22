# PRD · Baseline de producto RRSS Studio

| Campo | Valor |
|---|---|
| Estado | `legacy-pending` |
| Preparado para revisión | 2026-08-21 |
| Aprobado por | No aprobado |
| Fecha de aprobación | No aplica hasta gate humano |
| Alcance aprobado | Baseline heredado completo y solicitud de mejora de 2026-08-21: Windows 11 exclusivamente; instalación funcional con dependencias, persistencia local y arranque preparados; capacidades externas opcionales y bloqueadas visibles; confirmación previa de efectos fuera de la carpeta del proyecto, procesos y caché; sincronía de carrusel, selección vecina al desaparecer la activa y lista plegada independiente; guía de RRSS Studio con npm. |

## Propósito, problema y personas

RRSS Studio es una aplicación local para que una persona responsable de una app web pueda pasar de entender su producto y mercado a revisar contenido audiovisual listo para publicar de forma asistida. El valor se pierde cuando el análisis, la creación, los recursos audiovisuales y la preparación del equipo dependen de pasos manuales inconexos o de una instalación frágil.

| Persona | Necesidad | Contexto |
|---|---|---|
| Responsable de una app web | Comprender producto, mercado y oportunidades sin repetir información | Crea y mantiene uno o varios proyectos locales |
| Responsable de contenido | Convertir hallazgos en piezas originales, revisarlas y prepararlas para publicar | Trabaja con virales, recursos de marca y demostraciones de la app |
| Persona que instala o clona el proyecto | Poner la aplicación en marcha sin conocer su configuración interna | Ordenador con Windows 11 |

## Objetivos

| ID | Resultado observable | Señal de éxito |
|---|---|---|
| OBJ-001 | Una app web se convierte en un dossier reutilizable y en hallazgos de mercado editables. | La persona completa el flujo de análisis y puede reutilizar su resultado en los flujos posteriores. |
| OBJ-002 | Los hallazgos se convierten en piezas de contenido originales revisables antes de publicar. | La persona puede crear, revisar, regenerar o descartar piezas sin publicación automática. |
| OBJ-003 | Los recursos audiovisuales y las demostraciones propias se pueden revisar, combinar y conservar por proyecto. | La persona identifica qué recurso se usa, obtiene una nueva versión y elige explícitamente cuál queda como final. |
| OBJ-004 | Una copia limpia en el alcance de plataforma que apruebe la persona queda preparada para arrancar sin error de configuración de persistencia. | Un recorrido guiado termina con la aplicación local accesible y sin un error de configuración faltante de la persistencia local, indicando por separado las capacidades opcionales pendientes. |
| OBJ-005 | Revisar muchas piezas no desorienta a la persona entre el carrusel, el detalle y la lista. | Cualquier cambio de pieza activa en el carrusel actualiza el mismo detalle; las unidades de lista permanecen independientes y plegadas inicialmente. |

## Requisitos de producto

> Las prioridades ordenan trabajo futuro sobre el baseline heredado; no reescriben el estado histórico de funcionalidades ya documentadas. El reparto se calcula por esfuerzo relativo, no por número de filas.

| ID | OBJ | Requisito EARS | Pri. | Esfuerzo | Fuente |
|---|---|---|---|---:|---|
| PRD-RF-001 | OBJ-001 | El sistema DEBE permitir crear un proyecto a partir de una app web y producir un dossier editable que distinga la evidencia disponible de la información aportada por la persona. | M | 3 | SRC-005, SRC-006, SRC-008 |
| PRD-RF-002 | OBJ-001 | CUANDO existe un dossier, el sistema DEBE permitir analizar competencia, oportunidades locales y contenido viral del nicho, conservando las aportaciones manuales al actualizar resultados. | M | 3 | SRC-005, SRC-006, SRC-008 |
| PRD-RF-003 | OBJ-002 | CUANDO la persona elige un contenido viral como referencia, el sistema DEBE producir una interpretación original vinculada a su proyecto y dejarla disponible para revisión. | M | 5 | SRC-005, SRC-006, SRC-008 |
| PRD-RF-004 | OBJ-002 | CUANDO una pieza está lista para revisión, el sistema DEBE permitir previsualizarla, regenerarla, eliminarla o prepararla para publicación asistida sin publicar por sí solo. | M | 3 | SRC-005, SRC-006, SRC-008 |
| PRD-RF-005 | OBJ-004 | CUANDO una persona parte de una clonación limpia en Windows 11, el sistema DEBE ofrecer una configuración inicial que prepare las dependencias, la persistencia local y el arranque de la aplicación sin requerir que conozca variables internas de persistencia. | M | 5 | SRC-001, SRC-002, SRC-012, SRC-015, SRC-016 |
| PRD-RF-006 | OBJ-004 | CUANDO una persona ejecuta la instalación guiada en consola en Windows 11, el sistema DEBE informar los requisitos faltantes, confirmar antes los efectos fuera de la carpeta del proyecto, los procesos y la caché, y comunicar claramente si el proyecto quedó funcional o qué impide conseguirlo. | M | 5 | SRC-001, SRC-002, SRC-011, SRC-016 |
| PRD-RF-007 | OBJ-005 | CUANDO la persona cambia la pieza activa mediante una tarjeta lateral, un control anterior/siguiente o un indicador del carrusel de contenido generado, el sistema DEBE actualizar inmediatamente el detalle inferior para mostrar esa misma pieza sin requerir una segunda activación; SI la pieza activa desaparece y queda otra disponible, el sistema DEBE seleccionar una pieza vecina. | M | 3 | SRC-001, SRC-013, SRC-014, SRC-016 |
| PRD-RF-008 | OBJ-004 | El sistema DEBE ofrecer una guía de README de RRSS Studio que use npm para instalar, configurar y arrancar el proyecto, e indique como capacidades opcionales y bloqueadas visibles la herramienta de IA autenticada, las claves externas y las herramientas audiovisuales o de navegación. | M | 3 | SRC-001, SRC-002, SRC-009, SRC-010, SRC-016 |
| PRD-RF-009 | OBJ-003 | CUANDO la persona quiere mostrar una funcionalidad de su propia app, el sistema DEBE permitir crear una pieza propia mediante una demostración automatizada o una grabación aportada por ella. | S | 5 | SRC-005, SRC-006, SRC-008 |
| PRD-RF-010 | OBJ-003 | CUANDO una pieza tiene recursos audiovisuales disponibles, el sistema DEBE permitir organizarlos, previsualizarlos y generar versiones sin sustituir el resultado final hasta una elección explícita. | S | 5 | SRC-005, SRC-006, SRC-008 |
| PRD-RF-011 | OBJ-002 | El sistema DEBE permitir configurar capacidades externas de forma local, informar su disponibilidad y proteger sus credenciales de uso. | S | 3 | SRC-005, SRC-006, SRC-008 |
| PRD-RF-012 | OBJ-005 | CUANDO la persona abre Contenido generado en vista de lista, el sistema DEBE mostrar cada unidad plegada inicialmente y permitir desplegar o plegar cada una sin cambiar el estado de las demás. | C | 3 | SRC-001, SRC-013, SRC-016 |
| PRD-RF-013 | OBJ-003 | CUANDO la persona aporta un vídeo largo, el sistema DEBE poder proponer o conservar una selección editorial de clips verticales y mantener su historial de resultados. | C | 5 | SRC-005, SRC-006, SRC-008 |
| PRD-RF-014 | OBJ-001 | MIENTRAS un análisis o una generación está en curso, el sistema DEBE mostrar progreso, resultado y errores recuperables de forma comprensible. | C | 5 | SRC-005, SRC-006, SRC-008 |

### Reparto MoSCoW por esfuerzo

| Prioridad | Esfuerzo | Porcentaje | Lectura |
|---|---:|---:|---|
| Must | 30 | 52% | Flujo principal, preparación de clonación e interacción propuesta, pendiente de gate. |
| Should | 13 | 22% | Capacidades heredadas de alto valor que requieren confirmación operativa. |
| Could | 13 | 22% | Evolución y pulido recuperables si hay restricción de capacidad. |
| Won't | 0 | 0% | Sin elementos adicionales en esta propuesta. |
| Total | 58 | 100% | El esfuerzo Must se mantiene por debajo del 60%. |

## Reglas y límites de producto

- El producto es local y su idioma por defecto es español.
- La persona revisa y decide antes de publicar; la publicación automática en redes no pertenece al baseline.
- Las piezas inspiradas en virales deben ser reinterpretaciones originales, no copias literales.
- Los datos, credenciales y recursos del proyecto deben tratarse como información local y no deben exponerse por la documentación ni por mensajes de error.
- La herramienta de IA autenticada, las claves externas y las herramientas audiovisuales o de navegación son capacidades opcionales: su ausencia se muestra como bloqueo visible sin impedir declarar funcional la instalación local preparada.
- Windows 11 es el único alcance de plataforma de la instalación guiada.
- Antes de una acción guiada con efecto, la persona debe conocer los efectos fuera de la carpeta del proyecto, sobre procesos y sobre caché, y debe confirmarlos visiblemente.
- La guía de instalación usa el nombre RRSS Studio y npm.

## Decisiones de alcance aprobadas

- La guía y el asistente se limitan a Windows 11.
- La instalación funcional prepara las dependencias, la persistencia local y el arranque. La herramienta de IA autenticada, las claves externas y las herramientas audiovisuales o de navegación permanecen opcionales y bloqueadas visibles cuando falten.
- El asistente solicita confirmación visible antes de cada efecto fuera de la carpeta del proyecto, sobre procesos o sobre caché.
- La pieza activa cambia desde tarjetas laterales, controles anterior/siguiente e indicadores, y cada cambio actualiza el detalle sin segunda activación.
- Si desaparece la pieza activa, se selecciona una pieza vecina disponible; solo se muestra vacío cuando no queda ninguna.

## Solicitud de 2026-08-21: criterios de éxito observables

### CA-PROD-001 · Detalle sincronizado del carrusel
```gherkin
Escenario: Cambiar la pieza activa en carrusel
	Dado que existen al menos dos piezas de contenido generado
	Cuando la persona cambia la pieza activa mediante una tarjeta lateral, un control o un indicador del carrusel
	Entonces el detalle inferior identifica y muestra inmediatamente la pieza activa sin una segunda activación

Escenario: Desaparecer la pieza activa
	Dado que la pieza activa tiene una pieza vecina disponible
	Cuando la pieza activa desaparece de la colección
	Entonces la pieza vecina pasa a ser la pieza activa
```

### CA-PROD-002 · Lista con despliegue independiente
```gherkin
Escenario: Revisar piezas desde la lista
	Dado que la vista de lista contiene varias piezas
	Cuando la persona abre Contenido generado
	Entonces cada pieza aparece plegada
	Y puede desplegar una pieza sin desplegar las demás
```

### CA-PROD-003 · Clonación limpia preparada
```gherkin
Escenario: Preparar una copia limpia
	Dado un clon nuevo del proyecto en Windows 11
	Cuando la persona completa el recorrido de configuración indicado
	Entonces puede arrancar la aplicación local
	Y no recibe un error por configuración ausente de la persistencia local
```

### CA-PROD-004 · Instalación guiada con resultado inequívoco
```gherkin
Escenario: Ejecutar el instalador guiado
	Dado un equipo Windows 11 que no está preparado por completo
	Cuando la persona ejecuta el instalador en consola
	Entonces ve los requisitos detectados, las acciones que debe confirmar y el resultado de cada paso
	Y conoce los efectos y recursos potencialmente afectados antes de confirmar una acción
	Y recibe una conclusión inequívoca de proyecto funcional o bloqueo accionable
```

### CA-PROD-005 · Guía de README utilizable
```gherkin
Escenario: Configurar el proyecto mediante README
	Dado una persona que acaba de clonar el proyecto
	Cuando sigue la guía de README
	Entonces puede identificar requisitos, configuración local, preparación de la herramienta de IA y pasos de arranque
	Y puede encontrar una recuperación para un fallo de configuración común
```

### CA-PROD-006 · Dossier con evidencia distinguible *(cubre PRD-RF-001)*
```gherkin
Escenario: Analizar una app web
	Dado un proyecto con una app web y sus fuentes disponibles
	Cuando la persona inicia el análisis
	Entonces obtiene un dossier editable
	Y puede distinguir la información aportada de la evidencia disponible
```

### CA-PROD-007 · Hallazgos editables *(cubre PRD-RF-002)*
```gherkin
Escenario: Actualizar hallazgos de mercado
	Dado un proyecto con dossier
	Cuando la persona solicita nuevos hallazgos de mercado
	Entonces puede revisar los resultados obtenidos
	Y conserva las aportaciones manuales que había mantenido
```

### CA-PROD-008 · Interpretación original *(cubre PRD-RF-003)*
```gherkin
Escenario: Crear una pieza desde una referencia viral
	Dado un proyecto con una referencia viral elegida
	Cuando la persona crea contenido
	Entonces recibe una pieza vinculada a su proyecto para revisión
	Y su contenido no reproduce literalmente la referencia
```

### CA-PROD-009 · Revisión bajo control humano *(cubre PRD-RF-004)*
```gherkin
Escenario: Revisar una pieza lista
	Dado una pieza disponible para revisión
	Cuando la persona abre sus acciones
	Entonces puede previsualizarla, regenerarla o eliminarla
	Y no se publica sin una acción explícita de la persona
```

### CA-PROD-010 · Demostración propia con alternativa *(cubre PRD-RF-009)*
```gherkin
Escenario: Mostrar una funcionalidad de la propia app
	Dado un proyecto y una funcionalidad seleccionada
	Cuando la persona crea una pieza propia
	Entonces puede revisar una demostración asociada a la pieza
	Y puede aportar una grabación cuando no sea posible obtenerla automáticamente
```

### CA-PROD-011 · Final explícito *(cubre PRD-RF-010)*
```gherkin
Escenario: Generar una versión audiovisual
	Dado recursos disponibles para una pieza
	Cuando la persona genera una versión
	Entonces puede previsualizarla antes de aplicarla
	Y el resultado final anterior no cambia hasta su elección explícita
```

### CA-PROD-012 · Capacidades configurables *(cubre PRD-RF-011)*
```gherkin
Escenario: Configurar una capacidad externa
	Dado una persona con una capacidad pendiente de configurar
	Cuando revisa su estado y completa su configuración local
	Entonces conoce si esa capacidad está disponible
	Y sus credenciales no se muestran en claro
```

### CA-PROD-013 · Clips con historial *(cubre PRD-RF-013)*
```gherkin
Escenario: Crear clips desde una fuente larga
	Dado una fuente de vídeo admitida
	Cuando la persona solicita una selección editorial o aporta una propia
	Entonces puede revisar los clips resultantes y su contexto
	Y conserva el historial de resultados de la fuente
```

### CA-PROD-014 · Ejecución recuperable *(cubre PRD-RF-014)*
```gherkin
Escenario: Seguir una ejecución afectada por un fallo
	Dado una ejecución en curso o fallida
	Cuando la persona consulta su estado
	Entonces ve progreso, resultado o un error comprensible
	Y puede identificar una acción de recuperación cuando exista
```

## Casos límite del baseline

| Situación | Comportamiento de producto esperado |
|---|---|
| Entrada vacía o incompleta | La persona recibe una indicación concreta de lo que falta y no se presenta un resultado inexistente como válido. |
| Colección sin piezas o con una sola pieza | La interfaz conserva un estado vacío claro o una revisión sin ambigüedad sobre la pieza activa. |
| Pieza eliminada o actualizada durante la revisión | El detalle no queda apuntando a una pieza inexistente; se muestra una selección válida o un estado vacío. |
| Dos acciones de despliegue en lista | El despliegue de una unidad no modifica las demás, salvo una acción explícita de la persona. |
| Persistencia local sin configurar en una clonación | La instalación o guía informa el bloqueo antes del arranque y ofrece un siguiente paso sin exponer valores sensibles. |
| Requisito de instalación ausente en Windows 11 | El instalador no comunica éxito; explica el requisito faltante y la acción que queda a cargo de la persona. |
| Servicio externo, herramienta opcional o red no disponible | El flujo informa la limitación y conserva resultados parciales o previos cuando corresponda. |
| Credencial inválida, cuota agotada o acceso denegado | El mensaje diferencia la causa para que la persona pueda actuar sin revelar el valor de la credencial. |
| Reintento tras una interrupción | La persona puede conocer el estado persistido y no debe perder el historial o los resultados ya válidos. |
| Datos existentes incompletos o corruptos | El sistema evita presentar información no verificable como resultado fiable y comunica la necesidad de recuperación. |

## Fuera de alcance de este baseline

- Aprobar producto, arquitectura, diseño, plan, tareas o implementación: este documento solo prepara el gate humano de intake.
- Publicación automática mediante credenciales de redes sociales, bots de publicación o gestión de cuentas de terceros.
- Servicio en la nube para terceros o operación multiusuario.
- Decidir cómo se implementa el instalador, qué herramientas invoca o cómo configura la persistencia.
- Sustituir las validaciones reales de proveedores, navegador, grabación o render audiovisual que aún requieren pruebas en el equipo de la persona usuaria.

## Supuestos limitados

- Se normalizan como baseline las capacidades documentadas hasta 2026-08-21, incluso cuando su validación final de usuario sigue pendiente.
- Los nombres históricos RRSS Studio y la marca visible observada no se consideran una decisión de renombrado.
- Una instalación funcional no exige que estén configurados servicios opcionales de pago; esta interpretación debe confirmarse antes de especificar el instalador.
- La evidencia de instalación y arranque se limita a Windows 11 y no permite decidir el alcance de otras plataformas, los efectos autorizados ni los datos locales potencialmente afectados.

## Preguntas que bloquean la aprobación

- [NEEDS CLARIFICATION: ¿Se confirma el alcance de plataforma, los recursos locales potencialmente afectados, los prerrequisitos obligatorios y las autorizaciones del asistente descritos en «Decisiones de alcance que debe resolver el gate humano»? Recomendación: aceptar el alcance propuesto de Windows 11, la declaración previa de efectos y la confirmación visible antes de efectos externos.]
- [NEEDS CLARIFICATION: ¿Qué significa exactamente «proyecto funcional» si faltan servicios opcionales? Recomendación: debe abrirse y permitir el flujo local básico con persistencia preparada; las funciones que dependan de credenciales o herramientas opcionales deben indicarse como bloqueadas o degradadas de forma visible.]
- [NEEDS CLARIFICATION: ¿Se confirma la interacción exacta de carrusel, detalle y lista descrita en PRD-RF-007, PRD-RF-012 y sus criterios, incluida la selección tras desaparecer la pieza activa? Recomendación: que todo cambio de activo sincronice el detalle y que solo se use un vacío cuando no quede ninguna pieza.]
- [NEEDS CLARIFICATION: La documentación heredada discrepa sobre el gestor de paquetes. ¿Se confirma el uso de npm indicado por la guía operativa actual para README e instalación? Recomendación: sí, porque es la instrucción operativa vigente del repositorio.]
- [NEEDS CLARIFICATION: ¿RRSS Studio debe conservarse como nombre de producto en la nueva README o debe usar la marca visible observada en la aplicación? Recomendación: conservar RRSS Studio hasta que se apruebe un cambio de marca explícito.]

## Gate humano de producto

Este baseline está listo para revisión, no aprobado. La aprobación debe cubrir objetivos, requisitos, casos de uso, límites, discrepancias de `SOURCES.md` y orden de los cortes de `FEATURE-MAP.md`.
