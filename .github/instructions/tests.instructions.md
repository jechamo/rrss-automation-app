---
applyTo: "**/*.{test,spec}.*,**/tests/**,**/__tests__/**,**/test_*.py"
description: Reglas de TDD y calidad de tests
---

# Tests

Ciclo **RED → GREEN → REFACTOR**. El test se escribe primero y **se demuestra fallando**.

- Nombre: `debe_<comportamiento>_cuando_<condición>`. Se lee como una frase.
- Arrange · Act · Assert separados visualmente. Un solo Act. Un motivo de fallo por test.
- Sin lógica en el test: nada de `if` ni bucles. Casos múltiples → `test.each` / `@parametrize`.
- Determinista: reloj, aleatoriedad, UUIDs y red **inyectados**. Nunca `sleep`; espera por condición.
- Independiente del orden; cada test crea y limpia su estado.
- Prueba **comportamiento observable**, no implementación. Un test que rompe al refactorizar
  sin cambiar comportamiento es un mal test.
- Datos con Test Data Builder u Object Mother; nada de literales mágicos dispersos.
- **No mockees lo que no controlas**: envuélvelo en un puerto y haz un fake de ese puerto.
  Prefiere fakes a mocks.
- Casos límite obligatorios: vacío · nulo · uno · muchos · límite exacto · negativo ·
  desbordamiento · Unicode · zonas horarias · concurrencia · idempotencia · timeout ·
  permiso denegado · dependencia caída.
- Prohibido `.only`, `.skip`, tests comentados y asserts triviales.
- E2E: selectores por rol y texto accesible; solo flujos críticos de negocio.

Cobertura mínima 80 % en dominio y aplicación. La cobertura es un termómetro, no el objetivo.
