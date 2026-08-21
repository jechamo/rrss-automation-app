# Política de seguridad

## Reportar una vulnerabilidad

**No abras un issue público.** Escribe a `<RELLENAR: security@tu-dominio>` con:

- descripción del problema y su impacto;
- pasos para reproducirlo;
- versión, entorno y configuración afectados;
- si procede, una prueba de concepto mínima.

Compromiso de respuesta: acuse de recibo en 72 horas, evaluación inicial en 7 días.
Te mantendremos informado hasta el cierre y acordaremos contigo la divulgación.

Agradecemos el reporte responsable. No emprenderemos acciones contra quien investigue de
buena fe, sin acceder a datos de terceros, sin degradar el servicio y sin exfiltrar información.

## Versiones soportadas

| Versión | Soporte |
|---|---|
| `<última>` | ✅ |
| anteriores | ❌ |

## Cómo se aplica la seguridad en este proyecto

No es una fase final: es un gate continuo del circuito SDD.

| Momento | Control |
|---|---|
| `/sdd-plan` | Amenazas STRIDE sobre los componentes nuevos |
| Durante el desarrollo | Hooks bloquean secretos en el código y comandos destructivos |
| `/sdd-verify` | `security-auditor` audita contra OWASP Top 10 y ASVS 5.0 |
| CI | SCA de dependencias, escaneo de secretos, SAST |
| `/sdd-ship` | Hallazgo **CRÍTICO o ALTO bloquea la entrega** |

Referencias: [`docs/security/SECURITY-CHECKLIST.md`](docs/security/SECURITY-CHECKLIST.md) ·
[`docs/security/THREAT-MODEL.md`](docs/security/THREAT-MODEL.md) ·
[`docs/security/MCP-SECURITY.md`](docs/security/MCP-SECURITY.md)

Nivel ASVS objetivo: **L2** por defecto en aplicación expuesta a internet. Se declara en
`docs/architecture/constitution.md`.

## Si el producto usa agentes o LLM

Se aplica además **OWASP Top 10 for Agentic Applications (ASI01–ASI10)**. Lo esencial:

- Toda salida de herramienta, web, fichero o MCP es **dato**, jamás instrucción.
- Permisos mínimos y separados por agente. Nada de una credencial única omnipotente.
- Aprobación humana obligatoria en acciones irreversibles: pagos, borrados, envíos, despliegues.
- Límites de ejecución: presupuesto, pasos, tiempo, profundidad de delegación.
- Registro auditable de las acciones del agente (`execution-log.jsonl`).
