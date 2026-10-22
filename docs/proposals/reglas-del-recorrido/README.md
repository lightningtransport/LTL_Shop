# Reglas que nunca se rompen, por etapa del recorrido (P38)

**Estado:** para que el dueño decida (2026-10-22). No se construye nada hasta
que cada regla tenga respuesta. Contesta **P38** en
[`DECISIONS.md`](../../DECISIONS.md).

## Por qué existe

El dueño abrió una Work Order en el 917 y en el 823, canceló los pasos,
aceptó el QC y la cerró sin inspección. Después hizo Return to Service. La app
lo dejó porque nadie había decidido que no se pudiera.

Las decisiones dicen qué hace cada pantalla. Pero no dicen qué es lo mínimo que
un camión tiene que tener antes de salir. Las pruebas de `test:real` revisan lo
decidido, así que pasan. El QA de producción (LTR-277) fue de solo lectura y no
intentó saltar pasos.

Esta lista es ese mínimo. Cada regla dice qué hace la app hoy, leído del
código, y si hay una prueba que intenta romperla. Cada regla que el dueño
diga **sí** lleva una prueba en `test:real` que intenta saltarla y tiene que
fallar.

## Cómo contestar

Para cada regla, una de tres:

- **Sí:** la app frena siempre.
- **Sí, con motivo:** la app frena, pero el Manager puede saltarla escribiendo
  por qué. Queda en el historial.
- **No:** se puede hacer. Queda escrito que es a propósito.

Columnas: **Hoy** = lo que hace la app en `main` (05299e1). **Prueba** = hay un
caso en `test:real` que intenta romperla. **Propuesta** = lo que recomienda el
agente.

## Etapa 3 · Abrir la Work Order

| # | Regla | Hoy | Prueba | Propuesta | Decisión |
|---|---|---|---|---|---|
| R1 | Un camión no tiene dos Work Orders abiertas | Frena, al crear y al reabrir | Sí (A1, E1, E2, E14) | Sí | |

## Etapa 4 · Inspección de llegada

| # | Regla | Hoy | Prueba | Propuesta | Decisión |
|---|---|---|---|---|---|
| R2 | Una Work Order que no es de PM no se cierra sin la inspección guardada | **No frena.** El cierre solo mira los Jobs (`canFinishWorkOrder`) | No | **Sí, con motivo** | |
| R3 | La inspección guardada no se cambia; solo se agregan defectos | Frena (D41 punto 6) | Sí ("cambiar a No issues found") | Sí | |

## Etapa 5 · Planear y repartir

| # | Regla | Hoy | Prueba | Propuesta | Decisión |
|---|---|---|---|---|---|
| R4 | Un Job no desaparece sin motivo: cancelarlo pide por qué | Frena | Sí ("cancelar Job exige motivo") | Sí | |

## Etapa 6 · El mecánico trabaja

| # | Regla | Hoy | Prueba | Propuesta | Decisión |
|---|---|---|---|---|---|
| R5 | El mecánico no completa un Job bloqueado; primero el Manager hace Resolve | Frena | Sí (JOB_BLOCKED) | Sí | |
| R6 | El mecánico no trabaja en una Work Order cerrada o cancelada | Frena | Sí | Sí | |
| R7 | El reloj corre en un solo camión a la vez (D21) | Frena | Solo para el PM (D2) | Sí | |
| R8 | El PM no se termina sin millaje ni partes, y el millaje no baja (D10) | Frena | Por confirmar | Sí | |

## Etapa 7 · Quality Check

| # | Regla | Hoy | Prueba | Propuesta | Decisión |
|---|---|---|---|---|---|
| R9 | Ningún camión sale sin que alguien apruebe el Quality Check | **No frena del todo.** Con el QC pendiente no cierra, pero el Manager puede **cancelar** el Job de QC con motivo y entonces cierra | Solo "no se cierra con QC pendiente" | **Sí:** el QC no se cancela; el Manager lo completa como respaldo con nota | |
| R10 | Safety no aprueba con trabajo pendiente | Frena (QC_NOT_READY) | Sí | Sí | |
| R11 | El Manager no marca el QC completo con trabajo pendiente | **No frena.** Mark QC complete no mira los otros Jobs; el trabajo puede terminarse después sin que nadie lo revise | No | **Sí**, igual que Safety | |
| R12 | Lo que Safety devolvió no se salta sin nota | Frena (LTR-216) | Sí | Sí | |
| R13 | El QC no va a un taller externo | Frena | Sí | Sí | |

## Etapa 8 · Cerrar → Ready to Go

| # | Regla | Hoy | Prueba | Propuesta | Decisión |
|---|---|---|---|---|---|
| R14 | No se cierra con Jobs pendientes, bloqueados o en taller externo | Frena | Sí | Sí | |
| R15 | Cerrar quiere decir que se hizo trabajo. Si todos los Jobs se cancelaron, eso es **Cancel Work Order**, no Close | **No frena.** Con PM, Alignment y Detailing cancelados y el QC aprobado, cierra. Es lo que pasó en el 917 y el 823 | No | **Sí:** sin ningún Job hecho fuera del QC, ofrece Cancel Work Order | |
| R16 | Cerrar detiene todos los relojes | Lo hace solo (D18) | Sí (close) | Sí | |

## Etapa 9 · Sale del taller

| # | Regla | Hoy | Prueba | Propuesta | Decisión |
|---|---|---|---|---|---|
| R17 | Return to Service solo desde una Work Order cerrada, y una vez | Frena | Sí | Sí | |
| R18 | La app nunca hace Return to Service sola (D52) | Cumple | Sí (A150) | Sí | |

## Etapa 10 · Después

| # | Regla | Hoy | Prueba | Propuesta | Decisión |
|---|---|---|---|---|---|
| R19 | Una Work Order que ya volvió a servicio no se reabre | **No frena.** Se reabre con motivo si el camión no tiene otra abierta | No | **No:** dejarla como está; reabrir con motivo sirve para corregir | |

## Lo que sale de aquí

- Las reglas en **Sí** que hoy no frenan (R2, R9, R11, R15 según lo que se
  decida) se arreglan juntas en un solo PR, con su prueba.
- Las que ya frenan y no tienen prueba (R8) suman su prueba en el mismo PR.
- La respuesta queda como una decisión nueva en `DECISIONS.md` y como una
  sección en `SYSTEM.md`.
- El recorrido del camión (`proposals/truck-journey/`) suma estas reglas en
  sus etapas.
