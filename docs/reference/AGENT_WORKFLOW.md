# Cómo se trabaja una tarea (humano o agente)

**Clasificación:** INGENIERÍA
**Actualizado:** 2026-10-21 (en español; Linear, worktrees, `test:real`, Release safety, `docs/notas/`)

## Antes de escribir código

Cada tarea deja escrito, en el issue de Linear o en el PR:

- **Problema:** qué falla o qué falta, en palabras del taller.
- **Hoy:** qué pasa ahora, comprobado.
- **Meta:** la regla de producto que aplica (`SYSTEM.md` / `DECISIONS.md`).
- **Alcance:** el cambio más chico que lo resuelve.
- **Fuera de alcance:** lo cercano que a propósito no se toca.
- **Riesgo:** datos, permisos, PM, historial, UX o integraciones.
- **Verificación:** qué pruebas y qué evidencia lo cierran.

Un defecto nuevo se registra primero (issue en el proyecto de su módulo, con
severidad B / C / E, y una línea en `OPEN_ISSUES.md`) y después se arregla.
Antes de llamar algo defecto, revisa `DECISIONS.md` y Linear: puede ser una
decisión tomada.

## Qué leer

1. La sección que toca de `docs/SYSTEM.md` (cómo funciona hoy).
2. Las filas que tocan de `docs/DECISIONS.md`.
3. El issue de Linear (o su línea en `docs/OPEN_ISSUES.md`).
4. El código afectado y sus pruebas.
5. Las notas nuevas de `docs/notas/` (`estado: nueva`): cada una pasa a un
   issue de Linear, una fila de `DECISIONS.md` o una pregunta abierta (P), y
   se marca `estado: pasada a …`. Una nota nunca manda sobre lo de arriba.

No leas `docs/archive/` salvo que la tarea pida el porqué histórico. Lo
archivado nunca manda sobre `SYSTEM.md`, `DECISIONS.md` ni el código.

## Ramas y sesiones en paralelo

- El dueño corre varias sesiones a la vez. Antes de planear: `git fetch` y
  lee `origin/main` (el `main` local suele ir atrasado), `gh pr list` y lo que
  hacen las otras sesiones. No toques código que otra sesión tiene abierto.
- Trabaja en un worktree propio, en una rama propia (`claude/…` o
  `cristian/ltr-…` para Cursor). En un worktree nuevo:
  `npm run prisma:generate --workspace=@ltl-shop/api`.
- Justo antes de cada commit: `git branch --show-current`. Empuja la rama por
  nombre (`git push -u origin <rama>`), nunca `HEAD`: el checkout principal
  lo cambian otras sesiones.
- Un commit hecho en una rama después de que su PR se mergeó (squash) nunca
  llega a `main`: empieza otra rama desde `origin/main`.

## Ciclo de trabajo

```text
Un issue listo
  → leer la regla de producto
  → mirar el código de hoy
  → definir el hueco y los límites
  → el cambio más chico y seguro
  → pruebas enfocadas + test:real
  → revisar el diff
  → SYSTEM.md + USER_FLOWS.md (y DECISIONS.md / OPEN_ISSUES.md) en el mismo PR
  → PR, y el issue pasa a Done cuando se mergea
```

No empieces otra cosa mientras la tarea tenga código sin revisar, pruebas
rojas o documentación desactualizada.

## Pruebas: qué significa "funciona"

- **"Funciona" = la fila pasa en `npm run test:real --workspace=@ltl-shop/api`**
  (una vez: `test:real:setup`). Corre la API compilada contra la base local
  `ltl_shop_test` en Docker, nunca contra `ltl_shop` ni producción.
- Cada historia y flujo de `USER_FLOWS.md` tiene su fila de prueba. Un cambio
  que se ve en pantalla lleva prueba E2E con datos sembrados
  (`npm run test:e2e --workspace=@ltl-shop/web`).
- Un fallo se anota como FALLA o BLOQUEADO, nunca se reetiqueta como PASA.
- Un PR solo de documentación corre `git diff --check` y no justifica
  cambios de comportamiento.
- CI rojo con 0 pasos no es el código: lee las anotaciones del check
  (bloqueo de facturación de GitHub). Las previews de Vercel en rojo pueden ser
  el límite del plan Hobby; lo que cuenta es el job `test`.

## Reglas que no se negocian

- El esquema solo cambia con migraciones de Prisma
  (`apps/api/prisma/`). `supabase/migrations/` es una copia vieja congelada.
- Permisos y reglas de negocio se validan en el servidor.
- Work Orders, Activity Log, PM e historial existentes no se pierden ni se
  reescriben.
- **Nunca** `npm run db:seed` contra producción.
- Las lecturas de producción las corre el dueño (`supabase db query --linked`).

## Migraciones y deploy

- Mergear un PR con migración **no** la aplica. El build de la API en Vercel
  falla en `prisma:release-gate` mientras haya migraciones pendientes, y
  producción se queda en el deploy anterior.
- Justo después del merge hay que correr Release safety (lo lanza el dueño):
  `gh workflow run release-safety.yml --ref main -f apply_migrations=true -f verify_api=true`.
  Después, comprobar que el deploy de producción de `ltl-shop-api` pasó, y
  redesplegar si empezó antes de que terminara. Detalle en
  [`DEPLOY.md`](DEPLOY.md).
- Vercel (equipo `ltl8`) está en plan Hobby: cada push a un PR lanza varias
  previews y el límite diario se acaba. Junta los commits y empuja una vez.
  Si el dueño dice que un cambio mergeado "se ve igual", compara el commit del
  deploy de producción (web **y** API) con `origin/main` antes de buscar el
  bug.

## Cómo se reporta al dueño

- En español, corto y en lenguaje del taller: historia, flujo, caso límite,
  "funciona / falla". No en endpoints.
- Al cerrar, en el texto: qué quedó hecho, qué tiene que hacer el dueño ahora
  (merge, Release safety, redeploy) y qué sigue, con la pregunta.
- El dueño mergea los PR (`gh pr merge N --squash --delete-branch`).

## Agentes y subagentes

Usa un agente aparte solo cuando el traspaso es más chico que hacerlo
directo. Lo mecánico (formato, encabezados, pruebas repetitivas) va al modelo
más barato; dominio, esquema, permisos, concurrencia y cambios entre módulos,
al más capaz.

## Commits

Documentación, refactors, funciones nuevas, pruebas y migraciones van en
commits separados cuando se pueden revisar por separado. El título del PR
lleva el issue (`LTR-123`) y la decisión (`D54`) si aplica.
