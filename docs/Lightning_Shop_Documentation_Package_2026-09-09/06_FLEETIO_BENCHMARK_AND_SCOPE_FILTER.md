# Benchmark Fleetio y filtro de alcance

Fecha de consulta: 2026-09-09
Fuente: Help Center oficial de Fleetio

## Propósito

Aprender de una herramienta madura sin convertir Lightning Shop en una copia de Fleetio. Se adopta un patrón solo si aclara el dominio actual, reduce errores y puede implementarse incrementalmente.

## Lo que confirma nuestra dirección

### 1. Work Order es el contenedor de ejecución

Fleetio usa Work Orders para planificar y seguir el trabajo desde abierto hasta completado. Dentro agrega múltiples tareas/line items y problemas del mismo vehículo. Para Lightning esto respalda:

```text
Truck -> Work Order/intervention -> many Jobs -> each Job has Category
```

No respalda crear una WO distinta por cada Category o fase.

### 2. Problema y trabajo no son lo mismo

Fleetio separa `Issue` —una necesidad inesperada como leak, brake failure o noise— de `Service Task` —la tarea recurrente o reparación que se ejecuta—. Para Lightning:

- Reported Problem/Need: qué se observó o por qué llegó el Truck.
- Job: qué debe hacer el taller.
- Job Category: qué tipo de trabajo es.

Decisión de scope: adoptar la definición, no construir ahora un módulo Issue. Reason/notes y Jobs existentes bastan para la evolución actual.

### 3. Category pertenece al trabajo detallado

Fleetio aplica categorización a cada line item de tarea, incluso permitiendo una categorización predeterminada desde el catálogo y validación/ajuste al agregarla. Esto respalda que `WorkOrderJob.categoryId` sea autoridad para el Job y que `primaryCategoryId` quede como contexto compatible, no como restricción global.

### 4. Completion tiene efectos explícitos

En Fleetio, pasar la Work Order a completed registra las tareas realizadas, resuelve problemas vinculados y actualiza el historial. El aprendizaje no es copiar esos efectos, sino definir los nuestros de manera transaccional y auditable.

Para Lightning, completion significa cerrar la intervención después de resolver/cancelar Jobs requeridos. No significa `Ready to Go`.

### 5. Work Order Status y Vehicle Status son independientes

Fleetio administra estados de Work Order y de vehículo por separado y registra el historial de cambios del vehículo. Esto valida la separación Lightning:

- Work Order Status = estado de ejecución;
- Operational Status = disponibilidad del Truck;
- Readiness = evaluación para salir;
- Yard Presence = ubicación;
- Yard Phase = progreso operacional.

### 6. Inspección detecta; el trabajo resuelve

En Fleetio, una inspección fallida puede crear un Issue; aprobar después un punto de inspección no resuelve por sí solo el problema abierto. El patrón aplicable a Lightning es simple: Inspection puede descubrir y agregar trabajo requerido a la Work Order; la evidencia de reparación/completion resuelve el trabajo. No necesitamos automatizar Inspection workflows ahora.

## Lo que deliberadamente NO copiamos

| Función Fleetio | Decisión Lightning actual |
| --- | --- |
| Service Entries separadas | No añadir; usar Work Order e historial existentes |
| Parts, labor costs, invoices, purchase orders | Fuera de esta iniciativa |
| Warranties y vendor accounting | Fuera de esta iniciativa |
| Service Reminders/Programs configurables | PM actual permanece especializado |
| Issue module completo | Diferir; adoptar solo la definición conceptual |
| Statuses configurables | Conservar enums/reglas actuales hasta necesidad demostrada |
| Main Tasks/Subtasks | No añadir jerarquía de Jobs todavía |
| Expected labor por task | No inventar timers o estimados por Job |
| Inspection workflow builder | No añadir rules engine |
| Resource scheduler | No confundir con Yard Operations/dispatch schedule |

## Definiciones actualizadas

| Término | Definición Lightning |
| --- | --- |
| Reported Problem / Need | Síntoma, defecto o razón que origina trabajo; no es una tarea completada |
| Job | Acción específica, verificable y completable dentro de una Work Order |
| Job Category | Clasificación de la naturaleza del Job |
| Work Order | Intervención completa del Truck durante un evento de servicio |
| Inspection | Actividad que verifica condición y puede descubrir trabajo requerido |
| Completion | Cierre auditable de la intervención cuando sus Jobs requeridos están resueltos |
| Ready to Go | Decisión operacional posterior/separada de completion |

## Cambios recomendados al roadmap

Ninguna fase nueva. Solo ajustar criterios dentro de las ya existentes:

1. En auditoría, identificar dónde se captura hoy el reason/problem reportado.
2. En contratos multicategoría, mantener Category a nivel Job.
3. En UI, nombrar Jobs como acciones concretas y evitar síntomas ambiguos cuando el catálogo pueda distinguirlos.
4. En completion, documentar efectos y auditoría de forma explícita.
5. En Truck Detail, mostrar historial a partir de Work Orders/eventos existentes.

## Fuentes oficiales consultadas

- [Service Tasks vs. Issues, Service Entries vs. Work Orders](https://help.fleetio.com/maintenance/service-tasks-vs-issues-service-entries-vs-work-orders)
- [Work Order Overview](https://help.fleetio.com/en_US/work-order-overview)
- [Work Order Line Items: Service Tasks, Labor, Parts](https://help.fleetio.com/en_US/work-order-line-items-service-tasks-labor-parts)
- [Work Order Statuses](https://help.fleetio.com/en_US/work-orders/work-order-statuses)
- [Vehicle Statuses](https://help.fleetio.com/en_US/vehicle-statuses)
- [Issues Overview](https://help.fleetio.com/maintenance/issues-overview)
- [Submit Inspections in Fleetio Go](https://help.fleetio.com/en_US/fleetio-go-for-operators/submit-inspections-in-fleetio-go)

## Resultado

Fleetio no cambia nuestro alcance ni obliga a rediseñar el Shop. Refuerza el modelo ya elegido y añade una precisión útil: el problema reportado explica por qué se trabaja; los Jobs describen qué se hará. La implementación inmediata sigue siendo Work Orders multicategoría backward-compatible, no un sistema completo de fleet management.
