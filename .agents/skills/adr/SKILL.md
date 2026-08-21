---
name: adr
description: Crea un Architecture Decision Record en formato MADR. Úsalo cuando se tome una decisión con consecuencias estructurales duraderas.
---

# /adr — Registrar una decisión arquitectónica

Agente responsable: `@architect`.

Úsala para una decisión estructural duradera: fronteras, infraestructura, consistencia,
despliegue, contrato público o deuda difícil de revertir. Una elección local reversible va a
`DECISIONS.md`.

## Procedimiento

1. Ejecuta `node scripts/sdd-project.mjs new-adr <titulo-en-kebab-case> --json`.
2. Completa la plantilla devuelta: contexto, criterios, alternativas —incluida no hacer nada—,
   decisión, consecuencias y condiciones observables de revisión. El CLI solo numera y fecha.
4. Enlaza desde `docs/architecture/constitution.md` y desde la spec afectada.
5. Avisa a `@bitacora-keeper` para la entrada en `DECISIONS.md`.

## Reglas

- No inventes contenido decisorio ni marques `aceptado` sin aprobación humana.
- Para cambiar una decisión, crea otro ADR y marca el anterior `reemplazado`; no reescribas historia.
- Sin alternativas descartadas, consecuencias y revisión observable, el ADR está incompleto.
