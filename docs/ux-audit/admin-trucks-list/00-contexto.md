# 00 · Contexto y acceso — Lightning Shop Admin (lista de Trucks)

**Fecha:** 2026-10-14 · **Auditor:** Claude (skill audit-ux-4) con el dueño del producto
**slug:** admin-trucks-list

Producto, usuarios, plataformas y sistema visual: los mismos de
[`../admin-truck-wo/00-contexto.md`](../admin-truck-wo/00-contexto.md). Esta auditoría mira una sola pantalla.

## Alcance
- **Pantalla:** Admin → Trucks (`/admin/trucks`), `apps/web/src/components/admin-trucks-list.tsx`.
- **Por qué ahora:** Samsara S-2/S-3 (OPEN_ISSUES §1x) agregó las columnas Faults y Last location. El dueño
  ve la tabla desordenada, con información rota o repetida, y difícil de leer rápido.
- **Usuario y tarea:** el Shop Manager, varias veces al día, en la computadora de la oficina y en el teléfono.
  Abre Trucks para ubicar un camión y saber, sin entrar, qué trabajo tiene, qué falta y si trae una falla grave.

## Acceso usado
- **Producción:** captura del dueño (`evidencia/04-trucks-produccion-escritorio.png`). El panel del navegador
  no tenía sesión de producción, y no se inició sesión con credenciales reales.
- **Local:** API en la base de pruebas `ltl_shop_test` con un Samsara falso con la forma de los datos reales
  (luces por camión, `milStatus` por código). Web en `:3045`. Cuenta de prueba `manager@lightning.local`.
  Medido a 1440 × 900 y 375 × 812.
