-- LTR-153 / D17, D18: per-mechanic labor and per-Job blockers.
-- Additive. Schema only: no runtime reads or writes these columns until LTR-154 (PR 4) and LTR-155 (PR 5).
-- PauseReason is untouched; it stays for the Manager's official Work Order pause.
DO $$ BEGIN
  CREATE TYPE "blocker_reason" AS ENUM ('waiting_for_parts', 'waiting_for_approval', 'waiting_for_vendor', 'waiting_for_equipment', 'waiting_for_bay', 'waiting_for_driver', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- D18: labor is per mechanic. Nullable so historical sessions stay valid.
ALTER TABLE "work_sessions" ADD COLUMN IF NOT EXISTS "user_id" UUID;

CREATE INDEX IF NOT EXISTS "work_sessions_work_order_id_user_id_idx" ON "work_sessions"("work_order_id", "user_id");

DO $$ BEGIN
  ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- D17: a blocker always belongs to one Job. Nullable for official pauses and historical rows.
ALTER TABLE "pause_events" ADD COLUMN IF NOT EXISTS "job_id" UUID;
ALTER TABLE "pause_events" ADD COLUMN IF NOT EXISTS "blocker_reason" "blocker_reason";

CREATE INDEX IF NOT EXISTS "pause_events_job_id_idx" ON "pause_events"("job_id");

DO $$ BEGIN
  ALTER TABLE "pause_events" ADD CONSTRAINT "pause_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "work_order_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
