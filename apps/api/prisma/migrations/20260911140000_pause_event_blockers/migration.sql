-- Additive: distinguish official Work Order pauses (Manager) from mechanic-
-- reported blockers. Default keeps every historical row as an official pause.
ALTER TABLE "pause_events"
  ADD COLUMN IF NOT EXISTS "is_official_pause" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "pause_events"
  ADD COLUMN IF NOT EXISTS "reported_by_id" UUID;

ALTER TABLE "pause_events"
  ADD CONSTRAINT "pause_events_reported_by_id_fkey"
  FOREIGN KEY ("reported_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Additive enum value for the mechanic-reported blocker Activity Log entry.
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'blocker_reported';
