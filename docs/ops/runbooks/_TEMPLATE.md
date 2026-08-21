# Runbook: <escenario>

> Se lee a las 3 de la madrugada, con prisa y medio dormido. Escribe en consecuencia:
> pasos numerados, comandos copiables, sin prosa.

| Campo | Valor |
|---|---|
| **Severidad** | SEV1 (caído) · SEV2 (degradado) · SEV3 (molesto) |
| **Alerta que lo dispara** | `<nombre>` — condición exacta: `<métrica> <operador> <umbral>` durante `<ventana>` |
| **Objetivo de recuperación** | `<MTTR objetivo>` · escalar si se supera |
| **Dueño** | `<equipo>` |
| **Última revisión** | YYYY-MM-DD |
| **Última vez que se probó** | YYYY-MM-DD |

> El disparador lleva **umbral numérico**, no adjetivo. "Cuando haya muchos errores" no es un
> disparador: nadie sabe cuándo empieza a aplicarse este documento.

---

## 1. Síntoma

<Qué ve el usuario. Qué muestra el dashboard. Qué dice la alerta.>

## 2. Impacto

- **Quién se ve afectado**: <…>
- **Qué no puede hacer**: <…>
- **¿Hay pérdida de datos?**: sí / no
- **¿Hay que comunicar?**: <a quién y cuándo>

## 3. Diagnóstico

Ejecuta **en este orden** y anota el resultado:

1. `<comando>` → si `<condición>`, ve al paso `<n>` de mitigación
2. `<comando>` → …
3. Comprueba el dashboard `<enlace>`
4. Revisa los logs: `<consulta>`

| Si observas… | La causa probable es… | Ve a |
|---|---|---|
| | | §4.1 |

## 4. Mitigación (primero parar el dolor)

### 4.1 · <causa>
```bash
<comando exacto>
```
**Efecto esperado**: <…>
**Cómo confirmas que funcionó**: <métrica y en cuánto tiempo>

### 4.2 · Reversión del último despliegue
```bash
<comando exacto>
```
**Tiempo estimado**: <…>
**Qué pasa con los datos ya migrados**: <…>

## 5. Comunicación

Mientras se mitiga, no después. Quien está esperando sin noticias asume lo peor.

| Cuándo | A quién | Canal | Qué se dice |
|---|---|---|---|
| Al confirmar el incidente | `<equipo>` | `<canal>` | Qué falla y que se está trabajando |
| Si hay impacto visible | Usuarios | `<página de estado>` | Qué no funciona y estimación, sin causa técnica |
| Al resolver | Ambos | | Qué pasó, qué se hizo, qué se va a hacer para que no repita |

## 6. Resolución

<Arreglo de fondo, una vez el sistema está estable. Suele ser una tarea de backlog,
no algo que se hace a las 3 AM.>

## 7. Escalado

| Cuándo | A quién | Cómo |
|---|---|---|
| Se supera el MTTR objetivo de la cabecera | `<rol>` | `<canal>` |
| Hay pérdida de datos | `<rol>` | `<canal>` |
| Afecta a datos personales | Responsable de privacidad | `<canal>` |

## 8. Cierre

- [ ] Sistema estable y confirmado con métricas
- [ ] Comunicación enviada, si procedía
- [ ] Entrada de tipo `incidente` en `docs/bitacora/DECISIONS.md`
- [ ] Post-mortem sin culpables agendado (si fue SEV1 o SEV2)
- [ ] Tarea creada para la resolución de fondo
- [ ] Este runbook actualizado con lo aprendido
