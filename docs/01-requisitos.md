# Documento de Requisitos — App de Automatización de Contenido para RRSS

> Metodología: **SDD (Spec-Driven Development)**.
> Orden de trabajo: **Requisitos → Diseño → Arquitectura → Código**, requisito a requisito.
> Estado de este documento: **APROBADO por el usuario (v1).**
> Fecha: 2026-07-13

---

## 1. Visión general

Aplicación **web local** (corre en el propio PC, `localhost`) que funciona como una
**cadena de automatización (pipeline) para crear contenido en redes sociales (RRSS)**.

Dado una appweb (URL + código fuente), el sistema:

1. La analiza a nivel de negocio, marca y producto.
2. Analiza a su competencia directa.
3. Detecta y mapea clientes potenciales con estrategias de captación.
4. Rastrea contenido viral del nicho en YouTube/TikTok/Instagram.
5. Genera vídeos automáticamente (clonando virales o mostrando la propia app).
6. Deja el contenido listo para revisión y publicación asistida en RRSS.

Todo el flujo debe ser **muy visual** (cajas/nodos que muestran la ejecución en tiempo real),
con **historial** y gestión de estados (pendiente, publicado, etc.).

---

## 2. Decisiones ya cerradas con el usuario

Estas decisiones se han confirmado en la fase de dudas y son la base del diseño:

| # | Tema | Decisión |
|---|------|----------|
| D-01 | Plataforma | **App web local** (Next.js/servidor en `localhost`). Acceso a ficheros locales, Playwright, CLI. |
| D-02 | Motor de IA | **Claude Code CLI + plan Pro** como motor principal **sin coste de API**. |
| D-03 | IA de vídeo | **Gemini API** (pago por uso) reservada para **análisis/comprensión de vídeo** cuando sea indispensable. |
| D-04 | Modo de entrega | Implementación **requisito a requisito**; el usuario valida cada uno antes de pasar al siguiente. |
| D-05 | Primer requisito (MVP) | **REQ-001** (análisis de appweb) es la base y se construye primero. |
| D-06 | Publicación RRSS | **Manual asistida** al inicio (dejar listo + abrir la red para publicar con 1 clic). APIs oficiales más adelante. |
| D-07 | Análisis web (REQ-001) | **Crawl inteligente** de páginas clave (landing, pricing, features, about) con Playwright. |
| D-08 | Análisis de código (REQ-001) | Soportar: **ruta local**, **GitHub público**, **GitHub privado (con token)** y **solo web (sin código)**. |
| D-09 | Idioma del contenido | **Español** por defecto. |
| D-10 | Gestión de API keys | **Pantalla de Ajustes cifrada en local**, con zona de configuración por proveedor (probar conexión, estado OK/error). |
| D-11 | Proveedores de vídeo/voz | Conectores para **fal.ai**, **HeyGen** y **ElevenLabs** (keys se introducen en Ajustes). |
| D-12 | Montaje de vídeo | **FFmpeg local** como principal + **conector cloud opcional** (Creatomate) para el futuro → arquitectura *pluggable*. |
| D-13 | Stack técnico | **Se decide en el documento de Arquitectura** (no se cierra aquí). |
| D-14 | Multiproyecto | **Modelo de datos multiproyecto desde el inicio** (todo cuelga de una entidad `Proyecto`); la **UI arranca con un solo proyecto** y se escala a varios sin migración. |
| D-15 | Control de versiones | Proyecto versionado con **Git + GitHub** (cuenta `jechamo`). Se commitean los documentos SDD y el código. |

---

## 3. Glosario

- **Proyecto**: una appweb concreta que se analiza y para la que se genera contenido (p. ej. *chafit360*).
- **Dossier**: informe estructurado de negocio/marca/producto generado en REQ-001.
- **Nicho**: sector del proyecto (p. ej. *gimnasios / entrenamiento*).
- **Ejecución (run)**: una pasada del pipeline o de una de sus etapas, con su historial.
- **Pieza de contenido**: un vídeo/copy generado, con su estado (pendiente, publicado…).
- **Conector**: integración con un proveedor externo (fal.ai, HeyGen, ElevenLabs, Gemini…).
- **CTA**: llamada a la acción (*Call To Action*).

---

## 4. Requisitos funcionales

### REQ-001 — Análisis de la appweb  *(MVP — primero)*

**Objetivo:** dado (1) una URL y (2) una ubicación de código (ruta local o repo GitHub),
generar mediante IA un **dossier de negocio** completo.

**Entradas:**
- URL de la appweb (`https://…`). *(obligatoria)*
- Fuente de código *(opcional según D-08)*:
  - Ruta local (ej. `C:\Users\norkc\Documents\Personal\Proyectos\Github\chafit360`).
  - URL de GitHub público.
  - URL de GitHub privado (requiere token de GitHub, guardado en Ajustes).
  - Sin código: análisis solo de la web.

**Proceso:**
- **Web**: crawl inteligente (Playwright) de páginas clave (landing, pricing/precios, features, about/nosotros),
  extrayendo textos, CTAs y capturas.
- **Código**: análisis del repo con Claude Code CLI (estructura, funcionalidades, stack, features del producto).
- Fusión de ambas fuentes en un dossier.

**Salida — Dossier de negocio (estructurado + editable):**
- Descripción del negocio y propuesta de valor.
- Marca (tono, voz, identidad percibida).
- CTAs detectados.
- **Puntos de dolor** que resuelve.
- **Pros** y **contras**.
- Público objetivo / buyer persona.
- Funcionalidades clave del producto.
- Nicho/sector.

**Usos posteriores del dossier:**
- (A) Comparación con competidores (REQ-002).
- (B) Propuestas de marketing y estrategias de difusión.
- (C) Generación de contenido para RRSS.

**Criterios de aceptación (borrador):**
- Se puede lanzar un análisis con URL (+ opcionalmente código) desde la UI.
- El dossier se muestra de forma legible y **es editable** por el usuario antes de usarse.
- El dossier queda guardado en el historial del proyecto y es reutilizable por otros REQ.
- El flujo se ve como **cajas/nodos** que progresan (crawl → análisis código → fusión → dossier).

---

### REQ-002 — Análisis de competencia

**Objetivo:** mediante IA, escanear los **competidores directos** del proyecto.

**Proceso (borrador):** a partir del dossier (REQ-001), identificar competidores directos,
analizarlos (web/posicionamiento) y compararlos con el proyecto.

**Salida (borrador):** tabla/ficha comparativa (propuesta de valor, precios, pros/contras, diferenciadores).

> ✅ DA-01 resuelta: descubrimiento **híbrido** (IA propone desde el dossier + edición manual del usuario;
> los competidores manuales se conservan al regenerar). Ver §7.

---

### REQ-003 — Análisis de oportunidad y scraping de clientes potenciales

**Objetivo:** mapear **clientes potenciales** y definir una **estrategia de captación por cada uno**.

**Salida (borrador):**
- Lista de clientes potenciales.
- Estrategia recomendada por cliente: **envío de correo**, **visita al local con guión**, u otras.
- Posibilidad de **generar** esa estrategia (redactar el correo, el guión de visita, etc.).

**Decisión (DA-02 resuelta, ver §7):** leads = **negocios locales reales**; fuente = **IA + WebSearch**
(solo datos públicos de empresa); estrategia = **IA genera y el usuario edita/aprueba**. Implementado
como pipeline REQ-003 (`input → research → discover(web) → strategy`), espejo de REQ-002. Apoyo de
conocimiento: skill `rrss-lead-research`.

---

### REQ-004 — Scraping de competidores/nicho en RRSS

**Objetivo:** localizar **vídeos virales del nicho** en YouTube, TikTok e Instagram
(creadores del sector en general, no necesariamente de la app).

**Salida:** **Top 20** ordenado por más vistos / más virales.

**Decisión (DA-03 resuelta, ver §7):** fuente = **IA + WebSearch** (el motor `claude -p` localiza
y describe virales públicos, sin claves API extra); definición de **viral = relativo al autor**
(≈5× la mediana de vistas del propio canal, para no sesgar hacia cuentas grandes); ventana
temporal = **30 días** (configurable: 7/14/30/histórico desde la UI). Implementado como pipeline
REQ-004 (`input → discover(web) → rank(Top 20) → analyze(patrones)`), espejo de REQ-002/003.
Cada viral se descompone (hook, estructura, share-trigger, patrón transferible) para alimentar
REQ-005. Apoyo de conocimiento: skill `rrss-viral-analysis`.

---

### REQ-005 — Generación automática de contenido (clonado de viral)

**Objetivo:** tomar un vídeo elegido del Top 20 (REQ-004) y **replicar su contenido** automáticamente,
dejándolo para revisión y publicación con 1 clic.

**Flujo:**
1. **Extraer** el contenido del vídeo (comprensión con Gemini si es necesario).
2. **Generar guión**.
3. **Bifurcación de generación de vídeo:**
   - **(a)** Enviar a **fal.ai** (vía API) para generar los vídeos/cortes, **o**
   - **(b)** Enviar a **HeyGen** con una foto elegida por el usuario + ID de voz.
4. Si fue **(a)** → enviar a **ElevenLabs** (ID de voz) para la locución.
5. Comprobar si hace falta **montaje** (unir cortes, subtítulos, música).
6. Dejar el resultado **para validar** antes de publicar.

**UI/Gestión:**
- Flujo visible en **cajas** con progreso de ejecución en tiempo real.
- **Historial** y opción de **nueva ejecución**.
- Bandeja de estados: **pendiente de publicar**, **eliminar**, **regenerar**, **publicado**.

> ✅ DA-04 resuelta (ver §7). **Implementado (v1, 2026-07-15):** `ContentPiece` **muchos por
> proyecto** (bandeja de estados); pipeline `input → extract → guion → media → voz → montaje`
> (montaje = stub FFmpeg); conectores reales **fal.ai/HeyGen/ElevenLabs/Gemini** con keys de
> Ajustes; modal de generación con **selección auto/manual** de modelo/voz/avatar; guion
> **reinterpretado** (no copia). Entrada: panel **ContentTray** (selector de viral dentro del
> propio modal). Assets locales servidos por ruta protegida `…/asset?path=`.

---

### REQ-006 — Generación de contenido propio de la app para RRSS

**Objetivo:** generar contenido mostrando la **propia funcionalidad de la app**.

**Flujo:**
1. Leer el código de la app y **escoger una función** (o el usuario la indica) → la IA analiza esa funcionalidad.
2. Pedir **usuario y contraseña**; con **Playwright** navegar esa funcionalidad **en modo móvil** y grabar vídeo.
3. **Generar guión**.
4. Enviar a **fal.ai** para generar cortes a **intercalar** con el vídeo de Playwright.
5. Enviar a **ElevenLabs** (ID de voz) para la locución.
6. Comprobar si hace falta **montaje** → dejar **para validar** antes de publicar.

**UI/Gestión:** igual que REQ-005 (cajas, historial, bandeja de estados).

> ⚠️ Dudas abiertas: manejo seguro de credenciales de login de la appweb objetivo. Ver §7.

---

### REQ-007 — Skills

**Objetivo:** obtener/instalar **skills** (buscando en internet/GitHub) y elegir las mejores:

1. Skills por **API/proveedor**: HeyGen, fal.ai, ElevenLabs, montaje de vídeo, etc.
2. Skills por **funcionalidad**: marketing, generar campañas de publicidad, etc.

> ✅ **DA-06 RESUELTA (2026-07-15):** un "skill" aquí = **capacidad del entorno de Claude Code**
> (skills de proyecto en `.claude/skills/` + plugins del marketplace oficial), como **toolkit
> del agente y del motor headless de la app**, NO una feature de UI. **Instalación curada**
> (revisada), no automática. Pase de curación v1 hecho; catálogo y mapeo skill→REQ en
> **`docs/05-skills.md`**. La *pantalla* de Skills dentro de la app queda **aplazada** hasta
> que existan los REQs que la consumen (003–006).

---

### REQ-008 — Configuración sencilla de herramientas/APIs

**Objetivo:** que configurar cada herramienta/API sea **lo más sencillo posible**.

- **Pantalla de Ajustes** con un bloque por proveedor.
- Pegar API key → botón **"probar conexión"** → estado **OK/Error**.
- Keys **cifradas en local** (nada sale del PC salvo las llamadas al propio proveedor).
- Proveedores iniciales: **fal.ai, HeyGen, ElevenLabs, Gemini** (+ token GitHub).

---

### REQ-009 — Experiencia visual

**Objetivo:** app **muy visual** e impactante.

- Flujos de ejecución en **cajas/nodos** que se iluminan según progresan.
- Elementos visuales impactantes, **carruseles 360°**, animaciones.
- Historial y bandejas de estado claras.

> **Implementado (2026-07-15):** pase transversal — dashboard con **hero de aurora** animada, tarjetas
> con **elevación 3D** y entrada escalonada, **carrusel 360° (cover-flow)** de piezas en `ContentTray`
> (toggle Lista/Carrusel), **skeletons** de carga y transiciones suaves en el grafo de nodos y los
> chips de estado. Solo Tailwind + CSS (sin dependencias nuevas), respetando `prefers-reduced-motion`.

---

### REQ-010 — Publicación asistida en redes

**Objetivo:** llevar una pieza `listo` a la red destino con el mínimo esfuerzo, **sin APIs
oficiales ni tokens** (materializa **D-06**, opción manual asistida).

**Flujo (modal de 4 pasos por pieza):**
1. **Descargar** el vídeo final (montaje REQ-005 o grabación REQ-006) vía la ruta protegida
   `…/asset?path=…&download=1` (`Content-Disposition: attachment`).
2. **Copiar** el copy sugerido (título + CTA + hashtags) al portapapeles; editable antes de copiar.
3. **Abrir** la red destino (YouTube Studio / TikTok upload / Instagram web) en otra pestaña.
4. **Marcar como publicado**: `PUT` de la pieza a `status: "publicado"` + registro de
   `publishedTo`/`publishedAt` en el blob `assets`.

**UI/Gestión:** botón **«Publicar ↗»** en cada pieza `listo`/`publicado` del `ContentTray`
(lista y carrusel). Selector de red (YouTube/TikTok/Instagram) con su URL de subida.

> ✅ **Implementado (2026-07-15):** `PublishModal` (cliente) + `core/content/publish.ts`
> (targets + `composeCaption`); descarga por `?download=1`; persistencia de `publishedTo`/
> `publishedAt` en `assets`. La subida 100% automática por API oficial (OAuth + apps aprobadas
> por cada plataforma) sigue **fuera de alcance** (§6).

---

### REQ-011 — Estudio multimedia, grabación propia y MIX

**Objetivo:** reunir en una mediateca reutilizable todos los recursos audiovisuales del proyecto y
permitir crear un vídeo final combinándolos sin romper los montajes automáticos de REQ-005/006.

**Mediateca del proyecto:**
- Inventaría grabaciones del usuario, screencasts Playwright, clips fal.ai, presentadores HeyGen,
  locuciones, música y salidas finales.
- Cada recurso conserva nombre, tipo, origen, ruta, duración y relación opcional con una pieza.
- Permite previsualizar, renombrar, reutilizar, descargar y eliminar con confirmación. Un recurso
  utilizado por una composición no se borra de forma silenciosa.
- Los assets ya existentes en `ContentPiece.assets` siguen siendo válidos y se indexan sin mover
  ni eliminar sus ficheros.

**Modo «Graba tú mismo»:**
1. El usuario abre la URL de su app en una ventana de tamaño móvil.
2. Se identifica directamente en su app; RRSS Studio no captura esas credenciales.
3. Pulsa **REC**, elige la ventana en el selector seguro del navegador y navega.
4. Pulsa **STOP**, previsualiza, nombra y guarda la grabación en la mediateca.
5. Puede usarla inmediatamente en una pieza o conservarla para futuros vídeos.

El selector de `getDisplayMedia` siempre requiere una acción explícita: la aplicación no puede
elegir una ventana ni ocultar el diálogo de seguridad del navegador.
El modal debe caber en alturas reducidas: cabecera y acciones permanecen accesibles y el contenido
central dispone de scroll propio. Las confirmaciones, avisos y cambios de nombre de la aplicación
usan diálogos visuales de RRSS Studio, no `alert`/`confirm`/`prompt` del navegador.

**Estudio MIX inteligente (v1, sin línea de tiempo):**
- Panel visual de recursos + receta por bloques: hook, presentación, demo, B-roll y cierre.
- Pistas de locución y música con mezcla/ducking; subtítulos obligatorios cuando hay voz.
- Botón **MIX** que normaliza a 1080×1920, ordena segmentos, mezcla audio y quema subtítulos.
- La salida es una nueva versión. Solo **Usar como final** actualiza la pieza.
- `assembleMix()` es aditivo; `assemble()` y `assemblePresenterDemo()` permanecen disponibles.

**Subtítulos — regla transversal:** todo vídeo final con voz incluye subtítulos quemados, inferiores,
centrados y dentro de la zona segura de Shorts/Reels/TikTok. Un audio propio necesita texto antes
de producir un final publicable. Si FFmpeg no puede renderizarlos se conserva el preview, pero nunca
se degrada silenciosamente a un final sin subtítulos.

**Guía integrada:** enlace global **Guía** con explicación detallada de cada sección y de los flujos
viral+fal, viral+HeyGen, Playwright, subida, REC/STOP, MIX y publicación asistida.

**Criterios de aceptación:**
- Las piezas anteriores a REQ-011 abren, se reproducen y se publican como antes.
- Una grabación REC/STOP aparece en la mediateca y se puede reutilizar.
- Captura local no se sale del viewport y permite llegar a REC/STOP/Guardar con scroll interno.
- MIX combina vídeo, locución y música opcional sin sobrescribir el final anterior.
- Toda salida final con voz muestra subtítulos legibles en la zona inferior segura.
- Ajustes informa ruta y versión reales de yt-dlp/FFmpeg/ffprobe desde el proceso Next.
- La guía recorre paso a paso todas las combinaciones soportadas.

### REQ-012 — Planificación audiovisual y montador ligero

**Objetivo:** decidir antes de consumir créditos cuántos cortes generativos necesita una pieza y
armonizar grabación, locución y B-roll en una línea temporal visual, manteniendo intactos los
montajes automáticos y las recetas MIX anteriores.

**Plan previo a la generación:**
- En rama fal.ai el usuario elige cortes en modo **Automático** o una cantidad manual de **0 a 6**.
- Antes de lanzar la pieza se muestra duración objetivo, demostración disponible/estimada, tiempo de
  apoyo visual, cortes que se generarán, segundos facturables y coste orientativo.
- El botón final expresa la aprobación del plan. La IA recibe el límite elegido y no genera cortes
  adicionales de forma silenciosa.
- Playwright aporta marcadores desde sus pasos y `nav_log`; una grabación reutilizada aporta su
  duración real. Cuando aún no existe grabación se presenta explícitamente una estimación.

**Montador ligero:**
- MIX admite una receta v2 por segmentos, con recurso, entrada/salida, etiqueta y bloqueo.
- La UI muestra una única línea temporal vertical-first, con regla y cabezal comunes. La pista
  principal y las capas se editan dentro del mismo lienzo alineado, sin separar el trabajo en dos
  zonas. Permite selección, reordenación, recorte, inserción, eliminación y protección de momentos
  importantes.
- La bandeja audiovisual usa miniaturas reproducibles y una etiqueta inequívoca por origen/tipo
  (`Playwright`, grabación manual, clip IA, presentador, vídeo, final o versión MIX). Un visor único
  distingue claramente entre el montaje vivo, un recurso aislado y un resultado renderizado.
- La bandeja puede filtrarse por recursos principales, clips, finales y versiones MIX. La galería de
  Mediateca permanece plegada hasta que el usuario decide gestionar archivos; su inventario continúa
  disponible para el editor.
- El montaje vivo dispone de reproducir/pausar, detener, desplazamiento del cabezal y zoom. Compone
  en el navegador la pista principal, las capas activas, la locución, la música y una referencia de
  subtítulos según la posición actual, sin llamar a proveedores ni exigir un render previo.
- La timeline muestra fotogramas aproximados de pista base y superposiciones. Locución y música
  seleccionadas tienen controles de audio propios antes de renderizar.
- Una acción de armonización ajusta los bloques no protegidos a la duración de la locución. Las
  diferencias restantes se muestran como error accionable, nunca como truncado o congelado oculto.
- La receta v2 admite una pista superior opcional de superposiciones. Cada apoyo define recurso,
  recorte, inicio en timeline, pantalla completa o picture-in-picture, posición y tamaño. La pista
  base sigue avanzando y el audio de la superposición se ignora. El bloque puede desplazarse
  directamente y sus dos asas permiten reducir o ampliar el recorte, además de los campos numéricos.
- Los subtítulos se aplican después de todas las capas para permanecer siempre visibles. Keyframes,
  filtros creativos y edición cuadro a cuadro continúan fuera de alcance.
- Al elegir una locución generada para una pieza, el campo de subtítulos recupera inmediatamente el
  texto de su guion asociado. Un audio libre sin guion no borra texto escrito por el usuario.
- Preparar secuencial o en capas transforma la selección actual sin importar otros recursos. Si la
  timeline está vacía, la propuesta automática exige una pieza destino y nunca toma toda la
  mediateca del proyecto de forma implícita.

**Compatibilidad:**
- Las recetas MIX v1 se siguen leyendo y renderizando como antes.
- `assemble()`, `assemblePresenterDemo()` y la generación automática continúan disponibles.
- Cada render crea una versión nueva y solo **Usar como final** modifica la pieza asociada.

**Criterios de aceptación:**
- Automático y 0–6 cortes manuales funcionan y el coste usa la cantidad real.
- Todos los cortes generados quedan visibles en la mediateca y los utilizados aparecen en la timeline.
- Cada vídeo puede previsualizarse desde la bandeja, la locución puede escucharse y toda versión MIX
  lista puede reproducirse completa antes de marcarla como final.
- Al mover o recortar una capa, reproducir desde la timeline refleja inmediatamente su nueva posición;
  nunca se confunde el montaje actual con el último recurso aislado que se haya abierto.
- Los segmentos protegidos no se eliminan ni recortan sin desbloqueo explícito.
- Una receta v2 secuencial no renderiza si vídeo y pista maestra difieren más de 0,25 s. En modo por
  capas, si la locución es más larga, se informa y se mantiene el último frame de la base bajo los
  apoyos; nunca se oculta ese ajuste.
- Grabaciones manuales y Playwright pueden actuar como pista base; cualquier vídeo reutilizable puede
  añadirse como apoyo superior sin incorporar su audio.
- Preparar secuencial y Preparar en capas recuperan la misma locución y los mismos subtítulos de la
  pieza destino; solo cambia la composición visual.
- No se vuelve a omitir ningún corte ni se trunca el último por una locución más corta.
- Toda salida con voz conserva subtítulos inferiores en la zona segura.
- Piezas y MIX anteriores continúan abriendo, renderizando y publicándose.

### REQ-013 — Preflight de prompts y catálogo fal.ai ampliado

**Objetivo:** que ningún prompt generativo se envíe a fal.ai sin que el usuario pueda verlo,
modificarlo y aprobarlo, y ofrecer una selección actual de modelos con coste comparable.

**Flujo obligatorio en rama fal.ai:**
- «Preparar guion y prompts» ejecuta análisis/guion, pero no crea la pieza ni llama a fal.ai.
- Se muestran hook, duración y todos los cortes generativos con descripción, plano y prompt editable.
- Si cambia viral, funcionalidad, modelo, duración o cantidad, la revisión queda obsoleta y debe repetirse.
- «Aprobar prompts y generar» persiste la versión aprobada; el pipeline la reutiliza exactamente y
  no vuelve a pedir a la IA un guion diferente.
- El servidor rechaza una creación fal.ai sin revisión o con prompts vacíos/cantidad incoherente.
- HeyGen conserva su flujo directo porque no consume prompts text-to-video de fal.ai.

**Catálogo curado:** Seedance 1.0 Pro Fast, Seedance 2.0 Fast/Standard, Kling 2.5 Turbo Pro,
Kling 3.0 Standard/Pro, Veo 3.1 Fast/Standard y Luma Ray 2. Cada opción muestra tarifa estimada;
el cuerpo y duración se adaptan al contrato oficial del endpoint, siempre vertical y sin audio
nativo cuando existe esa opción, ya que la locución continua se monta aparte.

**Criterios de aceptación:** ningún crédito de vídeo se consume en el preflight; los prompts editados
son los que aparecen en el manifiesto de clips; las duraciones incompatibles se ajustan y explican;
coste y modelo coinciden con el render autorizado; piezas antiguas y la rama HeyGen siguen funcionando.

### REQ-014 — Confianza operativa: navegación autenticada, contexto y recuperación

**Objetivo:** evitar resultados aparentemente completos que en realidad no son ejecutables o no están
suficientemente justificados, sin romper los flujos existentes.

**Contenido propio / Playwright:**
- «Requiere login» autentica primero y la contraseña nunca se incluye en prompts, respuestas ni logs.
- Si se solicita una función concreta, el análisis combina dossier, código y una inspección móvil de la
  superficie privada ya autenticada para construir `navSteps` ejecutables.
- El usuario puede indicar un cliente o dato de ejemplo. Si lo omite, la IA puede proponer el primer
  elemento seguro visible, pero debe dejarlo explícito y permitir editarlo.
- Rutas dinámicas (`/client/:clientId`) se alcanzan seleccionando una entidad tras login; no se inventan IDs.
- Si no hay evidencia suficiente, la UI distingue claramente «guía humana» de «recorrido automático».
- Los pasos que confirman una mutación se marcan; el dry-run comprueba el control pero se detiene antes
  de ejecutarlo. La grabación real sí lo ejecuta al lanzar la pieza.

**Resiliencia y confianza:**
- Los catálogos de vídeo/voz se cargan de forma independiente y pueden reintentarse sin cerrar el modal.
- Un 5xx/timeout no se presenta como credencial inválida; 401/403 y 429 se explican por separado.
- Los scores de leads se recalibran con FIT+INTENT: sin señal pública explícita la intención no supera 3;
  todo score necesita una justificación visible y los lotes antiguos se pueden recalibrar sin nueva búsqueda.
- Los logos muestran iniciales inmediatamente y sustituyen el placeholder cuando llega la imagen.

**Contexto inicial del proyecto:** texto opcional, persistente y editable que prioriza crawl y búsqueda
en código, y se entrega al dossier como fuente declarada por el usuario. Nunca sustituye la evidencia:
el dossier diferencia lo aportado de lo verificado en web/código.

**Criterios de aceptación:** una función tras login puede producir JSON Playwright sin IDs inventados;
el dry-run no confirma acciones mutantes; ElevenLabs se reintenta dentro del modal; un lote 5/5 sin
señales se corrige; no hay huecos mientras cargan logos; el contexto se conserva en regeneraciones.

### REQ-015 — Mapa funcional recursivo de la app

**Objetivo:** producir automáticamente un inventario navegable de la experiencia de usuario hasta
tres niveles, para que el usuario no tenga que redactar y pegar manualmente el mapa de cada proyecto.

**Detección neutral de interfaz:** no se presupone una barra concreta. El análisis busca y relaciona
simultáneamente navbar superior, barra inferior, sidebar izquierda/derecha, drawer/hamburguesa,
pestañas, tarjetas enlazables, breadcrumbs y navegación programática (`navigate`, router, enlaces).

**Mapa estático — siempre:**
- Combina rutas, componentes de menú, layouts, guards, roles, feature flags y contenido de páginas.
- Profundidad máxima predeterminada: 3; límites de ficheros/nodos para evitar árboles infinitos.
- El contexto del proyecto puede indicar audiencia («cliente normal, no admin») y prioridades, pero
  el mapa se obtiene de evidencias del código/web y conserva referencias `archivo:línea`.
- Cada nodo incluye sección, descripción, ruta, superficie de navegación, botones/acciones seguras,
  login/roles/condiciones, hijos y estado de verificación.

**Verificación Playwright — posterior y opcional:**
- Reutiliza las credenciales cifradas del proyecto y visita únicamente rutas same-origin conocidas.
- No pulsa controles de negocio ni confirma mutaciones. Rutas dinámicas sin dato real quedan pendientes.
- Marca cada pantalla como verificada, redirigida, condicional/no accesible o pendiente; registra la URL
  final y puede añadir enlaces seguros observados que no estuvieran en el mapa estático.

**Salida:** sección «Mapa de la aplicación» con árbol desplegable, filtros por superficie/estado,
evidencias y exportación/copia a Markdown. El mapa alimenta dossier, funciones demostrables, pasos
Playwright, guía e ideas de contenido.

**Criterios de aceptación:** una app con bottom nav, otra con sidebar y otra con navbar producen el
mismo contrato; se representan menús simultáneos; no aparece admin si el contexto lo excluye; el mapa
llega a tres niveles sin ciclos; la verificación no ejecuta acciones mutantes y las rutas dinámicas no
inventan IDs.

---

### REQ-016 — Pulido de navegación, pipelines y login Playwright

**Objetivo:** reducir densidad visual y evitar que una pipeline o grabación parezca detenida cuando el
servidor sigue trabajando.

- Los nodos conservan separación legible en competencia, leads y virales.
- Cursor propio únicamente con puntero preciso; campos de texto y dispositivos táctiles mantienen el
  cursor nativo adecuado.
- Scrollbars globales modernas y discretas. El menú lateral elimina textos redundantes y reduce altura.
- Una interrupción transitoria del SSE no congela el grafo: el cliente permite la reconexión nativa y
  recupera el estado persistido del run.
- El login Playwright reconoce campos habituales y `identifier`, comprueba sesiones guardadas y vuelve
  a autenticarse cuando caducan.
- La autenticación ocurre en un contexto sin grabación. El vídeo comienza después de aplicar la sesión,
  por lo que no captura el formulario ni la escritura de credenciales.
- Si se marcó login pero no existen credenciales o no puede localizarse el formulario, no continúa de
  forma anónima: deja un error concreto y mantiene el fallback de subida manual.

**Criterios de aceptación:** ICG Vault reconoce `input[name="identifier"]`; una sesión caducada fuerza
nuevo login; una caída SSE temporal no obliga a volver al dashboard; el menú no muestra los textos
«Automatización de contenido RRSS» ni «Proyecto activo».

---

## 5. Requisitos no funcionales

- **RNF-01 — Local-first:** funciona en el PC del usuario; los datos y las keys no salen del equipo salvo llamadas explícitas a proveedores.
- **RNF-02 — Sin coste de API de IA base:** el análisis y los guiones usan Claude Code CLI (plan Pro). Gemini solo cuando sea indispensable.
- **RNF-03 — Seguridad de secretos:** API keys y tokens **cifrados** en reposo.
- **RNF-04 — Modularidad/pluggable:** proveedores de vídeo, voz y montaje intercambiables mediante conectores.
- **RNF-05 — Trazabilidad:** todo run queda en **historial** con su estado y artefactos.
- **RNF-06 — Español** como idioma por defecto de la UI y del contenido generado.
- **RNF-07 — Resiliencia:** un fallo de un proveedor externo no rompe el pipeline; permite reintentar/regenerar una etapa.
- **RNF-08 — Windows:** entorno principal Windows 11 (rutas, FFmpeg, Playwright).

---

## 6. Fuera de alcance (por ahora)

- Publicación 100% automática vía APIs oficiales de RRSS (se pospone; empezamos con publicación manual asistida — D-06).
- Automatización de publicación por bots (contra ToS de las plataformas).
- Multi-usuario / despliegue en la nube para terceros.

---

## 7. Dudas abiertas (a resolver antes de cada REQ)

Estas no bloquean REQ-001; se resolverán al llegar a cada requisito.

- **DA-01 (REQ-002):** ✅ RESUELTA. Descubrimiento **híbrido**: la IA propone competidores directos a
  partir del dossier (nicho + propuesta de valor) y el usuario puede **añadir/quitar/editar** competidores
  manualmente; los añadidos a mano se **conservan al regenerar**.
- **DA-02 (REQ-003):** ✅ RESUELTA (2026-07-15, con el usuario). **Leads = negocios locales reales**
  (para encajar con «envío de correo» y «visita al local»). **Fuente:** el motor `claude -p` con
  **WebSearch** localiza los negocios y extrae **solo datos públicos de empresa** (nombre, dirección,
  web, teléfono/email públicos) — sin clave API extra (usa la sesión Pro). **Legal:** solo datos
  públicos de empresa, **sin PII de personas físicas**, respetando los ToS de la fuente. **Estrategia:**
  la IA genera canal + estrategia + borrador (correo/guión de visita) por lead y el usuario edita/aprueba
  (patrón Guardar/Aprobar/Regenerar, espejo de dossier/competencia).
- **DA-03 (REQ-004):** ✅ RESUELTA (2026-07-15, con el usuario). **Fuente:** IA + WebSearch (el
  motor `claude -p` con WebSearch/WebFetch localiza virales públicos de YT/TikTok/IG; sin claves
  API ni scraping directo — usa la sesión Pro). **Definición de "viral":** **relativo al autor**
  (≈5× la mediana de vistas del propio canal), evitando el sesgo hacia cuentas ya grandes.
  **Ventana temporal:** **30 días** por defecto, configurable en la UI (7/14/30/histórico).
  **Salida:** Top 20 ordenado por viralidad, con cada pieza descompuesta (hook, estructura,
  share-trigger, patrón transferible) + patrones recurrentes del nicho, para alimentar REQ-005.
- **DA-04 (REQ-005):** ✅ RESUELTA (2026-07-15, con el usuario). **Criterio anti-copyright:**
  **reinterpretación conceptual** — se usa el `patronTransferible` del viral (REQ-004) para generar
  un guion **original** sobre la marca/app del usuario, **no una copia literal** (hook/estructura como
  inspiración, contenido nuevo). **Alcance:** cableado a **proveedores reales** (fal.ai, HeyGen,
  ElevenLabs, Gemini) con keys en Ajustes + test de conexión (REQ-008), y **selección de atributos por
  pieza** (modelo de vídeo / voz / avatar en modo **auto** = decide la IA, o **manual** = lo elige el
  usuario). **Comprensión del viral:** reutiliza los datos capturados en REQ-004 por defecto + Gemini
  **opcional** para enriquecer. **Rama de vídeo:** ambas **elegibles por pieza** — fal.ai (cortes
  generados) o HeyGen (avatar foto+voz). **Montaje** (FFmpeg, D-12) queda como **stub** en esta pasada.
- **DA-05 (REQ-006):** ✅ RESUELTA (2026-07-15, con el usuario). **Credenciales:** se guardan en el
  **Vault por proyecto** (AES-256-GCM, `data/vault.enc`) bajo la clave `login:<projectId>`; se configuran
  una vez y **la contraseña nunca la devuelve la API** (solo `configured: true/false`). **Grabación:**
  **Playwright real** (emulación de móvil iPhone 13 + `recordVideo` + login scriptado) con **fallback a
  subida manual** de un screencast (`.mp4/.webm/.mov`) si Playwright/navegador no están disponibles o
  fallan. **Selección de función:** la IA la propone leyendo el `dossier` y el usuario elige/edita.
  **Render/bandeja:** reutiliza la infraestructura de REQ-005 (misma `ContentPiece` con `origin="own"`;
  fal.ai genera **cortes B-roll** para intercalar con la grabación real + locución ElevenLabs). El
  **montaje** (FFmpeg, D-12) sigue como **stub** en esta pasada; se valida antes de montar.
- **DA-06 (REQ-007):** ✅ RESUELTA (2026-07-15). "Skill" = capacidad del entorno de Claude Code
  (skills de proyecto `.claude/skills/` + plugins del marketplace) como toolkit del agente/motor;
  instalación **curada**. Catálogo en `docs/05-skills.md`; UI aplazada.
- **DA-07 (General):** ✅ RESUELTA (D-14). Modelo de datos multiproyecto desde el inicio; UI empieza con un solo proyecto.

---

## 8. Próximos pasos (SDD)

1. **OK del usuario a este documento de Requisitos.**
2. Redactar **Documento de Diseño** (flujos, pantallas, modelo de datos conceptual, diseño visual de REQ-009).
3. Redactar **Documento de Arquitectura** (stack definitivo, módulos, conectores, ejecución del pipeline).
4. Empezar implementación por **REQ-001**.
