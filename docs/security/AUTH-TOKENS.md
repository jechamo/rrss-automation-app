# Autenticación, tokens y CSRF

Referencia portable para decidir y verificar autenticación en un proyecto instalado. No es una
decisión de arquitectura: **JWT no es el mecanismo predeterminado**. La constitución y el plan de
cada proyecto deben justificar si usan sesión opaca, JWT, OAuth 2.0/OIDC u otro mecanismo.
No se impone JWT, ni se presupone o activa durante la instalación.

Marco versionado: **OWASP Top 10:2025** como mapa de riesgos y **OWASP ASVS 5.0.0** como
contrato de verificación. Para tokens autocontenidos aplica especialmente ASVS V9. Las referencias
se versionan para que una actualización futura no cambie en silencio lo que se auditó.

## 1. Decisión previa

Antes de elegir el mecanismo, documenta en `plan.md`:

| Pregunta | Decisión exigida |
|---|---|
| ¿Quién emite y quién consume la identidad? | Emisor, audiencias y fronteras de confianza |
| ¿Hace falta revocación inmediata? | Sesión opaca, denylist, versión de sesión u otro control |
| ¿Hay varios servicios verificadores? | Gestión de claves y preferencia por firma asimétrica |
| ¿Cómo viaja la credencial? | Cookie automática o cabecera `Authorization: Bearer` explícita |
| ¿Qué guarda el navegador? | Riesgos XSS/CSRF y almacenamiento elegido |
| ¿Cuánto dura cada credencial? | TTL de access, refresh y sesión absoluta/inactiva |
| ¿Qué nivel ASVS aplica? | L1, L2 o L3 según la constitución |

No uses JWT si solo añade estado distribuido, complica la revocación o expone datos que cabrían en
una sesión opaca. Un JWT firmado proporciona integridad; su payload no queda cifrado por ello.

## 2. Contrato mínimo si se elige JWT

### 2.1 Verificación criptográfica

- La configuración del verificador fija una **allowlist de algoritmos**. El token nunca elige por
  sí solo el algoritmo aceptable.
- Se rechazan siempre `alg: none`, algoritmos fuera de la allowlist, firmas ausentes o inválidas y
  confusiones entre algoritmos simétricos/asimétricos.
- Las claves tienen procedencia, identificador (`kid` cuando aplique), propietario, periodo de
  validez, rotación y retirada documentados. Un `kid` es un selector, no una ruta o consulta libre.
- Cabeceras/parámetros `jku`, `x5u` y `jwk` del token no controlan fuentes dinámicas de claves. El
  verificador resuelve únicamente claves de emisores y orígenes en allowlist; valida TLS, host,
  redirecciones y destino de red y no permite acceso a loopback, redes privadas ni metadatos cloud.
- En varios servicios verificadores se prefieren firmas asimétricas: un verificador no necesita
  poseer capacidad para emitir tokens.
- Fallo de resolución de clave, algoritmo desconocido o parámetro crítico no soportado implica
  rechazo cerrado, nunca degradación.

### 2.2 Claims y propósito

El verificador comprueba como una unidad:

| Claim / dato | Regla |
|---|---|
| `iss` | Coincidencia exacta con el emisor configurado |
| `aud` | Contiene la audiencia esperada para este servicio |
| `exp` | Existe y no ha vencido; tolerancia de reloj pequeña y explícita |
| `nbf` | El token ya es válido; no se acepta prematuramente |
| `iat` | Coherente y dentro de la antigüedad máxima admitida |
| `sub` | Identidad estable, no vacía y válida para el emisor |
| `jti` | Único y comprobable cuando hay revocación, logout o prevención de replay |
| tipo | `access`, `refresh`, ID token u otro propósito no son intercambiables |
| scopes/roles | Se interpretan para la audiencia y el caso de uso concretos |

La autenticación no sustituye la autorización. Cada caso de uso valida permisos y pertenencia del
recurso en servidor; se prueban 401 (sin identidad válida), 403 (identidad sin permiso), IDOR,
escalada horizontal/vertical y separación multi-tenant.

### 2.3 Ciclo de vida

- Access tokens con expiración corta acorde al riesgo; refresh tokens con alcance mínimo y vida
  absoluta definida. Ningún TTL se copia de esta plantilla como decisión del proyecto.
- **Refresh token rotation**: el refresh token rota en cada uso. La **reuse detection** de uno ya
  consumido invalida la familia/sesión afectada y genera un evento de seguridad.
- Logout y cambio sensible (contraseña, rol, compromiso) tienen semántica de revocación explícita:
  denylist por `jti`, versión de sesión, invalidación del proveedor u otro mecanismo medible.
- La rotación de claves admite solapamiento controlado para tokens aún válidos y retirada segura.
- Nunca se incluyen secretos, contraseñas ni PII innecesaria en claims. Tokens completos, refresh
  tokens y cabeceras `Authorization` no aparecen en logs, métricas, URLs ni mensajes de error.

## 3. Transporte y almacenamiento

### Cookie enviada automáticamente

- `HttpOnly`, `Secure`, `SameSite` decidido, `Path` mínimo y `Domain` omitido salvo necesidad
  justificada. `SameSite=None` exige `Secure`.
- Los métodos `GET`, `HEAD` y `OPTIONS` no cambian estado.
- Se elige y prueba una defensa CSRF adecuada: token sincronizado, double-submit firmado o
  verificación estricta de origen, según arquitectura.
- **`SameSite` es defensa en profundidad, no sustituto universal de CSRF.** Excepciones de
  navegador, subdominios, navegaciones y flujos legítimos obligan a modelar el riesgo real.

### Bearer enviado explícitamente

- Solo en cabecera `Authorization`, nunca en query string, fragmento, referer o log.
- El almacenamiento del cliente se justifica frente a XSS. Evita almacenamiento persistente
  accesible a JavaScript cuando el riesgo no lo permite; un CSP no convierte XSS en imposible.
- CORS usa allowlist de orígenes, métodos y cabeceras; `*` no se combina con credenciales.
- Que el navegador no adjunte el bearer automáticamente reduce la superficie CSRF, pero no elimina
  XSS, filtraciones, CORS incorrecto ni endpoints que también acepten cookies.

## 4. Controles de aplicación dependientes del stack

El plan selecciona herramientas compatibles con el stack; el control se expresa por resultado:

| Objetivo | Evidencia esperada | Ejemplos no obligatorios |
|---|---|---|
| HTTPS y headers | Configuración y test de HSTS, CSP, MIME sniffing, referrer y permisos | Helmet, middleware equivalente, proxy/gateway |
| Validación de input | Esquema en cada frontera y casos negativos | Zod, Pydantic, Bean Validation |
| Inyección | Queries parametrizadas y comandos sin shell/interpolación | ORM/query builder/driver con parámetros |
| Abuso | Rate limit, límites de negocio e idempotencia probados | Gateway, middleware, bucket distribuido |
| XSS | Escapado por contexto, sanitización cuando se admite HTML y CSP | Sanitizador mantenido, templates autoescaped |
| Secretos | Gestor externo, mínimo privilegio y rotación | Vault/servicio cloud; nunca `.env` commiteado |
| Dependencias | Lockfile, SCA/SBOM según riesgo y actualización revisada | Herramienta real declarada en `.sdd/checks.json` |

## 5. Batería adversa mínima

Si JWT aplica, `test-plan.md` cubre al menos:

- firma inválida o ausente; `alg: none`; algoritmo no permitido; clave o `kid` desconocidos;
- `iss` y `aud` incorrectos; `exp` vencido; `nbf` futuro; `iat` incoherente; `sub` vacío;
- tipo de token incorrecto (refresh usado como access, ID token como access) y scope insuficiente;
- token revocado o `jti` bloqueado; replay y reutilización de refresh token;
- rotación de clave durante el periodo de solapamiento y después de retirar la clave;
- 401 frente a 403, IDOR, escalada de rol y acceso cruzado entre tenants;
- token ausente de logs, URLs, trazas y errores;
- cookie sin atributos, `SameSite=None` sin `Secure`, petición CSRF y `GET` mutante;
- XSS, CORS y rate limiting en las fronteras afectadas.

Cada control aplicable enlaza `control → decisión → tarea → test → evidencia`. Un `no aplica`
requiere motivo material; la ausencia de runner se registra como control no ejecutado con riesgo,
propietario y siguiente paso, nunca como aprobado.

## 6. Referencias primarias

- OWASP Top 10:2025: <https://owasp.org/Top10/2025/>
- OWASP ASVS 5.0.0: <https://owasp.org/www-project-application-security-verification-standard/>
- OWASP REST Security Cheat Sheet (JWT):
  <https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html>
- OWASP JSON Web Token Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html>
- OWASP CSRF Prevention Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html>
