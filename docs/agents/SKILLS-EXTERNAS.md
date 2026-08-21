# Skills externas

Las skills externas solo se distribuyen si están auditadas, fijadas y son parte del método base.
Se gobiernan en [`.sdd/external-skills.json`](../../.sdd/external-skills.json). La instalación
incluye únicamente `skill-creator`, oficial de Anthropic y fijada a un commit; no hereda
candidatas, rechazos ni decisiones históricas de la plantilla.

Para aprobar una entrada hacen falta publicador identificado, licencia verificada, versión o
commit inmutable, revisión de instrucciones y scripts, alcance, riesgo y responsable.

`node scripts/skills-sync.mjs --check` valida esa política; nunca instala por sí mismo.
