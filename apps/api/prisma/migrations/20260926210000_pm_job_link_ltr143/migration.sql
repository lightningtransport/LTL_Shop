-- LTR-141 / LTR-143: PM as a Job inside the truck's single Work Order.
-- Additive and nullable. Legacy PM Work Orders keep work_order_job_id NULL.

-- When the PM job was started (its end is completed_at).
ALTER TABLE "work_order_jobs" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3);

-- Link a PM service to its PM job (one PM service per job; one per Work Order stays).
ALTER TABLE "pm_services" ADD COLUMN IF NOT EXISTS "work_order_job_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "pm_services_work_order_job_id_key" ON "pm_services"("work_order_job_id");

DO $$ BEGIN
  ALTER TABLE "pm_services"
    ADD CONSTRAINT "pm_services_work_order_job_id_fkey"
    FOREIGN KEY ("work_order_job_id") REFERENCES "work_order_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
