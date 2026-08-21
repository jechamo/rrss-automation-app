# Checklists de implementación frontend

Carga únicamente las secciones que afecten a la tarea. Los documentos vinculantes del proyecto
son `docs/design/DIRECCION-VISUAL.md`, `docs/design/A11Y-CHECKLIST.md` y
`docs/design/USABILITY-CHECKLIST.md`.

## Datos y estados

- Todo componente con datos contempla vacío, cargando, parcial, error, sin permiso y éxito.
- Presentación y obtención de datos están separadas; la lógica de negocio no vive en la UI.
- Estado de servidor, UI, formulario y URL no se mezclan. Filtros/paginación compartibles viven
  en la URL.
- Errores de red, validación, permiso y negocio son distintos y accionables.

## Formularios

- Esquema compartido con backend cuando sea viable; `aria-describedby` enlaza cada error.
- Etiqueta siempre visible; placeholder solo ejemplifica formato; tipo/autocomplete semánticos.
- Validación al salir y al enviar, no hostigamiento mientras se escribe; doble envío protegido.
- Mensaje: qué está mal → cómo se arregla → alternativa; menos de quince palabras.
- Estado sucio recuperable, revelación progresiva y objetivo táctil móvil ≥44 px.

## Velocidad percibida

| Espera | Respuesta |
|---|---|
| <100 ms | ninguna |
| 100 ms–1 s | cambio visible en el control |
| 1–3 s | indicador de progreso |
| >3 s | progreso, estimación y cancelar |

Skeleton con forma real, carga progresiva y presupuesto medido. Actualización optimista solo si
es reversible y rara vez falla; nunca en pagos, altas, contraseñas ni borrados irreversibles.

## Accesibilidad WCAG 2.2 AA

- HTML semántico, teclado completo, foco visible/restaurado y modales con foco contenido.
- Contraste 4.5:1 en texto normal y 3:1 en texto grande/controles; nada solo por color.
- `aria-live` para cambios relevantes, objetivos ≥24×24, `prefers-reduced-motion`, `alt` útil.
- axe es suelo; recorre el flujo sin ratón y prueba zoom 200 %/lector cuando aplique.

## Rendimiento

- Mide LCP, INP, CLS y bundle contra el presupuesto del plan.
- Divide por ruta, dimensiona imágenes, lazy-load salvo la primera visible y virtualiza listas
  largas. Memoiza solo con evidencia del perfilador.

## Seguridad del cliente

- Sanitiza por contexto; `dangerouslySetInnerHTML` requiere justificación.
- Nada secreto llega al cliente. La autorización real está en servidor.
- Prefiere cookie `HttpOnly`/`Secure`/`SameSite` según el contrato aprobado; CSP estricta.
- Enlaces externos con `noopener noreferrer`; toda dependencia UI es código de terceros.

## Puerta de salida

- RED/GREEN/REFACTOR con salida real; seis estados; dirección visual y tokens respetados.
- Teclado/axe, microcopy, formularios y presupuesto verificados según la tarea.
- Cada `UX-*` tiene test/evidencia o control no ejecutado con riesgo/owner/siguiente paso.
- Cero lógica de negocio, secretos o desviaciones silenciosas.
