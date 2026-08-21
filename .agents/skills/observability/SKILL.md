---
name: observability
description: Instrumenta la observabilidad de producto — captura y clasificación de errores, salud de la versión, rastro de eventos de negocio, umbrales de alerta y playbooks. Úsala cuando una spec introduce caminos nuevos que pueden fallar delante de un usuario, o cuando un proyecto no tiene forma de enterarse de que algo se rompió.
---

# /observability — Enterarse antes que el usuario

Agente responsable: `@devops-expert`. Te invoca `implementer` cuando una tarea es de este terreno.
**Devuelve el control a quien te invocó.** No encadenes otro especialista.

Esta skill es la cara **proactiva**: instalar los sensores antes de que haya un incidente.
`/respond-incident` es la reactiva, y depende de que esto exista.

> Los tests atrapan los fallos que ya sabes nombrar. La observabilidad encuentra los que no.
> Un `catch` que escribe en la consola del navegador del usuario no es manejo de errores:
> es un error que nadie va a ver nunca.

## Puerta de entrada

- [ ] Tarea con id (`T-NNN-XX`) y criterio de aceptación que la origina
- [ ] `plan.md` §11 (observabilidad) leído: qué caminos son críticos en esta spec
- [ ] Constitución leída: si declara plataforma de observabilidad, se usa esa. Si no la declara,
      **propón y espera decisión**; elegir proveedor es una decisión con consecuencias duraderas
      y le corresponde a `@architect`, no a ti
- [ ] Saber si el producto trata datos personales. Cambia qué se puede capturar

Si el plan no dice qué caminos son críticos, **para**. No instrumentes todo "por si acaso": el
ruido tiene el mismo efecto que el silencio y además cuesta dinero.

## Procedimiento

### 1 · Delimitar

Lista los caminos que esta spec introduce y que pueden fallar delante de un usuario. Solo esos.
Escríbelos en la tabla §1 de `docs/ops/OBSERVABILITY.md`.

### 2 · Capturar y clasificar

Instrumenta la captura y **asigna cada error a su clase** — red, lógica de negocio, carga de
recursos, terceros—. Sin clase, un error es una notificación; con clase, es una decisión, porque
cada una tiene una acción distinta y confundirlas hace perder días.

Define el criterio de **agrupación**: cien usuarios con el mismo fallo son un problema, no cien
avisos.

### 3 · Salud de la versión

Marca cada evento con la versión desplegada y define los indicadores de §4 del documento: tasa de
fallo de sesión, errores por hora, usuarios únicos afectados y comparación con la versión anterior.

Declara la **regla de reversión**: qué combinación de indicadores obliga a volver atrás y quién lo
autoriza. Escribirla en frío cuesta cinco minutos; decidirla en caliente cuesta una hora de
discusión mientras los usuarios se caen.

### 4 · Rastro de eventos de negocio

El seguimiento automático da clics y navegación. Añade **qué intentaba hacer** el usuario en los
puntos que importan: añadió, aplicó, confirmó, pagó.

**Sin datos personales. Nunca.** Identificadores opacos, no nombres. Importes y cantidades sí;
correos, direcciones, tarjetas y texto escrito por el usuario, no. No hay excepción por comodidad
de depuración, y `@security-auditor` lo verifica en `/sdd-verify`.

### 5 · Trazas legibles

El código desplegado va minificado o compilado. Sin mapas de símbolos, la traza apunta a
`a.b.c:1:2847` y no sirve de nada. Genera y sube los mapas **en el pipeline**, y no los publiques
al cliente.

### 6 · Muestreo

Errores al 100 % siempre. Rendimiento y sesiones, muestreados en producción: capturarlo todo cuesta
dinero y ahoga la señal.

### 7 · Alertas con umbral y playbook

Por cada alerta, la fila completa de §8: umbral de aviso, umbral crítico, ventana, prioridad y
**playbook**.

**Una alerta sin acción posible no se crea.** Si al recibirla no hay nada que hacer, es ruido, y el
ruido acaba silenciando el canal entero — incluida la alerta que importaba.

Crea el runbook desde `docs/ops/runbooks/_TEMPLATE.md`
con disparador numérico y objetivo de recuperación. Un umbral con adjetivo —"cuando haya muchos
errores"— no es un disparador: nadie sabe cuándo aplica el documento.

### 8 · Verificar que funciona

**Provoca un error de prueba y compruébalo de extremo a extremo.** Una instrumentación que nadie
ha visto disparar es una instrumentación que probablemente no funciona: clave mal configurada,
entorno filtrado, bloqueador de por medio.

Pega la salida real. "Está configurado" no es un resultado.

## Antes de devolver el control

- [ ] `docs/ops/OBSERVABILITY.md` sin marcadores `<...>` sin resolver
- [ ] Cada camino crítico de la spec captura y **clasifica** sus errores
- [ ] Salud por versión visible, con regla de reversión escrita
- [ ] Rastro de eventos de negocio en los puntos que importan, **sin datos personales**
- [ ] Trazas legibles: mapas de símbolos en el pipeline, no publicados al cliente
- [ ] Muestreo declarado por entorno
- [ ] Toda alerta con umbral de aviso, umbral crítico, prioridad y playbook
- [ ] Runbook creado o actualizado, con disparador numérico
- [ ] **Error de prueba disparado y visto llegar**, con la salida pegada
- [ ] Sin secretos ni claves en el repositorio: la configuración va por variable de entorno

## Salida

```
### HANDOFF
- Agente origen: devops-expert
- Tarea: T-NNN-XX — <título>
- Criterio que cubre: CA-NN
- Ficheros tocados: <rutas>
- Caminos instrumentados: <lista>
- Clases de error cubiertas: <red | negocio | recursos | terceros>
- Salud de versión: <indicadores activos> · regla de reversión: <resumen>
- Eventos de negocio: <lista> · datos personales: ninguno
- Alertas: <n> — todas con umbral y playbook: sí/no
- Runbooks: <rutas>
- Verificación de extremo a extremo: <salida real del error de prueba>
- Bloqueos / supuestos: <lista, o "ninguno">
- Devuelvo control a: <quien me invocó>
```
