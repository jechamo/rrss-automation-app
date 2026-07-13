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

> ⚠️ Dudas abiertas: fuentes para descubrir competidores (búsqueda web, directorios, indicación manual). Ver §7.

---

### REQ-003 — Análisis de oportunidad y scraping de clientes potenciales

**Objetivo:** mapear **clientes potenciales** y definir una **estrategia de captación por cada uno**.

**Salida (borrador):**
- Lista de clientes potenciales.
- Estrategia recomendada por cliente: **envío de correo**, **visita al local con guión**, u otras.
- Posibilidad de **generar** esa estrategia (redactar el correo, el guión de visita, etc.).

> ⚠️ Dudas abiertas: fuente de los leads (Google Maps, directorios, LinkedIn…), legalidad y volumen. Ver §7.

---

### REQ-004 — Scraping de competidores/nicho en RRSS

**Objetivo:** localizar **vídeos virales del nicho** en YouTube, TikTok e Instagram
(creadores del sector en general, no necesariamente de la app).

**Salida:** **Top 20** ordenado por más vistos / más virales.

> ⚠️ Dudas abiertas: método de obtención (APIs oficiales vs scraping), métricas de "viralidad", ventana temporal. Ver §7.

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

> ⚠️ Dudas abiertas: qué es exactamente un "skill" aquí (¿Skills de Claude Code?, ¿plugins internos?), instalación automática vs curada. Ver §7.

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

- **DA-01 (REQ-002):** ¿Cómo se descubren los competidores? (búsqueda web con IA / indicación manual / directorios).
- **DA-02 (REQ-003):** ¿Fuente de clientes potenciales? (Google Maps, directorios, LinkedIn) y encuadre legal del scraping.
- **DA-03 (REQ-004):** ¿APIs oficiales o scraping para YouTube/TikTok/Instagram? ¿Qué define "viral" y en qué ventana temporal?
- **DA-04 (REQ-005):** Criterio para "clonar" sin infringir copyright (reinterpretar el concepto, no copiar literal).
- **DA-05 (REQ-006):** Almacenamiento seguro de credenciales de login de la appweb objetivo.
- **DA-06 (REQ-007):** Definición exacta de "skill" y política de instalación (automática vs revisada).
- **DA-07 (General):** ✅ RESUELTA (D-14). Modelo de datos multiproyecto desde el inicio; UI empieza con un solo proyecto.

---

## 8. Próximos pasos (SDD)

1. **OK del usuario a este documento de Requisitos.**
2. Redactar **Documento de Diseño** (flujos, pantallas, modelo de datos conceptual, diseño visual de REQ-009).
3. Redactar **Documento de Arquitectura** (stack definitivo, módulos, conectores, ejecución del pipeline).
4. Empezar implementación por **REQ-001**.
