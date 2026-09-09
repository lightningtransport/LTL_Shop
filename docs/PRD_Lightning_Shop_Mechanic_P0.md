# PRD — Lightning Shop Mechanic App

## Status overlay — 2026-09-09

This PRD preserves the original product history. For implementation status,
`README.md` and `CURRENT_PRODUCT_STATUS.md` take precedence; for the approved
Work Order evolution, use the
[2026-09-09 documentation package](./Lightning_Shop_Documentation_Package_2026-09-09/00_INDEX.md)
and its [checkout audit](./audits/WORK_ORDER_MULTICATEGORY_AUDIT_2026-09-09.md).

- **CURRENT/legacy:** Standard creation and Add Job are restricted to one
  Category even though each `WorkOrderJob` already stores `categoryId`.
- **TARGET:** a Work Order is the complete service intervention for one Truck;
  Jobs own their Categories and one Work Order may mix Categories.
  `primaryCategoryId` remains required initially as Initial/Primary Category.
- **LOCKED:** one open Work Order per Truck; a new Work Order means a new
  service event. Yard Phase does not create a Work Order. Standard Create does
  not Start; PM remains the specialized `mechanic.pm` exception. Completing a
  Job does not complete the Work Order, and Work Order `Completed` is separate
  from `Ready to Go`/`Returned to Service`.
- **DEFERRED:** per-Job timers/assignments, configurable rules, unconfirmed
  integrations, multiple open Work Orders per Truck, and removal of the legacy
  primary Category field.

Sections that describe Ninox as the P0 source of truth, Prisma as future, or a
non-Vercel API host are historical design context and are superseded by the
current Supabase PostgreSQL + Prisma + Vercel implementation.

## 1. Objetivo

Construir la experiencia del mecánico para el software de gestión del Shop de Lightning.

La aplicación debe registrar de forma simple y consistente:
- Truck atendido.
- Work Order abierta.
- Tipo de trabajo.
- Jobs a completar.
- Mecánico(s) participantes.
- Inicio del trabajo activo.
- Pausas y sus motivos.
- Reanudaciones.
- Finalización.
- Jobs completados.
- Historial de reparaciones del Truck.

El P0 mide el trabajo activo a nivel **Work Order / intervención**. Los Jobs individuales funcionan como checklist estandarizado y no tienen timer individual.

---

## 2. Principios del producto

### 2.1 El mecánico crea la Work Order

El flujo normal no requiere que un Manager cree o asigne previamente la Work Order.

El mecánico crea la Work Order seleccionando:
1. Truck.
2. Primary Job Category.
3. Uno o varios Jobs To Do.
4. Mechanic(s) / Working With.
5. Priority.
6. Notes, si aplica.

### 2.2 Timer a nivel Work Order

Ejemplo:

**WO #905 — Truck #905**  
Category: Suspension

Jobs:
- Inspect Air System
- Replace Air Hose
- Cooling System

Al iniciar la intervención comienza el Active Labor Time de la Work Order.

Completar un Job:
- Cambia el Job a Completed.
- No pausa la Work Order.
- No reinicia el timer.
- No completa automáticamente la Work Order.

P0 podrá medir Active Labor, Waiting Time y elapsed time de la intervención, pero no la duración exacta de cada Job individual.

---

## 3. Usuarios

### Mechanic

Identificado mediante su correo asociado. El sistema conoce automáticamente User ID, Name, Email, Role, Work Orders activas/pausadas e historial relacionado.

### Manager

Tiene experiencia separada y puede revisar Work Orders, corregir información autorizada, administrar Job Catalog, revisar Custom Jobs y consultar métricas.

---

## 4. Modelo conceptual

```text
Truck
  └── Work Order
        ├── Primary Category
        ├── Mechanic(s)
        ├── Jobs To Do
        │     ├── Catalog Job ID
        │     ├── Category
        │     └── Status
        ├── Work Sessions
        ├── Pause Events
        ├── Notes
        └── Activity Log
```

### Work Order Status
- In Progress
- Waiting / Paused
- Completed
- Cancelled

### Job Status
- To Do
- Completed
- Cancelled, si aplica

---

## 5. Flujo principal

```text
Login
 ↓
Home
 ↓
Create New Work Order
 ↓
Select Truck
 ↓
Review Truck Information
 ↓
Select Primary Category
 ↓
Select Jobs from Job Catalog
 ↓
Select Working With
 ↓
Select Priority
 ↓
Notes (optional)
 ↓
Create Work Order / Start Work
 ↓
Work Order In Progress
 ↓
Complete Jobs progressively
 ↓
Pause Work Order if blocked
 ↓
Select Pause Reason
 ↓
Resume Work Order
 ↓
Complete remaining Jobs
 ↓
Finish Work Order
```

---

## 6. Pantalla — Login

Permitir acceso mediante correo asociado al usuario.

Contenido:
- Email.
- Authentication method.
- Sign In.

Si el correo no está configurado:

**Your account is not configured for the Shop application.**

---

## 7. Pantalla — Mechanic Home

Header:
- MECÁNICO
- Home
- “Trabajos actuales, Ordenes de trabajo y trabajos recientes.”

Primary Action:

**Create New Work Order**

### Trabajos Activos

Cada Work Order muestra:
- WO ID.
- Truck Number.
- Priority.
- Status.
- Primary Category.
- Jobs Completed / Total.

Actions:
- **Pausar Trabajo**
- **Ver Trabajo**

### Trabajos Pausados

Cada Work Order muestra:
- WO ID.
- Truck Number.
- Priority.
- Pause Reason.
- Primary Category.
- Jobs Completed / Total.

Actions:
- **Ver Información**
- **Continuar Trabajo**

---

## 8. Pantalla — Nueva Orden de Trabajo

Header:
- MECÁNICO
- Nueva Orden de Trabajo
- “Ingrese la información necesaria.”

### Truck Search

Field:

**Buscar Truck Number (e.g. #905)**

El Truck debe seleccionarse desde registros existentes; no usar texto libre como identificador principal.

---

## 9. Truck Information

Después de seleccionar Truck mostrar:
- Make.
- Model.
- Year.
- Mileage.
- Company.
- Owner.

Action:

**See Truck Repair History**

### Validación de WO existente

Al seleccionar Truck, verificar si ya tiene Work Order abierta.

Si existe:

**Truck #905 already has an open Work Order.**

Mostrar WO ID, Status, Mechanic(s) y progreso.

Primary Action:

**VIEW OPEN WORK ORDER**

P0 debe evitar duplicados accidentales.

---

## 10. Primary Category

Field:

**CATEGORY**

Selector:

**Seleccionar Categoría**

Ejemplos:
- PM
- Suspension
- Brakes
- Electrical
- Engine
- Alignment
- Air System
- Tires
- Transmission
- Other

La lista definitiva proviene del catálogo.

La Primary Category sirve como filtro inicial y motivo principal de intervención. Cada Job conserva además su propia Category.

---

## 11. Job Catalog estandarizado

No usar texto libre como método principal para registrar Jobs.

Ejemplo del problema:
- 3in1
- 3 in 1
- 3-in-one
- Three in One

Todos podrían ser el mismo Job.

Después de seleccionar Category, mostrar Jobs precargados.

Ejemplo Suspension:
- Suspension Inspection
- 3 in 1
- Air Bag Replacement
- Shock Replacement
- Leveling Valve
- Torque Rod

### Canonical Job ID

Cada Job tiene ID permanente.

Ejemplo:

**JOB-0042**  
Display Name: **3 in 1**  
Category: **Suspension**  
Status: **Active**

Las métricas usan Job ID, no únicamente Display Name.

### Aliases

Ejemplo para `3 in 1`:
- 3in1
- 3-in-1
- 3 in one
- three in one

Buscar cualquiera debe sugerir el Job canónico.

---

## 12. Jobs To Do

Después de seleccionar Category:

**JOBS TO DO**

Ejemplo:
- Inspect Air System
- Replace Air Hose

Action:

**Agregar trabajo +**

`Agregar trabajo` abre búsqueda/selector del Job Catalog, no texto libre por defecto.

### Job Not Listed

Si no existe:

**JOB NOT LISTED**

Permite ingresar una descripción y crea un **Custom Job** temporal.

Guardar:
- Original Description.
- Selected Category.
- Created By.
- Work Order.
- Truck.
- Created At.

Manager podrá posteriormente:
- Map to Existing Job.
- Add to Job Catalog.

---

## 13. Jobs de múltiples categorías

Una Work Order puede tener Primary Category `Suspension` y contener:

Suspension:
- 3 in 1
- Shock Replacement

Electrical:
- ABS Sensor Replacement

Esto permite registrar trabajo descubierto sin crear otra WO.

---

## 14. Working With

Field:

**WORKING WITH**

Selector:

**Seleccionar Mecánico**

El usuario autenticado queda asociado automáticamente cuando corresponda. Pueden asociarse mecánicos adicionales.

---

## 15. Priority

Options:
- LOW
- NORMAL
- HIGH
- CRITICAL

Default recomendado: **NORMAL**

---

## 16. Notes

Field:

**NOTES OPTIONAL**

Placeholder:

**Describe o agrega más información que sea necesaria para ejecutar el trabajo**

---

## 17. Create Work Order

Minimum required:
- Truck.
- Primary Category.
- ≥1 Job.
- Mechanic / Working With.
- Priority.

Al crear registrar automáticamente:
- Work Order ID.
- Created At.
- Created By.
- Truck.
- Primary Category.
- Mechanic(s).
- Priority.
- Jobs.
- Notes.
- Initial Status.

### Regla de inicio

El contador representa trabajo real, no tiempo con una pantalla abierta.

**LOCKED — Standard:** `Create Work Order` no inicia trabajo ni abre una Work
Session. El mecánico debe ejecutar:

**START WORK**

**LOCKED — PM:** un usuario autorizado por `mechanic.pm` crea el servicio PM ya
iniciado, con asignación y primera Work Session atómicas. Esta excepción no se
extiende a Standard.

---

## 18. Pantalla — Work Order In Progress

Header:
- Back.
- WO ID.
- Truck Number.
- Priority.
- Status.
- Primary Category.
- Jobs Completed / Total.

### Work Options

- **Pausar Trabajo**
- **Finalizar Trabajo**

`Pausar Trabajo` afecta la Work Order completa.

### Truck Information

Sección colapsable con:

**See Truck Repair History**

### Jobs To Do

Mostrar Jobs pendientes con control para marcarlos Completed.

Action:

**Agregar trabajo +**

### Completed

Mostrar Jobs completados.

Si ninguno:

**No hay trabajos completados**

---

## 19. Job Finished

Al marcar un Job mostrar confirmación:

**JOB FINISHED**

Nombre del Job.

Actions:
- Cancelar.
- Terminar Trabajo.

Al confirmar:
- Job Status → Completed.
- Completed At → timestamp.
- Completed By → user.
- Mover a Completed.
- El timer de la Work Order continúa.

---

## 20. Add Job durante Work Order

Flujo:
1. Select Category.
2. Search predefined Job Catalog.
3. Select Job.
4. Add to current Work Order.

Si no existe usar **Job Not Listed**.

Agregar Job no reinicia el timer.

---

## 21. Truck Repair History

Header:

**REPAIR HISTORY — #905**

Mostrar Truck Information y filtros por Category.

Cada registro:
- Date.
- Primary Category.
- Truck.
- Mechanic(s).
- Mileage.
- Work Performed / Jobs.

---

## 22. Pause Work Order

La acción visual actual `PAUSE JOB` conceptualmente pausa la **Work Order**. Se recomienda renombrarla:

**PAUSE WORK**

o

**PAUSE WORK ORDER**

### Pause Reasons

- Waiting for Parts.
- Waiting for Approval.
- Waiting for Vendor.
- Waiting for Equipment / Tool.
- Waiting for Bay.
- Waiting for Driver.
- Truck Unavailable.
- Working on Another Work Order.
- Break.
- End of Shift.
- Other.

Si Other, Reason obligatorio.

Al pausar:
- Work Order Status → Waiting / Paused.
- Registrar Pause Started At.
- Pause Reason.
- Paused By.
- Active Labor deja de incrementarse.
- Waiting Time comienza.

Ejemplo:

```text
8:00 AM  Work Started
10:00 AM Pause — Waiting for Parts
1:00 PM  Resume
3:00 PM  Work Completed

Active Labor = 4h
Waiting for Parts = 3h
Elapsed Intervention = 7h
```

---

## 23. Home después de pausar

La WO pasa de `Trabajos Activos` a `Trabajos Pausados`.

Mostrar Pause Reason.

Actions:
- Ver Información.
- Continuar Trabajo.

---

## 24. Pantalla — Paused Work Order

Header:
- WO ID.
- Truck.
- Priority.
- Current Pause Reason.
- Category.
- Jobs Completed / Total.

Primary Action:

**Continuar Trabajo**

Al continuar:
- Cerrar Pause Event.
- Registrar Resumed At.
- Status → In Progress.
- Detener Waiting Time.
- Reanudar Active Labor.

---

## 25. Change Pause Reason

Mientras está pausada:

**CHANGE PAUSE REASON**

Mostrar Current Reason y:

**Update Pause**

Cambiar el motivo cierra el segmento anterior y crea otro.

Ejemplo:

```text
10:00 AM — Waiting for Parts
12:00 PM — Waiting for Approval
1:00 PM  — Resume
```

Resultado:
- Waiting for Parts = 2h.
- Waiting for Approval = 1h.

---

## 26. Finalizar Work Order

No permitir finalización normal si existen Jobs To Do pendientes.

Mensaje:

**This Work Order still has incomplete Jobs.**

Cuando todos estén Completed, `Finalizar Trabajo` registra:
- Completed At.
- Completed By.
- Final Status.
- Total Active Labor.
- Total Waiting.
- Waiting breakdown.
- Jobs Completed.

Status → **Completed**

---

## 27. Work Order vs Truck OOS

No asumir:

**Work Order Completed = Truck Available**

El estado operacional del Truck es independiente. Puede necesitar QA, otra intervención o aprobación antes de Return to Service.

---

## 28. Activity Log

Cada Work Order mantiene historial no editable directamente.

Eventos:
- Work Order Created.
- Work Started.
- Job Added.
- Job Completed.
- Job Cancelled.
- Work Paused.
- Pause Reason Changed.
- Work Resumed.
- Mechanic Added/Removed.
- Priority Changed.
- Notes Updated.
- Work Order Completed.
- Manager Correction.

Cada evento:
- Timestamp.
- User.
- Event Type.
- Entity.
- Relevant Value.
- Previous Value, cuando aplique.
- New Value, cuando aplique.

---

## 29. Datos mínimos

### Work Order
- Work Order ID.
- Truck ID.
- Primary Category ID.
- Status.
- Priority.
- Created At.
- Created By.
- Started At.
- Completed At.
- Notes.
- Total Active Labor.
- Total Waiting Time.

### Work Order Job
- Work Order Job ID.
- Catalog Job ID, si existe.
- Original Custom Description, si aplica.
- Category ID.
- Display Name snapshot.
- Status.
- Added At / By.
- Completed At / By.
- Cancelled At / Reason, si aplica.

### Pause Event
- Pause Event ID.
- Work Order ID.
- Reason.
- Started At.
- Ended At.
- Duration.
- Created By.
- Notes, si aplica.

### Mechanic Assignment
- Work Order ID.
- Mechanic ID.
- Added At.
- Removed At, si aplica.
- Added By.

### Job Category
- Category ID.
- Name.
- Status.
- Sort Order.

### Catalog Job
- Job ID.
- Category ID.
- Display Name.
- Status.
- Created At.
- Created By.

### Job Alias
- Alias ID.
- Job ID.
- Alias Text.

---

## 30. Custom Job Review

Manager puede:

### Map to Existing Job

Custom `3in1` → **JOB-0042 — 3 in 1**

### Add to Catalog

Definir:
- Canonical Display Name.
- Category.
- Aliases.
- Job ID.

Nunca perder el texto original.

---

## 31. Métricas habilitadas

### Shop / Work Orders
- Open Work Orders.
- Work Orders In Progress.
- Work Orders Waiting.
- Work Orders Completed.
- Average Active Labor.
- Average Waiting Time.
- Waiting Time by Reason.
- Work Orders by Category / Truck / Mechanic.

### Jobs
- Jobs Completed.
- Jobs by canonical Job ID.
- Jobs by Category.
- Frequency by Truck.
- Repeat Jobs on same Truck.

### Mechanics
- Work Orders participated in.
- Active Labor associated with Work Orders.
- Waiting Time associated with Work Orders.
- Jobs Completed.

No utilizar Jobs Completed por sí solo como ranking de productividad.

---

## 32. Border Cases

### BC01 — Truck ya tiene Work Order abierta
Advertir y dirigir a la existente.

### BC02 — Work Order sin Jobs
No permitir creación.

### BC03 — Job no existe
Job Not Listed → Custom Job.

### BC04 — Diferente escritura del mismo Job
Aliases + canonical Job ID.

### BC05 — Job renombrado
Mantener mismo Job ID.

### BC06 — Job fuera de uso
Marcar Inactive; no eliminar historial.

### BC07 — Job descubierto de otra Category
Permitir agregar a la misma WO.

### BC08 — Job completado accidentalmente
Reapertura/corrección controlada y auditada.

### BC09 — Finalización con Jobs pendientes
Bloquear.

### BC10 — Olvidó pausar/reanudar
Manager puede corregir con auditoría.

### BC11 — Cambio de Pause Reason
Cerrar segmento anterior y crear nuevo.

### BC12 — End of Shift
Pausa con reason `End of Shift`; no cuenta como Active Labor.

### BC13 — Múltiples mecánicos
Permitir asociación. P0 mide intervención, no labor individual exacta simultánea.

### BC14 — Múltiples WO activas por mecánico
Evitar doble conteo de tiempo productivo.

### BC15 — Refresh / navegador cerrado
Timer calculado desde timestamps persistidos, nunca desde un contador local.

### BC16 — Pérdida de conexión
Indicar acciones no sincronizadas y evitar pérdida/duplicación.

### BC17 — Ninox API error
No mostrar éxito hasta confirmar escritura. Retry idempotente.

### BC18 — Doble clic en Create Work Order
Protección idempotente.

### BC19 — Edición concurrente
Evitar sobrescrituras silenciosas.

### BC20 — Completar Job mientras WO está pausada
Por defecto requerir Resume primero.

### BC21 — Agregar Job a WO completada
No permitir al Mechanic; Manager puede reabrir según permisos.

---

## 33. Reglas UX

Minimizar escritura.

Preferir:
- Selectores.
- Botones grandes.
- Catálogos.
- Búsqueda.
- Estados claros.
- Confirmaciones solo para acciones importantes.

Evitar:
- Formularios largos.
- Texto libre innecesario.
- Timestamps manuales.
- Seleccionar/escribir su propio nombre.
- Calcular tiempos manualmente.
- Rankings individuales en la vista del mecánico.

Siempre visibles:
- Truck Number.
- Work Order ID.
- Status.
- Priority.
- Primary Category.
- Jobs Completed / Total.
- Current Pause Reason, si aplica.
- Acción principal disponible.

---

## 34. Ninox y futura migración

> **HISTORICAL/SUPERSEDED:** el checkout actual usa Supabase PostgreSQL
> administrado por Prisma. Ninox está DEFERRED y solo existe un adapter stub; no
> se ha confirmado lectura, escritura ni dual-write operacional.

Durante la transición, la aplicación utiliza la API de Ninox para leer/escribir la información que todavía tenga Ninox como Source of Truth.

El frontend no debe acoplarse directamente a la estructura interna de Ninox.

Arquitectura:

```text
Mechanic UI
     ↓
Application API
     ↓
Domain / Business Logic
     ↓
Ninox Adapter
```

Pensar las entidades como dominios propios:
- Trucks.
- Work Orders.
- Job Categories.
- Job Catalog.
- Mechanics / Users.
- Pause Events.
- Activity Logs.

Cuando sea necesario guardar:
- Internal ID.
- Ninox External ID.

Esto permite migración progresiva hacia la nueva base de datos.

---

## 35. Alcance P0

Incluye:
- Authentication.
- Mechanic Home.
- Active Work Orders.
- Paused Work Orders.
- Create Work Order.
- Truck Search.
- Truck Information.
- Truck Repair History.
- Primary Category.
- Standardized Job Catalog.
- Job aliases/search.
- Job Not Listed.
- Add Job.
- Working With.
- Priority.
- Notes.
- Work Order active state.
- Complete Job.
- Completed Jobs.
- Pause Work Order.
- Pause Reasons.
- Change Pause Reason.
- Resume Work Order.
- Complete Work Order.
- Activity timestamps/log.
- Ninox read/write integration.

---

## 36. Fuera de alcance inicial

Preparar el modelo, pero no es necesario construir todavía:
- Timer individual por Job.
- Estimated vs Actual por Job.
- Mechanic rankings.
- First-Time Fix Rate automatizado.
- Comeback Rate automatizado.
- Predictive maintenance.
- Parts inventory completo.
- Purchasing.
- Vendor management completo.
- Advanced scheduling.
- AI recommendations.
- Migración completa del ERP desde Ninox.

---

## 37. Criterio de éxito

Un mecánico puede:
1. Entrar.
2. Encontrar un Truck.
3. Ver información e historial.
4. Crear una Work Order.
5. Seleccionar Jobs estandarizados.
6. Iniciar la intervención.
7. Marcar Jobs completados.
8. Agregar Jobs descubiertos.
9. Pausar indicando por qué.
10. Cambiar el motivo de pausa.
11. Reanudar.
12. Completar todos los Jobs.
13. Finalizar la Work Order.

El sistema puede reconstruir:
- Quién trabajó.
- En qué Truck.
- Qué Work Order.
- Qué Jobs se realizaron.
- Cuándo comenzó.
- Cuánto Active Labor hubo.
- Cuánto Waiting Time hubo.
- Por qué estuvo pausado.
- Cuándo terminó.

---

## 38. Principio final

El mecánico no debe sentir que está operando un sistema de tracking.

Debe sentir que utiliza una herramienta sencilla para organizar y registrar su trabajo.

La complejidad vive detrás de la interfaz:

**el mecánico selecciona, inicia, completa, pausa y continúa; el sistema construye automáticamente el historial y los datos operacionales del Shop.**

---

## 39. Arquitectura de Información

### 39.1 Objetivo

Definir cómo se organiza, relaciona y navega la información dentro de la herramienta para mantener una experiencia simple para el mecánico y una estructura escalable para futuras funciones del Shop.

La arquitectura de información debe separar claramente:

- Navegación.
- Entidades de negocio.
- Estados y acciones.
- Historial y trazabilidad.
- Métricas y reporting.

---

### 39.2 Estructura principal de navegación — Mechanic

Para el mecánico, la navegación debe mantenerse intencionalmente simple.

```text
SHOP APP
│
├── Home
│   ├── Active Work Orders
│   ├── Paused Work Orders
│   └── Create New Work Order
│
├── Work Orders
│   └── Work Order Detail
│       ├── Truck Information
│       ├── Primary Category
│       ├── Jobs To Do
│       ├── Completed Jobs
│       ├── Working With
│       ├── Priority
│       ├── Notes
│       ├── Pause / Resume
│       └── Activity Log
│
├── Trucks
│   ├── Truck Detail
│   └── Repair History
│
├── Job Catalog
│   ├── Job Categories
│   ├── Canonical Jobs
│   ├── Aliases
│   └── Custom Jobs
│
└── Profile
    └── User / Logout
```

En P0, la experiencia real del mecánico debe sentirse todavía más simple:

```text
HOME
│
├── Current Work
├── Paused Work
└── + New Work Order
```

La mayor parte de la operación ocurre dentro de una Work Order.

---

### 39.3 Entidad central

La entidad central de la experiencia operacional es la **Work Order**.

La Work Order representa la intervención completa sobre un Truck.

```text
TRUCK
  │
  └── WORK ORDER
       │
       ├── Primary Category
       ├── Mechanics
       ├── Jobs
       ├── Pause Events
       ├── Notes
       ├── Activity Log
       └── Timing
```

La navegación debe priorizar siempre el contexto de la intervención completa.

---

### 39.4 Relación Work Order → Jobs

Cada Work Order puede contener uno o múltiples Jobs.

```text
WORK ORDER
│
├── Job 1
│    ├── Catalog Job ID
│    ├── Category
│    └── Status
│
├── Job 2
│
└── Job 3
```

Los Jobs describen **qué tareas deben realizarse**, pero en P0 no controlan el timer principal.

El timer y los Pause Events pertenecen a la Work Order.

---

### 39.5 Relación Job Category → Catalog Job

Los Jobs no deben depender de texto libre como fuente principal.

```text
JOB CATEGORY
   │
   └── CATALOG JOB
         ├── Job ID
         ├── Display Name
         └── Aliases
```

Cada Catalog Job debe estar relacionado con:

- Category.
- Canonical Job ID.
- Display Name.
- Status.
- Aliases.

Esto garantiza consistencia histórica y reporting confiable.

---

### 39.6 Arquitectura del tiempo

Los tiempos deben mantenerse separados de los Jobs individuales.

```text
WORK ORDER
│
├── Active Work Sessions
│
└── Pause Events
     ├── Waiting for Parts
     ├── Waiting for Approval
     ├── Waiting for Vendor
     ├── Waiting for Bay
     ├── End of Shift
     └── Other
```

De esta estructura se derivan:

```text
Total Intervention Time
├── Active Labor
└── Waiting / Blocked Time
```

Esto permite distinguir trabajo efectivo de tiempo detenido.

---

### 39.7 Arquitectura de contexto

La navegación debe seguir esta jerarquía:

```text
Home
  ↓
Work Order
  ↓
Truck Info / Jobs / History / Activity
```

No se recomienda una jerarquía donde Jobs sean el punto de entrada principal:

```text
Home
↓
Jobs
↓
Truck
↓
Work Order
```

El contexto operacional debe permanecer siempre alrededor de la intervención del Truck.

---

### 39.8 Regla conceptual de entidades

Usar estas definiciones como referencia transversal del producto:

**Truck**  
Activo físico sobre el cual se trabaja.

**Work Order**  
Intervención completa realizada sobre el Truck.

**Job**  
Tarea específica dentro de la Work Order.

**Mechanic**  
Persona que participa en la intervención.

**Pause Event**  
Periodo en el que la Work Order deja de acumular Active Labor y registra una causa de espera.

**Activity Log**  
Historial cronológico de acciones y cambios.

**Job Catalog**  
Taxonomía estandarizada de trabajos permitidos.

---

### 39.9 Arquitectura de información futura — Manager

Aunque este PRD corresponde al Mechanic App, la estructura debe permitir una experiencia Manager conectada a las mismas entidades.

```text
MANAGER
│
├── Dashboard
├── Work Orders
├── Trucks
├── Mechanics
├── Job Catalog
└── History / Reports
```

El Manager debe poder navegar de información agregada a detalle operacional:

```text
Dashboard
  ↓
Truck / Work Order / Mechanic
  ↓
Job Detail / Activity Log
```

Principio:

**Summary → Problem → Record → Action**

---

### 39.10 Regla de navegación y escalabilidad

La arquitectura de información debe permitir agregar futuros módulos sin cambiar la lógica central.

Ejemplos futuros:

- Parts.
- Inventory.
- Vendors.
- Purchasing.
- PM Scheduling.
- Fleet Availability.
- Inspections.
- Maintenance Planning.

Todos deben integrarse alrededor de entidades compartidas como:

- Truck.
- Work Order.
- Job.
- User / Mechanic.
- Activity Log.

La Work Order debe permanecer como el principal punto de unión de la operación del Shop.

---

## 40. Technical Architecture & Migration Strategy

> **HISTORICAL/SUPERSEDED:** esta sección conserva la estrategia original. El
> estado CURRENT es Next.js + NestJS + Prisma sobre Supabase PostgreSQL, con web
> y API desplegados en Vercel. Las referencias a Ninox como autoridad P0,
> Prisma como futuro y Render/Railway/Fly.io no describen el checkout actual.

### 40.1 Objetivo

Definir el stack tecnológico, los límites de arquitectura y la estrategia de transición desde Ninox hacia Supabase/PostgreSQL sin rehacer el producto.

Principios:

- El frontend no debe depender directamente de la estructura de Ninox.
- Ninox será el Source of Truth durante el P0.
- Toda lectura y escritura operacional del P0 pasa por la API propia de la aplicación.
- La lógica de negocio debe permanecer separada del proveedor de datos.
- Supabase/PostgreSQL reemplazará progresivamente a Ninox después de validar el producto.
- La migración debe poder hacerse por fases.

### 40.2 Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js + React + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Mechanic Mobile | Responsive Web / PWA |
| Backend | NestJS + TypeScript |
| API | REST |
| P0 Data Source | Ninox API |
| P0 Source of Truth | Ninox |
| Future Database | Supabase / PostgreSQL |
| ORM futuro | Prisma |
| Authentication | Supabase Auth |
| Error Monitoring | Sentry |
| Product Analytics | PostHog |
| Frontend Hosting | Vercel |
| Backend Hosting | Render, Railway o Fly.io |
| Testing | Vitest/Jest + Playwright |
| Source Control | GitHub |

### 40.3 Arquitectura del backend

Patrón recomendado:

**Modular Monolith**

No utilizar microservices en P0.

```text
Backend
│
├── Auth Module
├── Users / Mechanics Module
├── Trucks Module
├── Work Orders Module
├── Job Catalog Module
├── Pause Events Module
├── Activity Log Module
└── Integrations
     └── Ninox
```

Los límites entre módulos deben quedar claros aunque inicialmente todo se despliegue como una sola aplicación.

### 40.4 Arquitectura P0

```text
Mechanic / Manager UI
        ↓
Next.js / React
        ↓
Application API
        ↓
NestJS
        ↓
Domain / Business Logic
        ↓
Repository Interface
        ↓
Ninox Repository / Adapter
        ↓
Ninox API
        ↓
NINOX
```

Durante P0:

```text
READ   ← Ninox
WRITE  → Ninox
```

Ninox funciona como:

- Read Source.
- Write Source.
- Source of Truth.

No se debe mantener una segunda copia authoritative de la operación en Supabase durante el P0.

### 40.5 Repository / Adapter Pattern

La lógica de negocio no debe conocer detalles específicos de Ninox.

Ejemplo:

```text
WorkOrderService
        ↓
WorkOrderRepository
        ↓
NinoxWorkOrderRepository
```

El dominio trabaja con operaciones como:

- `createWorkOrder()`
- `getWorkOrder()`
- `updateWorkOrder()`
- `pauseWorkOrder()`
- `resumeWorkOrder()`
- `completeWorkOrder()`

Posteriormente:

```text
WorkOrderService
        ↓
WorkOrderRepository
        ↓
SupabaseWorkOrderRepository
```

La UI y la lógica de negocio no deben necesitar una reconstrucción completa cuando cambie el proveedor de persistencia.

### 40.6 IDs internos y externos

No utilizar el Ninox Record ID como único identificador conceptual.

Guardar cuando corresponda:

- Internal ID.
- Ninox External ID.

Ejemplo:

```text
Work Order
internal_id: wo_01JXYZ...
ninox_id: 18420
```

Esto permite migrar posteriormente a PostgreSQL sin romper las relaciones del dominio.

### 40.7 Future Database

Después de validar el producto:

- Supabase.
- PostgreSQL.
- Prisma como ORM.

PostgreSQL debe considerarse la base de datos principal y Supabase la plataforma administrada alrededor de ella.

Evitar acoplar la lógica de dominio a funcionalidades propietarias de Supabase cuando no sea necesario.

### 40.8 Authentication

Tecnología propuesta:

**Supabase Auth**

Debe manejar:

- Login por email.
- Session.
- User identity.
- Role.
- Account activation / deactivation.

Roles iniciales:

- Mechanic.
- Manager.
- Admin, si posteriormente es necesario.

### 40.9 Sentry

Usar Sentry desde P0 para:

- Frontend errors.
- Backend errors.
- API failures.
- Unhandled exceptions.
- Performance issues críticos.

Casos especialmente relevantes:

- Ninox API failures.
- Work Order creation failures.
- Pause / Resume failures.
- Authentication errors.
- Sync issues.

### 40.10 PostHog

Usar PostHog para Product Analytics.

Eventos sugeridos:

- `user_logged_in`
- `new_work_order_started`
- `work_order_created`
- `job_added`
- `custom_job_created`
- `job_completed`
- `work_order_paused`
- `pause_reason_changed`
- `work_order_resumed`
- `work_order_completed`
- `truck_history_viewed`
- `work_order_creation_abandoned`

No enviar información sensible innecesaria.

### 40.11 Hosting

Frontend:

**Vercel**

Backend:

Elegir uno para P0:

- Render.
- Railway.
- Fly.io.

La selección final debe mantenerse consistente entre Staging y Production.

### 40.12 Source Control

**GitHub**

Debe utilizar:

- Pull Requests.
- Code Reviews.
- Branch protection.
- CI checks.
- Release history.

### 40.13 Testing

Stack:

- Vitest o Jest para unit/integration tests.
- Playwright para critical end-to-end flows.

Flujos E2E críticos:

1. Mechanic Login.
2. Create Work Order.
3. Add standardized Job.
4. Add Custom Job.
5. Complete Job.
6. Pause Work Order.
7. Change Pause Reason.
8. Resume Work Order.
9. Complete Work Order.
10. Existing Work Order validation.

### 40.14 Environments

La aplicación debe tener:

```text
Development
Staging
Production
```

**Development:** desarrollo local y pruebas del equipo.

**Staging:** QA, Product Review y Acceptance Testing.

**Production:** operación real del Shop.

No desarrollar o experimentar directamente contra datos reales de Production.

Idealmente Staging debe usar una base/workspace de Ninox de prueba o registros de testing aislados.

### 40.15 Secrets y seguridad

Las credenciales de Ninox deben existir únicamente en backend/server environment.

Nunca exponer:

- Ninox API Token.
- Supabase Service Role.
- Backend credentials.

en:

- Browser.
- React bundle.
- Public environment variables.
- Client-side code.

```text
Browser
   ↓
Application API
   ↓
Backend Secret
   ↓
Ninox API
```

### 40.16 Source of Truth — P0

| Entity | Source of Truth |
|---|---|
| Trucks | Ninox |
| Mechanics / operational user data | Ninox |
| Work Orders | Ninox |
| Work Order Jobs | Ninox |
| Job Categories | Ninox |
| Catalog Jobs | Ninox |
| Pause Events | Ninox |
| Repair History | Ninox |
| Operational Status | Ninox |

La aplicación es una nueva experiencia y capa de lógica sobre datos que todavía persisten en Ninox.

### 40.17 Source of Truth — P1

Después de validar el producto:

| Entity | Future Source of Truth |
|---|---|
| Trucks | Supabase / PostgreSQL |
| Mechanics / Users | Supabase / PostgreSQL |
| Work Orders | Supabase / PostgreSQL |
| Work Order Jobs | Supabase / PostgreSQL |
| Job Categories | Supabase / PostgreSQL |
| Catalog Jobs | Supabase / PostgreSQL |
| Pause Events | Supabase / PostgreSQL |
| Activity Logs | Supabase / PostgreSQL |
| Repair History | Supabase / PostgreSQL |

Ninox pasa progresivamente a legacy/read-only antes de retirarse del flujo operacional.

### 40.18 Estrategia de migración Ninox → Supabase

```text
1. Build P0 using Ninox as Source of Truth.
2. Pilot with real Shop users.
3. Validate workflow, fields, states and Job Catalog.
4. Stabilize the validated domain model.
5. Design equivalent PostgreSQL schema.
6. Create Supabase / PostgreSQL environment.
7. Backfill historical Ninox records.
8. Validate counts, relationships and data integrity.
9. Implement Supabase repository adapters.
10. Run automated and manual acceptance tests.
11. Switch reads to Supabase in Staging.
12. Validate behavior and reports.
13. Switch writes to Supabase.
14. Make Supabase the Source of Truth.
15. Keep Ninox temporarily available for verification.
16. Disable Shop writes to Ninox.
17. Retire the Shop dependency on Ninox.
```

### 40.19 Configuración del Data Source

La arquitectura debe permitir sustituir la implementación del repositorio.

Conceptualmente:

```text
DATA_SOURCE=ninox
```

y posteriormente:

```text
DATA_SOURCE=supabase
```

No es obligatorio que el cambio dependa literalmente de una sola variable, pero el diseño debe permitir sustituir adapters sin rehacer los módulos de dominio.

### 40.20 No Dual Write por defecto

Durante P0 no escribir simultáneamente cada operación en Ninox y Supabase.

El Dual Write introduce riesgos:

- Una escritura funciona en un sistema y falla en el otro.
- Estados divergentes.
- Duplicados.
- Reintentos complejos.
- Ambigüedad sobre el Source of Truth.

Preferir fases claras de migración.

### 40.21 Realtime futuro

Realtime no es requisito del P0.

Durante P0 puede utilizarse refresh o polling controlado.

Después de la migración puede evaluarse Supabase Realtime para:

- Manager Dashboard.
- Active Work Orders.
- Mechanic status.
- Blocked Work Orders.

### 40.22 Cache y Queues

No son requeridos inicialmente.

Si posteriormente aparecen necesidades como:

- Alto volumen de API calls.
- Background jobs.
- Integraciones asincrónicas.
- Notifications.
- Report generation.

Se puede incorporar:

- Redis.
- BullMQ.

### 40.23 Integraciones futuras

```text
Integrations
│
├── Ninox
├── Samsara
├── McLeod
├── Notifications
└── Future ERP Services
```

Las integraciones deben mantenerse separadas de la lógica central del dominio.

### 40.24 Technical Definition of Done

Una feature no se considera terminada únicamente porque funciona localmente.

Debe cumplir, cuando corresponda:

- PRD / Acceptance Criteria completos.
- UX validada.
- Responsive behavior.
- Authorization correcta.
- Loading states.
- Empty states.
- Error handling.
- Ninox read/write confirmado.
- No duplicate writes.
- Activity Log cuando aplique.
- Sentry instrumentation.
- PostHog event cuando aplique.
- Unit/integration tests relevantes.
- E2E para flujo crítico.
- Code Review.
- Staging deploy.
- Product QA.
- Production ready.
- No secrets expuestos en frontend.

### 40.25 Principio técnico final

P0:

```text
Next.js / React
      ↓
NestJS
      ↓
Domain
      ↓
Repository
      ↓
Ninox
```

Después de validación:

```text
Next.js / React
      ↓
NestJS
      ↓
Domain
      ↓
Repository
      ↓
Supabase / PostgreSQL
```

**Ninox es la base operacional para validar el producto. Supabase/PostgreSQL será la base para escalarlo una vez que el modelo haya sido probado.**

# 44. Mobile Mechanic Wireframes — ASCII Reference

Esta sección documenta las pantallas del flujo del mecánico en mobile a partir de las 14 pantallas numeradas entregadas para el P0. Los wireframes son una guía estructural: preservan jerarquía, labels, estados y acciones principales; no sustituyen las especificaciones visuales finales.

Reglas comunes:

- La experiencia está optimizada para viewport mobile y scroll vertical.
- `Work Order` es la intervención del Truck; `Jobs` son tareas dentro de esa intervención.
- Completar un Job lo mueve de `Jobs To Do` a `Completed`; no completa automáticamente la Work Order.
- El contador de trabajo se controla a nivel de la intervención/Work Order y se pausa cuando se registra un bloqueo.
- Los textos mostrados en las imágenes se conservan cuando son parte del diseño: `Home`, `Create New Work Order`, `Pause Job`, `Waiting for Parts`, `Continue Work`, etc.

## Pantalla 01 — Home con trabajos activos y pausados

Objetivo: ofrecer al mecánico una vista inmediata de sus Work Orders operativas y el acceso para crear una nueva.

```text
┌──────────────────────────────┐
│ MECÁNICO                     │
│ Home                         │
│ Trabajos actuales, Ordenes   │
│ de trabajo y trabajos ...    │
│                              │
│ [ Create New Work Order ]    │
│                              │
│ TRABAJOS ACTIVOS             │
│ 2 trabajos activos           │
│ ┌──────────────────────────┐ │
│ │ WO-005                   │ │
│ │ #968     NORMAL  In Progress│
│ │ PM - 1 de 3 trabajos     │ │
│ │ [Pausar Trabajo] [Ver Trabajo]│
│ └──────────────────────────┘ │
│                              │
│ TRABAJOS PAUSADOS            │
│ 3 trabajos pausados          │
│ ┌──────────────────────────┐ │
│ │ WO-002  #922  CRITICAL   │ │
│ │ PM - 2 de 4 trabajos     │ │
│ │ Waiting for Parts        │ │
│ │ [Ver Información] [Continuar Trabajo]│
│ └──────────────────────────┘ │
│ ...                          │
└──────────────────────────────┘
```

## Pantalla 02 — New Work Order: búsqueda de Truck

Objetivo: iniciar la creación de una Work Order seleccionando primero el Truck.

```text
┌──────────────────────────────┐
│ MECÁNICO                     │
│ Nueva Orden de Trabajo       │
│ Ingrese la información ...   │
│                              │
│ TRUCK                        │
│ [ Search Truck Number     ]  │
│                              │
│ (sin Truck seleccionado)     │
│                              │
│ TRUCK INFORMATION            │
│ Seleccione un Truck para     │
│ mostrar sus datos.           │
└──────────────────────────────┘
```

La búsqueda debe aceptar el número del Truck y mostrar resultados seleccionables. No se habilita la creación hasta contar con un Truck válido.

## Pantalla 03 — Truck seleccionado y detalles

Objetivo: confirmar el activo seleccionado y ofrecer contexto antes de definir los Jobs.

```text
┌──────────────────────────────┐
│ NUEVA ORDEN DE TRABAJO       │
│                              │
│ TRUCK                        │
│ [ 905                    × ] │
│                              │
│ TRUCK INFORMATION        ˄   │
│ Make       Model       Year  │
│ Volvo      VNL 860     2025  │
│ ──────────────────────────── │
│ Mileage    Company     Owner │
│ 142,500 mi Lightning   Carlos│
│ [ See Truck Repair History ]  │
└──────────────────────────────┘
```

## Pantalla 04 — Category, Jobs To Do y datos iniciales

Objetivo: configurar la intervención antes de crearla.

```text
┌──────────────────────────────┐
│ CATEGORY                     │
│ [ Suspension             ˅ ] │
│                              │
│ JOBS TO DO                   │
│ ┌──────────────────────────┐ │
│ │ Inspect Air System    🗑 │ │
│ ├──────────────────────────┤ │
│ │ Replace Air Hose      🗑 │ │
│ ├──────────────────────────┤ │
│ │ Cooling System        🗑 │ │
│ └──────────────────────────┘ │
│ [ Agregar trabajo        ＋ ] │
│                              │
│ WORKING WITH                 │
│ [ Alejandro 1            ˅ ] │
│                              │
│ PRIORITY                     │
│ [ LOW ][ NORMAL ][ HIGH ][ CRITICAL ]
│                              │
│ NOTES (OPTIONAL)             │
│ [ Describe o agrega más ... ]│
│                              │
│ [ Create Work Order ]        │
└──────────────────────────────┘
```

La categoría filtra el catálogo de Jobs. El selector `Working With`, la prioridad y las notas pertenecen a la configuración inicial de la Work Order.

## Pantalla 05 — Agregar Jobs

Objetivo: permitir añadir uno o más trabajos adicionales desde la creación o desde una Work Order existente.

```text
┌──────────────────────────────┐
│ JOBS TO DO                   │
│                              │
│ [ Inspect Air System      🗑 ]│
│ [ Replace Air Hose         🗑 ]│
│                              │
│ ┌──────────────────────────┐ │
│ │ Agregar trabajo       ＋  │ │
│ └──────────────────────────┘ │
│                              │
│ Selector / búsqueda de Job   │
│ por Category                 │
│                              │
│ [ Add Job ] / [ Cancel ]     │
└──────────────────────────────┘
```

`Agregar trabajo` debe priorizar Jobs del catálogo. `Job Not Listed` queda como excepción controlada para registrar un Custom Job revisable.

## Pantalla 06 — Work Order creada: Jobs To Do y Completed

Objetivo: mostrar la intervención activa y su progreso.

```text
┌──────────────────────────────┐
│ WO-001                 NORMAL│
│ #905              In Progress│
│ Suspensión - 0 de 3 trabajos │
│                              │
│ WORK OPTIONS                 │
│ [ Pausar Trabajo ][Finalizar Trabajo]
│                              │
│ TRUCK INFORMATION        ˄   │
│ [ See Truck Repair History ]  │
│                              │
│ JOBS TO DO                   │
│ ○ Inspect Air System         │
│ ○ Replace Air Hose           │
│ ○ Cooling System             │
│ [ Agregar trabajo        ＋ ] │
│                              │
│ COMPLETED                    │
│ No hay trabajos completados  │
│                              │
│ WORKING WITH                 │
│ [ Alejandro 1 ]              │
│ PRIORITY  [LOW][NORMAL][HIGH][CRITICAL]
│ NOTES (OPTIONAL)             │
└──────────────────────────────┘
```

## Pantalla 07 — Job Finished modal

Objetivo: confirmar explícitamente que el Job seleccionado pasa a completado.

```text
┌──────────────────────────────┐
│ (pantalla oscurecida)         │
│       ┌──────────────────┐   │
│       │ JOB FINISHED     │   │
│       │                  │   │
│       │ Inspect Air      │   │
│       │ System           │   │
│       │                  │   │
│       │ [Cancelar]       │   │
│       │ [Terminar Trabajo]│  │
│       └──────────────────┘   │
└──────────────────────────────┘
```

Cancelar conserva el Job abierto. `Terminar Trabajo` confirma el cambio de estado y actualiza el contador de Jobs completados.

## Pantalla 08 — Work Order con Job completado

Objetivo: hacer visible el movimiento entre listas después de confirmar `Job Finished`.

```text
┌──────────────────────────────┐
│ ← WO-001                 #905│
│ Suspensión - 1 de 3 trabajos │
│                              │
│ JOBS TO DO                   │
│ ○ Replace Air Hose           │
│ ○ Cooling System             │
│ [ Agregar trabajo        ＋ ] │
│                              │
│ COMPLETED                    │
│ ✓ Inspect Air System         │
│                              │
│ WORKING WITH [ Alejandro 1 ] │
│ PRIORITY [LOW][NORMAL][HIGH][CRITICAL]
│ NOTES (OPTIONAL)             │
└──────────────────────────────┘
```

El Job completado permanece visible para trazabilidad; los Jobs restantes continúan accionables.

## Pantalla 09 — Repair History

Objetivo: consultar intervenciones previas del Truck desde la creación o desde la Work Order.

```text
┌──────────────────────────────┐
│ REPAIR HISTORY               │
│ #905                         │
│                              │
│ TRUCK INFORMATION            │
│ Volvo | VNL 860 | 2025       │
│ 142,500 mi | Lightning | Carlos│
│                              │
│ [ ALL ][ PM ][ Brakes ][ Electrical ]
│                              │
│ JUL 21, 2026          #905   │
│ Suspension                    │
│ Mechanic: Anthony / Alejandro│
│ Mileage: 142,500 mi          │
│ Work Performed:              │
│ [Inspect Air System]         │
│ [Replace Air Hose]            │
│ [Cooling System]              │
└──────────────────────────────┘
```

Los filtros por categoría son opcionales en P0, pero el historial debe mostrar fecha, categoría, mecánico, mileage y Jobs realizados.

## Pantalla 10 — Pause Job modal sin motivo seleccionado

Objetivo: iniciar una pausa obligando a registrar la razón operacional.

```text
┌──────────────────────────────┐
│       ┌──────────────────┐   │
│       │ PAUSE JOB        │   │
│       │                  │   │
│       │ [ Seleccione una │   │
│       │   opción       ˅ ]│  │
│       │                  │   │
│       │ [Cancelar] [Pausar Trabajo]
│       └──────────────────┘   │
└──────────────────────────────┘
```

El botón de confirmar requiere una razón válida y conserva el contexto de la Work Order detrás del modal.

## Pantalla 11 — Pause Job con motivo seleccionado

Objetivo: confirmar la pausa con `Waiting for Parts` u otra razón válida.

```text
┌──────────────────────────────┐
│       ┌──────────────────┐   │
│       │ PAUSE JOB        │   │
│       │                  │   │
│       │ [Waiting for Parts˅]│ │
│       │                  │   │
│       │ [Cancelar] [Pausar Trabajo]
│       └──────────────────┘   │
└──────────────────────────────┘
```

La razón seleccionada se guarda como Pause Event y detiene el tiempo activo del trabajo. El tiempo OOS del Truck puede continuar.

## Pantalla 12 — Home después de pausar

Objetivo: reflejar inmediatamente el cambio de estado en la lista principal.

```text
┌──────────────────────────────┐
│ MECÁNICO                     │
│ Home                         │
│ [ Create New Work Order ]    │
│                              │
│ TRABAJOS ACTIVOS             │
│ ... otras Work Orders ...    │
│                              │
│ TRABAJOS PAUSADOS            │
│ ┌──────────────────────────┐ │
│ │ WO-001                   │ │
│ │ #905                     │ │
│ │ Suspensión - 1 de 3      │ │
│ │ Waiting for Parts        │ │
│ │ [Ver Información]        │ │
│ │ [Continuar Trabajo]      │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

La Work Order sale de `Trabajos Activos` y aparece en `Trabajos Pausados` sin crear una nueva orden.

## Pantalla 13 — Work Order pausada

Objetivo: permitir retomar el trabajo o modificar el motivo de pausa.

```text
┌──────────────────────────────┐
│ ← WO-001                 #905│
│ Suspensión - 1 de 3 trabajos │
│ NORMAL       Waiting for Parts│
│                              │
│ [ Continuar Trabajo ]        │
│                              │
│ CHANGE PAUSE REASON       ˅  │
│ [ Waiting for Parts       ˅ ]│
│ [ Update Pause ]             │
│                              │
│ TRUCK INFORMATION        ˅   │
│ [ See Truck Repair History ]  │
│                              │
│ JOBS TO DO                   │
│ ○ Replace Air Hose           │
│ ○ Cooling System             │
│ [ Agregar trabajo        ＋ ] │
│ COMPLETED                    │
│ ✓ Inspect Air System         │
│ WORKING WITH [ Alejandro 1 ] │
└──────────────────────────────┘
```

## Pantalla 14 — Estado pausado persistente y recuperación

Objetivo: documentar el estado final mostrado cuando la Work Order sigue pausada y el mecánico debe elegir entre continuar o corregir el motivo.

```text
┌──────────────────────────────┐
│ ← WO-001                 #905│
│ Suspensión - 1 de 3 trabajos │
│ NORMAL       Waiting for Parts│
│                              │
│ [ Continuar Trabajo ]        │
│                              │
│ CHANGE PAUSE REASON          │
│ [ Waiting for Parts       ˅ ]│
│ [ Update Pause ]             │
│                              │
│ JOBS TO DO                   │
│ ○ Replace Air Hose           │
│ ○ Cooling System             │
│ [ Agregar trabajo        ＋ ] │
│                              │
│ COMPLETED                    │
│ ✓ Inspect Air System         │
│                              │
│ WORKING WITH [ Alejandro 1 ] │
│ PRIORITY [LOW][NORMAL][HIGH][CRITICAL]
│ NOTES (OPTIONAL)             │
└──────────────────────────────┘
```

`Continuar Trabajo` cierra la pausa vigente, registra el Resume Event y devuelve la Work Order a `In Progress`. `Update Pause` conserva auditoría del motivo anterior y registra el nuevo motivo.

## 44.1 Reglas de interacción derivadas de los wireframes

1. Crear una Work Order requiere Truck, Category y al menos un Job.
2. Si el Truck ya tiene una Work Order abierta, mostrar la existente antes de permitir duplicar la intervención.
3. `Jobs To Do` y `Completed` son listas separadas dentro de la misma Work Order.
4. Un Job terminado requiere confirmación explícita; la Work Order continúa abierta mientras existan Jobs pendientes.
5. Pausar siempre requiere un Pause Reason.
6. `Waiting for Parts` y otras razones son estados operacionales, no texto libre sin estructura.
7. El botón principal cambia por estado: `Create Work Order`, `Pausar Trabajo`, `Continuar Trabajo`, `Terminar Trabajo` o `Update Pause`.
8. La navegación a `See Truck Repair History` debe mantener disponible el retorno a la Work Order.
9. Los estados y tiempos deben actualizarse en Home y en el detalle sin crear registros duplicados.
10. El diseño debe mantener targets táctiles claros, scroll vertical y contraste suficiente para uso dentro del Shop.
