-- LTR-188 / D23, D24: helper Jobs and Jobs sent to an external shop. Additive only.
-- 1. work_order_jobs.helper_of_job_id: a helper Job points at the Job it helps (D23). Its own owner and clock.
-- 2. work_order_jobs.external_*: the Job is at an external shop while external_since is set (D24);
--    external_kind says whether the part or the whole truck went out. Status stays 'to_do'.

DO $$ BEGIN
  CREATE TYPE "job_external_kind" AS ENUM ('part', 'truck');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "work_order_jobs" ADD COLUMN IF NOT EXISTS "helper_of_job_id" UUID;
ALTER TABLE "work_order_jobs" ADD COLUMN IF NOT EXISTS "external_since" TIMESTAMP(3);
ALTER TABLE "work_order_jobs" ADD COLUMN IF NOT EXISTS "external_kind" "job_external_kind";
ALTER TABLE "work_order_jobs" ADD COLUMN IF NOT EXISTS "external_note" TEXT;
ALTER TABLE "work_order_jobs" ADD COLUMN IF NOT EXISTS "external_by_id" UUID;

CREATE INDEX IF NOT EXISTS "work_order_jobs_helper_of_job_id_idx" ON "work_order_jobs"("helper_of_job_id");

DO $$ BEGIN
  ALTER TABLE "work_order_jobs" ADD CONSTRAINT "work_order_jobs_helper_of_job_id_fkey" FOREIGN KEY ("helper_of_job_id") REFERENCES "work_order_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "work_order_jobs" ADD CONSTRAINT "work_order_jobs_external_by_id_fkey" FOREIGN KEY ("external_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
