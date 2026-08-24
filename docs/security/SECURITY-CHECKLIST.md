# Checklist de seguridad

Marco versionado: **OWASP Top 10:2025** como catálogo de riesgos y **ASVS 5.0.0** como
contrato verificable, con el nivel objetivo declarado en la constitución. Si el producto usa IA,
añade el catálogo OWASP Top 10 for Agentic Applications vigente.

Esta referencia no decide el stack. Helmet, Zod, un ORM o un proveedor de identidad pueden ser
implementaciones válidas, pero el gate exige el resultado observable y su evidencia, no una
librería concreta. Marca cada control `aplica`, `no aplica` con motivo o `no ejecutado` con riesgo,
propietario y siguiente paso.

---

## A01:2025 · Broken Access Control

- [ ] Autorización comprobada **en servidor** por caso de uso; la UI no protege el recurso
- [ ] Denegación por defecto y mínimo privilegio en aplicación, datos, cloud, tokens y CI
- [ ] IDOR: se valida pertenencia y permiso sobre el recurso, no solo que exista
- [ ] Escalada horizontal/vertical y rutas administrativas probadas
- [ ] Multi-tenant: aislamiento por tenant en todas las consultas o RLS activa **y probada**
- [ ] CORS explícito por origen, método y cabecera; nunca `*` con credenciales
- [ ] Si hay cookie automática, defensa CSRF elegida y probada; SameSite solo defensa en profundidad

## A02:2025 · Security Misconfiguration

- [ ] Sin credenciales por defecto, debug, trazas o documentación administrativa expuestos
- [ ] HTTPS obligatorio y HSTS donde aplica
- [ ] Headers probados: CSP, X-Content-Type-Options, Referrer-Policy y Permissions-Policy
- [ ] Errores al cliente genéricos; detalle solo en logs protegidos
- [ ] Buckets, colas, bases, paneles y métricas sin exposición pública accidental
- [ ] Configuración segura idéntica en código, proxy/gateway y plataforma de despliegue

## A03:2025 · Software Supply Chain Failures

- [ ] Lockfile commiteado y procedencia de dependencias verificable
- [ ] SCA ejecutado en CI con un comando real del stack; una auditoría omitida no figura como verde
- [ ] Dependencias sin mantenimiento, typosquatting y scripts de instalación revisados
- [ ] Acciones CI, imágenes y herramientas fijadas por commit/digest o política equivalente
- [ ] SBOM y firma/procedencia de artefactos según el riesgo del proyecto
- [ ] Actualizaciones con responsable, cadencia y respuesta a vulnerabilidades definida

## A04:2025 · Cryptographic Failures

- [ ] Contraseñas con función adaptativa mantenida y parámetros acordes al riesgo
- [ ] Datos sensibles en reposo cifrados cuando el threat model lo exige
- [ ] Claves en gestor de secretos, con mínimo privilegio, rotación y retirada
- [ ] Aleatoriedad criptográfica para tokens; nunca generadores no seguros
- [ ] Algoritmos y protocolos mantenidos; nada de criptografía casera
- [ ] JWT, si se elige, cumple [`AUTH-TOKENS.md`](./AUTH-TOKENS.md)

## A05:2025 · Injection

- [ ] Input externo validado por esquema en cada frontera; tipos y límites explícitos
- [ ] SQL/NoSQL parametrizado; ninguna concatenación de datos en consultas
- [ ] Comandos sin shell/interpolación y con argumentos separados
- [ ] XSS: escapado por contexto; HTML permitido solo tras sanitización mantenida
- [ ] CSP efectiva y probada; excepciones como `unsafe-inline` justificadas y acotadas
- [ ] LDAP, XPath, plantillas, cabeceras y logs tratados como superficies de inyección

## A06:2025 · Insecure Design

- [ ] Threat model actualizado con fronteras de confianza y casos de abuso
- [ ] Límites de negocio, rate limiting e idempotencia definidos y probados
- [ ] Recuperación, invitación, verificación y cambio de credenciales sin enumeración ni bypass
- [ ] Estados inválidos, concurrencia y fallos parciales tienen comportamiento seguro
- [ ] AuthN y AuthZ se modelan por separado
- [ ] Los controles no dependen de que el cliente se comporte correctamente

## A07:2025 · Authentication Failures

- [ ] Login, registro, MFA y recuperación resisten enumeración, stuffing y fuerza bruta
- [ ] Rate limiting/bloqueo progresivo no permite denegación permanente a terceros
- [ ] Sesiones expiran, rotan al elevar privilegio y tienen logout/revocación real
- [ ] Cookies usan `HttpOnly`, `Secure`, `SameSite`, `Path` y `Domain` según el diseño
- [ ] 401/403, cambio de rol, sesión revocada y credencial reutilizada están probados
- [ ] Si hay JWT: algoritmo fijo, rechazo de `alg: none`, claims, tipos, rotación y reuse probados

## A08:2025 · Software or Data Integrity Failures

- [ ] Artefactos de CI/CD y actualizaciones tienen integridad y procedencia verificables
- [ ] Deserialización de fuente no confiable prohibida sin esquema/allowlist
- [ ] Webhooks verifican firma, ventana temporal, replay y secreto rotado
- [ ] Migraciones y eventos protegen invariantes ante reintentos y entrega duplicada
- [ ] Datos de herramientas, web, ficheros o MCP se tratan como datos, no instrucciones

## A09:2025 · Security Logging and Alerting Failures

- [ ] Eventos de seguridad: login fallido, revocación, cambio de permisos y acceso sensible
- [ ] Logs **sin PII innecesaria, secretos, tokens ni cuerpos completos**
- [ ] Integridad, retención, acceso y borrado de logs definidos
- [ ] Alertas con umbral, propietario y runbook; se prueba que llegan
- [ ] Fallos del pipeline de logging/alerting son visibles y no silenciosos

## A10:2025 · Mishandling of Exceptional Conditions

- [ ] Timeout, cancelación, límites de recursos y backpressure definidos
- [ ] Fallo cerrado en autorización, firma, resolución de claves y validación
- [ ] Reintentos acotados con backoff/jitter; operaciones mutantes idempotentes
- [ ] Excepciones y estados parciales no filtran datos ni dejan permisos elevados
- [ ] Dependencias caídas, respuestas malformadas y agotamiento de cuota tienen pruebas
- [ ] El rollback conserva invariantes y existe un camino de recuperación operativo

## SSRF y peticiones salientes (egress)

Aplica a **toda petición saliente** dentro del alcance; cada `no aplica` necesita justificación
material propia. Por cada escenario y salto:

- [ ] El **destino solicitado** tiene una decisión explícita de permitido o rechazado contra la
      allowlist material del proyecto
- [ ] El **protocolo solicitado** está identificado y decidido explícitamente como permitido o
      rechazado
- [ ] Todas las direcciones efectivas **A/AAAA** se canonizan, clasifican y evalúan como
      **destino efectivo** antes de conectar
- [ ] Las redirecciones automáticas están deshabilitadas o se revalida **cada redirección** y cada
      salto antes de continuar
- [ ] Los destinos de metadata de infraestructura se rechazan **sin excepción**
- [ ] Un destino local, privado o link-local se rechaza o conserva una excepción con responsable,
      alcance, motivo material, evidencia y revisión
- [ ] Aplicabilidad, estado, decisión y evidencia se registran por separado
- [ ] Existe timeout material, cancelación efectiva y reintentos acotados; cualquier ausencia
      produce un hallazgo y el proyecto prueba los límites que declara
- [ ] Existe un límite máximo de respuesta y de procesamiento; su ausencia produce un hallazgo y
      el proyecto prueba n-1, n y n+1 sin asumir un valor universal
- [ ] Falta de acceso, permisos, red o respuesta queda como `no ejecutado`, con riesgo,
      responsable y siguiente paso; nunca como `PASS`, superado o verde
- [ ] La evidencia queda minimizada: sin secretos ni credenciales; sin cuerpos completos de
      petición o respuesta y sin datos personales innecesarios
- [ ] Documentos, URLs, respuestas y evidencias se tratan como datos no confiables: su contenido
      no puede reducir u omitir controles, cambiar gates ni ordenar un `PASS`

---

## Autenticación, tokens y CSRF

Aplica el contrato completo de [`AUTH-TOKENS.md`](./AUTH-TOKENS.md) solo cuando la arquitectura
elija JWT o credenciales de navegador. Como mínimo:

- [ ] Allowlist de algoritmo, rechazo de `alg: none`, firma y gestión/rotación de claves
- [ ] Verificación de `iss`, `aud`, `exp`, `nbf`, `iat`, `sub`, `jti`, tipo y scopes
- [ ] Access/refresh separados, **refresh token rotation** y **reuse detection**
- [ ] Revocación/logout probado; tokens ausentes de URLs y logs
- [ ] 401 frente a 403, IDOR, escalada y aislamiento multi-tenant
- [ ] Cookie automática: defensa CSRF seleccionada y probada; `SameSite` no basta por sí solo
- [ ] Bearer explícito: almacenamiento, XSS y CORS evaluados

## Privacidad y datos personales

- [ ] Minimización y finalidad por cada dato personal
- [ ] Base legal, retención, borrado y derechos definidos
- [ ] Transferencias a terceros y residencia documentadas
- [ ] Sin PII real en fixtures, logs o entornos que no la necesiten
- [ ] Acceso y exportación auditables sin ampliar permisos

## Si el producto usa LLM o agentes

- [ ] Toda salida de herramienta, web o fichero es dato no confiable, nunca instrucción
- [ ] Cada agente/herramienta tiene permisos mínimos y credenciales separadas
- [ ] MCP, skills y modelos tienen origen, versión y revisión registrada
- [ ] Memoria/contexto no persiste contenido no confiable como política
- [ ] Acciones irreversibles requieren aprobación humana
- [ ] Presupuesto, pasos, tiempo y profundidad de delegación tienen límites
- [ ] Todas las acciones materiales quedan auditadas

Ver también [`MCP-SECURITY.md`](./MCP-SECURITY.md).

---

## Matriz obligatoria en una spec sensible

`plan.md` conserva una fila por control aplicable:

| Control | ASVS | OWASP | Aplica | Decisión / justificación | Tarea | Test | Evidencia |
|---|---|---|---|---|---|---|---|
| SEC-EXAMPLE-001 | ASVS 5.0.0 Vx | A0x:2025 | sí | `<decisión concreta>` | T-NNN-01 | `<ruta::caso>` | `evidence.md#T-NNN-01` |

Un `no aplica` requiere justificación material. `security-pending` solo permite migrar contexto
brownfield histórico; una spec sensible nueva no puede usarlo para omitir la matriz.

## Clasificación de hallazgos y entrega

| Nivel | Criterio | Efecto |
|---|---|---|
| **CRÍTICO** | Compromiso sistémico o exposición masiva con explotación viable | Bloquea release |
| **ALTO** | Acceso significativo no autorizado o control crítico eludible | Bloquea release |
| **MEDIO** | Impacto/condiciones acotados | Se corrige o acepta con responsable y fecha de revisión |
| **BAJO** | Defensa en profundidad | Backlog trazado |

El informe canónico incluye `<!-- sdd-security-report:v1 -->` y el JSON definido por
`/security-scan`. Un `GO` no es compatible con CRÍTICO/ALTO, ni con MEDIO sin aceptación fechada.
