# Checklist de usabilidad

Documento vinculante. Lo aplica `ux-designer` en `/sdd-design` sobre el diseño, y
`frontend-expert` en `/front` sobre el código.

Complementa a la accesibilidad, no la sustituye: WCAG 2.2 AA es el **suelo legal**; esto es lo que
hace que además funcione. Una pantalla puede ser perfectamente accesible y perfectamente confusa.
La parte de accesibilidad vive en [`A11Y-CHECKLIST.md`](./A11Y-CHECKLIST.md) y se recorre entera
antes que esto.

---

## 1. Las diez heurísticas

Se revisan pantalla por pantalla. Cada una con el fallo típico, que es como se detectan de verdad.

| # | Heurística | Fallo típico |
|---|---|---|
| 1 | **Visibilidad del estado** | Se pulsa un botón y no pasa nada visible durante dos segundos. El usuario vuelve a pulsar |
| 2 | **Lenguaje del usuario** | "Persistir entidad", "Error de validación 422", "1999 céntimos" |
| 3 | **Control y libertad** | Borrar sin confirmación ni deshacer. Un proceso del que no se puede salir |
| 4 | **Consistencia** | Tres estilos de botón primario. "Carrito" en una pantalla y "cesta" en la siguiente |
| 5 | **Prevención de errores** | Campo libre donde solo caben tres valores. Botón activo que va a fallar seguro |
| 6 | **Reconocer antes que recordar** | Un identificador donde debería ir el nombre. Obligar a recordar el dato de la pantalla anterior |
| 7 | **Flexibilidad** | Solo se puede con ratón. Sin atajos para quien lo usa cada día |
| 8 | **Diseño minimalista** | Nueve campos de metadatos compitiendo con el precio |
| 9 | **Recuperación de errores** | "Error: INVALID_INPUT_422" sin decir qué campo ni cómo arreglarlo |
| 10 | **Ayuda contextual** | Un campo con formato específico y ninguna pista de cuál es |

---

## 2. Formularios

Es donde se pierde la gente que ya había decidido quedarse.

**Estructura**

- [ ] Etiqueta **siempre visible**. El texto de ejemplo dentro del campo desaparece al escribir y
      deja al usuario sin saber qué estaba rellenando
- [ ] Etiqueta asociada al campo, y el ejemplo muestra el **formato**, no repite la etiqueta
- [ ] Tipo de campo semántico: correo, teléfono, número, fecha. En móvil cambia el teclado que sale
- [ ] Ancho proporcional al contenido esperado. Un código postal y una dirección no miden igual:
      el ancho es información
- [ ] Una columna. Dos columnas duplican los errores de recorrido
- [ ] Se marcan los **opcionales** si la mayoría son obligatorios, y al revés

**Validación**

- [ ] Se valida **al salir del campo** y al enviar. No mientras se escribe: señalar que un correo
      es inválido cuando el usuario va por la tercera letra es hostigarlo
- [ ] El error **desaparece al volver a enfocar** el campo, para no corregir con un error rojo
      encima
- [ ] El mensaje aparece junto al campo, no solo en un resumen arriba
- [ ] El botón de envío se desactiva **solo durante el envío**, nunca por validación pendiente:
      un botón muerto sin explicación es un callejón sin salida
- [ ] Protección contra doble envío

**Reducir el trabajo**

- [ ] Autocompletado del navegador habilitado con el tipo correcto en cada campo
- [ ] Valores por defecto sensatos cuando se pueden deducir
- [ ] **Revelación progresiva**: los campos que dependen de una elección aparecen tras esa elección
- [ ] Si el formulario es largo, se parte en pasos con progreso visible y se puede volver atrás
- [ ] Lo escrito no se pierde al navegar o recargar

**Móvil**

- [ ] Objetivo táctil ≥ 44×44 px
- [ ] Tamaño de fuente en campos que no provoque zoom automático al enfocar (≥ 16 px en iOS)
- [ ] Acción principal alcanzable con el teclado abierto

---

## 3. Mensajes de error

Estructura: **qué está mal → cómo se arregla → alternativa si la hay.**

| Mal | Bien |
|---|---|
| "Entrada inválida" | "El correo debe incluir @" |
| "Error de formato" | "Teléfono: 9 dígitos, sin espacios" |
| "Campo obligatorio" | "Necesitamos tu nombre para emitir la factura" |
| "Cantidad no válida" | "Máximo 99 unidades. ¿Compra al por mayor? Escríbenos" |

**El tono no acusa.** "Has introducido un correo inválido" culpa al usuario; "el correo debe
incluir @" describe la regla. Es la misma información y no es la misma experiencia.

Menos de quince palabras. Se leen de un vistazo o no se leen.

---

## 4. Microcopy

- [ ] **Botones: verbo + sustantivo.** "Añadir al carrito", no "Enviar". "Continuar al pago", no
      "Continuar". Tras leer el botón se sabe exactamente qué va a pasar
- [ ] **Estados de carga contextuales**: "Aplicando descuento…", no "Cargando…"
- [ ] **Estados vacíos que enseñan el siguiente paso**, con acción concreta. "No hay resultados" es
      un callejón; "Prueba con menos filtros" es una salida
- [ ] **Confirmaciones específicas**: "Pedido realizado, confirmación enviada a tu correo", no
      "Éxito"
- [ ] Claridad por encima de ingenio. El texto gracioso se lee una vez y estorba cien
- [ ] Voz consistente en todo el producto

**Generar variantes con un modelo.** Es la herramienta obvia para esto y conviene decir cómo se usa,
porque el modo por defecto —pedir "escribe el texto de un botón"— devuelve exactamente lo genérico
que estamos intentando evitar. El prompt necesita contexto:

```text
Escribe <tipo de microcopy> para <contexto>.

- Situación: dónde y cuándo lo ve la persona
- Acción: qué ocurre exactamente al pulsarlo
- Voz de marca: <formal | cercana | directa>
- Restricciones: máximo <n> palabras, <idioma>, <términos prohibidos>

Genera <n> variantes que se diferencien en el enfoque, no en sinónimos.
```

**La regla que no se negocia: el modelo genera opciones, la persona elige.** Un modelo no conoce la
voz de la marca, no sabe qué término usa de verdad vuestra gente y no puede medir si convierte. Lo
que produce es un punto de partida, no una decisión. Y si hay dos candidatas defendibles, eso se
resuelve midiendo con usuarios reales, no discutiendo.

---

## 5. Velocidad percibida

Lo que se recuerda no son los milisegundos, es la sensación. Y la sensación se diseña.

| Espera | Qué necesita |
|---|---|
| < 100 ms | Nada. Se percibe instantáneo |
| 100 ms – 1 s | Cambio de estado visible en el elemento pulsado |
| 1 – 3 s | Indicador de progreso |
| > 3 s | Progreso con estimación, y posibilidad de cancelar |

- [ ] **Toda acción responde en menos de 100 ms**, aunque sea solo cambiando el estado del botón
- [ ] **Esqueleto con la forma del contenido real** mientras carga, no una pantalla en blanco ni un
      giro centrado. Enseñar la estructura de inmediato se percibe como el doble de rápido aunque
      tarde lo mismo
- [ ] **Carga progresiva**: primero lo crítico, después lo secundario, lo terciario bajo demanda
- [ ] Sin saltos de layout cuando llega el contenido
- [ ] Transiciones cortas en lugar de aparición brusca
- [ ] **Precarga especulativa** donde el siguiente paso es previsible —al pasar el cursor sobre un
      enlace, al llegar al último paso de un formulario—. Precargarlo todo no es una estrategia: es
      gastar el ancho de banda de otra persona

**Y además, lo que sí se mide.** La sensación se diseña, pero no se discute con opiniones. Los
umbrales de arriba se contrastan con las métricas reales de carga e interacción del navegador
—LCP, INP y CLS—, que `/front` recoge y `plan.md` §10 fija como objetivo. Si la sensación es buena
y la métrica es mala, la métrica gana: alguien con peor dispositivo o peor red está viendo otra
cosa.

**Actualización optimista** — pintar el resultado antes de que el servidor confirme:

- [ ] Solo si es **fácil de revertir** y el fallo es raro: marcar favorito, cambiar cantidad,
      ajustar una preferencia
- [ ] **Con reversión escrita**, no prevista. Si falla, se restaura el estado exacto anterior y se
      dice lo que pasó
- [ ] **Nunca** en: pagos, alta de cuenta, cambio de contraseña, borrados irreversibles, ni nada
      que el usuario deba poder afirmar que ocurrió. Ahí se espera la confirmación real, y esa
      espera se comunica

---

## 6. Antes de cerrar la pantalla

- [ ] Las diez heurísticas revisadas
- [ ] Los seis estados existen (vacío, cargando, parcial, error, sin permiso, éxito) — lo exige
      [`/front`](../../.agents/skills/front/SKILL.md)
- [ ] Accesibilidad verificada contra [`A11Y-CHECKLIST.md`](./A11Y-CHECKLIST.md) y registrada en el
      `docs/design/a11y-checklist.md` del proyecto, que crea `ux-designer` copiando la tabla de §7
- [ ] Formularios, mensajes de error y microcopy contra este documento
- [ ] Velocidad percibida: todo responde en menos de 100 ms
- [ ] Cada comprobación que resulte aplicable, declarada como `UX-<AREA>-NNN` en `plan.md` §9.3 con
      su tarea, su test y su evidencia. Lo que no llega a la matriz no se verifica en `/sdd-verify`
