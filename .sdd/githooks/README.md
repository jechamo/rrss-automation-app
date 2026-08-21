# .sdd/githooks/

Gates locales de git para proyectos **sin Node**. En proyectos con `package.json`, el instalador
monta Husky en `.husky/` — se autoactiva con `npm install` y llama a los mismos comandos.

| Hook | Ejecuta | Cuándo |
|---|---|---|
| `pre-commit` | `sdd-project run --fast` | lint, tests rápidos, tipos, build, olores |
| `pre-push` | `sdd-project run --slow` | cobertura, E2E, auditoría de dependencias, documentación |

## Activación

`sdd init` lo deja listo. Según el stack:

| Proyecto | Mecanismo | Se activa |
|---|---|---|
| Con `package.json` | `.husky/pre-commit` y `pre-push` | Con `npm install`, para todo el equipo, si añades `"prepare": "husky"` |
| Sin Node | `core.hooksPath` → `.sdd/githooks` | En el momento de instalar |

Para saltárselo: `sdd init … --no-hooks`. Para desactivarlo después:
`git config --unset core.hooksPath`.

**Por qué dos mecanismos y no uno.** Husky se autoactiva con `npm install`, que es su única
ventaja real y no es pequeña: lo que hay que recordar activar, no se activa. Pero requiere Node, y
aquí se instalan proyectos de Python, Go, Rust y Java. Así que Husky donde hay dónde engancharse,
y `core.hooksPath` donde no.

En ambos casos los hooks **delegan en `sdd-project run`**: si el proyecto cambia de runner, se
toca `.sdd/checks.json` y los hooks no se enteran.

Si `.sdd/checks.json` no tiene comandos configurados, los hooks no hacen nada. No fallan: no hay
nada que ejecutar.

## Permisos

Un hook sin bit de ejecución **no lo corre git en Linux ni macOS**, y en algunas versiones lo hace
en silencio. En Windows no se nota, porque `core.fileMode=false` ignora permisos.

Por eso el control está sobre el **índice de git**, que es lo único que viaja al clonar:

```bash
git ls-files -s .sdd/githooks/     # debe decir 100755
git update-index --chmod=+x .sdd/githooks/pre-commit
```

`check-sdd.mjs` falla si alguno está como `100644`. Y ningún agente cambia permisos por su cuenta:
lo dice y te da el comando.

## Saltárselos

```bash
git commit --no-verify
git push --no-verify
```

Existe para la emergencia real, y la emergencia real deja rastro: **abre la tarea de seguimiento
en el mismo momento**. Un bypass sin tarea no es una excepción, es deuda que nadie ha registrado.

## Esto no sustituye a CI

Los hooks locales son un atajo para enterarte en noventa segundos en vez de en diez minutos.
**Quien bloquea de verdad es CI**, porque es el único que no se puede saltar con una bandera.
