# Deuda técnica

Documento vinculante. La mide `/sdd-verify`, la registra `bitacora-keeper` y la paga
`refactor-specialist`.

---

## Qué es

> "Decisiones de diseño convenientes a corto plazo y caras a largo plazo." — Ward Cunningham

Como la deuda financiera: tomas prestado tiempo hoy y pagas intereses cada vez que tocas ese código.
La deuda no es un fracaso; **no saber cuánta tienes, sí**.

| Eje | Tipos |
|---|---|
| Origen | **Deliberada**: decisión consciente, con compensación analizada y plan de pago · **Accidental**: por desconocimiento o prisa, sin intención |
| Efecto | **Crítica**: bloquea features · **Manejable**: solo ralentiza |

La deliberada se registra en la bitácora en el momento de contraerla, con su fecha de revisión. La
accidental se descubre midiendo.

---

## Cómo se mide

Con un comando, no con una impresión. **La deuda con adjetivo no existe**: "tenemos bastante deuda"
no permite decidir nada.

```bash
node scripts/sdd-project.mjs debt --json
```

Cuenta `TODO`, `FIXME`, `HACK` y `XXX` sobre los ficheros versionados —no sobre `node_modules` ni
sobre lo ignorado— y agrupa por directorio. Sin dependencias y sin presuponer lenguaje.

Señales complementarias, del proyecto que las tenga configuradas:

| Señal | De dónde sale |
|---|---|
| Avisos de lint | gate `lint` |
| Funciones sobre el umbral de complejidad | gate `smells` |
| Módulos CORE por debajo de su umbral | gate `coverage` |
| Tendencia del tiempo de build | histórico de CI: subida sostenida = complejidad creciente |

### Ratio

```
ratio = esfuerzo estimado para saldar la deuda / esfuerzo total del periodo
```

| Ratio | Lectura |
|---:|---|
| < 30 % | Normal. Se paga con la regla del 80/20 |
| > 30 % | Alta. Se programa un sprint de deuda |
| > 50 % | Crítica. Hay una decisión arquitectónica pendiente, no una limpieza |

El numerador es una estimación humana y se declara como tal. Lo que no es opinable es el conteo.

---

## Cómo se paga

**Regla del boy scout.** Cada vez que tocas un fichero, lo dejas algo mejor: un nombre que revela
intención, un número mágico extraído, código muerto fuera. Acotada al fichero que ya estabas
tocando —`implementer` tiene prohibido arreglar de paso lo que no es su tarea, y esa prohibición
manda—.

**Regla del 80/20.** Un quinto de la capacidad de cada ciclo va a deuda. Previene la acumulación y
mantiene la velocidad estable. Es lo que evita el sprint de deuda.

**Sprint de deuda.** Cuando el ratio supera el 30 %: un periodo sin features, solo refactor,
limpieza y tests. Es una corrección, no una rutina; si hace falta cada trimestre, el problema está
en el 80/20 que no se está respetando.

**Un `TODO` sin ticket no es deuda, es un despiste.** La Definition of Done lo bloquea.

---

## Cómo se comunica

El negocio no decide sobre complejidad ciclomática. Decide sobre tiempo y riesgo.

| No | Sí |
|---|---|
| "Tenemos alta complejidad ciclomática y varios code smells" | "Cada feature nueva en este módulo tarda el doble que hace seis meses" |
| "Hay 47 TODOs pendientes" | "Invertir una semana ahora ahorra cuatro el próximo trimestre" |
| "El código está mal" | "El riesgo es que un cambio en pagos rompa algo que no vemos hasta producción" |

Traducir no es maquillar: la cifra sigue estando en `evidence.md`. Es elegir la unidad que permite
a quien decide, decidir.

---

## Registro evidenciado

### TD-001 · Fronteras de persistencia incompletas en pipelines

- **Tipo / efecto**: accidental / manejable.
- **Evidencia**: `src/core/pipeline/req001.ts`, `req005.ts` y `req006.ts` importan `@/lib/prisma`
	y actualizan modelos de Prisma desde los nodos. Esto mezcla la orquestación de casos de uso con
	el adaptador de persistencia y dificulta sustituirlo o probar reglas sin infraestructura.
- **Impacto**: un cambio de almacenamiento o de consistencia puede requerir tocar varios pipelines
	en vez de un límite de repositorio por contexto.
- **Límite actual**: no obliga a refactorizar el brownfield; los cambios nuevos no deben aumentar
	este acoplamiento sin justificación de plan.
- **Revisión**: 2026-11-21, al planificar una modificación transversal de persistencia o pipeline.

### TD-002 · Ejecución y progreso locales no sobreviven al proceso

- **Tipo / efecto**: deliberada / manejable.
- **Evidencia**: las rutas de ejecución lanzan `void executeRun(...)`; `src/core/pipeline/bus.ts`
	usa `EventEmitter` en `globalThis`, y `src/core/clips/processor.ts` conserva trabajos activos en
	un `Set` en memoria y marca trabajos interrumpidos como error al volver a leerlos.
- **Impacto**: al cerrar, recompilar o reiniciar el servidor se pierde el progreso vivo y no hay
	reanudación automática de pipelines. Los estados persistidos sirven para informar, no para
	reconstruir un trabajo en curso.
- **Límite actual**: no introducir broker o worker por esta deuda sin necesidad demostrada, ADR,
	idempotencia y operación preparada.
- **Revisión**: 2026-11-21, si aparece un requisito de reanudación fiable o ejecución separada.

### TD-003 · Arranque heredado con efectos globales no apto para instalación guiada

- **Tipo / efecto**: accidental / crítica para RF-05 de la spec 001.
- **Evidencia**: `iniciar.bat` ejecuta `taskkill /F /IM node.exe`, termina cualquier listener del
	puerto 3000 y elimina `.next` antes de iniciar Next. `src/lib/prisma.ts` instancia Prisma sin
	preparación ni diagnóstico de esquema, mientras `prisma/schema.prisma` depende de
	`DATABASE_URL`.
- **Impacto**: una clonación limpia no dispone de comprobación previa ni de un resultado seguro;
	el script puede afectar procesos ajenos y caché, y no clasifica datos existentes antes de
	operaciones sobre persistencia.
- **Límite actual**: no reutilizar estos efectos como asistente de instalación. La spec 001 debe
	preservar datos, detectar antes de cambiar y exigir confirmaciones separadas, conforme a su
	RF-05 y al ADR-0001.
- **Revisión**: 2026-11-21 o al cerrar la verificación de la spec 001, lo que ocurra primero.
