# Changelog

Todos los cambios relevantes de este proyecto se documentarán aquí siguiendo
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

- Añadido un E2E v1 determinista y sin créditos: datos temporales, proveedores simulados,
  bloqueo de egreso, ejecución en Windows CI y aislamiento completo del estado local.
- Cerrada la deuda documental histórica de la spec 001 mediante trazabilidad verificable de
  seguridad, usabilidad, documentación y aprobación visual, sin cambiar el comportamiento.
- Actualizado el baseline SDD a v0.9.1 y endurecido el instalador local: Vault versionado y
  atómico, base nueva vacía, readiness de aplicación/DB/Vault, build obligatorio, detección de
  Chromium, smoke reproducible de Windows y ejecución manual del CI sin autorizar resets ni
  sobrescribir datos existentes.
