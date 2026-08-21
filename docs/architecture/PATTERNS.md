# Patrones de diseño

Referencia del agente `refactor-specialist` y del `planner`.

> **Regla de uso**: un patrón se aplica cuando el **problema aparece**, no antes.
> Aplicarlo "por si acaso" es complejidad sin beneficio, y viola YAGNI.
> Al aplicar uno, documenta en `plan.md`: *problema → patrón → alternativa descartada*.

---

## 1. Índice por problema

| Problema que tienes | Patrón | Nota |
|---|---|---|
| Elegir implementación en tiempo de ejecución | **Strategy** | El más útil y el más infrautilizado. Sustituye al `switch` que crece |
| Crear objetos sin acoplarte a la clase concreta | **Factory Method**, **Abstract Factory** | No abstraigas antes del segundo caso real |
| Construcción con muchos opcionales | **Builder** | También para datos de test (Test Data Builder) |
| Aislar el dominio de la persistencia | **Repository** | Interfaz en el dominio, implementación fuera |
| Coordinar varias escrituras en una transacción | **Unit of Work** | Se abre en la capa de aplicación |
| Hablar con un sistema externo | **Adapter**, **Gateway**, **Anti-Corruption Layer** | El ACL es innegociable: su modelo no entra en tu dominio |
| Añadir comportamiento sin tocar la clase | **Decorator**, **Middleware/Pipeline** | Caché, logging, reintentos, métricas |
| Reaccionar a hechos del dominio | **Observer**, **Domain Events**, **Pub/Sub** | Desacopla el "qué pasó" del "qué hacer" |
| Orquestar un flujo largo entre servicios | **Saga**, **Process Manager** | Con compensaciones explícitas |
| Publicar eventos y escribir en BD de forma consistente | **Transactional Outbox** | **Obligatorio** si hay broker. Sin él, se pierden mensajes |
| Evitar procesar dos veces | **Idempotency Key** | En todo endpoint mutante y todo consumidor |
| Encapsular una operación como objeto | **Command**, **Mediator** | Base de CQRS |
| Separar el modelo de lectura del de escritura | **CQRS** | Empieza ligero: mismas tablas, distintos modelos |
| Reconstruir el estado desde el histórico | **Event Sourcing** | Muy caro. Solo con necesidad legal o temporal real |
| Simplificar un subsistema complejo | **Facade** | |
| Evitar `null` y condicionales dispersos | **Null Object**, **Result/Either**, **Optional** | Los errores esperados son valores, no excepciones |
| Reglas de negocio combinables | **Specification** | Filtros y validaciones componibles |
| Estado con transiciones legales | **State**, **State Machine** | Si tienes un `estado: string` con `if`s, es esto |
| Fallo de un servicio remoto | **Timeout**, **Retry con backoff + jitter**, **Circuit Breaker**, **Bulkhead** | Los cuatro juntos. El timeout **siempre** |
| Conceptos con validación propia | **Value Object** | `Email`, `Money`, `UserId`. Mata la Primitive Obsession |
| Consistencia dentro de una frontera | **Aggregate** | Una transacción, un agregado |
| Comportamiento por tenant o por plan | **Strategy + Policy Object** | |
| Muchos parámetros juntos que viajan siempre | **Parameter Object** | |
| Objeto costoso de crear | **Object Pool**, **Lazy Loading** | Solo con medición previa |
| Sustituir una implementación sin parar el mundo | **Branch by Abstraction** | Interfaz primero, dos implementaciones conviviendo, conmutador, y se borra la vieja |
| Reemplazar un sistema entero por partes | **Strangler Fig** | El nuevo va comiendo rutas del viejo. La alternativa —reescritura de golpe— es cómo mueren los proyectos |

---

## 2. Patrones por capa

### Dominio
Entity · Value Object · Aggregate · Domain Event · Specification · Policy · Factory ·
**Port** (interfaz que la infraestructura implementará)

### Aplicación
Use Case / Interactor · Command & Query · Unit of Work · Application Service ·
DTO / Mapper · Mediator

### Infraestructura
Repository (implementación) · Adapter · Gateway · Anti-Corruption Layer · Outbox ·
Circuit Breaker · Retry · Cache-Aside · Decorator

### Interfaces
Controller (fino) · Presenter / View Model · Middleware / Pipeline · Facade

### Frontend
Container/Presentational · Custom Hooks · Compound Components · Render Props ·
Provider · Observer (estado reactivo) · Command (acciones)

---

## 3. Antipatrones prohibidos

| Antipatrón | Por qué mata | Alternativa |
|---|---|---|
| **Singleton mutable global** | Estado compartido invisible, imposible de testear | Inyección de dependencias |
| **God Object** | Cambia por diez motivos distintos | Extract Class por responsabilidad |
| **Anemic Domain Model** (con dominio rico) | Las reglas se dispersan por los servicios | Mueve el comportamiento a las entidades |
| **Service Locator** | Oculta las dependencias | Inyección por constructor |
| **Herencia de 3+ niveles** | Frágil, rompe LSP | Composición |
| **Herencia por reutilizar código** | Acopla lo que no tiene relación conceptual | Composición o función libre |
| **`utils.js` cajón de sastre** | Sumidero sin dueño ni cohesión | Reparte por dominio |
| **Abstracción especulativa** | Interfaz con una implementación y sin segundo caso | Espera al segundo caso real |
| **Excepciones para flujo normal** | Control de flujo invisible y caro | Result/Either |
| **Big Ball of Mud** | Todo depende de todo | Fronteras y disciplina de módulos |

---

## 4. Cómo elegir bien

1. **Nombra el problema primero.** Si no puedes escribirlo en una frase, no necesitas un patrón.
2. **Regla de tres.** A la primera vez, escribe el código. A la segunda, aguántate. A la
   tercera, abstrae.
3. **El patrón más simple que resuelve el problema.** Strategy antes que Abstract Factory.
4. **Un patrón mal aplicado es peor que ninguno**: añade indirección sin resolver nada.
5. **Documenta la alternativa descartada.** Es lo que evitará que alguien lo "mejore" mal
   dentro de seis meses.
