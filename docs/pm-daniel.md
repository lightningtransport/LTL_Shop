# PM authorization and catalog

`mechanic.pm` is the persisted capability that authorizes a user to create or
perform PM Work Orders. Daniel remains PM-only, but he is no longer the only
account the application can authorize. Approved multi-workspace administrators
can also hold this capability and perform PM work under their own identity.

`pmAuthorized` remains temporarily in the database for deployment
compatibility. It is no longer the authority used by the API or web app.
Administrators without `mechanic.pm` can review PM details but cannot change
them. This is intentionally not a general mechanic-to-category assignment UI.

A later migration can remove `pmAuthorized` after production stability is
confirmed. PM part selections and observed mileage remain recorded per PM Work
Order, while every change to the truck's canonical mileage is auditable.

> **Superseded when `WORK_PLAN_PM_PHASE` is on (LTR-141, decisions D4 + D9).**
> PM becomes a mandatory Job inside the truck's single Work Order. The PM
> mechanic is assigned to the PM job, starts and finishes it with mileage and
> parts, and "Create PM service" joins the truck's open Work Order. The rules
> below describe the legacy flow (flag off), which stays for PM Work Orders
> created before the flag.

The Standard multi-Category target does not absorb PM. The Standard flow never
offers or accepts PM as a Job Category. A user who holds `mechanic.pm`, including
a multi-workspace user, must enter the specialized PM flow for mileage, parts,
automatic start, and completion rules.
