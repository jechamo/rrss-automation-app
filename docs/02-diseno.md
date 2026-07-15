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
