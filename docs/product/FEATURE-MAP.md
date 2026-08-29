# Mapa de funcionalidades y futuros cortes

> Estado durable: `legacy-pending` · Los cortes son propuestas de producto, no son specs creadas ni aprobadas. Se conserva la autorización humana del corte E2E de 2026-08-27 sin convertirla en aprobación adicional del baseline universal.

| ID | Corte vertical futuro, sin spec creada | Valor observable | Objetivos | PRD-RF | Casos | Estado |
|---|---|---|---|---|---|---|
| FEAT-001 | Analizar proyecto y descubrir mercado | El dossier y los hallazgos editables alimentan decisiones y contenido. | OBJ-001 | PRD-RF-001, PRD-RF-002, PRD-RF-014 | UC-001, UC-002, UC-009 | Heredado; incluido en el baseline aprobado. |
| FEAT-002 | Crear, revisar y publicar contenido original | Una referencia se convierte en una pieza revisable y la publicación sigue bajo control humano; carrusel, detalle y lista no se contradicen. | OBJ-002, OBJ-005 | PRD-RF-003, PRD-RF-004, PRD-RF-007, PRD-RF-012 | UC-003, UC-006, UC-010 | Propuesto para especificar; sin spec. |
| FEAT-003 | Demostración propia y estudio audiovisual | La persona crea contenido de su app y elige explícitamente versiones finales. | OBJ-003 | PRD-RF-009, PRD-RF-010 | UC-004, UC-005 | Heredado; incluido en el baseline aprobado. |
| FEAT-004 | Configuración local y recuperación operativa | Las capacidades locales están protegidas, son comprensibles y sus fallos son recuperables. | OBJ-002 | PRD-RF-011, PRD-RF-014 | UC-008, UC-009 | Heredado; incluido en el baseline aprobado. |
| FEAT-005 | Laboratorio de clips editoriales | Una fuente larga produce una colección trazable de clips de calidad. | OBJ-003 | PRD-RF-013 | UC-007 | Heredado; incluido en el baseline aprobado. |
| FEAT-006 | Clonación limpia, README e instalación guiada | Una persona en Windows 11 pone el proyecto en marcha con guía, autorizaciones claras y resultado inequívoco. | OBJ-004 | PRD-RF-005, PRD-RF-006, PRD-RF-008 | UC-011, UC-012 | Propuesto para especificar; sin spec. |
| FEAT-007 | Validación E2E simulada y sin red para cerrar v1 | Una entrega demuestra recorridos principales con datos aislados, capacidades deterministas, cero accesos externos y bloqueo ante regresiones. | OBJ-006 | PRD-RF-015 a PRD-RF-018 | UC-013 | Especificado y aprobado como `002-e2e-mock-offline-v1`; cobertura y accesibilidad automatizada quedan diferidas. |

## Cobertura y orden propuesto para decisión humana

- El mapa cubre cada `OBJ-*`, `PRD-RF-*` y `UC-*` del baseline.
- FEAT-002 y FEAT-006 son los cortes directamente activados por la solicitud aprobada de 2026-08-21.
- FEAT-002 conserva como contrato que todas las vías de cambio de activo sincronizan el detalle y que se elige una pieza vecina disponible al desaparecer la activa.
- FEAT-006 conserva como contrato Windows 11, instalación funcional local, capacidades opcionales bloqueadas visibles y confirmación de efectos fuera de la carpeta del proyecto, procesos y caché.
- FEAT-007 integra el núcleo fail-closed y, dentro de un único caso de uso, los recorridos autorizados de preparación, análisis, mercado, generación, contenido propio, clips y recuperación.
- La cadena durable del corte es `OBJ-006 → PRD-RF-015…018 → UC-013 → FEAT-007 → spec 002`.
- Cobertura de código y accesibilidad automatizada quedan fuera de FEAT-007 y necesitarán cortes o tareas posteriores antes de declararse configuradas.
- Ninguna fila autoriza crear una carpeta de spec ni comenzar diseño, plan, tareas o implementación.
