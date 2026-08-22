# Bitácora de decisiones

> Entradas nuevas arriba. No se borra ni reescribe historia existente.
> Usa [`TEMPLATE.md`](TEMPLATE.md) para cada decisión.

---

<!-- decisiones:insertar-aqui -->

## 2026-08-22 · Instalador guiado sin autenticar Claude

- **Tipo**: cambio
- **Contexto**: norkc pidió un ejecutable que recorra la preparación y *indique*
  el inicio de sesión y la comprobación de Claude.
- **Decisión / hecho**: `preparar.bat` lanza `scripts/prepare-guide.mjs`. Guía
  `check → prepare → /login indicado → auth status de solo lectura → start`.
  No pide secretos, no lanza el login y una sesión ausente no bloquea el uso
  local básico. La comprobación reutiliza el orden de binario de Claude CLI
  (override, gestionado, local) y no imprime rutas ni cuentas.
- **Alternativas descartadas**: autenticar Claude desde el asistente (fuera de
  la spec 001); disparar `iniciar.bat` (afecta procesos y caché sin
  consentimiento).
- **Impacto**: una clonación puede empezar con doble clic. README documenta el
  instalador como entrada recomendada.
- **Referencias**: spec `001-content-tray-local-installation` · RF-06 ·
  `preparar.bat` · `scripts/prepare-guide.mjs`
- **Quién**: norkc / agente

## 2026-08-22 · Recorrido de clonación en README y contrato de selección (spec 001)

- **Tipo**: cambio
- **Contexto**: T-001-07 documenta el asistente real y cierra las decisiones de
  planificación que aún no estaban en esta bitácora: el contrato de tres
  desenlaces de la pieza activa.
- **Decisión / hecho**: `README.md` encabeza el contrato «persistencia
  comprobada / arranque comprobado / opcionales identificados» y describe
  `check`, `prepare`, `start` y `reset` sin secretos ni rutas personales.
  `reconcileActivePiece` expone `kept`, `replaced` o `empty` para que la bandeja
  elija microcopy sin una segunda fuente de verdad. El runner de UI (Vitest +
  Testing Library, 5–6 devDependencies) permanece como precondición humana de
  T-001-06 porque la shell del agente no resuelve DNS externo.
- **Alternativas descartadas**: documentar `iniciar.bat` como arranque inocuo
  (afecta procesos y caché); imprimir `DATABASE_URL` o rutas de ejemplo
  personales; inferir la pieza activa con `?? pieces[0]`.
- **Impacto**: una clonación en Windows 11 puede seguir solo el README hasta un
  único bloqueo accionable. `.env.example` ya no contiene una ruta de usuario.
- **Referencias**: spec `001-content-tray-local-installation` · T-001-01 ·
  T-001-06 · T-001-07 · `docs/specs/001-content-tray-local-installation/research.md`
- **Quién**: agente

## 2026-08-21 · Marcador local de persistencia gestionada (spec 001)

- **Tipo**: decisión técnica acotada.
- **Contexto**: la presencia de SQLite por sí sola no permite distinguir una base creada por el
  asistente de datos locales desconocidos que deben preservarse y bloquearse.
- **Decisión / hecho**: escribir `data/installation/managed-v1.json` únicamente después de que la
  configuración local, las dependencias y Prisma terminen correctamente. El marcador contiene
  `version`, la versión de aplicación y el hash SHA-256 de `prisma/schema.prisma`; no guarda rutas,
  secretos, valores de configuración ni contenido de datos. Una modificación normal de SQLite no
  invalida el marcador.
- **Efecto**: una ejecución posterior puede revalidar una base gestionada contra metadatos estables;
  una DB o sidecar sin marcador compatible sigue protegido y bloqueado. `reset` copia primero DB y
  sidecars a `data/installation/backups/`, retira los originales y solo después ejecuta Prisma y
  escribe el marcador.
- **Alternativas descartadas**: leer SQLite o `.env` para inferir procedencia (divulga contenido) y
  considerar gestionada cualquier DB existente (fail-open).
- **Impacto**: estado local ignorado ya bajo `data/`; no requiere ADR ni cambia el esquema Prisma.
- **Referencias**: spec `001-content-tray-local-installation` · T-001-04/T-001-05 · SEC-002.

---

## 2026-08-21 · Stack de testing: Vitest + Testing Library (spec 001)

- **Tipo**: decisión técnica
- **Contexto**: la tarea T-001-06 requiere cubrir 7 controles de usabilidad UX-A11Y-001…007 y UX-PERF-001 con TDD real
	(red-green-refactor observable). No existe runner de tests para componentes React en el stack.
- **Decisión / hecho**: adoptar **Vitest** + **@testing-library/react** como runner de tests de interfaz.
	Devdependencies: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`
	(+ opcional `@testing-library/jest-dom`). Alias `@` resuelto en `vitest.config.ts` con `resolve.alias`.
- **Alcance**: solo la tarea T-001-06 depende del stack; resto de tareas de la spec avanza sin él.
	El `npm install -D` corre en máquina de usuario (shell del agente no resuelve DNS externo).
- **Alternativas descartadas**: (a) `node:test` a mano sin DOM ni JSX transform (inviable para React),
	(b) Playwright component testing (mayor peso operativo), (c) no automatizar a11y (rompería TDD de T-001-06).
- **Límite honesto**: UX-A11Y-001 (contraste) y UX-A11Y-004 (zoom 200%) no verificables en jsdom;
	revisión manual en `/sdd-verify`.
- **Impacto**: habilita ciclo TDD observable para controles de usabilidad en ContentTray. No requiere ADR.
- **Aprobada por**: norkc, 2026-08-21.
- **Referencias**: spec `001-content-tray-local-installation` · tarea T-001-06 · `src/components/ContentTray.tsx`

---

## 2026-08-21 · Implementación de core/installation en ESM + JSDoc (spec 001)

- **Tipo**: decisión técnica
- **Contexto**: `src/core/installation/*` ejecuta código de consola (RF-04 assistant) _antes_ de que exista
	`node_modules` (typescript es devDependency). `--experimental-strip-types` requeriría Node ≥22.6,
	pero project declara engines `>=20`.
- **Decisión / hecho**: implementar módulos de instalación en **JavaScript puro ESM** con **JSDoc**
	(no TypeScript compilado). Nombres de test conservados (`.test.mjs`). Sin cambio de alcance.
- **Alternativas descartadas**: (a) retrasar asistente de consola a post-setup (cambia UX),
	(b) TypeScript con `--experimental-strip-types` (requiere Node ≥22.6, incompatible),
	(c) CommonJS dinámico (incompatible con ESM del resto del proyecto).
- **Impacto**: asistente de instalación interactivo ejecutable sin step de build ni dependencias instaladas.
- **Deuda aceptada**: ninguna. JSDoc + tipos explícitos es estándar en Edge Functions.
- **Aprobada por**: norkc, 2026-08-21.
- **Referencias**: spec `001-content-tray-local-installation` · RF-04 (asistente de consola)

---

## 2026-08-21 · Baseline arquitectónico brownfield de RRSS Studio

- **Tipo**: decisión
- **Contexto**: la constitución estaba en `bootstrap` y la planificación de la spec sensible
	`001-content-tray-local-installation` no podía trazar su ASVS ni sus fronteras para datos,
	procesos, caché y configuración local.
- **Decisión / hecho**: se documenta como propuesta el monolito modular local con fronteras
	hexagonales pragmáticas y ASVS 5.0.0 L2 en la constitución y ADR-0001. Se propone consentimiento
	humano granular para efectos sobre procesos, cachés, datos persistidos y recursos fuera del
	repositorio.
- **Alternativas descartadas**: worker/cola, microservicios, EDA distribuido, CQRS/ES, serverless
	y reescritura Clean retrospectiva; no existe evidencia de escala, ownership ni operación que
	justifique su coste.
- **Impacto**: el plan posterior puede usar una frontera y baseline de seguridad explícitos, pero
	no puede afirmar aprobación de seguridad ni ejecutar efectos locales sin sus controles y tests.
- **Deuda aceptada**: fronteras hexagonales parciales y progreso/ejecución en memoria; registradas
	en `docs/quality/TECH-DEBT.md` para revisión en 2026-11-21.
- **Referencias**: spec `001-content-tray-local-installation` · ADR-0001 ·
	`docs/architecture/constitution.md`
- **Quién**: architect; pendiente de aprobación humana de arquitectura.
