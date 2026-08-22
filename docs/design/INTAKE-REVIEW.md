# Revisión de diseño de intake — RRSS Studio

| Campo | Valor |
|---|---|
| Estado | `legacy-pending` · revisión informativa, no aprobada |
| Fecha | 2026-08-21 |
| Alcance | UC-010, UC-011 y UC-012; no sustituye una fase `/sdd-design` |
| Diseño externo | No proporcionado: sin Figma, Stitch, boceto ni captura accesible |
| Dirección visual | No evaluada ni propuesta en esta revisión; requiere gate humano antes de diseñar una spec |

## Fuentes y método

Se contrastaron los artefactos normalizados `docs/product/PRD.md`,
`docs/product/USE-CASES.md`, `docs/product/FEATURE-MAP.md` y
`docs/product/SOURCES.md` con evidencia local observada. No se leyó ninguna
credencial ni configuración privada, no se accedió a red y no se modificó
ningún artefacto de producto, código, script o configuración.

| Fuente | Acceso | Uso en esta revisión | Límite |
|---|---|---|---|
| SRC-001 · solicitud de 2026-08-21 | accesible | Contrato observable de carrusel, lista, README e instalación | No decide la solución ni el alcance interno del asistente. |
| SRC-002 · `AGENTS.md` | accesible | Contexto Windows 11, arranque, persistencia, CLI y herramientas opcionales | Es guía operativa, no aprobación de producto. |
| SRC-009 · `README.md` | parcial | Evidencia de la guía disponible para una clonación limpia | No contiene el recorrido verificable requerido por UC-011. |
| SRC-010 · `package.json` | parcial | Evidencia de comandos disponibles | No convierte comandos en recorrido de instalación. |
| SRC-011 · `iniciar.bat` | accesible | Evidencia del arranque limpio actual | No realiza diagnóstico ni instalación guiada de una clonación limpia. |
| SRC-012 · `.env.example` | accesible | Evidencia de plantilla de configuración local sin secretos | No se reproducen valores ni se infiere un mecanismo de configuración. |
| SRC-013 · `src/components/ContentTray.tsx` | accesible | Vista, detalle y despliegue por pieza observados | La implementación observada no sustituye el contrato de UX. |
| SRC-014 · `src/components/PieceCarousel.tsx` | accesible | Selección y previsualización de piezas observadas | No prueba por sí sola sincronía del detalle. |
| Anclaje adicional · `src/components/Carousel3D.tsx` | accesible | Cambio de elemento activo mediante controles del carrusel | Es evidencia local para DISC-008; no altera `SOURCES.md`. |

El diseño histórico en `docs/02-diseno.md` y la interfaz existente se tratan
como evidencia brownfield. No constituyen un diseño externo nuevo ni una
aprobación del cambio de producto normalizado.

## Cobertura del baseline

| Objetivo | Requisito | Caso | Corte propuesto | Cobertura de esta revisión |
|---|---|---|---|---|
| OBJ-005 | PRD-RF-007, PRD-RF-012 | UC-010 | FEAT-002 | Sincronía carrusel-detalle, lista plegada e independencia, estados y accesibilidad. |
| OBJ-004 | PRD-RF-005, PRD-RF-008 | UC-011 | FEAT-006 | Recorrido README desde clonación limpia, diagnóstico y recuperación sin secretos. |
| OBJ-004 | PRD-RF-006 | UC-012 | FEAT-006 | Recorrido de consola Windows 11, decisiones, bloqueos y conclusión inequívoca. |

## Flujos y pantallas observados

### UC-010 · Revisar una colección de piezas

**Pantalla/recorrido:** `Contenido generado`, con conmutación entre carrusel y
lista, y detalle inferior en la vista de carrusel.

**Flujo de producto esperado:**

1. La persona abre una colección que contiene una o más piezas.
2. Puede elegir la vista de lista o carrusel.
3. En carrusel cambia la pieza activa mediante tarjeta lateral, control anterior/siguiente o indicador.
4. El detalle inferior identifica y muestra inmediatamente la misma pieza activa.
5. En lista todas las unidades empiezan plegadas; abrir o cerrar una no altera las demás.
6. Si la pieza activa deja de existir durante la revisión, la colección muestra una selección válida o un vacío claro.

**Evidencia observada:**

- La lista guarda la expansión por identificador de pieza y parte de un estado sin expansiones. Esto respalda la expectativa de plegado inicial e independencia de PRD-RF-012.
- El detalle del carrusel recibe un identificador de foco, pero el carrusel solo lo comunica al activar una tarjeta que ya es central.
- Los controles anterior/siguiente, los indicadores y las tarjetas laterales cambian el elemento activo dentro del carrusel sin comunicar ese cambio al detalle inferior. Puede quedar visible el detalle de la primera pieza o de una selección anterior mientras otra pieza aparece activa en el carrusel.
- Si una pieza enfocada desaparece, el detalle observado recurre a la primera pieza disponible; si ya no queda ninguna, la vista de carrusel no se muestra. El caso requiere validación explícita de que el cambio se entiende y no deja una referencia contradictoria.

**Estados relevantes:**

| Estado | Qué debe comprender la persona | Recuperación o acción esperada |
|---|---|---|
| Vacío | No hay piezas para revisar y no existe detalle seleccionado. | Crear una pieza o volver al flujo que permite generarla; no mostrar un detalle residual. |
| Cargando | La colección o la pieza activa se está obteniendo; el detalle aún no es fiable. | Esperar con una representación de colección y detalle coherente; no interpretar datos previos como actuales. |
| Parcial | Hay piezas, pero una previsualización, metadato, recurso o actualización no está disponible. | Revisar las piezas disponibles, distinguir qué falta y reintentar la carga afectada sin perder la selección válida. |
| Error | No se puede cargar la colección, cambiar el detalle o recuperar una pieza referenciada. | Explicar qué colección o pieza falló, ofrecer reintento y conservar lo ya cargado cuando sea fiable. |
| Sin permiso/bloqueado | La colección o un recurso no puede consultarse por acceso local, archivo no disponible o estado requerido ausente. | Indicar el recurso bloqueado y el siguiente paso autorizado, sin revelar rutas privadas, credenciales ni datos de terceros. |
| Éxito | La pieza activa se identifica de forma consistente en carrusel y detalle; en lista cada pieza está plegada salvo las abiertas por la persona. | Previsualizar, consultar detalle, abrir/cerrar una unidad o continuar con acciones ya permitidas sobre esa misma pieza. |

### UC-011 · Preparar una clonación limpia con README

**Recorrido:** una persona con Windows 11 clona el proyecto, abre `README.md`,
prepara el entorno local, configura la persistencia, deja disponible la
herramienta de IA y arranca la aplicación.

**Flujo de producto esperado:**

1. La persona identifica requisitos previos y qué queda opcional.
2. Prepara Node y npm cuando falten.
3. Instala dependencias y realiza la preparación local de persistencia indicada por la guía.
4. Comprueba que la configuración de persistencia existe sin tener que conocer una variable interna ni exponer su contenido.
5. Prepara y comprueba la herramienta de IA de línea de comandos.
6. Arranca la aplicación y recibe una ruta local o un diagnóstico recuperable.
7. Si falla una comprobación, distingue un bloqueo obligatorio de una capacidad opcional degradada.

**Evidencia observada:**

- El README actual describe el producto, documentación histórica y stack, pero no ofrece una guía verificable de requisitos, configuración local, CLI, arranque y recuperación. Esto coincide con el acceso `parcial` de SRC-009.
- Existe una plantilla de configuración local y la guía operativa declara una persistencia SQLite local, pero el README observado no explica cómo detectar o recuperar una configuración de persistencia ausente desde una clonación limpia.
- La guía operativa describe `iniciar.bat` como arranque recomendado después de que el entorno esté preparado. No documenta la preparación inicial.
- La CLI de IA puede tener binario disponible pero sesión no autenticada; ese matiz debe ser comunicable sin mostrar rutas personales, salida sensible ni credenciales.

**Estados relevantes:**

| Estado | Qué debe comprender la persona | Recuperación o acción esperada |
|---|---|---|
| Vacío | No hay configuración local preparada todavía; la guía empieza desde un clon limpio. | Seguir el primer paso concreto y seguro, sin asumir archivos locales preexistentes. |
| Cargando | Se está instalando, comprobando o preparando un requisito. | Ver el paso en curso, qué no debe cerrar y cuándo volver a comprobar. |
| Parcial | El arranque local básico está preparado, pero una capacidad no esencial aún requiere herramienta, red o configuración adicional. | Abrir la aplicación y conocer qué funciones quedan limitadas, sin que se declare éxito total ambiguo. |
| Error | Falló una instalación, una comprobación de persistencia, la preparación de dependencias o el arranque. | Ver causa categorizada, paso de recuperación y una alternativa segura; conservar el diagnóstico sin volcar secretos. |
| Sin permiso/bloqueado | Faltan permisos de escritura, acceso al directorio, requisitos del equipo o autenticación de la herramienta de IA. | Explicar la acción que debe realizar la persona con permiso y cómo reanudar; nunca pedir ni imprimir claves en el README. |
| Éxito | La aplicación local arranca sin error de persistencia ausente y la persona sabe qué capacidades opcionales siguen pendientes. | Abrir la aplicación y consultar la comprobación posterior adecuada. |

### UC-012 · Instalación guiada en consola para Windows 11

**Recorrido:** una persona ejecuta un asistente de consola desde una clonación
limpia, revisa los requisitos detectados, confirma las acciones con efecto y
recibe un estado final inequívoco.

**Flujo de producto esperado:**

1. El asistente identifica el entorno Windows 11 y verifica los requisitos sin cambiar el equipo.
2. Muestra el resultado de cada comprobación y diferencia bloqueos obligatorios de herramientas o servicios opcionales.
3. Antes de cualquier acción con efecto fuera del directorio del proyecto, solicita confirmación visible de la persona.
4. Prepara o guía la preparación de los requisitos aprobados.
5. Vuelve a comprobar los requisitos y, cuando procede, inicia la aplicación.
6. Concluye solo con uno de dos resultados: proyecto funcional según la definición aprobada, o bloqueo accionable con el siguiente paso humano.

**Evidencia observada:**

- `iniciar.bat` libera el puerto 3000, termina procesos de Node, borra la caché de compilación, inicia el servidor y abre el navegador. Es un arranque limpio para un entorno ya listo.
- El script no detecta Node ni npm, dependencias, persistencia, preparación de Prisma, CLI de IA, autenticación de CLI, ni servicios opcionales.
- El script no solicita confirmación antes de terminar procesos o borrar caché y espera indefinidamente a que el puerto quede disponible. No puede comunicar un bloqueo inequívoco de clonación limpia.
- La evidencia actual permite observar un arranque, no validar UC-012 como asistente de instalación guiada.

**Estados relevantes:**

| Estado | Qué debe comprender la persona | Recuperación o acción esperada |
|---|---|---|
| Vacío | Aún no se ha ejecutado ninguna comprobación; no se afirma que el equipo esté preparado. | Iniciar la detección de requisitos o consultar la guía de prerrequisitos. |
| Cargando | El asistente está comprobando una dependencia o ejecutando un paso confirmado. | Ver el nombre del paso, progreso razonable y un modo de detenerse sin etiquetar el proyecto como funcional. |
| Parcial | Los requisitos de arranque local están satisfechos, pero una herramienta o servicio opcional no lo está. | Recibir la lista de capacidades disponibles y limitadas; continuar solo si la definición humana de «funcional» lo permite. |
| Error | Un paso confirmado falló, por ejemplo al preparar dependencias, persistencia o arrancar. | Ver el paso que falló, un diagnóstico que no incluya secretos y una acción de recuperación o reintento. |
| Sin permiso/bloqueado | Un requisito no puede satisfacerse por permisos, software ausente, acceso, autenticación o confirmación denegada. | No ejecutar acciones no confirmadas; terminar con el bloqueo exacto y el siguiente responsable humano. |
| Éxito | Todas las comprobaciones obligatorias acordadas finalizaron y el arranque local se verificó. | Comunicar que el proyecto es funcional con el alcance aprobado y señalar por separado las capacidades opcionales pendientes. |

## Diagnóstico y recuperación que el baseline debe preservar

La siguiente matriz no define comandos, estructura de archivos ni implementación. Define la
información que una futura guía y asistente deben hacer visible sin divulgar secretos.

| Situación | Clasificación UX solicitada | Comunicación segura | Recuperación que deberá cubrir la futura spec |
|---|---|---|---|
| `DATABASE_URL` ausente o persistencia local no preparada | Bloqueo obligatorio antes de declarar arranque correcto | «Falta la configuración local de persistencia»; no mostrar el valor de la variable ni contenido de archivos privados. | Indicar el paso documentado para crear o completar la configuración local y repetir la comprobación. |
| Node ausente o no ejecutable | Bloqueo obligatorio | Indicar que falta el entorno de ejecución y que debe instalarse una versión compatible definida por documentación aprobada. | Enlazar al paso de instalación y volver a detectar, sin asumir una versión en este intake. |
| npm ausente o no ejecutable | Bloqueo obligatorio | Diferenciarlo de Node ausente y no atribuirlo a la aplicación. | Indicar cómo obtener el gestor aprobado y repetir la comprobación. |
| Dependencias no instaladas o instalación fallida | Bloqueo hasta disponer del entorno local básico | Identificar el paso de dependencias, no reproducir tokens de registros ni rutas personales. | Ofrecer reintento tras corregir red, permisos o requisito previo. |
| Preparación o acceso de Prisma/persistencia fallido | Bloqueo de arranque o de datos, según el resultado aprobado | Nombrar la categoría «persistencia local» y el paso afectado; no mostrar URL de base de datos ni datos existentes. | Corregir configuración/preparación local y repetir una comprobación que confirme el acceso. |
| Claude CLI ausente | Capacidad de análisis bloqueada; el carácter bloqueante para «funcional» sigue pendiente de gate humano | Diferenciar «no encontrada» de «no autenticada» y no imprimir rutas de usuario completas. | Guiar a instalar o seleccionar la CLI admitida y volver a comprobarla. |
| Claude CLI presente sin sesión válida | Capacidad de análisis bloqueada | Comunicar que requiere inicio de sesión local, sin pedir ni mostrar credenciales en la salida. | Llevar al paso de autenticación y volver a comprobar el estado. |
| Proveedor externo sin clave, clave rechazada, cuota agotada o red no disponible | Capacidad opcional degradada, salvo que el gate humano la declare obligatoria | Diferenciar configuración ausente, autorización, cuota y indisponibilidad; no mostrar claves ni cabeceras. | Mantener resultados locales válidos y explicar qué función queda disponible o qué debe reintentarse. |
| FFmpeg, ffprobe o yt-dlp no disponibles | Herramienta opcional degradada según las reglas vigentes | Nombrar la herramienta y el efecto visible: p. ej., sin montaje final o análisis enriquecido. | Indicar instalación aprobada o alternativa; conservar previsualizaciones y resultados parciales. |
| Playwright o navegador requerido no disponible | Capacidad de captura/demostración automatizada degradada | Explicar que la grabación automatizada no está lista, sin presentar un vídeo inexistente como final. | Ofrecer el recorrido manual ya previsto y una posterior comprobación. |

## Accesibilidad y recuperación observables

Estas condiciones se documentan para la futura especificación y diseño; no se declaran
verificadas sobre un diseño nuevo, porque no hay diseño aprobado para esta mejora.

| Área | Evidencia / brecha | Condición que debe conservar el producto |
|---|---|---|
| Teclado del carrusel | Se observan botones nativos para anterior, siguiente e indicadores; no se observa una semántica que anuncie qué pieza quedó activa ni un vínculo con el detalle. | Todas las formas de cambiar la pieza activa deben actualizar el mismo estado perceptible por teclado y mostrar foco visible sin depender de la animación 3D. |
| Foco y detalle | El detalle puede cambiar por interacción central; no se observa una regla de foco o lectura posterior al cambio. | El cambio no debe mover foco de forma inesperada; la persona debe poder llegar al detalle siguiente en orden lógico y saber qué pieza está revisando. |
| Anuncio de cambios | No se observa región de estado para comunicar que el detalle inferior ha cambiado. | El nombre de la pieza activa y la disponibilidad del detalle deben anunciarse de manera no intrusiva a tecnologías de apoyo. |
| Lista plegable | Se observa un botón textual para abrir/cerrar guion, pero no se observa en el anclaje una asociación semántica explícita entre control y sección. | Cada acción debe exponer expandido/plegado, identificar su contenido asociado y no modificar otras piezas. |
| Movimiento | La documentación operativa declara respeto por `prefers-reduced-motion`, pero esta revisión no verifica su resultado sobre el carrusel. | Debe existir una alternativa estable sin rotación ni transición que conserve selección, foco, controles y detalle. |
| Contraste y estados | Los estados visuales de las piezas usan color y texto; no se ha medido contraste ni auditado el diseño de esta mejora. | Estado, error, bloqueo y éxito deben mantener texto o iconografía con nombre accesible; el contraste y foco se validarán contra WCAG 2.2 AA en `/sdd-design`. |
| Consola | No existe asistente de instalación observado. | La salida debe ser lineal, legible mediante lector de pantalla, no depender solo de color, usar texto inequívoco y dejar el diagnóstico disponible al fallar. |
| Recuperación | `iniciar.bat` resuelve el arranque de un entorno existente, pero no comunica precondiciones ni salida de bloqueo. | Cada fallo debe decir qué ocurrió, qué puede hacer la persona, qué se conservará al reintentar y si el proyecto sigue siendo utilizable parcialmente. |

## Comportamiento visible no cubierto o no demostrable

- El carrusel actual muestra una tarjeta central y permite cambiar su activo, pero esa acción no demuestra sincronía con el detalle inferior en todas las rutas de interacción.
- La lista observada ya favorece unidades plegadas y expansión independiente. Aun así falta la verificación de interacción por teclado y tecnologías de apoyo contra el criterio observable.
- El arranque actual limpia procesos y caché de forma automática; esa conducta tiene efecto sobre el equipo y no constituye una instalación guiada con confirmación previa.
- El README existente informa sobre el producto, pero no cubre el viaje de primera clonación ni una recuperación documentada de persistencia ausente.
- No se proporcionó referencia visual externa. El diseño histórico de estética oscura/neón no equivale a una dirección visual aprobada para los futuros cortes FEAT-002 y FEAT-006.

## Discrepancias detectadas en la revisión

Estas discrepancias se registran aquí para que `spec-analyst` las integre o las mantenga abiertas
según corresponda. No resuelven ni cierran DISC-001 a DISC-007 de `SOURCES.md`.

| ID | Evidencia | Contradicción o vacío | Impacto | Pregunta o decisión humana requerida | Estado |
|---|---|---|---|---|---|
| DISC-008 | SRC-013, SRC-014 y `Carousel3D` | La pieza activa cambia dentro del carrusel por varias interacciones, pero el detalle inferior solo recibe selección al activar la tarjeta central. | Contradice el resultado observable de PRD-RF-007 y CA-PROD-001: carrusel y detalle pueden nombrar piezas distintas. | Confirmar que todos los cambios de activo, incluidos controles e indicadores, deben actualizar el detalle sin una segunda activación. Recomendación: sí, por coherencia y accesibilidad. | abierta |
| DISC-009 | SRC-009, SRC-011, SRC-012 y evidencia de `iniciar.bat` | Se solicita README y asistente para clonación limpia, pero se observa solo un README histórico/parcial y un script de arranque para un entorno ya preparado, con efectos automáticos y sin diagnóstico de requisitos. | UC-011 y UC-012 no son verificables; se puede declarar arranque sin que persistencia, CLI o dependencias estén preparadas. | Confirmar el mínimo de diagnóstico, las confirmaciones requeridas y el significado de «funcional» cuando falten capacidades opcionales. Recomendación: éxito mínimo = aplicación local accesible sin bloqueo de persistencia; capacidades opcionales visibles como degradadas. | abierta |
| DISC-010 | SRC-002, SRC-009 y evidencia de CLI/herramientas opcionales | Las fuentes describen CLI, Prisma y herramientas opcionales, pero no fijan una taxonomía visible única de obligatorio, opcional, no encontrado, no autenticado, sin permiso, cuota y sin red para el recorrido inicial. | Mensajes ambiguos pueden empujar a la persona a compartir secretos o impedir distinguir recuperación de degradación. | Aprobar una clasificación de estados y microcopy seguros para README/asistente antes de especificar FEAT-006. Recomendación: usar las categorías de la matriz de diagnóstico de este review, sin mostrar valores sensibles. | abierta |

## Supuestos y preguntas para el gate humano

- [NEEDS CLARIFICATION: ¿Se confirma que una acción que cambia la pieza activa en el carrusel incluye tarjetas laterales, controles anterior/siguiente e indicadores? Recomendación: sí; de otro modo el concepto de «activa» cambia según el dispositivo de entrada.]
- [NEEDS CLARIFICATION: Cuando desaparece la pieza activa, ¿debe conservarse la siguiente pieza disponible, la anterior o un vacío que requiera selección explícita? Recomendación: seleccionar una pieza vecina disponible y anunciar el cambio; usar vacío solo cuando no quede ninguna.]
- [NEEDS CLARIFICATION: ¿El asistente puede terminar procesos, limpiar caché o instalar requisitos por sí mismo, o debe pedir confirmación visible antes de todo efecto fuera del directorio del proyecto? Recomendación: confirmar antes de cualquier efecto externo, incluido terminar procesos.]
- [NEEDS CLARIFICATION: ¿«Proyecto funcional» exige Claude CLI autenticada o solo arranque local y persistencia preparada, dejando análisis y proveedores externos como capacidades configurables? Recomendación: exigir arranque local y persistencia; mostrar CLI no preparada como capacidad bloqueada, no como éxito total silencioso.]
- [NEEDS CLARIFICATION: ¿Se confirma npm como gestor para README e instalación, frente a la discrepancia histórica DISC-002? Recomendación: sí, conforme a la guía operativa vigente.]
- [NEEDS CLARIFICATION: ¿Qué nombre de producto debe encabezar README y asistente: RRSS Studio o la marca observada en la interfaz? Recomendación: RRSS Studio hasta aprobación explícita de renombrado.]

## Límites de esta revisión

- No hay dirección visual ni diseño externo nuevo sometido a contraste; no se proponen pantallas, wireframes, componentes, tokens ni decisiones de implementación.
- Los seis estados son un inventario de experiencia requerido para las futuras specs; no certifican la interfaz existente ni sustituyen el diseño detallado y su auditoría posterior.
- No se probaron instalaciones, servicios externos, credenciales, persistencia real, CLI, navegador, proveedores ni herramientas opcionales.
- DISC-001 a DISC-007 siguen abiertas en `docs/product/SOURCES.md`; solo el proceso de integración y el gate humano pueden resolverlas.

### HANDOFF
- Agente origen: ux-designer
- Fase completada: intake/revisión-diseño
- Fuentes consultadas: SRC-001, SRC-002, SRC-009, SRC-010, SRC-011, SRC-012, SRC-013 y SRC-014; todas accesibles salvo SRC-009 y SRC-010, que permanecen parciales. Evidencia local adicional: `src/components/Carousel3D.tsx`.
- Artefactos: `docs/design/INTAKE-REVIEW.md`.
- Requisitos / casos cubiertos: OBJ-005 → PRD-RF-007, PRD-RF-012 → UC-010 → FEAT-002; OBJ-004 → PRD-RF-005, PRD-RF-008 → UC-011 → FEAT-006; OBJ-004 → PRD-RF-006 → UC-012 → FEAT-006.
- Discrepancias: DISC-008, DISC-009 y DISC-010 abiertas en este review; DISC-001 a DISC-007 no se cierran ni modifican.
- Decisiones tomadas: ninguna de producto, diseño, arquitectura o implementación. Se registró evidencia y se separaron bloqueos obligatorios de degradaciones pendientes de aprobación humana.
- Supuestos: Windows 11 es el contexto de instalación; las capacidades externas y herramientas opcionales no deben exponer secretos ni simular un resultado final equivalente; el diseño histórico es evidencia brownfield, no aprobación para estos cortes.
- Bloqueos: baseline de producto `legacy-pending`; ausencia de diseño externo y de dirección visual aprobada; definición pendiente de «funcional», alcance de acciones del asistente, gestor de paquetes y marca; DISC-001 a DISC-010 abiertas.
- Siguiente agente sugerido: spec-analyst — motivo: integrar únicamente las discrepancias y preguntas confirmadas en los artefactos de producto, mantener las no aprobadas abiertas y preparar el gate humano de producto antes de crear una spec.
- Comando / contexto durable: releer `docs/product/PRD.md`, `docs/product/USE-CASES.md`, `docs/product/FEATURE-MAP.md`, `docs/product/SOURCES.md` y `docs/design/INTAKE-REVIEW.md`; tras decisiones humanas, `orchestrator` devuelve a `spec-analyst` para integración de intake.