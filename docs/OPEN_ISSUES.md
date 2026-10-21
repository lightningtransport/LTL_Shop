# Pendientes (resumen)

**Actualizado:** 2026-10-21 (LTR-261 hecho: el Dashboard avisa la llegada sin Work Order); antes 2026-10-21 (huecos del recorrido completo del camión: LTR-260, LTR-261, LTR-262; G11–G14 en `USER_FLOWS.md` §9); antes 2026-10-19

**Lo pendiente vive en Linear** (equipo LTR, un proyecto por módulo; ver
[`PRD.md`](PRD.md) §4). Esta página es solo un resumen para leer de un vistazo.
Cuando un issue pasa a Done, se borra su línea.

El historial completo hasta el 2026-10-14 (plan de cierre, fases A–D, defectos
§1a–§1z, limpieza, idioma) está en
[`archive/OPEN_ISSUES_HISTORIAL_2026-10.md`](archive/OPEN_ISSUES_HISTORIAL_2026-10.md).
Las citas "OPEN_ISSUES §1x" de otros documentos apuntan ahí.

**Clases:** **B** bloquea · **C** confunde · **E** cosmético (etiqueta
"Severidad" en Linear).

## Abierto por módulo

| Proyecto Linear | Issue | Qué | Clase |
|---|---|---|---|
| Yard | LTR-266 | En la TV del taller el tablero del Yard pide scroll de lado y hacia abajo (D53) | B |
| Yard | LTR-73 | Cobertura de Upcoming Schedule_Teams | — |
| Yard | LTR-255 | Upcoming Departures solo trae las salidas de hoy (faltan las planeadas en Supabase) | — |
| Yard | LTR-256 | 26 camiones en "301 Yard" según Dispatch, sin Work Order en el shop (pregunta al owner) | — |
| Yard | LTR-262 | Incoming Trucks todavía no coincide con Ninox: camiones de más y el 943 (G13, sigue a LTR-254) | C |
| Trucks & Inspección | LTR-203 | API de solo lectura para terceros (P14) | — |
| Mecánicos | LTR-194 | Cierre del rediseño General/PM (bloque B) | — |
| Parts, Costs & Finance | LTR-220 (Epic) | Repuestos, stock y llantas (D45): ST-1 a ST-6 hechas (LTR-221–226); faltan P24, P26, P28 y P31 de Randy | — |
| Safety / QC | LTR-229 (Epic), LTR-233 | Ajustes de Safety (D46): SQ-1 a SQ-3 hechas (LTR-230–232); fotos y videos para más adelante (LTR-233, Gated) | — |
| Setup, People & Permisos | LTR-161 | Modelo de roles y permisos con pantalla propia | — |
| Plataforma y Go-live | LTR-45 / LTR-52 | Salida en vivo (en espera) y flota de producción | — |
| Plataforma y Go-live | LTR-241 | `getAttention` del Dashboard: 60 de sus 113 consultas, medido en la ronda de rendimiento 2026-10 (LTR-237, cerrada; ver `reference/PERFORMANCE.md`); 10 e2e de Chromium fallan en main (specs desactualizados) | E |
| Integraciones V3 | LTR-46, 54, 56 | Integraciones en espera (Gated): contratos, trailers | — |

## Preguntas abiertas

En [`DECISIONS.md`](DECISIONS.md): **P4** (`mechanic_status` de Ninox), **P14**
(qué datos usa la API para terceros) y **P24, P26, P28, P31** (stock y llantas, D45, para Randy; P25, P27, P29 y P30 cerradas). P32–P36 se cerraron con **D47** (2026-10-18). **La demo** no se actualiza con D45 hasta que el dueño avise. P13 se cerró con D44; P37 con D49 (nuestra yard: Home Office y Lightning Transport and Logistics).

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
