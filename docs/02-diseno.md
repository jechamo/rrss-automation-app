# Documento de Diseño — App de Automatización de Contenido para RRSS

> Metodología: **SDD**. Depende de: [Requisitos v1](01-requisitos.md).
> Alcance: diseño de experiencia, navegación, pantallas, flujo visual y **modelo de datos conceptual**.
> No fija el stack técnico (eso va en Arquitectura).
> Estado: **APROBADO por el usuario (v1).**
> Fecha: 2026-07-13

---

## 1. Principios de diseño

1. **Local-first y sin fricción**: todo funciona en el PC; configurar una API es pegar una key y pulsar "probar".
2. **El pipeline es el protagonista**: el usuario siempre entiende en qué etapa está y qué falta.
3. **Muy visual (REQ-009)**: base oscura con acentos neón y gradientes vibrantes, animaciones con propósito.
4. **Revisar antes de publicar**: nada se publica solo; todo pasa por una bandeja de validación.
5. **Reutilización**: el dossier (REQ-001) alimenta al resto; no se pide la misma info dos veces.
6. **Trazabilidad**: cada ejecución queda en historial con su estado y artefactos.

---

## 2. Identidad visual

**Estética:** *dark + neon/glass* combinada con *gradientes vibrantes* (mezcla de las opciones 1 y 3).

- **Fondo:** tonos muy oscuros (casi negro / azul noche) con sutil ruido/profundidad.
- **Superficies:** tarjetas con **glassmorphism** (fondo translúcido, borde luminoso, blur).
- **Acentos / gradientes:** paleta neón vibrante para estados, CTAs y bordes activos.
- **Tipografía:** sans-serif moderna, alto contraste, jerarquía clara.
- **Movimiento:** transiciones suaves; los nodos del pipeline **pulsan/brillan** al ejecutarse.

**Paleta propuesta (tokens, se afinan en implementación):**

| Token | Uso | Color aprox. |
|-------|-----|--------------|
| `bg-base` | Fondo app | `#0A0A0F` |
| `surface` | Tarjetas/paneles (glass) | `rgba(255,255,255,0.04)` |
| `border-glow` | Borde activo/hover | gradiente violeta→cian |
| `accent-primary` | CTA principal | `#7C3AED` (violeta) |
| `accent-secondary` | Acento vibrante | `#22D3EE` (cian) / `#F472B6` (rosa) |
| `state-running` | Etapa en curso | cian pulsante |
| `state-ok` | Etapa OK | verde neón `#34D399` |
| `state-error` | Etapa error | rojo/coral `#FB7185` |
| `state-pending` | Pendiente | gris/ámbar |

> Nota: se garantiza contraste AA para texto sobre fondo oscuro.

---

## 3. Arquitectura de información y navegación

**Modelo híbrido:** *sidebar* de secciones + un **Dashboard** inicial con el pipeline visual y accesos rápidos.

### Sidebar (secciones)
- **Dashboard** — visión general + pipeline visual del proyecto activo.
- **Proyecto** — datos y **Dossier** (REQ-001).
- **Análisis** — Competencia (REQ-002) · Oportunidades/Leads (REQ-003).
- **RRSS** — Virales del nicho (REQ-004) · Generar contenido (REQ-005/006) · **Bandeja de publicación**.
- **Historial** — todas las ejecuciones y piezas.
- **Skills** — catálogo/instalación (REQ-007).
- **Ajustes** — API keys y conectores (REQ-008).

### Selector de proyecto
- En la parte superior de la sidebar: **selector de proyecto activo** (arranca con uno; preparado para varios — D-14).

---

## 4. Mapa de pantallas

| Pantalla | Requisito | Descripción |
|----------|-----------|-------------|
| Dashboard | REQ-009 | Pipeline visual del proyecto + KPIs + accesos rápidos. |
| Nuevo/Editar Proyecto | REQ-001 | Formulario: URL + fuente de código (local/GitHub) + opciones de crawl. |
| Dossier | REQ-001 | Resultado editable (negocio, marca, CTA, dolor, pros/contras, persona, features). |
| Competencia | REQ-002 | Ficha comparativa vs competidores. |
| Oportunidades | REQ-003 | Lista de leads + estrategia por lead. |
| Virales del nicho | REQ-004 | **Top 20** en carrusel/tabla, ordenable. |
| Generar contenido | REQ-005/006 | Lanza el pipeline de vídeo; flujo en nodos. |
| Bandeja de publicación | REQ-005/006 | Estados: pendiente · publicado · (regenerar/eliminar). |
| Galería de vídeos | REQ-009 | **Carrusel 360º** de piezas generadas para revisión. |
| Historial | RNF-05 | Runs pasados con estado y artefactos. |
| Skills | REQ-007 | Buscar/instalar skills por API y por funcionalidad. |
| Ajustes | REQ-008 | Bloques por proveedor: key + "probar conexión" + estado. |

---

## 5. El pipeline visual (grafo de nodos)

**Componente central**: grafo de nodos animado (estilo React Flow).

- Cada **etapa** del pipeline es un **nodo** conectado al siguiente.
- **Estados de nodo:** `pendiente` (gris), `en curso` (cian pulsante), `ok` (verde), `error` (coral).
- Al pulsar un nodo → panel lateral con detalle, logs y artefactos de esa etapa.
- Acciones por nodo: **reintentar / regenerar** esa etapa sin rehacer todo (RNF-07).
- El grafo se **recompone** según el requisito (REQ-001 tiene sus nodos; REQ-005 otros).

**Ejemplo de nodos para REQ-001:**

```
[Entrada URL+Repo] → [Crawl web] → [Análisis código] → [Fusión IA] → [Dossier listo]
```

**Ejemplo de nodos para REQ-005 (clonado de viral):**

```
[Elegir viral] → [Extraer contenido] → [Guión] → ┬─(a)→ [fal.ai] → [ElevenLabs] ─┐
                                                  └─(b)→ [HeyGen] ────────────────┴→ [Montaje?] → [Validar] → [Publicar]
```

---

## 6. Carruseles 360º

- **Uso principal:** **galería de vídeos generados** — las piezas se muestran como *cards* en un carrusel 3D giratorio para revisarlas antes de publicar.
- **Uso secundario:** Top 20 de virales (REQ-004) como carrusel llamativo.
- Interacción: arrastrar/rotar, la card frontal se destaca; clic abre el detalle/preview.

---

## 7. Diseño detallado de REQ-001 (primer requisito a implementar)

### 7.1 Pantalla "Nuevo Proyecto / Análisis"
Formulario en tarjeta glass:
- **URL de la appweb** (obligatoria, validación de formato).
- **Fuente de código** (opcional), selector:
  - `Ruta local` → input de ruta (ej. `C:\Users\...\chafit360`).
  - `GitHub público` → URL del repo.
  - `GitHub privado` → URL + aviso de que usa el token de Ajustes.
  - `Solo web` → sin código.
- **Profundidad de crawl**: por defecto *"páginas clave"* (D-07), con opción avanzada.
- Botón **"Analizar"** → arranca el pipeline y navega al grafo de nodos.

### 7.2 Ejecución (grafo de nodos)
- Se ven los nodos de §5 progresando en tiempo real.
- Errores por nodo (ej. web caída, repo inaccesible) con opción de reintentar.

### 7.3 Pantalla "Dossier" (resultado)
Secciones editables (cada una en su tarjeta):
1. **Negocio y propuesta de valor**
2. **Marca** (tono, voz, identidad)
3. **CTAs detectados**
4. **Puntos de dolor** que resuelve
5. **Pros** / **Contras**
6. **Público objetivo / persona**
7. **Funcionalidades clave**
8. **Nicho/sector**

Acciones: **Editar** (inline), **Guardar versión**, **Regenerar** (todo o una sección), **Exportar** (Markdown/JSON), **Usar en →** (Competencia / Marketing / Contenido).

### 7.4 Estados de REQ-001
`sin analizar` → `analizando` → `dossier borrador` → `dossier aprobado`.

---

## 8. Bandeja de publicación (REQ-005/006)

Vista con filtros por estado:
- **Pendiente de publicar** · **Publicado** · **En revisión** · **Error**.
- Acciones por pieza: **Previsualizar**, **Regenerar**, **Eliminar**, **Publicar** (abre la red — publicación manual asistida, D-06).
- Cada pieza muestra: miniatura, red destino, copy, guión, etapa y fecha.

---

## 9. Pantalla de Ajustes (REQ-008)

- Un **bloque por proveedor**: fal.ai, HeyGen, ElevenLabs, Gemini, **Token GitHub**.
- Cada bloque: campo de key (enmascarado), botón **"Probar conexión"**, indicador **OK/Error**, fecha de última verificación.
- Las keys se **cifran en local** (nunca en el repo; `.env`/almacén cifrado — detalle en Arquitectura).
- Estado global: "X de N conectores configurados".

---

## 10. Modelo de datos conceptual (multiproyecto — D-14)

Entidades principales (atributos se afinan en Arquitectura):

- **Proyecto**: `id`, `nombre`, `url`, `fuenteCodigo` (tipo + ruta/repo), `nicho`, `createdAt`.
- **Dossier**: `id`, `proyectoId`, `contenido` (secciones §7.3), `estado`, `version`, `updatedAt`.
- **Competidor**: `id`, `proyectoId`, datos y comparativa (REQ-002).
- **Leads** (REQ-003): contenedor 1-a-1 con `Proyecto` (espejo de `Competencia`): `content` JSON con
  `{ resumen, zona, personas[], leads[], estrategiaGlobal[] }` + `status`/`version`. Cada `lead` = negocio
  local real con datos **públicos** (nombre, tipo, dirección, web, teléfono, email) + `temperatura`
  (caliente/templado/frío), `canalRecomendado` (correo/visita/otro), `estrategia`, `borrador`
  (asunto+cuerpo = correo o guión de visita), `fitScore`/`intentScore`, `origen` (ia/manual).
- **Viral**: `id`, `proyectoId`, `red`, `url`, `metricas`, `ranking` (REQ-004).
- **PiezaContenido**: `id`, `proyectoId`, `origen` (viral/propio), `guion`, `videoPath`, `redDestino`, `estado` (pendiente/publicado/…), `createdAt`.
- **Run** (ejecución): `id`, `proyectoId`, `requisito`, `nodos[]` (estado por etapa), `logs`, `estado`, `timestamps`.
- **Conector**: `proveedor`, `estado`, `ultimaVerificacion` (las keys **no** aquí, sino en almacén cifrado).

Relación raíz: **todo cuelga de `Proyecto`** (permite escalar a multiproyecto sin migración).

---

## 11. Estados globales y consistencia

- **Estados de pieza:** `pendiente` · `en revisión` · `publicado` · `error` · `eliminada`.
- **Estados de run/nodo:** `pendiente` · `en curso` · `ok` · `error`.
- Acciones transversales: **regenerar** (rehace una etapa/pieza) y **reintentar** (tras error).

---

## 12. Responsive y accesibilidad

- Pensado para **escritorio** (uso principal en el PC). Layout fluido; mínimos táctiles no prioritarios.
- Contraste AA en tema oscuro; foco visible; navegación por teclado en formularios y bandejas.
- Animaciones con opción de **reducir movimiento** (respeta `prefers-reduced-motion`).

---

## 13. Dudas de diseño (resueltas)

- **DD-01:** ✅ La galería 360º **solo previsualiza**; la edición (recortes/subtítulos) se hace en la etapa de **montaje** (separada).
- **DD-02:** ✅ El Dashboard muestra una vista **de extremo a extremo** (REQ-001→006) como resumen; el grafo detallado de cada requisito se ve al entrar en su sección.
- **DD-03:** ✅ **Solo tema oscuro** por ahora; los tokens quedan preparados para añadir tema claro más adelante.

---

## 14. Próximos pasos

1. **OK del usuario** a este documento de Diseño.
2. Redactar **Documento de Arquitectura** (stack, módulos, ejecución del pipeline, almacenamiento, conectores, seguridad de keys).
3. Implementar **REQ-001**.

---

## 15. Estudio multimedia y MIX (REQ-011)

### 15.1 Acceso y estructura

- La barra lateral incorpora **Estudio** dentro de un proyecto y **Guía** como entrada global.
- `/proyecto/[id]/estudio` mantiene el tema oscuro, cristal, aurora y elevación 3D.
- Dos vistas: **Mediateca** y **MIX**; apiladas en móvil y en dos columnas en escritorio.

### 15.2 Mediateca

Tarjetas con preview, nombre, tipo, duración, origen y fecha. Filtros: todos, vídeos, grabaciones,
audio y resultados. Acciones: ver, escuchar, renombrar, descargar, usar y eliminar. Los recursos
referenciados muestran dónde se utilizan antes de permitir su eliminación.

### 15.3 Grabador propio

Modal profesional en cuatro pasos: **Preparar → Compartir → Grabar → Revisar**. Incluye URL y
«Abrir app en móvil», instrucciones para elegir la ventana, REC/STOP grandes, temporizador, punto
rojo, estado accesible y preview vertical. Al detener permite nombrar, repetir, descartar o guardar.

### 15.4 MIX inteligente

La mediateca aparece a la izquierda y la receta a la derecha. La receta ordena bloques de vídeo,
locución, música y subtítulos. «Preparar MIX» propone una combinación; el usuario puede reordenar
o quitar bloques antes de renderizar. Estados: `borrador → renderizando → listo | error`.
**Usar como final** es una acción separada. El timeline cuadro a cuadro queda como evolución futura.

### 15.5 Subtítulos y zona segura

En 1080×1920 el texto permanece centrado en la franja inferior segura, por encima de controles de
RRSS. Máximo dos líneas, frases cortas, blanco/negrita y fondo/contorno contrastados. No existe
interruptor para desactivarlos cuando hay locución.

### 15.6 Centro de ayuda

`/guia` presenta índice, tarjetas numeradas, flujos, requisitos previos, pasos, resultados y solución
de problemas para Dashboard, proyecto, dossier, competencia, leads, virales, contenido, estudio,
ajustes y publicación.

## 16. Plan audiovisual y timeline ligera (REQ-012)

### 16.1 Aprobación antes de generar

Los modales de contenido muestran una tarjeta **Plan de montaje**. En fal.ai incluye modo de cortes
Automático/Manual, cantidad, duración por corte, duración objetivo, segundos de B-roll y coste. El
CTA pasa a ser **Aprobar plan y generar** para dejar claro cuándo se consumirán créditos.

### 16.2 Timeline

MIX conserva sus resultados a la derecha y sustituye la lista de vídeos completos por una línea
temporal proporcional. Cada bloque muestra miniatura/nombre, tipo, duración y candado. Se puede
seleccionar, añadir, arrastrar/reordenar, recortar con entrada/salida, bloquear y eliminar. El
reproductor superior previsualiza el recurso seleccionado; el resultado exacto se revisa después de
renderizar.

La lectura se divide en cinco pasos numerados: configurar versión, elegir plan, construir timeline,
explorar vídeos y revisar audio/subtítulos. La bandeja usa tarjetas con fotograma, play, duración,
origen, número de usos y badges de tipo. Un monitor fijo en la columna derecha reproduce el recurso
seleccionado o el MIX final; las versiones renderizadas quedan como tarjetas compactas debajo.

La locución y la música disponen de reproductor independiente. Los bloques de ambas pistas de vídeo
usan un fotograma aproximado como fondo con gradiente para conservar la legibilidad del texto.

### 16.3 Armonización

La cabecera compara duración visual y locución. **Ajustar a locución** reparte la diferencia entre
segmentos no protegidos dentro de los límites de sus fuentes. Los avisos distinguen estimación,
desajuste, recurso ausente y corte sin utilizar. Los marcadores Playwright se representan como
segmentos de demo protegidos; los manuales pueden bloquearse desde el propio editor.

### 16.4 Superposiciones

La acción **Preparar en capas** coloca la grabación manual o Playwright en la pista base y distribuye
los apoyos visuales en una pista superior. Cada recurso ofrece **Pista base** y **Superponer**. Al
seleccionar una superposición se editan inicio temporal, entrada/salida, modo pantalla completa o
picture-in-picture, esquina/centro y tamaño. La timeline superior es proporcional y avisa si el apoyo
sale de la duración final o si una pantalla completa tapa un momento protegido. La locución permanece
continua y los subtítulos se dibujan siempre por encima de ambas pistas. El cuerpo del bloque se
arrastra para moverlo en el tiempo; sus asas laterales cambian entrada/salida y duración sin sustituir
los controles numéricos de precisión.

La UI explica la diferencia antes de preparar: **Secuencial** alterna recursos a pantalla completa;
**En capas** mantiene la navegación debajo de los apoyos. Los dos modos usan una única carga de
locución/subtítulos desde la pieza destino.

### 16.5 Captura y diálogos adaptativos

Captura local usa un contenedor limitado por `100dvh`, cuerpo con scroll y cabecera/acciones fijas,
de modo que REC, STOP y Guardar siguen accesibles en portátiles y ventanas bajas. Confirmaciones,
avisos y renombrados se muestran en un diálogo propio con tonos normal/peligro y foco de teclado; el
único diálogo inevitable del navegador es el selector seguro para compartir pantalla.

## 17. Revisión previa de prompts fal.ai (REQ-013)

En ambos modales, la rama fal.ai añade una tarjeta violeta entre el plan audiovisual y el CTA final.
El estado vacío explica que aún no habrá consumo; «Preparar guion y prompts» muestra el hook y una
tarjeta editable por corte. Cambios que alteren el plan muestran una advertencia de obsolescencia y
bloquean el CTA. Un prompt vacío también bloquea la aprobación. El CTA final se denomina «Aprobar
prompts y generar». El selector de modelo incluye versión, perfil y coste por segundo en cada opción.

## 18. Confianza operativa (REQ-014)

- **Nuevo proyecto:** textarea opcional «Contexto para el análisis», con ejemplos y aviso de que la IA
  contrastará lo indicado con la web y el código. El mismo campo se puede editar en el proyecto.
- **Contenido propio:** junto al login aparece «Cliente o dato de ejemplo». Tras analizar, una tarjeta
  verde confirma que hay recorrido automático; una tarjeta ámbar avisa cuando solo hay pasos humanos.
  La inspección autenticada usa estructura y textos visibles, nunca la contraseña.
- **Validación:** los pasos de confirmación se verifican sin pulsarlos y el resultado lo indica expresamente.
- **Proveedores:** cada error muestra proveedor y tipo; «Reintentar catálogos» recarga sin cerrar el modal
  y conserva las opciones que ya funcionaron.
- **Leads:** un aviso detecta scores antiguos/no justificados y ofrece «Recalibrar puntuaciones» sin repetir
  la búsqueda de negocios.
- **Logos:** las iniciales coloreadas siempre están presentes debajo de la imagen que carga.

## 19. Mapa de la aplicación (REQ-015)

- Panel propio dentro del proyecto, después del pipeline y antes del dossier, con resumen, audiencia,
  profundidad y fecha de generación.
- El árbol usa tarjetas indentadas por nivel. Cada tarjeta muestra nombre, descripción, ruta, superficie
  (`navbar`, `sidebar`, `bottom nav`, `drawer`, `tabs`, página), login/rol y estado código/runtime.
- Las evidencias y acciones se despliegan bajo demanda para mantener una lectura compacta.
- «Verificar con Playwright» visita rutas seguras tras login y actualiza badges sin regenerar el dossier.
- «Copiar Markdown» exporta la estructura Sección → Subsección → Descripción → Navegación.
- Estado vacío y avisos explican cuándo no existe código, una ruta es dinámica o falta login.

## 20. Pulido visual y confianza de ejecución (REQ-016)

- Las tarjetas de pipeline tienen más aire horizontal y conectores visibles. El estado en curso conserva
  el anillo animado; una reconexión no devuelve visualmente los nodos a pendiente.
- Cursor de anillo cian/violeta en escritorio, con variante activa sobre controles. Inputs y textarea
  conservan la forma de edición y en táctil no se fuerza ningún cursor.
- Scrollbars finas con thumb degradado y hover luminoso; la barra lateral usa una versión aún más estrecha.
- Sidebar compacta: solo lockup, navegación global y secciones del proyecto; se eliminan tagline y pie
  redundante para evitar scroll en alturas normales.
- La grabación automática muestra logs diferenciados para sesión validada, reautenticación, formulario
  ausente y credenciales rechazadas. Nunca graba la pantalla donde se introducen usuario/contraseña.
