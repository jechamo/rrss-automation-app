# Casos de uso de producto

> Estado: `approved` · Normalizado el 2026-08-21 · Gate humano aprobado por norkc.

## UC-001 · Analizar una app web

- **Actor**: Responsable de una app web.
- **Cubre**: PRD-RF-001, PRD-RF-014.
- **Precondiciones**: Dispone de una URL de la app y, opcionalmente, de una fuente de código o contexto de análisis.
- **Flujo principal**: Crea un proyecto, inicia el análisis, sigue su progreso y revisa o edita el dossier resultante.
- **Alternativas y errores**: La fuente de código puede no estar disponible; el análisis debe explicar la evidencia que falta y conservar un resultado parcial cuando sea posible.
- **Postcondiciones**: Existe un dossier reutilizable por los demás flujos del proyecto.

## UC-002 · Descubrir mercado y oportunidades

- **Actor**: Responsable de una app web.
- **Cubre**: PRD-RF-002, PRD-RF-014.
- **Precondiciones**: Existe un dossier del proyecto.
- **Flujo principal**: Solicita competencia, oportunidades locales o virales, revisa sus resultados y conserva o edita aportaciones manuales.
- **Alternativas y errores**: Una fuente externa puede no responder o no ofrecer evidencia suficiente; el resultado debe señalar su procedencia y limitación.
- **Postcondiciones**: El proyecto conserva hallazgos editables que pueden alimentar contenido.

## UC-003 · Crear contenido inspirado en un viral

- **Actor**: Responsable de contenido.
- **Cubre**: PRD-RF-003, PRD-RF-004, PRD-RF-011, PRD-RF-014.
- **Precondiciones**: Existe dossier y una referencia viral elegida; las capacidades externas necesarias están disponibles o se conoce su ausencia.
- **Flujo principal**: Elige una referencia, configura la creación, revisa la pieza original resultante y decide regenerar, conservar, eliminar o preparar publicación asistida.
- **Alternativas y errores**: Un servicio externo puede fallar o faltar; la persona recibe un error accionable y puede conservar los resultados ya producidos.
- **Postcondiciones**: La pieza y su historial quedan disponibles para revisión posterior.

## UC-004 · Mostrar la propia app en una pieza

- **Actor**: Responsable de contenido.
- **Cubre**: PRD-RF-009, PRD-RF-011.
- **Precondiciones**: Existe dossier y la persona conoce la funcionalidad que quiere mostrar.
- **Flujo principal**: Elige una funcionalidad, proporciona o genera una demostración de la app y revisa la pieza propia resultante.
- **Alternativas y errores**: Si no se puede generar una demostración automatizada, la persona puede aportar una grabación propia.
- **Postcondiciones**: La pieza propia conserva su demostración y queda disponible en la bandeja de contenido.

## UC-005 · Gestionar recursos y crear una versión audiovisual

- **Actor**: Responsable de contenido.
- **Cubre**: PRD-RF-010.
- **Precondiciones**: El proyecto contiene recursos audiovisuales o una pieza asociada.
- **Flujo principal**: Revisa recursos, compone una versión, la previsualiza y decide explícitamente usarla como resultado final.
- **Alternativas y errores**: Si no puede generarse una versión final, el resultado previo permanece conservado y se informa la causa.
- **Postcondiciones**: El proyecto conserva recursos, borradores y versiones distinguibles.

## UC-006 · Preparar publicación asistida

- **Actor**: Responsable de contenido.
- **Cubre**: PRD-RF-004.
- **Precondiciones**: Hay una pieza lista para revisar.
- **Flujo principal**: Descarga el material, ajusta y copia el texto de publicación, abre el destino elegido y marca la pieza como publicada cuando corresponde.
- **Alternativas y errores**: Puede abandonar el flujo sin marcar la pieza como publicada.
- **Postcondiciones**: La publicación queda registrada solo tras una acción explícita de la persona.

## UC-007 · Crear clips desde un vídeo largo

- **Actor**: Responsable de contenido.
- **Cubre**: PRD-RF-013.
- **Precondiciones**: Aporta una fuente de vídeo admitida y conoce las capacidades disponibles para procesarla.
- **Flujo principal**: Elige una selección editorial o solicita propuestas, revisa clips resultantes y conserva su historial.
- **Alternativas y errores**: Si no hay momentos que alcancen el umbral de calidad, se muestra el número real de resultados y el motivo.
- **Postcondiciones**: Cada clip y su evidencia quedan asociados al historial de la fuente.

## UC-008 · Configurar capacidades locales

- **Actor**: Persona administradora local del proyecto.
- **Cubre**: PRD-RF-011.
- **Precondiciones**: Tiene las credenciales o recursos que desea configurar.
- **Flujo principal**: Configura una capacidad, comprueba su estado y conoce qué flujos quedan disponibles.
- **Alternativas y errores**: Una credencial no válida, una cuota agotada o un servicio no disponible se distinguen para permitir una acción adecuada.
- **Postcondiciones**: Las credenciales no se exponen y la disponibilidad queda visible para la persona.

## UC-009 · Supervisar una ejecución y recuperarse de un fallo

- **Actor**: Responsable de una app web o de contenido.
- **Cubre**: PRD-RF-014.
- **Precondiciones**: Existe una ejecución en curso, completada o fallida.
- **Flujo principal**: Consulta progreso, detalle y resultado; cuando aplica, reintenta o regenera la parte afectada.
- **Alternativas y errores**: Una interrupción transitoria de actualización no debe ocultar el estado persistente de la ejecución.
- **Postcondiciones**: La persona sabe si la ejecución terminó, falló o requiere una acción externa.

## UC-010 · Revisar una colección de piezas

- **Actor**: Responsable de contenido.
- **Cubre**: PRD-RF-007, PRD-RF-012.
- **Precondiciones**: El proyecto contiene al menos una pieza generada.
- **Flujo principal**: Alterna entre carrusel y lista; una tarjeta lateral, un control anterior/siguiente o un indicador cambia la pieza activa y actualiza inmediatamente su mismo detalle, y en lista despliega únicamente las unidades que necesita consultar.
- **Alternativas y errores**: Si la pieza activa desaparece durante la revisión, la colección selecciona una pieza vecina disponible; muestra un estado vacío claro solo cuando no queda ninguna.
- **Postcondiciones**: La pieza revisada y el detalle visible no se contradicen.

## UC-011 · Preparar una clonación limpia

- **Actor**: Persona que instala o clona el proyecto.
- **Cubre**: PRD-RF-005, PRD-RF-008.
- **Precondiciones**: Cuenta con una clonación limpia y acceso al README.
- **Flujo principal**: Sigue la guía de RRSS Studio con npm, identifica los requisitos para preparar dependencias, persistencia local y arranque, y distingue las capacidades opcionales bloqueadas visibles.
- **Alternativas y errores**: Si una comprobación falla, encuentra un diagnóstico y una recuperación sin revelar datos sensibles; la herramienta de IA autenticada, las claves externas y las herramientas audiovisuales o de navegación faltantes se presentan como capacidades opcionales bloqueadas visibles.
- **Postcondiciones**: La aplicación puede iniciarse sin error de configuración faltante de la persistencia local y la persona conoce las capacidades opcionales pendientes.

## UC-012 · Ejecutar la instalación guiada de Windows 11

- **Actor**: Persona que instala o clona el proyecto.
- **Cubre**: PRD-RF-006.
- **Precondiciones**: Usa Windows 11 y dispone de la clonación limpia.
- **Flujo principal**: Ejecuta el instalador en consola, revisa los requisitos detectados, distingue los necesarios para la instalación funcional de las capacidades opcionales bloqueadas visibles, conoce los efectos fuera de la carpeta del proyecto, los procesos y la caché, confirma las acciones autorizadas y recibe una conclusión de estado.
- **Alternativas y errores**: Si un requisito no puede satisfacerse, una autorización se deniega o una capacidad queda degradada, recibe un bloqueo o estado accionable y el instalador no declara éxito fuera de la definición humana aprobada.
- **Postcondiciones**: El proyecto queda funcional según la definición aprobada o la persona conoce exactamente el siguiente paso humano necesario y qué capacidad permanece limitada.
