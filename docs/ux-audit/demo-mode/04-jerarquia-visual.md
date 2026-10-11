# 04 · Jerarquía y claridad visual — Lightning Shop, modo demo

**Fecha:** 2026-10-10 · **Alcance:** el Panel de demo en laptop (1290 px) y teléfono (375 px), en reposo (grilla de cuentas) y con una historia activa; las pantallas del producto solo donde el panel cambia su lectura · **Método:** navegador (capturas, `getComputedStyle`) + código (`demo-panel.tsx`, `ui.tsx`, `globals.css`).
**Resumen:** 6 hallazgos, 1 de severidad 3. El panel usa el sistema de diseño del producto (mismos botones, badges y tokens), así que el problema no es de sistema sino de aplicación: dentro del panel el botón más grande es el menos importante y las diez cuentas pesan igual que la tarjeta del paso.

## Prueba de los 5 segundos

| Pantalla | Qué salta primero | Resultado |
|---|---|---|
| Panel en reposo, laptop (`01-panel-abierto-pm.jpg`) | La grilla de diez botones iguales; el título "Demo panel" y la cuenta actual (azul) se ven después | Falla a medias: se entiende "cuentas", no "qué hago ahora" |
| Panel con historia, laptop (`04-panel-historia-dashboard-laptop.jpg`) | El selector y la tarjeta del paso; "Do:" en negrita; Next en azul | Pasa |
| Panel con historia, teléfono (`04-panel-historia-telefono.jpg`) | El panel entero: tapa el 75 % de la pantalla y el Dashboard queda detrás | Falla: se ve la guía, no la app que hay que mostrar |
| Dashboard con el panel al lado (laptop) | Los cuatro contadores y "Needs you" | Pasa (la columna reservada funciona) |

## Hallazgos

### UX-4-001 · En teléfono el panel es la pantalla
- **Dónde:** Panel a 375 px · `demo-panel.tsx:74` (`inset-x-3 bottom-3 max-h-[75vh]`)
- **Evidencia:** `evidencia/04-panel-historia-telefono.jpg` (observado): el panel ocupa 609 de 812 px (75 %); del Dashboard solo se ve el título. Medido con `getBoundingClientRect`.
- **Criterio:** Lo principal primero: la audiencia tiene que ver la app, no la guía
- **Severidad:** 3 · En teléfono es imposible mostrar y guiar a la vez; hay que cerrar y abrir el panel en cada paso.
- **Recomendación:** En < 1000 px, el panel abierto es una barra inferior de una línea ("Step 2 of 5 · Yard board" + Back/Next) de unos 56 px; tocar la barra despliega la tarjeta completa sobre un fondo oscurecido y se vuelve a plegar con un toque. Mismo patrón que la "hoja" (`SideSheet`) ya existente en el producto.
- **Esfuerzo:** M

### UX-4-002 · El botón más grande del panel es "Reset demo"
- **Dónde:** `demo-panel.tsx:234-236` (`Button variant="outline" className="w-full"`, 36 px de alto) frente a Back/Next/Go to screen (32 px, `size="sm"`)
- **Evidencia:** `evidencia/04-panel-historia-dashboard-laptop.jpg` (observado); medidas con `getComputedStyle`: Reset 36 px de alto y ancho completo; Next 32 px.
- **Criterio:** Jerarquía de acciones: la acción frecuente pesa más que la rara
- **Severidad:** 2 · Next se toca 100 veces por demo; Reset, una o ninguna.
- **Recomendación:** Next como botón primario a ancho completo dentro de la tarjeta (o "Back · Next" a mitades, Next primario); Reset y Leave como enlaces de texto en el pie, del mismo peso que "Leave demo mode" hoy.
- **Esfuerzo:** S

### UX-4-003 · Diez botones de cuenta con el mismo peso y sin orden de lectura claro
- **Dónde:** Grilla de cuentas · `demo-panel.tsx:101-125` (grid de 2 columnas, botones de 11 px/12 px)
- **Evidencia:** `evidencia/01-panel-abierto-pm.jpg` (observado): cuatro grupos de 2 columnas; el grupo "PM" deja una celda vacía; la cuenta actual se marca solo por color de borde y texto azul; las pistas tienen 2–3 líneas y ocupan más que el nombre.
- **Criterio:** Agrupar y ordenar por uso; el estado actual debe verse sin leer
- **Severidad:** 2
- **Recomendación:** Con las cuentas por rol (PR B): botón = código grande (MG1) + rol en gris en una línea; la pista pasa al `title`/tooltip o a una línea truncada; la cuenta actual con un check y el fondo azul lleno. Orden: la cuenta del paso actual primero cuando hay historia.
- **Esfuerzo:** S · con PR B

### UX-4-004 · La tarjeta del paso no distingue el título del paso de la historia
- **Dónde:** `demo-panel.tsx:179-182`: "Step 1 of 5 · Manager" (12 px gris) y el título del paso (14 px/600), sin el nombre de la historia salvo en el selector
- **Evidencia:** `evidencia/04-panel-historia-dashboard-laptop.jpg` (observado): "Operations" podría ser el nombre de la historia, de la pantalla o del paso.
- **Criterio:** Jerarquía tipográfica: contexto > título > cuerpo
- **Severidad:** 2
- **Recomendación:** Cabecera de la tarjeta en dos niveles: "Chapter 5 of 14 · A blocker" (12 px) / "Step 2 of 4" (12 px), título del paso (16 px/600); el nombre de la historia se mantiene en el selector. En PR C, con capítulos.
- **Esfuerzo:** S · con PR C

### UX-4-005 · El aviso de las 5 PM y la casilla de auto-follow se cuelan entre la tarjeta y el pie
- **Dónde:** `demo-panel.tsx:209-220`
- **Evidencia:** `evidencia/04-panel-historia-telefono.jpg` (observado): el aviso "After 5 PM…" aparece en gris pegado a la casilla, al mismo tamaño que "Say:"; en teléfono queda cortado por el borde del panel.
- **Criterio:** Los avisos de estado se separan del contenido y tienen su propio estilo
- **Severidad:** 1
- **Recomendación:** Aviso como `InlineAlert` de variante informativa arriba de la tarjeta (solo cuando aplica); la casilla al pie de la tarjeta, junto a los botones.
- **Esfuerzo:** S

### UX-4-006 · El panel hace scroll interno y esconde el pie
- **Dónde:** `demo-panel.tsx:74` (`max-h-[75vh] overflow-auto`)
- **Evidencia:** medido: `scrollHeight` 777 px frente a 711 px visibles en laptop con una historia activa; "Reset demo" y "Leave demo mode" quedan por debajo del borde; en el teléfono también.
- **Criterio:** Las acciones de salida visibles sin scroll, o claramente secundarias
- **Severidad:** 1
- **Recomendación:** Plegar por defecto "What each button does" y la grilla cuando hay historia (ya se pliega), y poner Reset/Leave como enlaces de una línea: el panel entra sin scroll en 1290 × 948.
- **Esfuerzo:** S

## Inventario visual
- Tamaños de fuente en el panel: 3 (12, 14, 16 px); pesos: 400, 500, 600. Coherente con el producto.
- Variantes de botón usadas: `default` (Next), `outline` (Back, Reset), `ghost` (Go to screen), botón de cuenta propio (`PRESET_BUTTON`, copiado de las maquetas), enlace de texto (Leave). 5 estilos en 360 px.
- Colores de énfasis: primario (azul) para Next y la cuenta activa; ámbar (`warning`) para "el paso es de otra cuenta"; gris para todo lo demás. Correcto.
- Componentes: `Badge`, `Button`, `InlineAlert`, `Select` del sistema; el panel no inventa primitivas salvo `PRESET_BUTTON`.
- Columna reservada: 392 px desde 1000 px (mecánico) y 1200 px (Admin). Medido en el ensayo: ningún botón del producto queda tapado en 1290 px.

## Lo que funciona bien
- El panel usa los tokens y componentes del producto: no desentona con la app que se presenta.
- "Do:" en negrita y "Say:" en gris separan de un vistazo lo que se hace de lo que se dice.
- La cuenta activa y el paso de otra cuenta se distinguen por color (azul / ámbar) además de por texto.
- La columna reservada en laptop hace que la app se vea completa con el panel abierto.

## Fuera de alcance / no verificado
- Tablet (768 px): no se midió.
- Contraste numérico: skill 2, fuera del alcance de esta auditoría.
