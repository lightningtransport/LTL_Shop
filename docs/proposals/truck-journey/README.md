# Recorrido del camión, de punta a punta (user journey)

**Estado:** es el mapa del recorrido como está en producción (2026-10-21, `main`
875781c). Se armó para D52 y ahí se vieron los huecos G11–G14 de
[`USER_FLOWS.md`](../../USER_FLOWS.md) §9. El dibujo completo, con un carril por
persona y los huecos de cada etapa, está en
[`recorrido-camion.tldr`](recorrido-camion.tldr). Para abrirlo, entra a
[tldraw.com](https://www.tldraw.com) y usa File → Open. Las reglas de cada paso
están en [`SYSTEM.md`](../../SYSTEM.md) y las pruebas en `USER_FLOWS.md`.

## Etapas

| # | Etapa | Quién | Qué pasa en la app | Decisión / HU |
|---|---|---|---|---|
| 1 | Dispatch avisa que viene | Dispatch (Ninox), Manager | Yard › Dispatch › **Incoming**, por día | D51 · HU-M22 |
| 2 | Llega a la yard | Samsara, Manager | Entra al geofence de nuestra yard → "In yard · since {hora}" (hasta 1 h tarde). Sin Work Order sale en **Arrived · Needs a Work Order** con Create WO, en Dispatch y en el Dashboard. Si no está en la app: Add from Samsara | D49, D50, LTR-261 · HU-M22 |
| 3 | Abrir la Work Order | Manager (o el PM con Create PM service) | Nace con PM · Alignment · Detailing · Quality Check, cada uno con su equipo. Con WO abierta el camión está **In shop** | D1, D49 · HU-M1 |
| 4 | Inspección de llegada | Manager o mecánico con permiso | 53 puntos y 10 llantas; cada defecto crea su Job. Los Jobs de llantas van a **Alignment** y dicen qué llanta y por qué | D41, D54 · HU-M16, HU-M17 |
| 5 | Planear y repartir | Manager | Add work (fallas de Samsara, catálogo, Custom), un dueño por Job, partes compradas o del stock | D42, D45 · HU-M3, HU-M14 |
| 6 | El mecánico trabaja | Mecánico, Mecánico PM | My work › Start, en teléfono o tablet (PWA). Ve qué está activo, no cuánto lleva. Report blocker → el Manager hace Resolve. El PM anota millaje y partes | D18–D21, D54 · HU-ME1–ME6, HU-PM1 |
| 7 | Quality Check | Safety (o el Manager de respaldo) | Take → Approve, o Return con hallazgos y vuelve a planear | D19, D46 · HU-QC1 |
| 8 | Cerrar → Ready to Go | Manager | Close Work Order. Las partes del PM salen del estante; la mano de obra va al costo del camión | D34 · HU-M5 |
| 9 | Sale del taller | Manager, Samsara | Departures por día, primero "Not ready · N Jobs left". Return to Service. Si Samsara lo ve fuera estando en Ready to Go: "Left the yard · Confirm Return to Service". La app nunca lo hace sola | D51, D52 · HU-M6, HU-M22 |
| 10 | Después | Samsara, Manager, Finanzas | La falla "Fixed" o "Came back". Fin de mes: Internal invoices → PDF a Finanzas. Si vuelve, es otra visita con otra Work Order | D42, D34 · HU-M13 |

## Huecos que siguen abiertos

- Incoming trae camiones de más (LTR-262).
- Departures solo trae las salidas de hoy (LTR-255, LTR-73).
- Hay 26 camiones en "301 Yard" sin WO (LTR-256).
- Ninox no recibe el estado del taller (P4).
- Fotos y videos del defecto todavía no (LTR-233).

La lista completa está en `OPEN_ISSUES.md`.
