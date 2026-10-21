# 00 · Contexto — QA de producción, Shop Manager

**Fecha:** 2026-10-21 · **Slug:** `prod-qa-2026-10-21`
**Producto:** Lightning Shop, https://ltl-shop-web.vercel.app
**Commit en vivo:** `9a9211b` (PR #389, LTR-275). Web y API en Ready.
**Quién:** Cristian, rol Shop Manager, tema oscuro, escritorio (~1496 px).
**Método:** navegador sobre producción, solo lectura. No se creó ninguna Work Order.

Este pase guarda hallazgos para priorizarlos después. No abre issues en Linear
hasta que se decida el orden. El archivo vivo es [`hallazgos.md`](hallazgos.md).

## Alcance de esta corrida

Hecho: Admin de Shop Manager en escritorio, mecánico Standard (MG), PM (MPM) y Safety (QC).
Safety no tenía camiones en cola, así que la revisión (Take, Approve, Return) no se abrió.

Teléfono e iPad (emulación Chrome, no Safari real): Admin, mecánico Standard (MG), PM (MPM) y Safety (QC) ya se vieron. La hoja de revisión de Safety no se abrió: la cola estaba vacía. Samsara y Shop hours ya se vieron (cierre 17:00, lunes a viernes).
