# Mapa de funcionalidades y futuros cortes

> Estado: `approved` · Los cortes son propuestas de producto, no son specs creadas ni aprobadas. Su orden requiere decisión humana para seleccionar la primera spec.

| ID | Corte vertical futuro, sin spec creada | Valor observable | Objetivos | PRD-RF | Casos | Estado |
|---|---|---|---|---|---|---|
| FEAT-001 | Analizar proyecto y descubrir mercado | El dossier y los hallazgos editables alimentan decisiones y contenido. | OBJ-001 | PRD-RF-001, PRD-RF-002, PRD-RF-014 | UC-001, UC-002, UC-009 | Heredado; incluido en el baseline aprobado. |
| FEAT-002 | Crear, revisar y publicar contenido original | Una referencia se convierte en una pieza revisable y la publicación sigue bajo control humano; carrusel, detalle y lista no se contradicen. | OBJ-002, OBJ-005 | PRD-RF-003, PRD-RF-004, PRD-RF-007, PRD-RF-012 | UC-003, UC-006, UC-010 | Propuesto para especificar; sin spec. |
| FEAT-003 | Demostración propia y estudio audiovisual | La persona crea contenido de su app y elige explícitamente versiones finales. | OBJ-003 | PRD-RF-009, PRD-RF-010 | UC-004, UC-005 | Heredado; incluido en el baseline aprobado. |
| FEAT-004 | Configuración local y recuperación operativa | Las capacidades locales están protegidas, son comprensibles y sus fallos son recuperables. | OBJ-002 | PRD-RF-011, PRD-RF-014 | UC-008, UC-009 | Heredado; incluido en el baseline aprobado. |
| FEAT-005 | Laboratorio de clips editoriales | Una fuente larga produce una colección trazable de clips de calidad. | OBJ-003 | PRD-RF-013 | UC-007 | Heredado; incluido en el baseline aprobado. |
| FEAT-006 | Clonación limpia, README e instalación guiada | Una persona en Windows 11 pone el proyecto en marcha con guía, autorizaciones claras y resultado inequívoco. | OBJ-004 | PRD-RF-005, PRD-RF-006, PRD-RF-008 | UC-011, UC-012 | Propuesto para especificar; sin spec. |

## Cobertura y orden propuesto para decisión humana

- El mapa cubre cada `OBJ-*`, `PRD-RF-*` y `UC-*` del baseline.
- FEAT-002 y FEAT-006 son los cortes directamente activados por la solicitud aprobada de 2026-08-21.
- FEAT-002 conserva como contrato que todas las vías de cambio de activo sincronizan el detalle y que se elige una pieza vecina disponible al desaparecer la activa.
- FEAT-006 conserva como contrato Windows 11, instalación funcional local, capacidades opcionales bloqueadas visibles y confirmación de efectos fuera de la carpeta del proyecto, procesos y caché.
- Ninguna fila autoriza crear una carpeta de spec ni comenzar diseño, plan, tareas o implementación.
