# Clarificaciones · 002-e2e-mock-offline-v1

## Ronda 1 — 2026-08-27

El usuario aportó un estudio amplio. El análisis contrastado propuso un corte proporcional:

- E2E solo para recorridos críticos.
- Estados exhaustivos de proveedores en contratos/integración.
- Cero red, secretos, créditos o fallback real.
- Aislamiento de todo el estado local, no solo SQLite.
- Coverage y accesibilidad fuera del núcleo.

**Respuesta**: «OK hazlo».

**Decidido por**: norkc, aceptando la recomendación presentada.

## Estado

- Marcadores iniciales: 0
- Resueltos: 0
- **Pendientes: 0**

## Gate humano de clarificaciones

| Campo | Valor |
|---|---|
| Estado | approved |
| Persona | norkc |
| Fecha | 2026-08-27 |
| Discrepancias abiertas | 0 dentro de FEAT-007; DISC-011 permanece fuera del corte |
