---
applyTo: "**/domain/**,**/application/**,**/core/**"
description: Reglas del núcleo - dominio y casos de uso
---

# Núcleo: dominio y aplicación

**Regla número uno: cero dependencias hacia fuera.** Si aquí aparece un import del ORM, del
cliente HTTP, del framework web o de un SDK, está mal: define un puerto e invierte la dependencia.

## Dominio

- Entidades con identidad **y comportamiento**. Nada de modelos anémicos cuando hay reglas.
- Value Objects para conceptos con validación: `Email`, `Money`, `UserId`. Inmutables,
  validados en el constructor, igualdad por valor.
- Agregado = frontera de consistencia transaccional. Una transacción, un agregado.
  Entre agregados, consistencia eventual vía eventos de dominio.
- Invariantes protegidas dentro del agregado: debe ser **imposible** construir un objeto inválido.
- Errores de dominio tipados (`InsufficientBalance`), no strings ni códigos mágicos.
- Puertos (interfaces) definidos **aquí**, implementados en `infrastructure/`.
  Pequeños y orientados al consumidor (ISP).

## Aplicación

- Un caso de uso = una operación de negocio. Entrada DTO validado, salida DTO.
- Patrón: validar → cargar agregado → ejecutar regla → persistir → publicar evento.
- La transacción se abre **aquí** (Unit of Work), nunca en el repositorio ni en el controlador.
- Sin detalles de HTTP, sin objetos `Request`/`Response`, sin código de estado.
- Sin reglas de negocio propias: eso vive en el dominio.

## Tests

Unitarios puros y rápidos, sin I/O. El dominio se testea **sin dobles** porque no tiene
dependencias. La aplicación, con fakes en memoria de los puertos.
