# 09 · Informe final — Responsive, color semántico y accesibilidad

**Fecha:** 2026-10-15 · **Archivos:** [`04-jerarquia-visual.md`](04-jerarquia-visual.md) (responsive, 9), [`02-accesibilidad.md`](02-accesibilidad.md) (color y tipografía, 15), [`04b-color-semantico.md`](04b-color-semantico.md) (roles de color, 10)

## Resumen ejecutivo

**34 hallazgos:**

| Severidad | 4 | 3 | 2 | 1 |
|---|---|---|---|---|
| Hallazgos | 0 | 2 | 22 | 10 |

**La base está bien.** El texto, los errores, los avisos y el foco cumplen WCAG AA en tema claro y oscuro, y en el teléfono nada se sale de la pantalla. Los problemas vienen de tres patrones:

1. **El layout decide por el ancho de la ventana, no por el espacio real.** Entre 768 y 1023 px el menú lateral deja 528 px y los buscadores desaparecen (UX-4-001, UX-4-002, UX-4-007, UX-4-009). En pantallas de más de 1700 px pasa lo contrario: el contenido se queda en 1440 px y deja franjas vacías (UX-4-003).
2. **El sistema de diseño tiene tokens pero no reglas de qué estado va con qué color.**
   - El azul significa seis cosas y no hay rol `info` (UX-4-101).
   - "Ready to close" sale en ámbar y en azul (UX-4-102).
   - "Inactivo" es gris en un lado y ámbar en otro (UX-4-105).
   - Sigue viva una segunda familia de tokens, `--shop-*` (UX-4-107).
3. **Hay estados que se comunican solo por color o con texto cortado:**
   - las llantas OK/Watch/Fix (UX-2-003, severidad 3);
   - la barra de progreso (UX-2-004);
   - los enlaces sin subrayar (UX-2-006);
   - los placeholders cortados (UX-4-004 a UX-4-006);
   - las iniciales que no caben en el avatar (UX-4-008 / UX-2-011).

## Arreglos rápidos (esfuerzo S, sin decisión de producto)

| # | Hallazgo | Qué se cambia |
|---|---|---|
| 1 | UX-4-001 | `AdminFilterToolbar`: filtros en línea solo con espacio suficiente; buscador con ancho mínimo. Arregla 6 pantallas. |
| 2 | UX-4-007 | Shop workflow: grilla de 3 columnas desde `xl`; chip en una línea con `truncate`. |
| 3 | UX-4-008 / UX-2-011 | Avatar: la letra se achica con 3 iniciales. |
| 4 | UX-4-004, 005, 006 | Placeholders cortos y el texto completo en `aria-label`. |
| 5 | UX-2-003 | Llantas: palabra o icono además del color, y `aria-label` completo. |
| 6 | UX-2-001 | `--input` propio (3,2:1) y `.field` con `border-input`. |
| 7 | UX-2-002 | Token `--primary-text` para texto azul sobre fondos azules (5,0:1). |
| 8 | UX-2-007 | Resultado resaltado en New Work Order con `bg-accent`. |
| 9 | UX-2-006 | Enlaces dentro de oraciones siempre subrayados. |
| 10 | UX-2-013 | Foco visible en los selectores de archivo de factura. |
| 11 | UX-2-005 | Interruptor apagado del PM visible (`bg-muted-foreground/75`). |
| 12 | UX-2-015 | Casilleros de "Add to team" con el nombre de la persona. |
| 13 | UX-4-009 | `whitespace-nowrap` en número, fecha y total de Purchases. |
| 14 | UX-4-109 | `theme-color` oscuro igual al fondo real. |

## Decisiones del dueño (2026-10-15)

Decidido: pantallas de datos a todo el ancho; menú lateral fijo desde 1024 px; "Ready to close" en azul; aplicar los 14 arreglos rápidos.

### Opciones que se plantearon

| Hallazgo | Opciones | Recomendación |
|---|---|---|
| UX-4-003 Franjas vacías en pantallas anchas | Todo el ancho para pantallas de datos / dejar 1440 px | Yard, Dashboard y listas a todo el ancho; formularios y detalle en 1440 px |
| UX-4-002 Menú lateral a 768 px | Menú fijo desde 1024 px / menú de iconos entre 768 y 1023 / dejar como está | Menú fijo desde 1024 px |
| UX-4-102 "Ready to close" | Azul (acción del Manager) / ámbar (espera) | Azul, como en el stepper, el Dashboard y la WO |

## Trabajo más grande (M)
- **Tabla de estado → token** en `docs/design-system/foundations.md` (UX-4-110). Rol `info`, ámbar solo para "algo va mal" y un nombre de par por rol (UX-4-101, 103, 104, 108). Propuesta completa en `04b-color-semantico.md`.
- **Retirar la familia `--shop-*`** (UX-4-107).
- **`npm run ui-audit`** no ve los fondos translúcidos y por eso no detecta parte de estos contrastes.

## Fuera de alcance
- **Contraste sin verificar en pantalla:** se calculó desde los tokens. Hay que comprobarlo en el navegador en claro y oscuro después de los cambios.
- **Detalle de WO y Truck en 768 px:** no se midieron.
