-- Activity Log event for resolving a blocker (enum value must be committed before use).
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'blocker_resolved';

-- LTR-98 / D3: mechanic-reported blockers stay active until resolved.
-- Additive and nullable; official pauses keep using ended_at.
ALTER TABLE "pause_events" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP(3);
ALTER TABLE "pause_events" ADD COLUMN IF NOT EXISTS "resolved_by_id" UUID;

DO $$ BEGIN
  ALTER TABLE "pause_events"
    ADD CONSTRAINT "pause_events_resolved_by_id_fkey"
    FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- History: blockers on Work Orders that are already closed are resolved at close time.
-- Blockers on open Work Orders stay active (D3).
UPDATE "pause_events" pe
SET "resolved_at" = COALESCE(wo."completed_at", wo."updated_at")
FROM "work_orders" wo
WHERE pe."work_order_id" = wo."id"
  AND pe."is_official_pause" = false
  AND pe."resolved_at" IS NULL
  AND wo."status" IN ('completed', 'cancelled');
