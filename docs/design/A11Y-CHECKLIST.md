# Checklist de accesibilidad — WCAG 2.2 AA

Documento vinculante. Lo aplica `ux-designer` en `/sdd-design` sobre el diseño, `frontend-expert`
en `/front` sobre el código, y `code-reviewer` en `/sdd-verify` sobre lo entregado.

Es el **suelo legal**, no el techo: cumplirlo entero no hace que un producto sea usable. Para eso
está [`USABILITY-CHECKLIST.md`](./USABILITY-CHECKLIST.md), que se recorre además de este.

**Cómo se usa.** Una spec con `Impacto de usabilidad: aplicable` copia la tabla de §7 a
`docs/design/a11y-checklist.md` —el fichero **del proyecto**, uno por producto— y la rellena
pantalla por pantalla. Cada control que resulte aplicable se declara en la matriz `UX-A11Y-NNN` de
`plan.md` §9.3 con su tarea, su test y su evidencia.

---

## 1. Los cuatro principios

Todo lo demás cuelga de aquí. Si no sabes en qué principio cae un problema, probablemente no has
entendido el problema.

| Principio | Qué exige | Fallo típico |
|---|---|---|
| **Perceptible** | La información llega por más de un canal | Un error señalado solo con borde rojo |
| **Operable** | Todo se puede hacer sin ratón y sin prisa | Un menú que solo se abre al pasar el cursor |
| **Comprensible** | El comportamiento no sorprende | Un `select` que navega al cambiar de valor |
| **Robusto** | La tecnología asistiva puede leerlo | Un `div` con `onClick` haciendo de botón |

---

## 2. Perceptible

- [ ] **Toda imagen tiene alternativa textual.** La decorativa se marca como tal y se oculta a los
      lectores; la informativa describe **la función**, no la apariencia. El alternativo de un icono
      de papelera es "eliminar", no "papelera"
- [ ] **Contraste ≥ 4.5:1** en texto normal, **≥ 3:1** en texto grande (≥ 24 px, o ≥ 19 px en
      negrita) y en los límites de los controles
- [ ] **Nada se comunica solo por color.** El rojo se acompaña de icono o texto: en torno al 8 % de
      los hombres no distingue rojo de verde
- [ ] El texto se puede **ampliar al 200 %** sin que se pierda contenido ni se solape
- [ ] Ningún contenido depende exclusivamente de la orientación de la pantalla
- [ ] El vídeo tiene subtítulos; el audio, transcripción
- [ ] Nada parpadea más de tres veces por segundo — puede provocar convulsiones

## 3. Operable

- [ ] **Todo lo interactivo se alcanza con `Tab`** y se activa con `Enter` o `Espacio`
- [ ] El **orden de tabulación sigue el orden visual**. Si divergen, alguien navegando a ciegas
      recorre la pantalla en un orden que no existe
- [ ] **El foco siempre se ve.** Diseñado a propósito, no el que trae el navegador por defecto y
      alguien quitó con `outline: none` sin poner nada en su lugar
- [ ] **No hay trampas de foco.** Un diálogo retiene el foco mientras está abierto y lo devuelve al
      elemento que lo abrió al cerrarse. `Escape` cierra
- [ ] Existe un enlace para **saltar al contenido principal**, visible al enfocarlo
- [ ] **Objetivos táctiles ≥ 24×24 px** con separación (WCAG 2.2 AA). En móvil, el mínimo cómodo
      real es 44×44 px
- [ ] Ninguna funcionalidad exige un gesto complejo sin alternativa de un solo toque
- [ ] Si hay límite de tiempo, se puede ampliar o desactivar
- [ ] El contenido que aparece al enfocar o al pasar el cursor se puede cerrar, sigue visible
      mientras el cursor está encima y no tapa lo que el usuario estaba mirando

## 4. Comprensible

- [ ] El idioma de la página está declarado, y también el de los fragmentos en otro idioma
- [ ] La navegación es **consistente** entre pantallas: mismo sitio, mismo nombre, mismo orden
- [ ] Nada cambia de contexto solo por recibir el foco o cambiar un valor
- [ ] **Todo campo tiene etiqueta asociada**, visible y persistente
- [ ] Los errores se **identifican en texto**, se asocian a su campo y **describen cómo se arreglan**
- [ ] La ayuda —cuando existe— está en el mismo sitio en todas las pantallas
- [ ] No se pide dos veces la misma información en el mismo proceso si el sistema ya la tiene
- [ ] Ningún paso de autenticación exige recordar, transcribir o resolver un puzle sin alternativa

## 5. Robusto

- [ ] **Se usa el elemento nativo.** Un `button` ya es enfocable, activable por teclado y anunciado
      como botón. Un `div` con `onClick` no es nada de eso, y arreglarlo cuesta más que usar el
      elemento correcto desde el principio
- [ ] **ARIA solo donde el HTML no llega.** Mal ARIA es peor que ningún ARIA: anuncia algo falso
- [ ] Los controles de solo icono llevan **nombre accesible** — "Eliminar del carrito", no "Papelera"
- [ ] El contenido que cambia sin recargar se **anuncia**: una región activa educada para lo
      informativo, asertiva solo para lo urgente
- [ ] El estado se expone además de pintarse: pulsado, expandido, seleccionado, inválido, ocupado
- [ ] Los campos con error se marcan como inválidos y **apuntan a su mensaje**
- [ ] La jerarquía de encabezados es coherente y no salta niveles por motivos estéticos

---

## 6. Cómo se comprueba

**Automático** — detecta cerca de un tercio de los problemas. Es el suelo, no la prueba:

- Analizador de accesibilidad en la suite de test, sobre los componentes y las páginas clave.
  Fallar el test es el resultado esperado cuando algo se rompe; **no vale mirarlo a ojo**
- Auditoría de accesibilidad del navegador en las pantallas principales
- Comprobador de contraste sobre los tokens del design system, una vez, en vez de pantalla por
  pantalla

**Manual** — donde aparece lo que de verdad rompe la experiencia:

1. **Desconecta el ratón.** Recorre el flujo completo con `Tab`, `Shift+Tab`, `Enter`, `Espacio`,
   `Escape` y flechas. Si en algún momento no sabes dónde está el foco, ya has encontrado un fallo
2. **Escucha la pantalla** con un lector (NVDA en Windows, VoiceOver en macOS). No hace falta ser
   experto: si lo que oyes no basta para saber qué hacer, tampoco le basta a quien lo usa a diario
3. **Amplía al 200 %** y comprueba que no se pierde ni se solapa nada
4. **Simula daltonismo** en las herramientas del navegador y busca información que desaparezca

**Ninguna de las dos columnas sustituye a la otra.** Un analizador en verde con la navegación por
teclado rota es un producto inaccesible con un informe bonito.

---

## 7. Tabla de verificación por pantalla

> Esta es la tabla que se copia a `docs/design/a11y-checklist.md` del proyecto. Una fila por
> pantalla. `Estado`: `verificado` · `no ejecutado` · `no aplica` con motivo material.

| Pantalla | Alternativas textuales | Contraste | Teclado y foco | Nombres accesibles | Errores asociados | Estado | Evidencia |
|---|---|---|---|---|---|---|---|
| `<pantalla>` | | | | | | `<estado>` | `<UX-A11Y-NNN / log / captura>` |

**Un `no ejecutado` conserva riesgo, propietario y siguiente paso.** No cuenta como verificado y
bloquea la entrega igual que un control de seguridad sin ejecutar.

---

## 8. Antes de cerrar la pantalla

- [ ] Los cuatro principios recorridos
- [ ] Verificación manual con teclado hecha, no supuesta
- [ ] Contraste comprobado sobre los tokens reales, no sobre la maqueta
- [ ] Cada control aplicable declarado como `UX-A11Y-NNN` en `plan.md` §9.3
- [ ] Cada control no ejecutado con riesgo, propietario y siguiente paso escritos
- [ ] Usabilidad recorrida además de esto — [`USABILITY-CHECKLIST.md`](./USABILITY-CHECKLIST.md)
