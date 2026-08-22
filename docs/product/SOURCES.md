# Fuentes y discrepancias del baseline

> Estado: `approved` · Consulta de intake: 2026-08-21. Las fuentes de chat y de código son evidencia; la aprobación humana explícita de norkc materializa este baseline. Los hashes completos los fija el validador de producto.

| ID | Tipo | Ubicación | Consultada | Acceso | SHA-256 | Alcance extraído y limitación |
|---|---|---|---|---|---|---|
| SRC-001 | Solicitud de chat aprobada | Petición de la persona usuaria del 2026-08-21 | 2026-08-21 | accesible | no calculado | Aprueba el baseline y decide Windows 11, instalación funcional local, capacidades opcionales bloqueadas visibles, confirmaciones, comportamiento de carrusel/lista, npm y nombre de la guía. No fija decisiones internas. |
| SRC-002 | Guía operativa | `AGENTS.md` | 2026-08-21 | accesible | no calculado | Contexto Windows 11, arranque limpio, herramienta de IA y uso operativo de npm. Resume estado, no es por sí sola aprobación de producto. |
| SRC-003 | Perfil de rol | `.claude/agents/spec-analyst.md` | 2026-08-21 | accesible | no calculado | Reglas de intake, EARS, MoSCoW, límites de rol y preguntas abiertas. No describe capacidades del producto. |
| SRC-004 | Modelo de proceso | `docs/sdd/OPERATING-MODEL.md` | 2026-08-21 | accesible | no calculado | Artefactos y gate humano de intake para brownfield. No aprueba este baseline. |
| SRC-005 | Requisitos funcionales heredados | `docs/01-requisitos.md` | 2026-08-21 | accesible | no calculado | Visión, requisitos 001 a 018, límites y decisiones históricas. La primera versión está fechada 2026-07-13. |
| SRC-006 | Diseño funcional heredado | `docs/02-diseno.md` | 2026-08-21 | accesible | no calculado | Flujos, pantallas, revisión de piezas y estudio audiovisual. Su estado histórico no equivale a una revisión UX del nuevo cambio. |
| SRC-007 | Arquitectura heredada | `docs/03-arquitectura.md` | 2026-08-21 | accesible | no calculado | Evidencia de capacidades y restricciones históricas. Sus decisiones internas no se trasladan como requisitos de este PRD. |
| SRC-008 | Bitácora de producto y entrega | `docs/04-bitacora.md` | 2026-08-21 | accesible | no calculado | Estado declarado, ampliaciones 012 a 018 y validaciones pendientes. Mezcla hechos implementados con pendientes de prueba humana. |
| SRC-009 | Documentación de inicio | `README.md` | 2026-08-21 | parcial | no calculado | Fuente solicitada para la guía de instalación. El intake no encontró una guía verificable que cubra el nuevo recorrido completo; requiere actualización posterior por su propietario documental. |
| SRC-010 | Manifiesto de ejecución | `package.json` | 2026-08-21 | parcial | no calculado | Fuente solicitada para conocer comandos disponibles. No se usa como requisito de producto ni se infieren decisiones de instalación no documentadas. |
| SRC-011 | Arranque actual | `iniciar.bat` | 2026-08-21 | accesible | no calculado | Evidencia de un arranque limpio existente en Windows 11. No es un instalador guiado de clonación limpia. |
| SRC-012 | Configuración de ejemplo | `.env.example` | 2026-08-21 | accesible | no calculado | Declara configuración local de persistencia y ubicación opcional de la herramienta de IA, sin secretos. |
| SRC-013 | Evidencia de interfaz observada | `src/components/ContentTray.tsx` | 2026-08-21 | accesible | no calculado | Observa estado de foco y despliegue por pieza; no convierte el código existente en requisito. |
| SRC-014 | Evidencia de interfaz observada | `src/components/PieceCarousel.tsx` | 2026-08-21 | accesible | no calculado | Observa que el carrusel comunica una selección; no garantiza por sí solo el detalle correcto. |
| SRC-015 | Evidencia de configuración observada | `src/lib/prisma.ts` | 2026-08-21 | accesible | no calculado | Observa la inicialización directa de la persistencia; no define la experiencia de clonación solicitada. |
| SRC-016 | Revisión UX de intake | `docs/design/INTAKE-REVIEW.md` | 2026-08-21 | accesible | no calculado | Handoff de UX para UC-010, UC-011 y UC-012: evidencia brownfield, estados observables y discrepancias; no aprueba producto ni diseño. |

## Discrepancias resueltas por el gate humano

| ID | Fuentes | Descripción | Impacto | Recomendación / decisión humana requerida | Estado |
|---|---|---|---|---|---|
| DISC-001 | SRC-002, SRC-004, SRC-008 | El repositorio está marcado como baseline heredado pendiente, mientras requisitos, diseño y arquitectura históricos figuran como aprobados o implementados. | No se podía presentar el baseline normalizado como aprobado automáticamente. | norkc aprueba explícitamente el baseline completo, sus casos y su mapa. | resuelta |
| DISC-002 | SRC-002, SRC-007 | La guía operativa vigente indica npm y el documento heredado contiene una decisión histórica distinta sobre gestor de paquetes. | Cambia los pasos de README e instalación. | norkc aprueba npm para la guía. | resuelta |
| DISC-003 | SRC-002, SRC-008 | El resumen operativo enumera una parte de los requisitos heredados; la bitácora documenta además capacidades audiovisuales, de confianza y de clips. | El baseline total debe conservarlas sin afirmar que estén validadas end-to-end. | norkc aprueba el baseline heredado completo sin declarar validación end-to-end adicional. | resuelta |
| DISC-004 | SRC-001, SRC-011, SRC-012, SRC-015 | La persona solicita que una clonación limpia quede funcional, pero las fuentes observadas solo evidencian configuración de ejemplo y arranque de un entorno ya preparado. | Determina el contrato de éxito y el alcance del instalador. | norkc define instalación funcional como dependencias, persistencia local y arranque preparados; las capacidades opcionales quedan bloqueadas visibles. | resuelta |
| DISC-005 | SRC-001, SRC-009 | Se solicita una guía README de instalación y configuración; la fuente actual no ofrece un recorrido verificable completo para ello. | Requiere un artefacto documental futuro y criterios de comprobación. | norkc aprueba una guía de RRSS Studio para Windows 11 que usa npm. | resuelta |
| DISC-006 | SRC-001, SRC-013, SRC-014 | El código observado ya mantiene identificadores de foco y despliegue, pero la solicitud aprobada exige el comportamiento visible preciso de sincronía e independencia. | No debe suponerse que la observación actual satisface la experiencia solicitada. | norkc aprueba PRD-RF-007 y PRD-RF-012 como contrato de producto. | resuelta |
| DISC-007 | SRC-002, SRC-008 | RRSS Studio es el nombre documental heredado y se observa una marca visual distinta en la aplicación. | Afecta la redacción de README e instalador, no el comportamiento funcional. | norkc aprueba RRSS Studio como nombre de la guía. | resuelta |
| DISC-008 | SRC-013, SRC-014 y SRC-016 | La pieza activa cambia dentro del carrusel por varias interacciones, pero el detalle inferior solo recibe selección al activar la tarjeta central. | Contradice el resultado observable de PRD-RF-007 y CA-PROD-001: carrusel y detalle pueden nombrar piezas distintas. | norkc aprueba que todos los cambios de activo actualicen el detalle inmediatamente y que se seleccione una vecina al desaparecer la activa. | resuelta |
| DISC-009 | SRC-009, SRC-011, SRC-012, SRC-015 y SRC-016 | Se solicita README y asistente para clonación limpia, pero se observa solo un README histórico/parcial y un script de arranque para un entorno ya preparado, con efectos automáticos y sin diagnóstico de requisitos. | UC-011 y UC-012 no son verificables; se puede declarar arranque sin que persistencia, herramienta de IA o dependencias estén preparadas. | norkc aprueba confirmar efectos fuera de la carpeta del proyecto, procesos y caché; la instalación funcional no exige las capacidades opcionales. | resuelta |
| DISC-010 | SRC-002, SRC-009 y SRC-016 | Las fuentes describen herramienta de IA, persistencia y herramientas opcionales, pero no fijan una taxonomía visible única para el recorrido inicial. | Mensajes ambiguos pueden impedir distinguir recuperación de bloqueo. | norkc aprueba que la herramienta de IA autenticada, las claves externas y las herramientas audiovisuales o de navegación faltantes sean bloqueos visibles opcionales. | resuelta |

## Límites de la evidencia

- No se accedió a servicios externos, credenciales ni datos locales privados.
- Las validaciones históricas registradas pueden requerir repetición en el equipo de la persona usuaria.
- No se infirió una solución técnica para la persistencia, la README ni el instalador.
- La revisión UX incorporada como SRC-016 no sustituyó la aprobación humana de producto; las discrepancias se resolvieron mediante el gate explícito de norkc.
