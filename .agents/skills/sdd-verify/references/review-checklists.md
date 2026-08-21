# Checklists de verificación

Carga solo las secciones aplicables después de que los gates automáticos sean ejecutables.

## Código y diseño

Diff con gravedad/ruta/línea; SOLID, DRY, KISS, YAGNI y patrones. Cada violación se corrige o
justifica durablemente. Tests con asserts materiales, mutación puntual, límites, sin `.only/.skip`
ni mocks de lo que se pretende probar.

## Seguridad

Para impacto sensible ejecuta `/security-scan verify` contra OWASP Top 10:2025/ASVS 5.0.0.
Control aplicable→decisión→tarea→test→evidencia; no-aplica con motivo. Auditor read-only y
reporte literal parseable. CRÍTICO/ALTO bloquea; MEDIO requiere owner, decisión y reviewDate.

## Usabilidad/accesibilidad

Para impacto aplicable: WCAG 2.2 AA/Nielsen, gate a11y y revisión manual de teclado, foco/modal,
lector, zoom 200 %, formularios, microcopy y respuesta visible <100 ms. Nada optimista en pagos,
altas, contraseñas o borrados irreversibles. Auditoría read-only y reporte literal parseable.

## Calibración/operación

Cada módulo tiene tier; dinero/datos/permisos nunca bajo CORE. Cumple umbral o declara limitación.
Errores clasificados, salud por versión/reversión, eventos sin PII, alertas con umbral/playbook,
métricas y deuda medidas. Migraciones reversibles, flags y documentación/bitácora al día.

## Evidencia

Cada ejecución tiene comando/salida/artefacto; tarea hecha tiene evento; delegaciones observadas o
motivo; controles no ejecutados conservan riesgo/owner/siguiente paso. La decisión humana queda
NO-GO hasta aprobación explícita.
