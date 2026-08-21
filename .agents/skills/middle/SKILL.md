---
name: middle
description: Implementa una tarea de capa media o backend — dominio, casos de uso, servicios, integraciones, colas, transacciones. Aplica SOLID, patrones y TDD estricto. Úsala cuando la tarea toque lógica de negocio, API o infraestructura de servidor.
---

# /middle — Implementación de capa media

Agente responsable: `@backend-expert`. Coordina: `@implementer` (o `@planner` en su papel de
jefe de proyecto). Devuelve el control a quien invocó.

## Puerta de entrada

No se empieza sin esto. Si falta, **para y pídelo**; no lo inventes:

- [ ] Tarea con id (`T-NNN-XX`) en `tasks.md`, con criterio de aceptación que la origina
- [ ] `plan.md` con la posición arquitectónica decidida (capas, dónde vive el dominio)
- [ ] Contrato en `contracts/` si la tarea cruza una frontera de sistema
- [ ] Si toca el esquema de datos → la tarea de `/bbdd` va **antes**, no en paralelo

Si la tarea dice "implementa el login" sin criterio de aceptación, no está definida.
Vuelve al jefe de proyecto.

## Ciclo obligatorio

### 1 · 🔴 RED

Escribe **un** test que falle por el motivo correcto y **pega la salida real del fallo**.

- Unitario del caso de uso, con los puertos como dobles. Sin BD, sin HTTP, sin reloj real.
- Nómbralo `debe_<comportamiento>_cuando_<condición>`.
- Un test que pasa a la primera no prueba nada: comprueba que falla, y por qué falla.

### 2 · 🟢 GREEN

El código mínimo. Nada de generalizar "por si acaso" — eso es YAGNI y lo audita
`@refactor-specialist`.

### 3 · ♻️ REFACTOR

Con la suite en verde. Aplica la lista de abajo. Si el refactor rompe un test, el refactor
está mal, no el test.

## Dónde va cada cosa

La regla no negociable: **las dependencias apuntan hacia dentro**.

| Capa | Contiene | Nunca contiene |
|---|---|---|
| **Dominio** | Entidades, agregados, invariantes, objetos de valor, eventos de dominio, **interfaces de puerto** | Framework, ORM, HTTP, SQL, `import` de infraestructura |
| **Aplicación** | Casos de uso, orquestación, transacción, autorización del caso de uso | Reglas de negocio (van al dominio), detalles de transporte |
| **Infraestructura** | Adaptadores: repositorios, clientes HTTP, productores/consumidores de cola, caché | Reglas de negocio, decisiones de flujo |
| **Entrada** | Controladores, handlers, consumidores, CLI. Traducen y validan | Lógica de negocio. Un controlador largo es un caso de uso escondido |

Prueba rápida: si borras el framework, ¿el dominio compila? Si no, la dependencia está invertida
al revés.

## SOLID en la práctica de esta capa

- **S** — Un caso de uso, una intención de negocio. Si al nombrarlo necesitas "y", son dos.
- **O** — Caso nuevo → implementación nueva del puerto, no un `if` más en el `switch`.
- **L** — Ninguna implementación de puerto lanza `NotImplemented` ni endurece precondiciones.
  Si un adaptador no puede cumplir el contrato, el puerto está mal segregado.
- **I** — Puertos pequeños y orientados al consumidor. Tres puertos de dos métodos antes que uno
  de seis. El puerto lo define **quien lo consume**, no quien lo implementa.
- **D** — El dominio declara `interface PaymentGateway`; infraestructura escribe
  `StripePaymentGateway`. Nunca al revés, nunca `new` de un concreto dentro de un caso de uso.

## Patrones, cuando aparece el problema

| Problema real | Patrón | Trampa |
|---|---|---|
| Elegir implementación en runtime | Strategy · Factory | No lo uses si nunca hay más de una |
| Aislar persistencia | Repository · Unit of Work | Repositorio que devuelve filas del ORM no aísla nada |
| Hablar con un tercero | Adapter · Anti-Corruption Layer | No dejes que su modelo entre en tu dominio |
| Añadir comportamiento sin tocar la clase | Decorator · Middleware | Tres decoradores anidados ya no se depuran |
| Reaccionar a hechos | Domain Events · Observer | Nombra el evento en **pasado**: `OrderPlaced` |
| Flujo largo entre servicios | Saga · Process Manager | Cada paso necesita compensación **escrita** |
| Escribir en BD y publicar en broker | **Transactional Outbox** | Sin outbox, el `commit` y el `publish` se desincronizan. Pasa en producción, no en local |
| Petición repetida | **Idempotency Key** | Obligatorio en todo endpoint mutante y en todo consumidor de cola |
| Evitar `null` y condicionales dispersos | Result/Either · Null Object · Specification | |
| Estado con transiciones legales | State Machine | Las transiciones ilegales se prueban, no se comentan |
| Fallo remoto | Timeout → Retry con backoff **+ jitter** → Circuit Breaker → Bulkhead | Retry sin jitter sincroniza a todos los clientes y tumba el destino |

**Prohibido**: Singleton mutable global · God Object · Service Locator · dominio anémico cuando
el dominio es rico · `utils.js` cajón de sastre · herencia de 3+ niveles.

## Innegociables de esta capa

- **Validación en la frontera** con esquema (zod, pydantic, DTO). Dentro se confía. Fail fast.
- **AuthN ≠ AuthZ**: la autorización se comprueba **en el caso de uso**, servidor, siempre. No
  en la UI, no solo en el middleware de ruta.
- **Consultas parametrizadas** siempre. Concatenar SQL es rechazo automático.
- **Nada de secretos** en código, logs ni tests. Variables de entorno.
- **Logs estructurados** sin PII, sin tokens, sin cuerpos completos. Con `trace_id`.
- **Transacción explícita**: qué la abre, qué la cierra, qué pasa si falla en medio.
- **El reloj y el azar son dependencias.** Inyéctalos o no podrás testear.
- **Idempotencia** en todo lo que un cliente pueda reintentar.
- Errores tipados. Ni `catch` vacío, ni `except: pass`, ni tragar y seguir.

## Antes de devolver el control

- [ ] Rojo demostrado con salida real, ahora verde
- [ ] Suite completa en verde, sin `.only` ni tests saltados
- [ ] Lint, formato y tipado estricto sin warnings
- [ ] Cobertura del camino nuevo, y **mutation score** del core si el proyecto lo tiene montado
  (Stryker en TS, mutmut en Python). Cobertura alta con *mutation score* bajo significa que los
  tests no detectan defectos: no cuenta como hecho
- [ ] Observabilidad en el camino nuevo: log, métrica, traza
- [ ] `contracts/` actualizado si cambió una frontera
- [ ] Sin decisiones arquitectónicas tomadas por tu cuenta. Si el plan no cubría algo, se para y
  se escala al `@architect` — con ADR, no en el chat

## Stack concreto

El método de arriba no depende del framework. Lo que sí depende: las prácticas del fabricante.
Consulta `docs/agents/SKILLS-EXTERNAS.md` — si el
proyecto usa Cloudflare Workers, Netlify Functions o Stripe hay skills oficiales del equipo
propietario declaradas en `.sdd/external-skills.json`.
Para versiones y APIs actuales usa el MCP `context7` antes que la memoria.

## Salida

```
### HANDOFF
- Agente origen: backend-expert
- Tarea: T-NNN-XX — <título>
- Criterio que cubre: CA-NN
- Ficheros tocados: <rutas>
- Ciclo TDD: rojo <salida pegada> → verde → refactor <qué se limpió>
- Checks ejecutados: <comando + resultado real>
- Patrones aplicados: <lista o "ninguno">
- Decisiones tomadas: <lista, o "ninguna">
- Bloqueos / supuestos: <lista, o "ninguno">
- Devuelvo control a: <quien me invocó>
```
