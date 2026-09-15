# Documentation index

**Classification:** CANONICAL DOCUMENTATION MAP
**Updated:** 2026-09-14

This index resolves documentation authority. A document not marked canonical
does not override `LIGHTNING_SHOP_MASTER_PRD.md`, tested code, or the current
implementation summary.

## Required reading order

1. `LIGHTNING_SHOP_MASTER_PRD.md`
2. `CURRENT_PRODUCT_STATUS.md`
3. `ENGINEERING_PRACTICES.md`
4. The module-specific CURRENT or ENGINEERING document for the change.

For implementation work, also read the relevant row in
`audit/CURRENT_VS_TARGET.md` and select one task from
`IMPLEMENTATION_QUEUE.md`. For any V2 ownership work, read
`OWNERSHIP_CUTOVER_CONTRACT.md` first. Q1–Q18 are approved 2026-09-12;
V2-002 implements TARGET directly. For `apps/web` UI work, read
`design-system/README.md` (CURRENT inventory, not TARGET kit).

## Authority map

| Document | Classification | Authority | Purpose | Status |
|---|---|---|---|---|
| `LIGHTNING_SHOP_MASTER_PRD.md` | CANONICAL | Product and domain | Target product, domain rules, users, ownership direction, Yard, roadmap | ACTIVE |
| `CURRENT_PRODUCT_STATUS.md` | CURRENT STATE | Implemented behavior | What the code does at the audited commit | ACTIVE |
| `ENGINEERING_PRACTICES.md` | ENGINEERING | Technical practices | Data flow, performance, mutation, authorization, verification rules | ACTIVE |
| `PERFORMANCE.md` | ENGINEERING | Measured performance | Performance targets and historical measurements | ACTIVE |
| `DEPLOY.md` | ENGINEERING | Deployment | Prisma release and deployment safety | ACTIVE |
| `DEVELOPMENT_ROADMAP.md` | IMPLEMENTATION PLAN | Sequencing only | NOW/NEXT/LATER milestones derived from canonical target and current gaps | ACTIVE |
| `IMPLEMENTATION_QUEUE.md` | IMPLEMENTATION PLAN | Task execution | Small, scoped tasks with acceptance criteria and tests | ACTIVE |
| `OWNERSHIP_CUTOVER_CONTRACT.md` | PRODUCT DECISION CONTRACT | Approved V2 cutover | Action matrix, rollback, test plan, and Cristian Q1–Q18. Authorizes direct TARGET implementation (no W1) | ACTIVE — APPROVED 2026-09-12 |
| `AGENT_WORKFLOW.md` | ENGINEERING | Delivery process | Context, agent responsibility, and development-loop rules | ACTIVE |
| `YARD_OPERATIONS_PHASE_1_CONTRACT.md` | CURRENT STATE | Module contract | Implemented readiness Phase 1 boundary | ACTIVE |
| `LTR-34_WORK_PLAN_SLICE1_PROPOSAL.md` | PROPOSAL | Dual-run Work Plan API | LTR-34 Slice 1 hooks + TARGET derivation; awaiting PM+PD ack before merge/cutover | DRAFT |
| `pm-daniel.md` | REFERENCE | PM-specific context | PM authorization and compatibility notes | ACTIVE |
| `PRD_V1_SHIP.md` | DEPRECATED | None | Superseded V1 draft supplied during normalization | PRESERVED |
| `PRD_Lightning_Shop_Mechanic_P0.md` | HISTORICAL | None | Original mechanic P0 and obsolete Ninox-era product framing | PRESERVED |
| `SHOP_ADMIN_INTEGRATION_BLUEPRINT.md` | HISTORICAL | None | Original Shop Admin integration plan; many phases are now implemented | PRESERVED |
| `WORK_ORDER_OWNERSHIP_MIGRATION.md` | HISTORICAL | None | Original seven-slice ownership plan; slices and statuses are stale | PRESERVED |
| `DEVELOPER_HANDOFF_2026-09-10.md` | HISTORICAL | None | Point-in-time handoff | PRESERVED |
| `agents/SLICE_PROMPTS.md` | DEPRECATED | None | Prompts tied to the superseded ownership slice plan | PRESERVED |
| `audits/WORK_ORDER_MULTICATEGORY_AUDIT_2026-09-09.md` | HISTORICAL | None | Point-in-time pre-implementation audit | PRESERVED |
| `audits/WORK_ORDER_OWNERSHIP_AUDIT_2026-09-11.md` | HISTORICAL | None | Pre-migration ownership audit, obsolete after later main commits | PRESERVED |
| `audit/ux-theme/README.md` | REFERENCE | Audit evidence | UX/theme audit notes | PRESERVED |
| `audit/REPOSITORY_BASELINE.md` | REFERENCE | Audit evidence | Pre-normalization safety snapshot | ACTIVE |
| `audit/REPOSITORY_INVENTORY.md` | REFERENCE | Audit evidence | Application, data, tests, docs, and tooling inventory | ACTIVE |
| `audit/CURRENT_VS_TARGET.md` | REFERENCE | Gap control | Mandatory CURRENT/TARGET separation | ACTIVE |
| `audit/CODE_CLEANUP_CANDIDATES.md` | REFERENCE | Cleanup triage | Non-destructive code and artifact candidates | ACTIVE |
| `audit/GIT_BRANCH_AUDIT.md` | REFERENCE | Git triage | Conservative local/remote branch classification | ACTIVE |
| `audit/BASELINE_VERIFICATION.md` | REFERENCE | Verification evidence | Commands, outcomes, failures, and blockers | ACTIVE |
| `audit/V1_000_DEPLOYMENT_INVESTIGATION.md` | REFERENCE | Release evidence | Root cause, production gate status, and required V1-000 action | ACTIVE |
| `audit/V1_003_RELEASE_SMOKE.md` | REFERENCE | Release evidence | Production smoke checklist, deployment ids, health probes, and operator-required remaining rows | ACTIVE |
| `audit/NORMALIZATION_REPORT.md` | REFERENCE | Handoff | Final normalization result and next task | ACTIVE |
| `audit/CAPABILITY_BOUNDARY_AUDIT.md` | AUDIT EVIDENCE | V1-004 authorization matrix | Declared vs enforced vs V1 expected capabilities for Admin, Work Order, and Yard mutations | ACTIVE |
| `audit/V2_1_001_YARD_PHASE_PERSISTENCE_GAP.md` | PRODUCT DECISION / AUDIT | V2.1-001 Yard Phase | Derivation cases and no-go on `YardPhaseEvent` until a live Operational Yard pilot answers the product questions | ACTIVE |
| `audit/TRUCK_IDENTITY_AND_MILEAGE_CURRENT.md` | CURRENT STATE / AUDIT | Truck search + identity | How truck search, miles, owners, make/model/year, and company work TODAY. Samsara/McLeod stay out of the path | ACTIVE |
| `Lightning_Shop_Documentation_Package_2026-09-09/00_INDEX.md` | HISTORICAL | None | Index of the superseded dated package | PRESERVED |
| `Lightning_Shop_Documentation_Package_2026-09-09/01_PRODUCT_DIRECTION_AND_DOMAIN_MODEL.md` | HISTORICAL | None | Earlier product/domain direction | PRESERVED |
| `Lightning_Shop_Documentation_Package_2026-09-09/02_DEVELOPMENT_PLAN.md` | HISTORICAL | None | Earlier development plan | PRESERVED |
| `Lightning_Shop_Documentation_Package_2026-09-09/03_WORK_ORDER_EVOLUTION_PLAN.md` | HISTORICAL | None | Earlier Work Order evolution plan | PRESERVED |
| `Lightning_Shop_Documentation_Package_2026-09-09/04_YARD_OPERATIONS_READINESS_TRUCK_DETAIL.md` | HISTORICAL | None | Earlier Yard/Readiness plan | PRESERVED |
| `Lightning_Shop_Documentation_Package_2026-09-09/05_CODEX_PROMPTS.md` | DEPRECATED | None | Historical implementation prompts | PRESERVED |
| `Lightning_Shop_Documentation_Package_2026-09-09/06_FLEETIO_BENCHMARK_AND_SCOPE_FILTER.md` | REFERENCE | None | Competitor benchmark; not a feature backlog | PRESERVED |
| `design-system/README.md` | CURRENT STATE | Implemented UI inventory | Tokens, direct shadcn modules, loading/empty/failure rules, EN/ES glossary | ACTIVE |
| `README.md` | REFERENCE | Repository onboarding | Setup, stack, commands, and links to authoritative docs | ACTIVE |
| `.github/pull_request_template.md` | ENGINEERING | Review process | Verification and data-flow review checklist | ACTIVE |

## Precedence

1. Product TARGET: `LIGHTNING_SHOP_MASTER_PRD.md`.
2. Product CURRENT: tested code plus `CURRENT_PRODUCT_STATUS.md`.
3. Technical rules: Prisma migrations, `ENGINEERING_PRACTICES.md`,
   `PERFORMANCE.md`, and `DEPLOY.md`.
4. Sequencing: `DEVELOPMENT_ROADMAP.md` and `IMPLEMENTATION_QUEUE.md`.
5. Everything marked historical, deprecated, or reference is non-authoritative.

When code and `CURRENT_PRODUCT_STATUS.md` disagree, code is the implementation
truth and the status document must be corrected in the same stabilization task.
