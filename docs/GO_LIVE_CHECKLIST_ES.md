# Salida en vivo — paso a paso

**Para:** Cristian · **Fecha:** 2026-10-05, actualizada el 2026-10-09 · **Ticket:** LTR-45

> **En espera (2026-10-09):** el dueño decidió no salir en vivo todavía. La guía queda al día para cuando se
> retome. Estado de producción al 2026-10-09: **todas las migraciones aplicadas** (la última,
> `20261014120000_internal_invoices_ltr201`), la API y la web en `main` (`bd2dd54`). Las fases 1 a 3 ya se
> hicieron de hecho; al retomar alcanza con repetir la 1 para confirmar que no apareció nada nuevo.
**Lista anterior (Ninox, septiembre):** [`archive/GO_LIVE_CHECKLIST_ES_2026-09-20.md`](archive/GO_LIVE_CHECKLIST_ES_2026-09-20.md)

Este documento es el orden exacto para abrir el Shop a personas reales. Cada
paso dice **quién lo hace** (Tú / Yo) y **cómo saber que salió bien**. No
saltes de fase: cada una depende de la anterior.

**Tiempo total:** unas 2 horas de trabajo, más un día de prueba.
**Cuándo:** las fases 3 y 4 fuera del horario del taller (después de las
5:00 p.m. o en fin de semana): hay unos minutos en que la API vieja y la base
nueva no se entienden.

---

## Fase 0 — Qué necesitas a mano

- Acceso a **GitHub** (pestaña Actions del repo `LTL_Shop`).
- Acceso a **Vercel**, equipo `ltl8`, proyectos `ltl-shop-api` y `ltl-shop-web`.
  (Yo no tengo acceso a ese equipo; esos pasos son tuyos.)
- Acceso a **Supabase**, proyecto de producción `mjlfynzqmxoezanvyniw`, y la
  CLI de Supabase con sesión iniciada.
- Un **iPhone** con Safari para la prueba final.
- La lista del personal del día 1: nombre, correo y tipo (Standard, PM,
  Safety) de cada persona.

---

## Fase 1 — Mirar cómo está producción (sin cambiar nada)

Por qué: hoy producción tiene la API de una versión anterior. Cuando hay
migraciones pendientes, el build de la API en Vercel se niega a desplegar
(`prisma:release-gate`), así que **la API vieja sigue corriendo** mientras la
web ya puede estar en la versión nueva.

**1.1 · Tú — migraciones pendientes.** GitHub → Actions → **Release safety**
→ *Run workflow* con **Run prisma migrate deploy = desactivado** y
**Probe API = activado**.
- Esperado (al 2026-10-09): el paso "Check Prisma migration status" sale en
  **verde**, sin pendientes. Si lista alguna, es de un PR mergeado después:
  sigue con la fase 3 para aplicarla.
- Regla de siempre: después de mergear un PR con migración, corre Release
  safety **en ese momento** y vuelve a publicar la API; si no, la API de
  producción se queda en la versión anterior (pasó el 2026-10-09).

**1.2 · Tú — lecturas de la base (solo lectura).** En tu terminal:

```bash
supabase db query --linked --project-ref mjlfynzqmxoezanvyniw "select migration_name, finished_at from _prisma_migrations order by finished_at desc limit 6;"
```

```bash
supabase db query --linked --project-ref mjlfynzqmxoezanvyniw "select email, name, role, active from users order by role, name;"
```

```bash
supabase db query --linked --project-ref mjlfynzqmxoezanvyniw "select count(*) as trucks from trucks;"
```

```bash
supabase db query --linked --project-ref mjlfynzqmxoezanvyniw "select display_id, status from work_orders where status in ('created','in_progress','waiting_paused') order by display_id;"
```

Pásame el resultado: con eso confirmo qué falta y qué Work Orders de prueba
hay que limpiar en la fase 6.

**1.3 · Tú — Vercel.** En `ltl-shop-api` y `ltl-shop-web` → *Deployments*:
anota qué commit está en **Production** y si el último build de la API dice
*Error* (esperado mientras haya migraciones pendientes).

---

## Fase 2 — Variables de entorno

**2.1 · Tú — Vercel, proyecto `ltl-shop-api`** (Settings → Environment
Variables → Production). Nunca con prefijo `NEXT_PUBLIC_`:

| Variable | Valor | Para qué |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → *service_role* | Que el Manager cree cuentas con contraseña temporal (D22) |
| `SUPABASE_URL` | `https://mjlfynzqmxoezanvyniw.supabase.co` | Lo mismo |
| `CRON_SECRET` | Un texto largo y aleatorio (por ejemplo, 40 caracteres) | Respaldo del cierre del día a las 5:00 p.m. (D20) |
| `DATA_SOURCE` | `supabase` | Ya debería estar |
| `AUTH_DEV_BYPASS` | **No debe existir** (o `false`) | Sin esto, cualquiera entraría sin contraseña |
| `SENTRY_DSN` | Opcional | Ver errores en producción |

**2.2 · Tú — Vercel, proyecto `ltl-shop-web`:** confirma que
**`NEXT_PUBLIC_E2E_DEV_LOGIN` no existe** (si existe, la pantalla de login
muestra "Dev login"). Opcional: `NEXT_PUBLIC_SENTRY_DSN`.

**2.3 · Tú — Supabase → Authentication → URL Configuration:**
- *Site URL*: `https://ltl-shop-web.vercel.app`
- *Redirect URLs*: agrega `https://ltl-shop-web.vercel.app/reset-password`
  (para "Olvidé mi contraseña").

✅ **Listo cuando:** las variables están guardadas. Todavía no despliegues.

---

## Fase 3 — Migrar la base y desplegar (fuera de horario)

Hazlo **todo seguido**. Solo hace falta si la fase 1 listó migraciones
pendientes. (Al 2026-10-09 no queda ninguna.)

**3.1 · Tú — aplicar migraciones.** GitHub → Actions → **Release safety** →
*Run workflow* con **Run prisma migrate deploy = activado** y **Probe API =
activado**.
- Aplica las migraciones pendientes y vuelve a cargar el catálogo de Jobs.
- Esperado: el job termina en verde. (El último paso, "Verify API", puede
  fallar si la API vieja ya no responde bien; en ese caso sigue con 3.2.)

**3.2 · Tú — desplegar la API.** Vercel → `ltl-shop-api` → *Deployments* →
último commit de `main` → **Redeploy** (sin caché).
- Esperado: el build pasa (ahora la base está al día).
- Ojo: redespliega **el último** commit de `main`. Si después se mergeó otro PR
  y ya está *Ready*, no hace falta; un Redeploy de un commit anterior pisaría
  la versión nueva.

**3.3 · Tú — desplegar la web.** Vercel → `ltl-shop-web` → **Redeploy** del
último commit de `main`.

**3.4 · Tú / Yo — comprobar.**
- `https://ltl-shop-api.vercel.app/api/health` responde `"ok": true`
  (puedo revisarlo yo).
- Vercel → `ltl-shop-api` → Settings → **Cron Jobs**: aparecen dos trabajos a
  `/api/internal/day-close`. Toca **Run** en uno: responde
  `{ "ok": true, "closedSessions": … }`.
- Vuelve a correr **Release safety** con migrate **desactivado**: ahora debe
  salir en **verde** (sin pendientes).

**Si algo sale mal:** no vuelvas a una API de antes del 30 de septiembre
(PR #235): esa versión todavía usa la columna que se borró. Mándame el error
del build o del job y lo vemos.

---

## Fase 4 — Cuentas

**4.1 · Tú — tu cuenta y la del System Admin (Supabase).**
Supabase → Authentication → Users → **Add user**: tu correo y una contraseña,
con *Auto Confirm User*. Repite para la cuenta System Admin. El correo debe
ser **exactamente** el mismo que su fila en `users` (consulta 1.2). Si no
tienen fila, avísame y te paso cómo crearla.
- ✅ Entras a `https://ltl-shop-web.vercel.app/login` con tu correo y ves el
  Admin.

**4.2 · Tú — el resto del personal (desde la app).**
Admin → **People** (Personas) → **Add person**, uno por uno: nombre, correo y
tipo:
- **Daniel** → PM.
- Cada mecánico → Standard.
- **Safety 1** y **Safety 2** → Safety (con sus nombres y correos reales).

Cada vez la app muestra una **contraseña temporal una sola vez**: cópiala y
dásela a esa persona. Al entrar por primera vez la app le pide cambiarla.
- ✅ La persona entra con su correo y la contraseña temporal, cambia la
  contraseña y ve su pantalla (mecánico, PM o Quality Check).

**4.3 · Tú — sacar las cuentas de prueba** (MG, MPM, MD, MA y cualquier
otra que no sea real): People → la persona → **Remove from Shop** (D31: deja de
entrar y de aparecer, su historial queda). Si nunca hizo nada, aparece
**Delete** y se borra del todo. Si la app dice que tiene trabajo pendiente,
manda sus Jobs a la cola del equipo desde ahí mismo, o haz primero la fase 6.

---

## Fase 5 — Configurar el taller

**5.1 · Tú — Setup → Shop workflow** (D28):
- **Equipo** de cada paso: **PM** → Daniel; **Alignment** y **Detailing** →
  quienes los hagan. Con una persona, el Job nace suyo; con dos o más, nace en
  la cola del equipo y lo toma el primero. **Quality Check** → las personas de
  Safety (el Manager puede hacerlo de respaldo, D29).
- **Shop hours:** cierre 5:00 p.m., lunes a viernes. Guardar.

**5.2 · Tú / Yo — camiones.** Con el conteo de la consulta 1.2: si falta
algún camión que el taller va a buscar, avísame; la carga se hace una sola
vez con el script de Ninox (nunca con `db:seed`, que pisaría datos reales).

**5.3 · Catálogo de Jobs:** ya lo cargó la fase 3. Abre Admin → Job Catalog y
confirma que están las categorías que usa el taller; activa o desactiva las
que hagan falta (D30).

**5.4 · Tú — Parts & costs** (D32, D34):
- **Labor rate:** la tarifa por hora del taller y desde qué fecha vale.
- **Vendors:** los proveedores de partes y los talleres externos.
- **Parts:** el costo de referencia y el proveedor habitual de las partes
  del PM que más se usan (puede hacerse de a poco).

---

## Fase 6 — Limpiar datos de prueba

Con la lista de la consulta 1.2 (Work Orders abiertos):

**6.1 · Tú — cancelar los Work Orders de prueba desde la app.** Work Order →
menú **…** → **Cancel Work Order** → motivo "Prueba antes de salir en vivo".
Así queda registrado y los camiones quedan libres.

**6.2 · Tú — anular lo de prueba en Parts & costs.** Compras, reparaciones
externas y facturas internas de prueba (por ejemplo "Prueba · 123123"):
abrirlas → **Void** con el motivo "Prueba antes de salir en vivo". No se borra
nada: quedan tachadas y su costo sale del camión.

**No** corras scripts de reseteo ni `db:seed` en producción.

---

## Fase 7 — Un día de prueba con gente real

Con tu iPhone (Safari) y al menos un mecánico, Daniel y una persona de Safety.
Primero instala la app: Safari → Compartir → **Agregar a pantalla de inicio**.

| # | Quién | Qué | Debe pasar |
|---|---|---|---|
| 1 | Manager | Nuevo Work Order para un camión real | Nace con PM, Alignment, Detailing y Quality Check y sus responsables |
| 2 | Manager | Inspección: "Issues found" → Agregar trabajo | El Job aparece en el Work Plan |
| 3 | Manager | Asigna el Job a un mecánico | El mecánico lo ve en su inicio |
| 4 | Mecánico | Start → trabaja → Completar Job | Su tiempo aparece en el Work Order |
| 5 | Mecánico | Reportar bloqueo en otro Job | El Manager lo ve en el Dashboard |
| 6 | Manager | Resolver el bloqueo | El mecánico ve "Resuelto · toca Continuar" |
| 7 | Manager | **Agregar ayudante** en un Job | El ayudante lo ve y su tiempo corre a su nombre |
| 8 | Manager | **Enviar a taller externo** (pieza) → **Regresó** | El siguiente paso dice "En taller externo"; al volver se completa |
| 9 | Daniel | Crear/iniciar el PM, millaje y partes, Terminar | El paso PM queda completo |
| 10 | Safety | Quality Check: Tomar → Devolver con nota | El Manager ve "Devuelto por Safety" |
| 11 | Safety | Tomar → Aprobar | El Manager puede cerrar |
| 12 | Manager | Cerrar Work Order → Return to Service | El camión sale del tablero |
| 13 | Mecánico | Deja un Job a medias al irse | Al día siguiente su reloj cerró a las 5:00 y ve "Ayer quedó en curso · toca Continuar" |
| 14 | Mecánico | Start en un camión y después en otro | El reloj del primero se cierra ("cambio de camión") |
| 15 | Manager | Cargar una compra real con su factura en PDF para un camión | Aparece en Truck → Costs del camión |
| 16 | Manager | Fin de mes: factura interna del camión → Send → Download PDF | Sale con número SHOP-… y el PDF para Finanzas |

Cualquier cosa que falle o confunda: mándame captura y la registro en
`OPEN_ISSUES.md` con su clase (B bloqueante, C confuso, E estético).

---

## Fase 8 — Día 1 y después

- **Primer día:** revisa el Dashboard a media mañana y al final del día;
  corrige tiempos raros desde Work Order → Historial y auditoría → Corrección
  de tiempo.
- **Volver atrás:** en Vercel, *Promote* el deploy anterior de la API o la
  web. La base **no** se deshace: solo se puede volver a deploys posteriores
  al PR #235 (30 de septiembre).
- **Terminado cuando:** el taller trabaja un día completo con usuarios reales
  sin un defecto B. Entonces se cierran LTR-45 y LTR-173.

## Quién hace qué

| Paso | Tú | Yo |
|---|---|---|
| Release safety, Vercel, Supabase (fases 1–4) | ✅ | Te guío y reviso resultados |
| Health de la API | | ✅ |
| Alta de personal, configuración, limpieza (fases 4–6) | ✅ | |
| Prueba del día y arreglos (fases 7–8) | Pruebas y me reportas | Registro y arreglo |
