# Plan de test · 001-content-tray-local-installation

## Alcance

| Incluye | Excluye |
|---|---|
| Selección, plegado, precheck, SQLite, consentimiento y CLI. | Proveedores, login IA, publicación y opcionales como prerrequisito. |

## Mapa criterio a test

| OBJ | PRD-RF | UC | RF | CA | Tarea futura | Nivel | Test previsto |
|---|---|---|---|---|---|---|---|
| OBJ-005 | PRD-RF-007 | UC-010 | RF-01 | CA-01 | T-001-01/T-001-06 | unitario/UI | `selection.test.ts::debe_sincronizar_activo_y_detalle_cuando_cambia_indice` |
| OBJ-005 | PRD-RF-007 | UC-010 | RF-02 | CA-02 | T-001-01 | unitario | `selection.test.ts::debe_reconciliar_activo_cuando_desaparece` |
| OBJ-005 | PRD-RF-012 | UC-010 | RF-03 | CA-03 | T-001-06 | UI | `ContentTray.test.tsx::debe_conservar_plegados_independientes` |
| OBJ-004 | PRD-RF-005 | UC-011 | RF-04 | CA-04 | T-001-04/T-001-07 | CLI/manual | `install-local.test.mjs::debe_requerir_persistencia_antes_de_ready` |
| OBJ-004 | PRD-RF-006 | UC-012 | RF-05 | CA-05 | T-001-03/T-001-05 | unitario/CLI | `installation.test.ts::debe_bloquear_reset_sin_confirmacion_separada` |
| OBJ-004 | PRD-RF-008 | UC-011 | RF-06 | CA-06 | T-001-03/T-001-07 | unitario/docs | `installation.test.ts::debe_declarar_opcional_sin_bloquear_ready` |
| OBJ-004 | PRD-RF-006 | UC-012 | RF-07 | CA-07 | T-001-02/T-001-05 | unitario/CLI | `installation.test.ts::debe_sanear_diagnosticos` |
| OBJ-004 | PRD-RF-006 | UC-012 | RF-08 | CA-08 | T-001-03/T-001-05 | unitario/CLI | `installation.test.ts::debe_recalcular_recibo_en_cada_ejecucion` |

## Niveles y dobles

| Nivel | Cobertura |
|---|---|
| Unitario | ID activo, cambios rápidos, precheck, sanitización y consentimiento. |
| Integración | Filesystem temporal, SQLite sintética, sidecars y proceso hijo con argv separado. |
| Contrato | [internal-cli.md](contracts/internal-cli.md), estados, `ready` y ausencia de datos sensibles. |
| Interfaz | Rol, teclado, `aria-expanded`, región de estado y reducción de movimiento. |
| Manual Windows 11 | Clonación limpia, interrupción, protección de datos, consentimientos y consola. |

| Regla de fixture | Valor |
|---|---|
| Datos | IDs y directorios temporales sintéticos. |
| Prohibido | Tocar `prisma/dev.db`, leer `.env`, usar PII, secretos o rutas personales. |

## Casos límite

| Caso | Resultado esperado |
|---|---|
| Colección vacía o última pieza eliminada | `pieceId=null` y ningún detalle residual. |
| Cambio doble y rápido | Gana la última selección. |
| Nueva carga de lista | Unidades plegadas; durante sesión conservan su estado. |
| Equipo fuera de Windows 11 | Bloqueo de plataforma, no éxito. |
| Persistencia ausente | Bloqueo seguro sin valor de variable. |
| SQLite o sidecar existente | Bloqueo protegido sin contenido expuesto. |
| Confirmación rechazada | No hay efecto y el recibo mantiene bloqueo. |
| Puerto ocupado | Categoría segura; no mata procesos globalmente. |
| Opcional ausente | Efecto visible sin impedir `ready`. |

## Seguridad

| Control | Abuso | Resultado seguro | Test |
|---|---|---|---|
| SEC-INPUT-001 | Ruta absoluta, traversal o `.env`. | Rechazo sin leer ni mostrar contenido. | `installation.test.mjs::debe_rechazar_ruta_fuera_del_proyecto` |
| SEC-DATA-002 | DB/sidecar e intento de reset. | Bloqueo o confirmación separada; resguardo. | `installation.test.mjs::debe_bloquear_datos_existentes_sin_reset_confirmado` |
| SEC-PROC-003 | Imagen global o PID no confirmado. | Rechazo; no termina procesos. | `install-local.test.mjs::debe_requerir_confirmacion_por_pid` |
| SEC-DIAG-004 | Error con URL, variable o ruta personal simulada. | Salida categórica saneada. | `installation.test.mjs::debe_sanear_diagnostico_local` |
| SEC-DEPS-005 | Instalación global o PATH. | Efecto no autorizado en esta spec. | `install-local.test.mjs::debe_clasificar_instalacion_global_como_efecto_externo` |

## Usabilidad y documentación

| Grupo | Verificación |
|---|---|
| UX-A11Y-001 a UX-A11Y-007 | Teclado, nombres, reducción de movimiento, zoom y contraste final. |
| UX-A11Y-001 | `ContentTray.test.tsx::debe_mantener_contraste_y_estado_activo` (semántica; contraste final manual) |
| UX-A11Y-002 | `ContentTray.test.tsx::debe_exponer_estado_activo_en_texto` |
| UX-A11Y-003 | `ContentTray.test.tsx::debe_conservar_foco_del_control_activado` |
| UX-A11Y-004 | `ContentTray.test.tsx::debe_mantener_controles_accesibles` (semántica; área 200 % manual) |
| UX-A11Y-005 | `PieceCarousel.test.tsx::debe_nombrar_indicador_y_pieza_activa` |
| UX-A11Y-006 | `ContentTray.test.tsx::debe_anunciar_detalle_actualizado` |
| UX-A11Y-007 | `PieceCarousel.test.tsx::debe_conservar_seleccion_sin_movimiento` |
| UX-FORM-001 | Confirmación separada, no afirmativa por defecto y rechazo sin efecto. · `install-local.test.mjs::debe_exigir_confirmacion_separada_para_reset` |
| UX-COPY-001 | Categoría, recuperación y alternativa sin datos locales. · `installation.test.mjs::debe_devolver_recuperacion_segura` |
| UX-PERF-001 | `ContentTray.test.tsx::debe_actualizar_detalle_en_una_activacion` |
| Revisión manual | Lector de pantalla, contraste y clonación Windows 11 por `code-reviewer` en `/sdd-verify`. |

| DOC-ID | Tarea futura | Artefacto | Comprobación |
|---|---|---|---|
| DOC-README-INSTALACION | T-001-07 | README.md | node scripts/check-sdd.mjs --spec 001 --json; revisión de clonación limpia |

## Criterio de suficiencia

| Módulo previsto | Tier | Umbral |
|---|---|---:|
| `src/core/content/selection.ts` | CORE | 100 % |
| `src/core/installation/*` | CORE | 100 % |
| `ContentTray.tsx`, `PieceCarousel.tsx` | IMPORTANT | 80 % |
| `scripts/install-local.mjs` | INFRASTRUCTURE | Contrato e integración obligatorios. |

Todos los CA deben estar verdes. La evidencia registra RED, GREEN, refactor y gates no configurados.

## Gates

| Estado | Comando |
|---|---|
| Configurado | `node scripts/check-sdd.mjs --spec 001 --json` |
| Disponible fuera del gate SDD | `npm run test:contracts`, `npm run db:generate`, `npm run db:push`, `npm run build`, `npm run lint` |
| Pendiente | interfaz, integración, E2E, a11y, security, documentación, typecheck y build como gates SDD |
