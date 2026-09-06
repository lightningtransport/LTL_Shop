# Shop Admin Integration Blueprint

## 1. Propósito

Este documento define cómo incorporar la experiencia **Shop Admin** al sistema real **LTL Shop Mechanics**. Está dirigido a otro ingeniero o agente que trabaje dentro de este repositorio y debe ser suficiente para planificar e implementar la integración sin consultar el historial de la conversación que originó el prototipo.

Shop Admin permite que Managers y Admins observen y administren la operación del Shop: Work Orders, Jobs, Trucks, Mechanics, tiempos, bloqueos, catálogo, historial y métricas. La referencia visual y funcional proviene del prototipo bilingüe ubicado en:

`/Users/cristianperez/Documents/ChatGPT/Shop`

Ese proyecto es una referencia de producto, contenido y cobertura, no código ni estilos para copiar directamente. LTL Shop Mechanics es la aplicación real; sus reglas implementadas y su sistema de diseño shadcn vigente tienen prioridad.

### Resultado objetivo

- Añadir una aplicación administrativa bajo `/admin` dentro de `apps/web`.
- Añadir contratos administrativos bajo `/api/admin` dentro de `apps/api`.
- Autorizar los roles `manager` y `admin`; `admin` hereda las capacidades operativas de Manager.
- Construir Shop Admin con los componentes shadcn, tokens y estilos vigentes de LTL Shop Mechanics.
- Mantener Supabase Postgres, administrado mediante Prisma, como fuente operacional objetivo.
- Convivir temporalmente con Ninox para consulta, importación y reconciliación hasta retirarlo.
- Preservar sin regresiones los flujos actuales del mecánico, incluido PM mediante `pmAuthorized`.
- Preparar una sola estructura de componentes para inglés y español.

## 2. Autoridad y resolución de conflictos

Aplicar esta prioridad cuando dos fuentes difieran:

1. **Comportamiento probado e implementado en LTL Shop Mechanics.**
2. **Sistema de diseño y estilos vigentes de LTL Shop Mechanics**, incluidos sus componentes shadcn, tokens semánticos y patrones responsive/accesibles.
3. **Reglas vigentes documentadas en este repositorio**, especialmente `README.md`, `docs/CURRENT_PRODUCT_STATUS.md` y `docs/PRD_Lightning_Shop_Mechanic_P0.md`.
4. **PRD de Manager y prototipo Shop** como referencia funcional, de contenido, jerarquía y cobertura de pantallas.

No reemplazar una regla existente del mecánico ni el sistema visual vigente para reproducir literalmente el prototipo. Registrar la diferencia y adaptar Shop Admin al dominio y al diseño real de LTL.

### Fuentes que deben leerse antes de implementar

En LTL Shop Mechanics:

- `README.md`
- `docs/CURRENT_PRODUCT_STATUS.md`
- `docs/PRD_Lightning_Shop_Mechanic_P0.md`
- `apps/api/prisma/schema.prisma`
- `packages/shared/src/enums.ts`
- `packages/shared/src/types.ts`
- `apps/api/src/auth/auth.guard.ts`
- `apps/api/src/work-orders/work-orders.controller.ts`
- `apps/api/src/work-orders/work-orders.service.ts`
- `apps/web/src/components/ui.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/tailwind.config.js`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/lib/utils.ts`

En el proyecto de referencia Shop:

- `docs/reference/PRD_Manager_App_Content.md`
- `docs/reference/PRD_Mechanic_App_Content_JobCatalog.md`
- `docs/PROTOTYPE_GUIDE.md`
- `docs/PRD_COVERAGE_MATRIX.md`
- `docs/DESIGN_SYSTEM.md`
- `app/src/app/routes.ts`
- `app/src/screens/ManagerScreens.tsx`

Términos canónicos que no se traducen: **Off Duty**, **Work Order**, **Job** y **Truck**.

## 3. Estado actual verificado

Esta sección describe el checkout inspeccionado el 6 de septiembre de 2026. Debe volver a verificarse antes de implementar porque el código y los despliegues pueden avanzar.

### 3.1 Plataforma

- Monorepo con frontend Next.js en `apps/web`.
- API NestJS en `apps/api`.
- contratos de dominio compartidos en `packages/shared`.
- PostgreSQL/Supabase como base de datos.
- Supabase Auth para sesiones de producción.
- Prisma y `apps/api/prisma/migrations` como única autoridad de migraciones.
- Frontend y API desplegables en Vercel.

### 3.2 Sistema de diseño vigente

El frontend ya mantiene un sistema shadcn implementado como código fuente local, no como una dependencia visual externa. Su base verificada incluye:

- primitives compartidos en `apps/web/src/components/ui.tsx`;
- Radix para comportamiento accesible y `class-variance-authority` para variantes;
- `cn()` con `clsx` y `tailwind-merge`;
- Lucide para iconografía;
- tokens semánticos light/dark en `apps/web/src/app/globals.css`;
- Tailwind 3 configurado en `apps/web/tailwind.config.js`;
- Inter como tipografía principal y JetBrains Mono para datos monoespaciados;
- colores `background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning`, `border`, `input` y `ring`;
- radios, sombras, focus visible y targets táctiles ya definidos.

Shop Admin debe extender esta base. No debe importar los tokens, Geist, CSS ni componentes shadcn del prototipo Shop. Si falta un primitive —por ejemplo Table, Tabs, Dropdown Menu, Sheet, Pagination o Data Table— debe añadirse siguiendo el patrón shadcn y las dependencias ya presentes en LTL, manteniendo su API reusable en la capa compartida.

### 3.3 Identidad y roles

`UserRole` ya contiene:

- `mechanic`
- `manager`
- `admin`

`AuthGuard` valida el token de Supabase, resuelve el usuario de aplicación por email o `supabaseAuthId`, comprueba que esté activo y adjunta el usuario a la petición. Actualmente no existe un guard declarativo que restrinja endpoints por rol. Tener el enum no equivale a tener RBAC administrativo implementado.

### 3.4 Dominio reutilizable

El esquema ya incluye:

- `User`, `Truck`, `WorkOrder` y `WorkOrderJob`.
- `JobCategory`, `CatalogJob` y `JobAlias`.
- `WorkSession` y `PauseEvent` a nivel de Work Order.
- `MechanicAssignment`.
- `ActivityLog` con `previousValue`, `newValue` y `relevantValue`.
- `PmService`, partes, fitment y auditoría de millaje.
- `version` e `idempotencyKey` en `WorkOrder`.
- `ninoxExternalId` en varias entidades para trazabilidad de migración.

Los campos existentes deben reutilizarse antes de crear conceptos paralelos.

### 3.5 API existente

La API actual expone autenticación, Mechanics, Trucks, catálogo y el flujo del mecánico. Entre otros:

- `GET /api/auth/me`
- `GET /api/mechanics`
- `GET /api/trucks`
- `GET /api/trucks/search`
- `GET /api/trucks/:id/open-work-order`
- `GET /api/trucks/:id/repair-history`
- `GET /api/catalog/categories`
- `GET /api/catalog/jobs`
- `GET /api/catalog/aliases`
- `GET|POST /api/work-orders`
- acciones start, pause, resume, complete, notes, Jobs y PM sobre Work Orders.

`GET /api/work-orders` está orientado al mecánico autenticado. No debe reutilizarse como listado global cambiando silenciosamente su semántica; Shop Admin necesita contratos separados.

### 3.6 Estado real de Ninox en este checkout

El código contiene un `NinoxClient` placeholder y `GET /api/integrations/ninox/status`. El propio cliente declara que P0 usa Supabase y que el adaptador Ninox no está implementado. No se verificó aquí lectura, escritura ni dual-write operacional.

Antes de diseñar coexistencia se debe inventariar cualquier integración que exista fuera de este checkout: servicios desplegados, scripts, jobs, webhooks, credenciales, tablas, sentido de sincronización y responsables. Hasta tener evidencia:

- no afirmar que LTL lee o escribe Ninox;
- no activar `DATA_SOURCE=ninox`;
- no introducir dual-write;
- no tratar un `ninoxExternalId` como prueba de sincronización;
- no convertir datos no confirmados en métricas.

## 4. Reglas que Shop Admin no puede romper

1. Solo puede existir una Work Order abierta por Truck.
2. Crear una Work Order estándar no inicia Active Labor; el mecánico usa **Start Work**.
3. La excepción PM inicia trabajo al crear y solo aplica por la capacidad `pmAuthorized`, nunca por nombre o email.
4. Una Work Order normal requiere al menos un Job y rechaza Jobs duplicados.
5. Completar un Job no pausa ni completa automáticamente la Work Order.
6. Una Work Order no puede pausarse si ya no tiene Jobs pendientes; PM usa sus propias validaciones.
7. Los timers provienen de timestamps persistidos, nunca de contadores del navegador.
8. Completar una Work Order y marcar un Truck **Returned to Service** son acciones separadas.
9. Las correcciones no borran silenciosamente el valor anterior.
10. Toda mutación administrativa sensible identifica al usuario real y deja Activity Log.

## 5. Arquitectura objetivo

```text
Browser
  ├─ Mechanic UI (rutas actuales)
  └─ Shop Admin UI (/admin/*)
            │
            ▼
      NestJS API (/api/*)
        ├─ dominio actual del mecánico
        ├─ AdminModule (/api/admin/*)
        ├─ RBAC + validación + auditoría
        └─ Prisma repositories
            │
            ▼
     Supabase PostgreSQL

Ninox durante transición
  └─ adaptador server-side explícito
       ├─ consulta/importación
       ├─ checkpoints y reconciliación
       └─ sin acceso desde el browser
```

### 5.1 Límites de módulos

- `AdminModule` orquesta consultas y comandos administrativos; no duplica reglas de dominio.
- Las reglas compartidas de Work Orders permanecen en servicios reutilizables del backend.
- Los endpoints del mecánico conservan sus respuestas y permisos actuales.
- El frontend Admin consume únicamente DTOs públicos; nunca modelos Prisma directos.
- La integración Ninox vive detrás de una interfaz server-side y no condiciona el render de Admin cuando Supabase ya contiene el dato autoritativo.

### 5.2 Rutas y navegación

- Base web: `/admin`.
- Login compartido: `/login`; después de autenticar, redirigir según rol y destino solicitado.
- `mechanic` que intente entrar a `/admin` recibe una pantalla 403 segura y no carga datos administrativos.
- `manager` entra al Dashboard Admin.
- `admin` entra al mismo espacio y puede recibir capacidades adicionales en fases posteriores.
- No crear un segundo sistema de autenticación ni guardar roles solo en el cliente.

### 5.3 Internacionalización

- Usar un único árbol React por pantalla.
- Todo texto general vive en catálogos tipados `en` y `es`.
- El locale no se representa mediante dos copias de una página.
- La selección y persistencia exacta del locale se define en la fase 1 usando una solución compatible con App Router.
- El lanzamiento puede habilitar inglés primero, pero ningún componente nuevo debe contener una estructura que impida español.

## 6. Permisos

| Capacidad | mechanic | manager | admin |
|---|---:|---:|---:|
| Usar flujo móvil actual | Sí | Según política existente | Según política existente |
| Acceder a `/admin` | No | Sí | Sí |
| Ver operación global | No | Sí | Sí |
| Editar operación | No | Sí | Sí |
| Corregir tiempos | No | Sí | Sí |
| Administrar catálogo | No | Sí | Sí |
| Revisar Custom Jobs | No | Sí | Sí |
| Configuración global futura | No | No por defecto | Sí |

Implementar en el API un decorador/guard de roles reutilizable. Cada endpoint administrativo debe declarar roles permitidos y verificar también permisos específicos cuando se introduzcan. Ocultar un botón en React nunca sustituye autorización server-side.

## 7. Contratos administrativos propuestos

Los siguientes contratos son objetivo de implementación; no existen todavía.

### 7.1 Convenciones comunes

```ts
type AdminListQuery = {
  cursor?: string;
  limit?: number;        // default 25, máximo definido por API
  search?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
};

type AdminPage<T> = {
  items: T[];
  nextCursor: string | null;
  total?: number;
};

type AdminMutationMeta = {
  expectedVersion: number;
  idempotencyKey: string;
  reason?: string;
};
```

- Validar query y body con Zod en `packages/shared` y nuevamente en el API.
- Usar cursor para listas operativas; no descargar la base completa.
- Exigir `expectedVersion` para cambios sobre entidades versionadas.
- Reutilizar el mismo `idempotencyKey` al reintentar una acción.
- Responder `409 Conflict` si el registro cambió.
- Registrar before/after y actor en la misma transacción PostgreSQL que la mutación.

### 7.2 Lecturas

| Endpoint | Propósito |
|---|---|
| `GET /api/admin/dashboard` | KPIs y listas de atención para un rango permitido |
| `GET /api/admin/work-orders` | listado global filtrable y paginado |
| `GET /api/admin/work-orders/:id` | detalle, Jobs, Mechanics, pausas y Activity Log |
| `GET /api/admin/trucks` | listado y estado operacional derivado |
| `GET /api/admin/trucks/:id` | detalle, WO actual e historial |
| `GET /api/admin/mechanics` | capacidad y actividad actual |
| `GET /api/admin/mechanics/:id` | detalle operacional sin ranking individual |
| `GET /api/admin/history` | Work Orders y Jobs finalizados/cancelados |
| `GET /api/admin/catalog/categories` | categorías y conteos |
| `GET /api/admin/catalog/categories/:id` | Jobs y aliases de una categoría |
| `GET /api/admin/catalog/custom-jobs` | cola paginada de Custom Jobs pendientes |
| `GET /api/admin/reports/waiting-by-reason` | agregados soportados por PauseEvent |
| `GET /api/admin/reports/job-performance/:id` | solo cuando exista evidencia suficiente por Job |

### 7.3 Mutaciones

| Endpoint propuesto | Regla mínima |
|---|---|
| `PATCH /api/admin/work-orders/:id` | prioridad/notas/campos permitidos, versión y Activity Log |
| `POST /api/admin/work-orders/:id/mechanics` | añadir Mechanic sin alterar historia previa |
| `DELETE /api/admin/work-orders/:id/mechanics/:mechanicId` | soft-remove mediante `removedAt`; no borrar fila histórica |
| `POST /api/admin/work-orders/:id/cancel` | razón obligatoria y transición válida |
| `POST /api/admin/work-orders/:id/complete` | mismas invariantes del dominio actual |
| `POST /api/admin/work-orders/:id/return-to-service` | separado de completar WO |
| `POST /api/admin/jobs/:id/cancel` | soft cancel con razón |
| `POST /api/admin/jobs/:id/reopen` | conserva historia y registra evento |
| `POST /api/admin/time-corrections` | corrección auditable; nunca editar totales directamente |
| `POST|PATCH /api/admin/catalog/jobs` | crear/renombrar/desactivar; nunca perder identidad canónica |
| `POST /api/admin/catalog/custom-jobs/:id/map` | conservar texto original y asociar Job canónico |

El verbo `DELETE` de la asignación representa una acción HTTP sobre la relación activa; la persistencia debe ser soft-remove. No se autoriza borrar Work Orders, Jobs, Activity Logs ni historia.

## 8. Brechas del modelo actual

### 8.1 Off Duty

`Truck` no tiene un estado operacional canónico, `offDutySince` ni eventos de entrada/salida de servicio. Añadir un modelo de eventos, por ejemplo `TruckServiceStatusEvent`, con estado canónico, timestamp, actor, razón y Work Order opcional. El estado actual se deriva del último evento válido.

No inferir Off Duty a partir de texto libre de Ninox. Durante migración, valores sin mapping aprobado se conservan como `Unknown` y se excluyen de downtime.

### 8.2 Tiempos por Job

La implementación actual mide `WorkSession` y `PauseEvent` por Work Order. El prototipo muestra Active Labor y Waiting por Job. No atribuir tiempos de Work Order a un Job por conveniencia.

Fase inicial:

- mostrar tiempos de Work Order donde estén soportados;
- marcar métricas por Job como no disponibles;
- no publicar Job Performance basado en aproximaciones.

Una fase posterior puede introducir segmentos vinculados a Job y Mechanic, pero exige migración, nuevas invariantes y actualización del flujo mecánico. Debe aprobarse como cambio de dominio separado.

### 8.3 Concurrencia e idempotencia

`WorkOrder.version` e `idempotencyKey` ya existen, pero no todas las entidades administrativas tienen control equivalente. Definir si cada mutación versiona la Work Order agregada o requiere `version` propio. No usar `updatedAt` del cliente como única garantía.

### 8.4 Auditoría y correcciones

`ActivityLog` soporta before/after, pero faltan contratos administrativos completos y posiblemente entidades explícitas de corrección. Toda corrección de tiempo debe conservar el dato original, el corregido, la razón, el actor y el timestamp. Los totales se recalculan desde segmentos/eventos; no se editan directamente.

### 8.5 Catálogo y Custom Jobs

`WorkOrderJob` ya tiene `mappedCatalogJobId` y `reviewStatus`; `CatalogJob` y `JobAlias` existen. Antes de añadir tablas, completar el contrato de estados de revisión y decidir la identidad canónica estable. Renombrar un Job no debe cambiar su ID.

## 9. Matriz de las 19 pantallas Manager

Fases: **1** fundación, **2** lectura operacional, **3** mutaciones, **4** catálogo/reportes.

| Pantalla de referencia | Ruta web propuesta | Datos reutilizables | Endpoint principal | Permiso | Brecha principal | Fase |
|---|---|---|---|---|---|---:|
| Manager Login | `/login` | Supabase Auth, `User.role` | `GET /api/auth/me` | Público/autenticado | redirección y 403 por rol | 1 |
| Dashboard | `/admin` | WO, Jobs, pausas, asignaciones | `GET /api/admin/dashboard` | manager/admin | Off Duty y métricas no soportadas | 2 |
| Work Orders | `/admin/work-orders` | `WorkOrder`, Truck, categoría, Mechanics | `GET /api/admin/work-orders` | manager/admin | filtros globales/paginación | 2 |
| Work Order Detail | `/admin/work-orders/[id]` | detalle actual, Jobs, pausas, log | `GET /api/admin/work-orders/:id` | manager/admin | contrato global y acciones RBAC | 2/3 |
| Job Detail | `/admin/jobs/[id]` | `WorkOrderJob`, catálogo, WO | `GET /api/admin/jobs/:id` | manager/admin | timing por Job no existe | 2/3 |
| Correct Time | `/admin/work-orders/[id]/correct-time` | sesiones, pausas, Activity Log | `POST /api/admin/time-corrections` | manager/admin | modelo/contrato de corrección | 3 |
| Mechanics | `/admin/mechanics` | `User`, asignaciones, WO | `GET /api/admin/mechanics` | manager/admin | capacidad agregada | 2 |
| Mechanic Detail | `/admin/mechanics/[id]` | User, asignaciones, Jobs completados | `GET /api/admin/mechanics/:id` | manager/admin | métricas atribuibles | 2 |
| Trucks | `/admin/trucks` | `Truck`, WO abierta | `GET /api/admin/trucks` | manager/admin | estado Off Duty canónico | 2 |
| Truck Detail | `/admin/trucks/[id]` | Truck, WO, repair history | `GET /api/admin/trucks/:id` | manager/admin | eventos de servicio | 2/3 |
| Job Catalog | `/admin/catalog` | Category, CatalogJob, Alias | `GET /api/admin/catalog/categories` | manager/admin | conteos y contratos de gestión | 4 |
| Job Category Detail | `/admin/catalog/categories/[id]` | Category, Jobs, aliases | `GET /api/admin/catalog/categories/:id` | manager/admin | paginación/estados | 4 |
| Add Catalog Job | `/admin/catalog/jobs/new` | catálogo actual | `POST /api/admin/catalog/jobs` | manager/admin | ID canónico estable | 4 |
| Custom Jobs Review | `/admin/catalog/custom-jobs` | campos de review existentes | `GET /api/admin/catalog/custom-jobs` | manager/admin | estados y mapping transaccional | 4 |
| Job Aliases | `/admin/catalog/jobs/[id]/aliases` | `JobAlias` | `POST /api/admin/catalog/jobs/:id/aliases` | manager/admin | validación de alias normalizado | 4 |
| History | `/admin/history` | WO/Jobs completados y cancelados | `GET /api/admin/history` | manager/admin | filtros y separación legacy | 2 |
| Performance | `/admin/reports/performance` | agregados válidos de WO | `GET /api/admin/reports/performance` | manager/admin | métricas no soportadas por Job | 4 |
| Waiting by Reason | `/admin/reports/waiting-by-reason` | `PauseEvent.reason/durationMs` | endpoint homónimo | manager/admin | definición de blocker | 4 |
| Job Performance | `/admin/reports/jobs/[id]` | Jobs completados | endpoint homónimo | manager/admin | tiempo por Job no existe | 4/defer |

Todas las pantallas deben conservar el mismo árbol React entre EN y ES. El prototipo ya contiene 19 pares localizados y sirve para revisar contenido, jerarquía, empty states y navegación.

## 10. Fases de entrega

### Fase 1 — Fundación

- Guard/decorador RBAC en NestJS y pruebas de denegación.
- protección server-side de `/admin` y redirección post-login.
- inventario de primitives/patterns shadcn vigentes y ampliación compartida solo donde falten componentes.
- layout Admin responsive con navegación, construido con tokens y estilos actuales de LTL.
- infraestructura de mensajes tipados EN/ES.
- contratos base de paginación, errores y mutaciones.

Salida: Manager/Admin pueden entrar a un shell seguro; Mechanic no puede acceder.

### Fase 2 — Operación read-only

- Dashboard con métricas soportadas y procedencia documentada.
- listas/detalles de Work Orders, Trucks y Mechanics.
- History.
- búsquedas, filtros, paginación, loading, empty, error y retry.
- no mostrar Average Downtime, Off Duty Since ni Job labor si no existe evidencia.

Salida: visibilidad global útil sin mutaciones nuevas.

### Fase 3 — Administración operacional

- editar campos permitidos de Work Order.
- gestionar asignaciones.
- cancel/reopen/complete mediante reglas compartidas.
- Returned to Service separado.
- correcciones de tiempo auditables.
- versionado, idempotencia y conflictos 409.

Salida: acciones críticas con before/after y sin romper el flujo mecánico.

### Fase 4 — Catálogo y reportes

- administración de Categories, Jobs y aliases.
- cola y mapping de Custom Jobs.
- Waiting by Reason y métricas demostrables.
- Job Performance permanece deshabilitado hasta contar con tiempos atribuibles por Job.

Salida: gobernanza de catálogo y reportes basados en evidencia.

### Fase 5 — Coexistencia y retiro de Ninox

1. Inventariar integración real fuera del checkout.
2. Definir datasets y campos con propietario, dirección y frecuencia.
3. Aprobar mapping por campo y estado; lo desconocido sigue `Unknown`.
4. Crear importaciones idempotentes con checkpoints y reporte de discrepancias.
5. Ejecutar backfill y reconciliación contra conteos y muestras aprobadas.
6. Operar una ventana temporal de lectura/comparación.
7. Cortar Ninox como fuente operacional cuando los criterios se cumplan.
8. Conservar trazabilidad mediante `ninoxExternalId` donde corresponda.
9. Desactivar credenciales/jobs de Ninox y documentar recuperación/archivo.

No implementar dual-write permanente. Si la auditoría descubre escrituras existentes, congelar cambios de arquitectura hasta documentar propietario, conflicto, retry, idempotencia y procedimiento de corte.

## 11. Métricas y procedencia

Cada métrica del Dashboard o reporte debe tener una definición versionada que indique:

- entidades y estados incluidos;
- timezone (`America/New_York` para presentación; UTC en persistencia);
- rango y límites inclusivos/exclusivos;
- tratamiento de registros abiertos;
- tratamiento de `Unknown` y datos legacy;
- nivel de caché e invalidación.

No mezclar historial Ninox y datos LTL en un mismo KPI sin mapping, deduplicación y reconciliación aprobados. Los mocks del prototipo nunca son evidencia operacional.

## 12. UX y diseño

- El sistema de diseño shadcn vigente de LTL Shop Mechanics es la única fuente de primitives, tokens y estilos para Shop Admin.
- Reutilizar primero los componentes exportados por `apps/web/src/components/ui.tsx`, incluidos Button, Input, Textarea, Label, Select, Card, Badge y Dialog, además de los patterns compartidos de loading, error y navegación existentes.
- Crear nuevos primitives shadcn compartidos solamente cuando no exista un equivalente adecuado; no construir copias locales por pantalla ni controles raw si existe un primitive apropiado.
- Usar exclusivamente las variables semánticas de `globals.css` y sus mappings de Tailwind. No introducir colores hex/OKLCH aislados en pantallas Admin ni copiar los tokens navy/amber del prototipo.
- Conservar Inter, JetBrains Mono, radios, sombras, focus ring, light/dark theme y densidad visual actual. No sustituirlos por Geist u otra tipografía del prototipo.
- Usar Lucide mediante `lucide-react`; no copiar SVGs decorativos ni mezclar familias de iconos.
- Tratar el prototipo Shop únicamente como referencia de información, orden, prioridades, estados y composición general. La apariencia final debe sentirse como una extensión nativa de LTL Shop Mechanics.
- Antes de diseñar el shell Admin, revisar los componentes y estilos más recientes de la rama objetivo. Si existen cambios de diseño pendientes en otra PR, integrar o esperar esa fuente antes de duplicar patrones.
- Manager es desktop-first, pero debe ser utilizable en pantallas pequeñas.
- Breakpoints de QA: 390×844, 834×1194 y 1440×1024.
- Targets interactivos mínimos de 44 px.
- focus visible, labels semánticos, encabezados y tablas accesibles.
- Las tablas anchas desplazan dentro de su contenedor, nunca el documento completo.
- Todo estado de carga debe terminar en contenido, empty state o error con Retry; no dejar skeleton indefinido.
- La revisión visual debe comparar Shop Admin con pantallas LTL existentes en el mismo viewport, además de comprobar cobertura funcional contra el prototipo.

## 13. Seguridad y fallas

- Autorización server-side en todas las lecturas y escrituras Admin.
- Allowlist de campos editables; no aceptar nombres arbitrarios de columna.
- No incluir tokens, passwords ni payloads sensibles completos en logs.
- Errores de Ninox no impiden operar datos ya autoritativos en Supabase.
- Timeout o retry no puede duplicar una mutación.
- Un conflicto nunca sobrescribe silenciosamente a otro usuario.
- Cancelación/desactivación es soft state; no DELETE físico de entidades operativas.
- Activity Log es inmutable desde la UI.

## 14. Plan de pruebas y aceptación

### Autorización

- `mechanic` recibe 403 en cada endpoint `/api/admin/*` y no ve datos Admin.
- `mechanic` no accede a `/admin` mediante URL directa, navegación o caché.
- `manager` y `admin` acceden a las capacidades permitidas.
- usuario inactivo o sin sesión no accede.

### Datos y dominio

- listados globales paginan y filtran sin omitir/duplicar elementos.
- KPIs concuerdan con fixtures o consultas SQL controladas.
- `Unknown` se excluye de cálculos que requieren Off Duty confirmado.
- Work Order-level time nunca se presenta como Job-level time.
- edición con versión obsoleta devuelve 409.
- retry con la misma idempotency key no duplica cambios.
- cada mutación sensible crea exactamente un Activity Log con actor y before/after.

### Regresión del mecánico

- creación estándar sigue separada de Start Work.
- no se agregan Jobs duplicados.
- pausa inválida sigue bloqueada.
- completar Job no termina la Work Order.
- flujo PM sigue autorizado exclusivamente por `pmAuthorized` y conserva sus requisitos de millaje/partes.

### UI e idiomas

- EN/ES usan el mismo árbol de componentes y controles.
- términos canónicos permanecen iguales.
- las pantallas reutilizan primitives shadcn compartidos y no duplican controles o tokens por ruta.
- light/dark theme conserva contraste, estados y focus con los tokens vigentes de LTL.
- no hay overflow de documento en 390×844, 834×1194 o 1440×1024.
- focus, labels, tablas, errores y Retry son accesibles.

### Coexistencia Ninox

- una caída de Ninox no corrompe ni bloquea la operación autoritativa en Supabase.
- importación repetida es idempotente.
- discrepancias producen reporte revisable; no se resuelven sobrescribiendo en silencio.
- conteos, IDs externos y muestras aprobadas coinciden antes del corte.

### Comandos mínimos por lote

Desde la raíz de LTL Shop Mechanics:

```bash
npm run lint
npm run test --workspace=@ltl-shop/api
npm run test --workspace=@ltl-shop/web
npm run build
git diff --check
```

Cuando haya rutas Admin funcionales, añadir E2E con usuarios fixture `mechanic`, `manager` y `admin`, incluyendo los tres viewports requeridos. Las migraciones deben probarse sobre una base aislada con `DATABASE_URL` y `DIRECT_URL` explícitos.

## 15. Instrucciones para el siguiente agente

1. Verificar branch, `git status`, PR abiertos y estado actual de los archivos citados.
2. Leer primero las fuentes de LTL y después el PRD/prototipo Shop.
3. Tratar este documento como blueprint; si contradice comportamiento actual probado, conservar el comportamiento y actualizar el blueprint con evidencia.
4. Implementar una fase por rama/worktree y entregar commits pequeños y revisables.
5. Empezar por RBAC; no crear páginas Admin que dependan de seguridad solo del cliente.
6. No copiar HTML, CSS, tokens, fuentes ni primitives del prototipo. Reusar su contenido y jerarquía mediante los componentes shadcn y estilos vigentes del sistema real.
7. No inventar mappings Ninox, estados Off Duty, timestamps, métricas, relaciones ni capacidades de escritura.
8. Etiquetar claramente datos legacy, importados, mock, parciales o `Unknown`.
9. No introducir dual-write sin una decisión arquitectónica nueva, evidencia del sistema externo y plan de recuperación.
10. No modificar los flujos estándar o PM como efecto colateral de Shop Admin.
11. Actualizar `docs/CURRENT_PRODUCT_STATUS.md` cuando una fase esté realmente implementada y validada.
12. No declarar completa una fase por pasar lint/build únicamente; validar autorización, API, UI, responsive y el flujo end-to-end correspondiente.

## 16. Definition of Done global

Shop Admin se considera integrado cuando:

- las 19 pantallas tienen una decisión explícita: implementada, adaptada o diferida con razón;
- Manager y Admin operan bajo RBAC probado;
- Mechanic no puede acceder a datos o comandos administrativos;
- las métricas publicadas son reconstruibles desde datos reales;
- mutaciones sensibles son idempotentes, concurrent-safe y auditables;
- EN/ES comparten estructura;
- los flujos existentes del mecánico y PM no presentan regresiones;
- la coexistencia con Ninox tiene inventario, mappings, reconciliación y criterio de corte;
- Supabase queda documentado como fuente operacional final;
- Ninox puede retirarse sin perder trazabilidad ni historia aprobada.
