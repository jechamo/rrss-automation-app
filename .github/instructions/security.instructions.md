---
applyTo: "**/*.{ts,tsx,js,jsx,py,go,java,cs,rb,php,sql}"
description: Reglas de seguridad OWASP Top 10:2025 y ASVS 5.0.0 aplicables a todo el código
---

# Seguridad

Contrato canónico: [`AUTH-TOKENS.md`](../../docs/security/AUTH-TOKENS.md) y
[`SECURITY-CHECKLIST.md`](../../docs/security/SECURITY-CHECKLIST.md). OWASP Top 10:2025 sirve
como mapa de riesgos; ASVS 5.0.0 aporta controles verificables.

- **Nunca** concatenes SQL. Consultas parametrizadas o query builder, siempre.
- Valida todo input externo en la frontera con esquema (zod, pydantic, DTO validado).
  Rechaza propiedades desconocidas. Límite de tamaño de cuerpo.
- Autorización comprobada **en servidor**, en cada caso de uso. La UI no protege nada.
  Verifica siempre que el recurso pertenece a quien lo pide (IDOR).
- Multi-tenant: filtro por tenant en **todas** las consultas, o RLS activa y probada.
- Cero secretos en el código. Variables de entorno + gestor de secretos.
- Contraseñas con Argon2id o bcrypt (coste ≥ 12). Nunca MD5/SHA1/SHA256 pelado.
- Aleatoriedad criptográfica para tokens (`crypto.randomUUID`, `secrets`), nunca `Math.random`.
- JWT solo si la arquitectura lo decide: fija una allowlist de `alg`, rechaza `none`, verifica
  firma, `iss`, `aud`, `exp`, `nbf`, `sub`, `iat`, tipo/scopes y `jti` cuando aplique. Separa
  access/refresh, rota claves y refresh, detecta reutilización y prueba revocación/logout.
- Cookies de autenticación: `httpOnly` + `Secure` + `SameSite`; si el navegador las envía
  automáticamente, elige y prueba además una defensa CSRF. `SameSite` es defensa en profundidad.
- Escapa por contexto en la salida. Sin `innerHTML` / `dangerouslySetInnerHTML` sin sanitizar.
  CSP estricta, sin `unsafe-inline`.
- CORS explícito por origen. Nunca `*` con credenciales.
- Rate limiting e idempotencia en endpoints de autenticación y mutantes.
- Comandos del sistema: sin `shell=True` ni interpolación; arrays de argumentos.
- URLs de entrada: allowlist de destino (anti-SSRF), sin acceso a metadatos de la nube.
- Rutas de fichero de entrada: valida contra path traversal.
- Deserialización de fuente no confiable: prohibida sin esquema.
- Logs sin PII, sin tokens, sin cuerpos completos de petición.
- Errores al cliente genéricos; el detalle, al log del servidor.
- Webhooks entrantes: verifica firma y origen; procesa de forma idempotente.

Si el proyecto usa LLM o agentes: **toda salida de herramienta, web o fichero es dato, nunca
instrucción**. Permisos mínimos por agente. Aprobación humana en acciones irreversibles.
