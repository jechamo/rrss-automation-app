---
name: rrss-lead-research
description: "Investiga y cualifica leads para RRSS Studio a partir del dossier y la competencia, para REQ-003 y su estrategia de captacion."
---

# Investigacion y cualificacion de leads (RRSS)

Objetivo: convertir el `dossier` (negocio, propuesta de valor, nicho, publico objetivo,
puntos de dolor) y la `competencia` en una **estrategia de captacion** y un conjunto de
**leads/segmentos accionables** para contenido y publicidad en RRSS.

## Entradas esperadas
- **Dossier** (REQ-001): `negocio`, `propuestaValor`, `nicho`, `publicoObjetivo`,
  `puntosDolor`, `funcionalidades`, `marca`.
- **Competencia** (REQ-002): `competidores` (propuesta de valor, precios), `ventajas`,
  `amenazas`, `oportunidades`.

## Metodo
1. **Definir buyer personas (2-4).** Por cada una: rol/puesto, sector, tamaño de empresa,
   objetivos, dolores concretos (deriva de `puntosDolor` y del hueco en `oportunidades`),
   objeciones y el "trigger" que le hace buscar una solucion.
2. **Segmentar por señales de intencion.** Clasifica por temperatura:
   - *Caliente*: busca activamente (keywords de producto, compara alternativas, sigue a
     competidores).
   - *Templado*: tiene el dolor pero no busca solucion (consume contenido del nicho).
   - *Frio*: encaja en el perfil pero sin señal aun.
3. **Mapear canales y fuentes por persona.** Donde esta cada segmento (comunidades,
   subreddits, grupos, hashtags, directorios, reviews de competidores) y que formato de
   contenido consume. Prioriza canales con menor coste de alcance.
4. **Diferenciacion.** Ancla el mensaje en las `ventajas` frente a competidores y en las
   `oportunidades` (huecos no cubiertos). Evita competir donde el competidor es fuerte.
5. **Cualificar (BANT ligero / FIT+INTENT).** Puntua cada segmento 1-5 en: encaje con la
   propuesta de valor, tamaño/alcanzabilidad, intencion observable, y coste de captacion.

## Salida (JSON sugerido)
```json
{
  "personas": [
    { "nombre": "", "rol": "", "sector": "", "dolores": [], "objeciones": [], "trigger": "" }
  ],
  "segmentos": [
    { "nombre": "", "temperatura": "caliente|templado|frio", "canales": [],
      "mensajeClave": "", "fitScore": 1, "intentScore": 1 }
  ],
  "fuentesLeads": [ { "tipo": "comunidad|directorio|hashtag|reviews", "detalle": "", "porque": "" } ],
  "estrategia": { "prioridad": [], "quickWins": [], "mensajesPorPersona": {} }
}
```

## Buenas practicas
- Concreto y verificable: nada de "todo el mundo". Cada segmento debe ser alcanzable por un
  canal identificable.
- No inventar datos de personas reales ni PII. Trabaja a nivel de segmento/persona-tipo.
- Reutiliza los precios de la competencia para posicionar (premium vs. asequible).
- Prioriza *quick wins* (caliente + alto fit + bajo coste) para las primeras campañas.
