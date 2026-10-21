# Lightning Shop — instrucciones para agentes

Empieza por [`docs/README.md`](docs/README.md): una fuente de verdad por tema.
Lo pendiente vive en Linear (equipo LTR, un proyecto por módulo). El detalle de
cómo se trabaja está en
[`docs/reference/AGENT_WORKFLOW.md`](docs/reference/AGENT_WORKFLOW.md); esto es
el resumen que no se puede saltar.

## Al empezar

- `git fetch` y lee `origin/main`, `gh pr list` y lo que hacen las otras
  sesiones: el dueño trabaja con varias a la vez y el `main` local va atrasado.
- Revisa [`docs/notas/`](docs/notas/README.md): las notas con `estado: nueva`
  son lo último que dijo el dueño. Pásalas a un issue de Linear, a
  `docs/DECISIONS.md` o a una pregunta abierta (P) y márcalas
  `estado: pasada a …`. Una nota nunca manda sobre `SYSTEM.md`,
  `DECISIONS.md` ni el código.

## Mientras trabajas

- Un defecto se registra primero (issue en Linear con B / C / E) y después se
  arregla. Antes de llamarlo defecto, busca si hay una decisión tomada.
- Worktree y rama propios. Antes de cada commit, `git branch --show-current`;
  empuja la rama por nombre, nunca `HEAD`.
- "Funciona" = pasa `npm run test:real --workspace=@ltl-shop/api` (base local
  `ltl_shop_test`). Un cambio de comportamiento actualiza `docs/SYSTEM.md` y
  `docs/USER_FLOWS.md` en el mismo PR.
- Nunca `db:seed` contra producción. Las lecturas de producción las corre el
  dueño.
- Un PR con migración necesita Release safety justo después del merge; dilo
  claro. Junta los commits: Vercel Hobby tiene límite diario de deploys.

## Al cerrar

En español y corto: qué quedó hecho, qué tiene que hacer el dueño ahora
(merge, Release safety, redeploy) y qué sigue, con la pregunta en el texto.
