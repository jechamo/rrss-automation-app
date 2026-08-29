# Investigación · 002-e2e-mock-offline-v1

## D-01 · Runner de navegador

| Opción | Pros | Contras | Veredicto |
|---|---|---|---|
| Playwright ya instalado | servidor web, traces y bloqueo de rutas | añade instalación de Chromium en CI | elegida |
| Vitest + DOM | rápido | no valida servidor/navegador real | solo para unitarios |
| runner nuevo | podría especializarse | dependencia y mantenimiento sin necesidad | descartada |

La estrategia versionada del repositorio ya prescribe Playwright y el paquete ya figura en
`devDependencies`. Se usa la versión bloqueada por `package-lock.json`; no se añade dependencia.

## D-02 · Aislamiento

| Opción | Pros | Contras | Veredicto |
|---|---|---|---|
| raíz completa por ejecución | separa DB, Vault, cachés y medios | exige enrutar accesos heredados | elegida |
| solo SQLite temporal | simple | deja Vault/caché/medios compartidos | descartada |
| copia de datos reales | cercana a producción | riesgo y PII innecesarios | descartada |

## D-03 · Bloqueo de egreso

Se elige defensa en profundidad: selección fail-closed de adaptadores, guard HTTP en servidor y
route abort en navegador. Confiar solo en que CI no tenga secretos no cubre una URL pública o una
CLI instalada accidentalmente. Solo se permite loopback (`localhost`, `127.0.0.0/8`, `::1`).

## D-04 · Dobles

Se implementan fakes de los contratos que consume RRSS Studio y fixtures por intención. No se
replican SDKs de terceros. Una intención desconocida lanza error; no hay respuesta genérica ni
fallback. Esto reduce mocks mentirosos y hace visible cuándo aparece una capacidad nueva.

## Dependencias nuevas propuestas

Ninguna. Next.js, Prisma, Vitest y Playwright ya están fijados en el lockfile.

## Fuentes verificadas

- `docs/quality/TEST-STRATEGY.md` — estrategia vinculante local, consultada 2026-08-27.
- `package.json` y `package-lock.json` — versiones reales, consultados 2026-08-27.
- Guía local `vercel:nextjs` sobre Route Handlers y runtime Node — consultada 2026-08-27.
- Playwright se usará mediante su API ya instalada; no se cambia de versión ni se necesita una
  decisión basada en información web volátil.

## Descartes que conviene recordar

- No ejecutar proveedores reales como “smoke”: puede consumir créditos y no es determinista.
- No publicar bases, Vault o medios como artefactos de CI.
- No añadir Docker ni un panel de resultados para una aplicación local Windows.
