---
applyTo: "**/*.{tsx,jsx,vue,svelte,astro,html,css,scss}"
description: Reglas de usabilidad y accesibilidad WCAG 2.2 AA aplicables a todo el código de interfaz
---

# Usabilidad y accesibilidad

Contrato canónico: [`A11Y-CHECKLIST.md`](../../docs/design/A11Y-CHECKLIST.md) —el suelo legal, WCAG
2.2 AA— y [`USABILITY-CHECKLIST.md`](../../docs/design/USABILITY-CHECKLIST.md) —las diez heurísticas,
formularios, microcopy y velocidad percibida—. Cumplir la primera entera no hace que un producto
sea usable: una pantalla puede ser perfectamente accesible y perfectamente confusa.

## Accesibilidad

- Usa el **elemento nativo**. Un `div` con `onClick` no recibe foco, no responde a teclado y no se
  anuncia como botón. ARIA solo donde el HTML no llega: mal ARIA anuncia algo falso.
- Todo interactivo alcanzable con `Tab`, activable con `Enter`/`Espacio`. El orden de tabulación
  sigue el orden visual; si divergen, quien navega a ciegas recorre una pantalla que no existe.
- **Foco siempre visible.** No lo elimines por estética sin poner algo mejor.
- Diálogos: atrapan el foco mientras están abiertos, `Escape` cierra, el foco vuelve al origen.
- Enlace para saltar al contenido principal, visible al enfocarlo.
- Contraste ≥ 4.5:1 texto normal, ≥ 3:1 texto grande y controles. Nada **solo** por color.
- Objetivos táctiles ≥ 24×24 px con separación; ≥ 44×44 px para que resulte cómodo en móvil.
- Controles de solo icono con nombre accesible que describe la **acción**, no el dibujo.
- Contenido dinámico anunciado con región activa; errores con rol de alerta ligados a su campo.
- Alternativa textual con intención; decorativas vacías. Idioma de la página declarado.
- Respeta `prefers-reduced-motion`. Legible al 200 % sin pérdida ni solape.
- Jerarquía de encabezados coherente, sin saltar niveles por motivos estéticos.

## Formularios

- **Etiqueta siempre visible** y asociada al campo. El texto de ejemplo muestra el formato; no
  sustituye a la etiqueta, porque desaparece al escribir.
- Tipo de campo semántico: en móvil determina el teclado que aparece.
- Ancho proporcional al contenido esperado —el ancho es información—. Una sola columna.
- Marca los **opcionales** si la mayoría son obligatorios, y al revés.
- **Valida al salir del campo y al enviar.** Validar mientras se escribe es hostigar.
- El error desaparece al reenfocar. El mensaje va junto al campo, no solo en un resumen arriba.
- El botón de envío se desactiva **solo durante el envío**, nunca por validación pendiente.
- Protección contra doble envío. Autocompletado con el tipo correcto en cada campo.
- Valores por defecto sensatos; revelación progresiva de los campos dependientes.
- Formularios largos: pasos con progreso visible y vuelta atrás. Lo escrito no se pierde.
- En iOS, fuente ≥ 16 px en campos para evitar el zoom automático al enfocar.

## Microcopy

- **Botones: verbo + sustantivo.** "Añadir al carrito", no "Enviar"; "Continuar al pago", no
  "Continuar".
- Errores: **qué está mal → cómo se arregla → alternativa**. "El correo debe incluir @", no
  "Entrada inválida". Sin culpar a la persona, y en menos de quince palabras.
- Estados de carga contextuales: "Aplicando descuento…", no "Cargando…".
- Estados vacíos que enseñan el siguiente paso con acción concreta.
- Confirmaciones específicas: "Pedido realizado, confirmación enviada", no "Éxito".
- Claridad por encima de ingenio; voz consistente en todo el producto. Un modelo puede generar
  variantes, pero **elige la persona**: no conoce la voz de la marca ni puede medir si convierte.

## Velocidad percibida

- **Toda acción responde en menos de 100 ms**, aunque solo sea con el estado del control.
- Esqueleto con la forma del contenido real; nunca pantalla en blanco ni un giro centrado.
- 300 ms–1 s indicador simple · 1–3 s progreso · > 3 s progreso con estimación y cancelación.
- Carga progresiva: lo crítico primero, lo secundario después, lo terciario bajo demanda.
- Sin saltos de layout: reserva dimensiones antes de que llegue el contenido.
- Precarga especulativa donde el siguiente paso es previsible. Precargarlo todo no es estrategia.
- **Actualización optimista solo si es fácil de revertir y el fallo es raro**, con la reversión
  escrita y no prevista. **Nunca** en pagos, alta de cuenta, cambio de contraseña ni borrados
  irreversibles: ahí se espera la confirmación real y esa espera se comunica.
- Contrasta la sensación con las métricas reales de carga e interacción. Si la sensación es buena
  y la métrica es mala, gana la métrica: alguien con peor red está viendo otra cosa.

## Trazabilidad

Si la spec declara `Impacto de usabilidad: aplicable`, cada comprobación aplicable es un control
`UX-<AREA>-NNN` en `plan.md` §9.3 —áreas `A11Y`, `FORM`, `COPY`, `PERF`— con tarea, test y
evidencia en el mismo PR. Un control sin salida real se declara **no ejecutado** con riesgo,
propietario y siguiente paso: no cuenta como verificado y bloquea la entrega.

El analizador automático cubre alrededor de un tercio de los problemas; es el suelo, no la prueba.
Lo demás aparece **desconectando el ratón** y recorriendo el flujo completo.
