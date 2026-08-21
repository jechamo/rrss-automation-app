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
