-- Additive: optional per-Job mechanic assignment. Nullable column keeps all
-- historical Work Order Jobs valid; no data is rewritten or dropped.
ALTER TABLE "work_order_jobs" ADD COLUMN IF NOT EXISTS "assigned_mechanic_id" UUID;

ALTER TABLE "work_order_jobs"
  ADD CONSTRAINT "work_order_jobs_assigned_mechanic_id_fkey"
  FOREIGN KEY ("assigned_mechanic_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "work_order_jobs_assigned_mechanic_id_idx"
  ON "work_order_jobs" ("assigned_mechanic_id");
