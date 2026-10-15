# Pendientes (resumen)

**Actualizado:** 2026-10-14

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
| Work Orders & Jobs | LTR-205 | Add work: tarjeta dentro de tarjeta en `CategoryJobList` | E |
| Yard | LTR-73 | Cobertura de Upcoming Schedule_Teams | — |
| Yard | LTR-206 | Textos "UNAVAILABLE" y "Unable to load current administrative data." | E |
| Yard | LTR-207 | La pestaña Dispatch se llama `movement` en la URL | E |
| Trucks & Inspección | LTR-203 | **Crear y editar camiones desde el Shop** (P13, el dueño dijo sí el 2026-10-14) y API para terceros (P14) | — |
| Trucks & Inspección | LTR-214 | Corregir el VIN de 876 y 877 (espera LTR-203) | C |
| Trucks & Inspección | LTR-113 | Make/Model invertidos en algunos camiones | C |
| Mecánicos | LTR-194 | Cierre del rediseño General/PM (bloque B) | — |
| Mecánicos | LTR-208 | La pestaña Trucks es solo un buscador; mostrar "Trucks with your Jobs" | C |
| Mecánicos | LTR-209 | "Loading work order" en texto plano; usar `PageSkeleton` | E |
| Setup, People & Permisos | LTR-161 | Modelo de roles y permisos con pantalla propia | — |
| Setup, People & Permisos | LTR-210 | "Add to team" no guarda hasta "Save steps" | C |
| Demo & Landing | LTR-211 | Avisar que una historia ya se ejecutó en esta base | C |
| Plataforma y Go-live | LTR-45 / LTR-52 | Salida en vivo (en espera) y flota de producción | — |
| Plataforma y Go-live | LTR-212 | Polling superpuesto; logo del Admin pesado | E |
| Plataforma y Go-live | LTR-213 | CI: correr vitest de la web y `test:real` | C |
| Integraciones V3 | LTR-46, 54, 55, 56 | Integraciones en espera (Gated): contratos, geocerca, trailers | — |

## Preguntas abiertas

En [`DECISIONS.md`](DECISIONS.md): **P4** (`mechanic_status` de Ninox), **P13**
(campos de la ficha del camión y emparejado con Samsara) y **P14** (qué datos
usa la API para terceros).

## Salida en vivo

En espera por decisión del dueño (2026-10-09). Paso a paso en
[`GO_LIVE_CHECKLIST_ES.md`](GO_LIVE_CHECKLIST_ES.md). Termina cuando el taller
trabaja un día completo con usuarios reales sin un defecto B.

## Fuera de alcance

Ver [`PRD.md`](PRD.md) §5.
