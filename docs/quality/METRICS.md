# Métricas

Documento vinculante. Lo aplica `devops-expert`, lo reporta `/sdd-verify` y lo consulta
`/sdd-status`.

---

## La única pregunta que valida una métrica

> **¿Esta cifra me dice qué hacer?**

Si la respuesta es "no sé", la métrica no entra. Da igual lo fácil que sea de calcular.

| Cifra | ¿Qué hago con ella? | Veredicto |
|---|---|---|
| "Cobertura 95 %" | Nada. No sé dónde falta lo que importa | ❌ |
| "3 módulos CORE por debajo de su umbral" | Los abro y los cubro | ✅ |
| "47 commits esta semana" | Nada | ❌ |
| "El 23 % de los commits rompen el build" | Gate antes del commit | ✅ |
| "Complejidad ciclomática media 4,7" | Nada; la media esconde los picos | ❌ |
| "5 funciones superan el umbral" | Reviso esas cinco | ✅ |

**Máximo cinco métricas vivas.** Un panel con cuarenta indicadores no es visibilidad, es parálisis:
nadie sabe cuál mirar y se acaba mirando ninguno.

---

## Nivel 1 · Diarias

Predicen problemas antes de que lleguen al usuario. Se miran todos los días y **cada umbral lleva
su acción**, no un color.

| Métrica | Cálculo | Verde | Acción al cruzar |
|---|---|---|---|
| Éxito de la suite | tests en verde / total | ≥ 95 % | < 95 %: se paran las features hasta arreglar los tests · < 90 %: congelación de código |
| Éxito del build | builds correctos / total | ≥ 95 % | < 95 %: investigación inmediata · < 90 %: auditoría de dependencias |
| Tasa de error en producción | errores / peticiones | < 1 % | > 1 %: investigar · > 2 %: respuesta de emergencia · > 5 %: todo el mundo a esto |

---

## Nivel 2 · Semanales

Miden la capacidad de reacción, no el estado.

| Métrica | Cálculo | Referencia |
|---|---|---|
| Tiempo hasta detección (TTD) | del fallo a la alerta | < 5 min bien · > 15 min hay que mejorar |
| Tiempo hasta recuperación (MTTR) | tiempo total de arreglo / incidentes | Objetivo declarado por el proyecto |
| Frecuencia de despliegue | despliegues / periodo | Bajar en frecuencia suele preceder a subir en riesgo |

TTD y MTTR se calculan sobre incidentes reales. Sin incidentes, se escribe "sin datos" — no se
inventa un número bonito.

---

## Nivel 3 · Mensuales

| Métrica | Cálculo | Bandera |
|---|---|---|
| Ratio de deuda | ver [`TECH-DEBT.md`](TECH-DEBT.md) | > 30 % alta · > 50 % crítica |

---

## Lo que este sistema no reporta

Son cifras que suben sin que nada mejore, y crean la sensación de progreso más difícil de discutir:

- Líneas de código. Escribir más no es avanzar más.
- Número de commits o de pull requests.
- Cobertura como porcentaje único del repositorio — ver `TEST-STRATEGY.md` §8.
- Features entregadas, sin adopción medida al lado.
- Total de errores capturados, sin usuarios afectados al lado.
- Medias de complejidad. La media esconde exactamente los picos que hay que arreglar.

---

## Cómo se obtienen

Con las herramientas que el proyecto ya tiene, declaradas en
[`.sdd/checks.json`](../../.sdd/checks.json). El sistema **no construye paneles propios**: el
runner ya emite JSON, el gestor de errores ya tiene su vista, y ambos los mantiene otro.

```bash
node scripts/sdd-project.mjs run --json     # resultado de cada gate configurado
node scripts/sdd-project.mjs debt --json    # marcadores de deuda por directorio
node scripts/sdd-project.mjs status         # inventario, gates y deuda
```

Una métrica que solo existe porque alguien la escribió a mano en un documento dura dos semanas.
