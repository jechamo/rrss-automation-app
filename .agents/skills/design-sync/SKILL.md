---
name: design-sync
description: Sincroniza el diseño con el código. Lee tokens, componentes y estados desde Figma (Dev Mode) o Google Stitch por MCP y los contrasta con el design system implementado.
---

# /design-sync — Diseño ↔ código

Agentes: `@ux-designer` (interpreta) → `@frontend-expert` (implementa).

## Requisitos

- **Figma**: escritorio abierto, Dev Mode activo, servidor MCP local habilitado
  (panel Inspect → *Enable desktop MCP server*). Configurado en `.mcp.json` como `figma`.
- **Stitch**: servidor MCP `@google/stitch-mcp`. Configurado como `stitch`.

Si el MCP no responde, **dilo y para**. No inventes valores de diseño: un color inventado
se propaga por todo el producto.

## Paso 1 — Leer el diseño

Del nodo o página indicada, extrae:
- Tokens: color (con su nombre semántico), tipografía, espaciado, radios, sombras.
- Estructura: jerarquía de componentes y su anidamiento.
- Variantes y estados: default, hover, focus, active, disabled, error, cargando, vacío.
- Restricciones responsive y breakpoints.
- Textos reales (para microcopy e i18n).

## Paso 2 — Contrastar con el código

| Comprobación | Acción si falla |
|---|---|
| ¿El token existe en el design system? | Si no, no lo codifiques a pelo: propón añadirlo o usar el más cercano y señalar la inconsistencia |
| ¿El componente ya existe? | Reutiliza. Crear un duplicado es la vía rápida a un design system muerto |
| ¿El diseño cubre todos los estados? | Si faltan (vacío, error, cargando, sin permiso), **pídelos**: no los inventes en el código |
| ¿Contraste ≥ 4.5:1 (texto) y ≥ 3:1 (controles)? | Señálalo como bloqueante de accesibilidad |
| ¿Objetivos táctiles ≥ 24×24 px? | Señálalo |
| ¿Se transmite información solo por color? | Señálalo |

## Paso 3 — Informe de divergencias

```markdown
## Divergencias diseño ↔ código — YYYY-MM-DD

### Tokens fuera del sistema
- `#3B7DDD` usado en el nodo X — el más cercano es `color.primary.500` (#3A7CDC)

### Componentes duplicados
- El diseño crea un `CardSmall` que es `Card` con `density="compact"`

### Estados faltantes en el diseño
- Pantalla de listado: falta estado vacío y estado de error

### Accesibilidad
- Texto secundario sobre fondo `surface.subtle`: contraste 3.1:1 (mínimo 4.5:1) ❌
```

## Paso 4 — Implementación

Pasa a `@frontend-expert` con: tokens confirmados, componentes a reutilizar, componentes
nuevos justificados, y los estados que hay que construir.

Recuerda: **lo que salga de Stitch es punto de partida, no entrega**. Pasa siempre por
accesibilidad, tokens y estados no felices antes de dar nada por bueno.

## Cierre

```
### HANDOFF
- Agente origen: ux-designer
- Origen del diseño: <Figma nodo / Stitch proyecto>
- Tokens confirmados: <n> · fuera del sistema: <n>
- Componentes a reutilizar: <lista> · nuevos: <lista>
- Estados faltantes en el diseño: <lista>
- Bloqueantes de accesibilidad: <lista>
- Siguiente agente sugerido: frontend-expert
```
