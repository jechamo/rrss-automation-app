# Observabilidad

Plantilla del proyecto. La rellena `devops-expert` con [`/observability`](../../.agents/skills/observability/SKILL.md).
Complementa a [`runbooks/`](runbooks/) y a [`/respond-incident`](../../.agents/skills/respond-incident/SKILL.md),
que es la cara reactiva de lo mismo.

> Sustituye los `<...>` por las decisiones reales del proyecto. Un documento con marcadores sin
> resolver no es una plantilla rellenada: es una intención.

---

## 0. Por qué esto no es opcional

En desarrollo hay un usuario, red perfecta, navegador actual y datos limpios. En producción hay
miles a la vez, conexiones malas, dispositivos viejos, caracteres que nadie previó y gente que cierra
la pestaña a medias. La distancia entre "funciona en mi máquina" y "funciona para todos" solo se
cubre observando.

Y hay una asimetría que decide la prioridad: **los tests atrapan los fallos que ya sabes nombrar;
la observabilidad encuentra los que no.** Por eso `TEST-STRATEGY.md` §0 calibra entre las dos.

---

## 1. Qué se instrumenta

| Camino | Criticidad | Qué se captura |
|---|---|---|
| `<flujo crítico de negocio>` | Alta | Errores, latencia, rastro de eventos |
| `<...>` | | |

Regla mínima: **todo camino que la spec introduce y que puede fallar delante de un usuario**.

---

## 2. Clasificación de errores

Un error sin clasificar es una notificación más. Clasificado, es una decisión. Cada clase tiene una
acción distinta, y confundirlas hace perder días arreglando lo que no se puede arreglar.

| Clase | Qué es | Qué se hace |
|---|---|---|
| **Red / conectividad** | El usuario perdió conexión, la petición no llegó | No es un bug de código. Se mejora la experiencia: reintento, estado offline, mensaje honesto |
| **Lógica de negocio** | Un cálculo, una validación o una regla que falla | Bug real. Arreglo inmediato si toca dinero o datos |
| **Carga de recursos** | Falta un fragmento de la aplicación tras un despliegue | Problema de despliegue o caché. Se resuelve invalidando y recargando, no parcheando el código |
| **Terceros** | Falla una dependencia externa | Se evalúa reintento, degradación o sustitución. Se silencia con fecha, nunca indefinidamente |

Proyecto: `<clases adicionales si las hay>`.

## 3. Agrupación

Cien usuarios con el mismo fallo son **un** problema, no cien avisos. El criterio de agrupación se
declara explícitamente —tipo de error, mensaje normalizado y componente— para que el recuento sea
"un fallo, 100 usuarios afectados" y no cien notificaciones idénticas que enseñan al equipo a
ignorar las notificaciones.

Criterio del proyecto: `<...>`.

---

## 4. Salud de la versión

Sin esto, la secuencia es: se despliega, se espera, alguien se queja, y alguien intenta recordar qué
se subió ayer. Con esto, se ve degradarse la versión en minutos.

| Indicador | Cómo se calcula | Umbral de alarma |
|---|---|---|
| Tasa de fallo de sesión | sesiones con error / sesiones | `<...>` |
| Errores por hora | | `<...>` |
| Usuarios únicos afectados | | `<...>` |
| Comparación con la versión anterior | delta % | `<...>` |
| Tiempo hasta detección | del primer error a la alerta | Objetivo: `<...>` |

Regla de reversión: `<qué combinación de indicadores dispara una vuelta atrás, y quién la autoriza>`.

---

## 5. Rastro de eventos de negocio

El seguimiento automático da clics y navegación. Lo que falta es **qué intentaba hacer** el usuario.

```
14:32:03  añade al carrito        producto=<id>  cantidad=2
14:32:07  aplica descuento        código=<id>    resultado=aceptado
14:32:18  inicia pago
14:32:19  ERROR                   pago rechazado
```

Con esa secuencia el fallo se reproduce. Sin ella hay una traza de pila y una conjetura.

**Sin datos personales, nunca.** Identificadores opacos, no nombres. Importes y cantidades sí;
tarjetas, correos, direcciones y contenido escrito por el usuario, no. Esta regla no admite
excepciones por comodidad de depuración, y `security-auditor` la verifica.

Eventos del proyecto: `<...>`.

---

## 6. Contexto y trazas legibles

- **Contexto de sesión**: versión, entorno, dispositivo, tipo de conexión, idioma, duración. Permite
  ver patrones que ningún test reproduce —"solo falla en móvil con conexión lenta a los treinta
  minutos"—.
- **Trazas legibles**: el código desplegado va minificado o compilado; sin mapas de símbolos, la
  traza apunta a `a.b.c:1:2847`. Los mapas se generan y se suben **en el pipeline**, y no se
  publican al cliente.
- **Identificación de usuario**: `<identificador opaco, nunca datos personales>`.

---

## 7. Muestreo

Capturarlo todo en producción cuesta dinero y ahoga la señal.

| Entorno | Errores | Rendimiento | Sesiones |
|---|---|---|---|
| Desarrollo | 100 % | 100 % | 100 % |
| Producción | 100 % | `<...>` | `<...>` y 100 % cuando hay error |

Los errores nunca se muestrean. El rendimiento y las sesiones, sí.

---

## 8. Alertas

Una alerta sin acción posible es ruido, y el ruido se acaba silenciando entero — incluida la que
importaba.

| Alerta | Aviso | Crítico | Ventana | Prioridad | Playbook |
|---|---|---|---|---|---|
| `<nombre>` | `<umbral>` | `<umbral>` | `<min>` | crítica/aviso/informativa | [`runbooks/<...>.md`](runbooks/) |

**Prioridades**

- **Crítica** — pérdida de dinero, funcionalidad rota visible, pérdida o corrupción de datos,
  incidente de seguridad. Respuesta inmediata.
- **Aviso** — degradación de rendimiento, funcionalidad no crítica rota, tasa de error elevada pero
  manejable. Se planifica.
- **Informativa** — fallo de un tercero conocido, errores esperados por entrada inválida. Se sigue,
  no se despierta a nadie.

**Contra la fatiga**

1. Agrupar antes de notificar (§3).
2. Filtrar por entorno: nunca alertar de desarrollo.
3. Reglas de silencio **con fecha de caducidad y motivo escrito**. Un silencio sin fecha es una
   alerta borrada a escondidas.
4. Revisar la precisión: si menos del 70 % de las alertas llevan a una acción, los umbrales están
   mal y hay que corregirlos, no aguantarlos.

Silencios activos: `<alerta — motivo — caduca el ...>`.

---

## 9. Después del incidente

Post-mortem obligatorio cuando `<criterio del proyecto: p. ej. más de 5 min de degradación>`.

Cronología · causa raíz · a quién afectó y cuánto · qué funcionó y qué no de la respuesta · acciones
concretas con dueño y fecha.

**Sin cultura de culpa.** El objetivo es que el sistema no lo permita la próxima vez, no que alguien
quede señalado. Un post-mortem donde la conclusión es el nombre de una persona es un post-mortem
fallido: la pregunta correcta es por qué el sistema dejó que ese error llegara a producción.
