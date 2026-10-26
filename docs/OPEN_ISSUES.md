# Pendientes (resumen)

**Actualizado:** 2026-10-23 (LTR-302 / AP-3 construido en la rama `claude/ap3-tread-minimo`, PR pendiente de merge; migración → Release safety); antes 2026-10-22 (D57 áreas en paralelo: Epic LTR-299 con AP-1 a AP-7, LTR-300–306; P39–P42 abiertas); antes 2026-10-21 (QA de producción, escritorio y teléfono e iPad: un solo issue, LTR-277, 10 secciones; LTR-278–292 duplicados); antes 2026-10-21 (limpieza de Linear: los cerrados se borraron de Linear y su copia está en [`archive/LINEAR_CERRADOS_2026-10-21.md`](archive/LINEAR_CERRADOS_2026-10-21.md); LTR-194 hecho, LTR-73 duplicado de LTR-255, LTR-46, LTR-54 y LTR-52 cancelados; suman LTR-267 a LTR-270); antes 2026-10-21 (LTR-274 hecho: nada bajo 12px, token `--brand-navy`; botones de las tarjetas de mecánico, PM y Safety a lo ancho y con aspecto de botón en oscuro); antes 2026-10-21 (LTR-275 hecho: "this device" / "este dispositivo"); antes 2026-10-21 (LTR-266 hecho y fuera de la lista; LTR-274 nuevo: textos de menos de 12px; LTR-275 nuevo: "this phone" en la tablet; LTR-273 alinea los docs); antes 2026-10-21 (LTR-261 hecho: el Dashboard avisa la llegada sin Work Order); antes 2026-10-21 (huecos del recorrido completo del camión: LTR-260, LTR-261, LTR-262; G11–G14 en `USER_FLOWS.md` §9); antes 2026-10-19

**Lo pendiente vive en Linear** (equipo LTR, un proyecto por módulo; ver
[`PRD.md`](PRD.md) §4). Esta página es solo un resumen para leer de un vistazo.
Cuando un issue pasa a Done, se borra su línea. Un `LTR-n` cerrado antes del
2026-10-21 ya no está en Linear: búscalo en
[`archive/LINEAR_CERRADOS_2026-10-21.md`](archive/LINEAR_CERRADOS_2026-10-21.md).

El historial completo hasta el 2026-10-14 (plan de cierre, fases A–D, defectos
§1a–§1z, limpieza, idioma) está en
[`archive/OPEN_ISSUES_HISTORIAL_2026-10.md`](archive/OPEN_ISSUES_HISTORIAL_2026-10.md).
Las citas "OPEN_ISSUES §1x" de otros documentos apuntan ahí.

**Clases:** **B** bloquea · **C** confunde · **E** cosmético (etiqueta
"Severidad" en Linear).

## Abierto por módulo

| Proyecto Linear | Issue | Qué | Clase |
|---|---|---|---|
| Work Orders & Jobs | LTR-299 | **Epic D57:** áreas en paralelo, un camión a la vez, Tires en Alignment, tread en el mínimo, card de Tires ([propuesta](proposals/areas-en-paralelo/README.md)) | — |
| Work Orders & Jobs | LTR-300 | AP-1: un solo orden de áreas; Tires y Flat Repair en Alignment; "next: Tires" | C |
| Work Orders & Jobs | LTR-301 | AP-2: Work Plan del camión y tabla de Jobs de la WO agrupadas por área (depende de AP-1). **Construido en la rama `claude/ap2-areas-ui` (rebasada sobre el PR 429)** | C |
| Trucks & Inspección | LTR-302 | AP-3: tread en el mínimo crea Job; margen Watch en Setup; números a la vista (**migración → Release safety**). **Construido en la rama `claude/ap3-tread-minimo`; PR pendiente de merge** (A162–A163) | B |
| Trucks & Inspección | LTR-303 | AP-4: card Tires con PSI y tread, leyenda y motivo; la fila del Job dice por qué (**construido, PR en revisión**) | C |
| Work Orders & Jobs | LTR-304 | AP-5: docs de D57 repartidos en cada PR | — |
| Mecánicos | LTR-305 | AP-6: cola de Shop Work para mecánicos generales (en PR) | — |
| Work Orders & Jobs | LTR-306 | AP-7: un camión a la vez (`TRUCK_BUSY`), Yard con "Waiting for a mechanic" y quién lo tiene (en PR) | — |
| Yard | LTR-255 | Upcoming Departures solo trae las salidas de hoy (faltan las planeadas en Supabase) | — |
| Yard | LTR-256 | 26 camiones en "301 Yard" según Dispatch, sin Work Order en el shop (pregunta al owner) | — |
| Yard | LTR-262 | Incoming Trucks todavía no coincide con Ninox: camiones de más y el 943 (G13, sigue a LTR-254) | C |
| Yard | LTR-270 | La prueba e2e de arrastrar el tablero del Yard con el mouse sigue en rojo en WebKit (sigue a LTR-227) | — |
| Trucks & Inspección | LTR-203 | API de solo lectura para terceros (P14) | — |
| Parts, Costs & Finance | — | Repuestos, stock y llantas (D45): hecho (LTR-220–226, cerrados); faltan P24, P26, P28 y P31 de Randy | — |
| Safety / QC | LTR-233 | Fotos y videos como evidencia de un hallazgo (SQ-4, Gated); SQ-1 a SQ-3 de D46 hechas (LTR-229–232, cerrados) | — |
| Setup, People & Permisos | LTR-161 | Modelo de roles y permisos con pantalla propia (D48 ya resolvió quién maneja a Managers y Admins) | — |
| Plataforma y Go-live | LTR-45 | Salida en vivo (en espera desde el 2026-10-09) | — |
| Plataforma y Go-live | LTR-277 | QA de producción 2026-10-21 (escritorio, teléfono e iPad). Un issue con 10 secciones. Primero el filtro del Dashboard. Las secciones 5 y 6 (compra "Prueba" y camiones 9050, 9220, 9680) esperan al dueño. LTR-278 a LTR-292 quedaron como duplicados | C |
| Plataforma y Go-live | LTR-267 | Vercel: cada deploy pesa 400–600 MB y Functions Storage se vuelve a llenar (lo hace el dueño) | — |
| Plataforma y Go-live | LTR-268 | Supabase de producción: MFA en la cuenta dueña y respaldos (lo hace el dueño) | — |
| Plataforma y Go-live | LTR-269 | Revisión de UI en teléfono y escritorio: 13 hallazgos de color y accesibilidad, pantallas nuevas sin revisar | — |
| Plataforma y Go-live | LTR-241 | `getAttention` del Dashboard: 60 de sus 113 consultas, medido en la ronda de rendimiento 2026-10 (LTR-237, cerrada; ver `reference/PERFORMANCE.md`); 10 e2e de Chromium fallan en main (specs desactualizados) | E |
| Integraciones V3 | LTR-56 | Trailers UC como activos (Gated; ID de Ninox sin resolver) | — |

## Preguntas abiertas

En [`DECISIONS.md`](DECISIONS.md): **P4** (`mechanic_status` de Ninox), **P14**
(qué datos usa la API para terceros) y **P24, P26, P28, P31** (stock y llantas, D45, para Randy; P25, P27, P29 y P30 cerradas). P32–P36 se cerraron con **D47** (2026-10-18). **La demo** no se actualiza con D45 hasta que el dueño avise. P13 se cerró con D44; P37 con D49 (nuestra yard: Home Office y Lightning Transport and Logistics); P38 con D55. **P45–P58** (rediseño como la pizarra del taller, [propuesta](proposals/rediseno-pizarra/README.md) con boceto, 2026-10-24; sin decidir). **P39–P44** (D57: Detailing tras devolución de Safety, nombre de "Shop Work", override de dos áreas, camión tomado desde ayer, Tire Mounting y Rotation en Alignment, quién ve la cola del taller) para el dueño y el Shop Manager.

## Demo congelada (desde 2026-10-16)

Por decisión del dueño, lo nuevo **no se lleva a la demo** (datos, capítulos,
deploy de la web y del API de la demo) hasta que él avise que terminó de
agregar cosas. Entonces se actualiza toda la demo de una vez.

## Salida en vivo

En espera por decisión del dueño (2026-10-09). Paso a paso en
[`GO_LIVE_CHECKLIST_ES.md`](GO_LIVE_CHECKLIST_ES.md). Termina cuando el taller
trabaja un día completo con usuarios reales sin un defecto B.

## Fuera de alcance

Ver [`PRD.md`](PRD.md) §5.
