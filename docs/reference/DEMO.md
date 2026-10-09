# Demo local: toda la app en uso

**Actualizado:** 2026-10-09 (modo demo, D36)
**Para qué:** mostrarles la app a los usuarios (Manager, mecánicos, PM, Safety) con datos que hacen ver cada pantalla en uso.
**Dónde:** solo en esta máquina, base `ltl_shop_demo`. Nunca en producción.

## Armarla

```bash
npm run prisma:demo-local --workspace=@ltl-shop/api
```

Esto hace cuatro cosas:
1. Crea `ltl_shop_demo` si no existe y aplica las migraciones.
2. Corre el seed: personas, catálogo, piezas de PM, Shop workflow y camiones.
3. Corre `reset-demo-work-orders.ts --demo --apply`.
4. Si se vuelve a correr, borra todo y lo arma de nuevo. No da errores de proveedor o factura repetidos.

Es mejor **armarla la mañana de la demo**, porque las horas son relativas al momento en que corre:
- lo de hoy queda repartido entre las 7:00 y la hora en que corre;
- lo de ayer y los días anteriores, en horario de taller.

Si corre después de las 5:00 p.m., el cierre del día ya cortó los relojes de hoy.

Para verla:
1. `npm run start:demo` (desde la raíz). Compila `packages/shared` y la API y levanta las dos cosas:
   - la API en `http://127.0.0.1:3141` contra `ltl_shop_demo`, con `AUTH_DEV_BYPASS=true` y `YARD_READY_TO_GO_SINCE=2000-01-01T00:00:00Z`;
   - la web en `http://127.0.0.1:3042` con `NEXT_PUBLIC_E2E_DEV_LOGIN=1` (Dev Login y Panel de demo).

   Si un puerto está ocupado: `DEMO_API_PORT=3151 DEMO_WEB_PORT=3043 npm run start:demo`. Otra base: `DEMO_DATABASE_URL=…` (tiene que ser `localhost` y decir "demo").
2. Abrir `http://127.0.0.1:3042/login`, escribir `manager@lightning.local` y tocar **Enter demo mode (this machine only)**. No pide contraseña. (El botón **Dev login** de siempre sigue ahí: entra sin el panel.)

## Modo demo (D36)

Con el modo demo encendido, el encabezado de todas las pantallas tiene un botón **Demo** (matraz) a la izquierda del perfil. Abre el **Demo panel**, el mismo panel flotante de las maquetas (`docs/proposals/*/mockup.html`), ahora dentro de la app. Sus textos están en inglés porque es una herramienta para presentar, no parte del producto.

- **User:** las diez cuentas demo agrupadas (Management, Mechanics, PM, Safety), cada una con una pista de qué muestra. Tocar una **cambia de usuario sin cerrar sesión**: la web pone la cookie de Admin con el token `dev:` nuevo y **recarga la página** en la pantalla de inicio de esa cuenta (Manager → Operaciones, mecánico → Mi trabajo, PM → PM, Safety → Quality Check). Nada del usuario anterior queda en pantalla. La cuenta actual sale marcada; una cuenta que no esté activa en la base sale como "inactive". Las cuentas que no son del reparto (por ejemplo `cristian@ltransl.com`) salen bajo **Others**.
- **Stories** *(segunda etapa, PR 2)*: elegir una historia de `USER_FLOWS.md` y recorrerla paso a paso; cada paso cambia de usuario y de pantalla y dice qué tocar y qué explicar.
- **Reset demo:** limpia la historia y vuelve al Manager en Operaciones. **No rearma los datos**: para eso, `npm run prisma:demo-local`.
- **Leave demo mode:** esconde el panel y el botón; la sesión sigue. Se vuelve a encender desde `/login`.
- El estado (encendido, panel abierto, historia y paso) queda en el navegador (`localStorage['ltl_shop_demo']`) y sobrevive a recargas y a cerrar sesión.

Dónde no existe: en producción. El panel se monta solo donde está Dev Login (`DEMO_MODE_AVAILABLE`, `apps/web/src/lib/dev-login.ts`, `false` en el deploy) y cambiar de usuario necesita la API con `AUTH_DEV_BYPASS=true`; `GET /api/dev/demo/users` responde 404 sin esa variable. La suite e2e (`apps/web/e2e/demo-mode.spec.ts`) comprueba que sin el modo encendido el botón no está, aunque el build tenga Dev Login.

Antes de presentar: armar la base esa mañana (ver arriba) y, si la demo pasa de las 5:00 p.m., recordar que el cierre del día corta los relojes de hoy.

## Cuentas

| Rol | Correo | Qué ve |
|---|---|---|
| Shop Manager | `manager@lightning.local` | Operaciones, Yard, Work Orders, Trucks, Partes y costos (con tarifa y facturas a Finanzas), Setup |
| Mecánico general | `anthony@lightning.local` | Reloj corriendo, cola del equipo, Jobs por iniciar, completados por día |
| Mecánico general | `elliot@lightning.local` | El Job bloqueado esperando piezas |
| Mecánico general | `john@lightning.local` | "Ayer quedó en curso · toca Continuar" |
| Alignment | `mechanic@lightning.local` (Alejandro 1) | Alineaciones por hacer y hechas |
| Detailing | `alejandro-2@lightning.local` | Detailing; también está en la cola del equipo |
| Mecánico PM | `daniel@lightning.local` | PM en curso, "Esperan PM" con "Último PM", PM pausado |
| Safety | `safety-1@lightning.local`, `safety-2@lightning.local` | Por revisar, Devueltos, Hechos |
| Admin | `admin@lightning.local` | Todo lo del Manager |

`luis@lightning.local` está **inactivo**: sirve para mostrar el filtro de People.

## Qué muestra cada camión

### Hoy en el taller
Algunos Work Orders se crearon días atrás, así que salen como "abierto hace más de 24 h".

| Camión | Situación | Historia de usuario |
|---|---|---|
| 601 | Recién llegado | Como Manager, registro la inspección de llegada. |
| 602 | Inspección con hallazgos, de hace 2 días | Como Manager, asigno Brake Inspection y Lights. |
| 603 | Sin hallazgos | Como mecánico, veo mi Job listo para iniciar. |
| 604 | Trabajo en curso | Como Anthony, veo mi reloj corriendo en la 604. |
| 605 | Bloqueado, esperando piezas, de hace 2 días | Como Manager, veo el bloqueo con la nota y lo resuelvo. La compra de la bolsa de aire ya está cargada hoy. |
| 606 | Solo falta QC (Normal) | Como Safety, lo tomo y lo apruebo o lo devuelvo. Como Manager, también puedo hacerlo (respaldo). |
| 607 | Ready to Go | Como Manager, lo devuelvo al servicio (Return to Service). |
| 608 | De vuelta en servicio hoy | El Work Order queda en el historial. |
| 609 | En pausa oficial, esperando aprobación | Como Manager, lo reanudo. Como PM, lo veo en "pausados". |
| 610 | Pieza en taller externo | La fila del Job dice "Part out", con el botón Returned. |
| 611 | Camión fuera, en taller externo, de hace 3 días | En el Yard sale "Out of shop". La factura de Bay Area Body Shop está ligada al Job. |
| 612 | Job con ayudante | "Brake Inspection · helper". |
| 613 | Job cancelado y pedido de trabajo abierto | Como Manager, marco el pedido como atendido. |
| 614 | Le falta un paso obligatorio | "Add missing steps". |
| 615 | Work Order cancelado | Se ve el motivo. El camión queda sin WO abierto. |
| 616 | Solo falta QC (Critical) | Sale primero en "Por revisar" de Safety. |
| 617 | Solo falta QC (High) | Sale segundo. |
| 905 | QC tomado por Safety 2 | Safety 1 lo ve como "Lo tomó Safety 2". |
| 922 | Devuelto por Safety 1 | Safety lo ve en "Devueltos". El Manager lo ve bloqueado con la nota y lo resuelve. |
| 931 | QC aprobado | Como Manager, lo veo en "Listos para cerrar" y lo cierro. |
| 944 | Reloj de ayer | Como John, veo "Ayer quedó en curso": el cierre del día lo cortó a las 5:00 p.m. |
| 957 | Detailing en la cola del equipo | Setup: Detailing tiene un equipo de dos. Anthony y Alejandro 2 lo ven en "Cola del equipo". |
| 968 | PM en curso | Como Daniel, continúo el PM. |
| 973, 986, 991 | Sin Work Order abierto (visitas recientes) | Como Manager, creo un Work Order nuevo. |

Los números de camión son los del seed. El script imprime la tabla real al terminar.

### Historia: unos 4 meses

Cada camión tiene de 1 a 3 visitas cerradas en los últimos 4 meses. Algunas son de los últimos días, incluida ayer. Cada visita pasó por el ciclo completo:
1. inspección;
2. reparaciones con su nota de cierre;
3. PM con piezas y millaje;
4. Alignment y Detailing;
5. QC aprobado por Safety;
6. cierre;
7. Return to Service.

Algunas visitas tuvieron un bloqueo resuelto, y dos fueron devueltas por Safety. Una, de hace un mes, mandó la transmisión a Diesel Pro.

Así se pueden mostrar:
- **Truck → Resumen:** historial de reparaciones, con filtro por categoría.
- **Truck → Costos:** barras por mes, movimientos (con una compra corregida y una anulada) y mano de obra en horas y en dinero.
- **Mecánicos → Completados:** agrupados en Ayer y Antes, con notas.
- **PM:** "Último PM: millas · fecha" en cada camión, y la pieza más usada por modelo.
- **Safety → Hechos:** lo de los últimos 7 días.
- **Operaciones:** completados hoy y en los últimos 7 días.

### Partes y costos
- **Proveedores:** FleetPride, TruckPro, Rush Truck Centers, Diesel Pro Repair y Bay Area Body Shop. Old Supply Co está **inactivo**.
- **Partes:** todas las piezas de PM tienen precio de referencia. Las que se usan tienen proveedor habitual. Hay una creada en la app: "Wiper blade 22 in heavy duty".
- **Compras:** unas 45 en 4 meses. Incluyen:
  - varias líneas, con impuesto y flete;
  - una repartida entre dos camiones;
  - una para el estante, sin camión;
  - una **corregida** y una **anulada**.
- **Reparaciones externas:**
  - la transmisión (Diesel Pro), ligada al Job que regresó;
  - la del camión 611, que está afuera ahora;
  - un DPF y un parabrisas, sin Job.
- **Tarifa de mano de obra (Partes y costos → Tarifa de mano de obra):** $95/h desde hace unos 4 meses y medio, y $105/h desde el 1 de este mes. Cada Work Order cerrado tiene su mano de obra en Costos, por ejemplo "WO-037 · 5.71 h × $95.00/h", a la tarifa del día en que se hizo el trabajo.
- **Facturas internas a Finanzas (Partes y costos → Facturas internas):**
  - dos **aceptadas**, de hace dos meses;
  - una **enviada** y una **anulada** (con su motivo), del mes pasado;
  - un **borrador** de este mes.

  Los números son `SHOP-AAAA-NNNN`. El PDF se descarga desde la factura.

## Lo que la demo local no puede mostrar
- **Dispatch, Movement y "Sale pronto":** vienen de agent-reporting, que no está conectado en local. La pantalla dice que no respondió.
- **Samsara y la ubicación física:** no están conectados.
- **Archivos de factura:** necesitan Supabase Storage; en local el campo no aparece.
- **Contraseñas temporales y "Quitar del Shop":** necesitan Supabase Auth.
