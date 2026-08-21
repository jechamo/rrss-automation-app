# Gates de diseño y usabilidad

## Dirección visual

Antes de la primera pantalla, `docs/design/DIRECCION-VISUAL.md` debe estar aprobada. Obtén del
usuario referencias y antirreferencias, adjetivos que excluyan opciones, escala tipográfica,
densidad, movimiento/reduced-motion y límites explícitos. Si no tiene criterio, propón una
dirección completa y solicita aprobación; no empieces con defaults genéricos.

## Preguntas materiales

Pregunta con recomendación y alternativas: pasos/retroceso, recarga intermedia, estados omitidos,
volumen de listas, acción destructiva/deshacer, responsive y componentes existentes. Sin
confirmación queda `[NEEDS CLARIFICATION]`. Una contradicción de producto vuelve a `/sdd-intake`;
una aclaración de spec vuelve a `/sdd-clarify`.

## Flujo y pantallas

- Mapa mermaid con decisiones, fricción y errores; no solo happy path.
- Cada pantalla: vacío, cargando, parcial, error, sin permiso y éxito.
- Un elemento con carácter funcional por pantalla, coherente con la dirección.
- Componentes clasificados en reutiliza/extiende/nuevo; cada nuevo se justifica.
- Valores fuera de tokens son inconsistencias, no valores que se copian al código.

## Accesibilidad y usabilidad

Contrasta `A11Y-CHECKLIST.md` y `USABILITY-CHECKLIST.md`: contraste, foco/teclado, jerarquía,
objetivos táctiles, color, errores accionables, microcopy y velocidad percibida. Declara dónde no
se permite actualización optimista. Cada comprobación aplicable se convierte en `UX-A11Y|FORM|COPY|PERF-NNN` para el plan.

## Puerta

Dirección aprobada; flujo completo; seis estados; elemento con carácter; cobertura CA↔pantalla;
discrepancias resueltas; componentes justificados; accesibilidad/usabilidad recorridas; cero
decisiones técnicas. Requisito nuevo vuelve a producto/spec, nunca se oculta en `design.md`.
