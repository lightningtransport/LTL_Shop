-- LTR-186 / D20, D21: day close and one clock per mechanic. Additive only.
-- 1. work_sessions.end_reason: why the app closed a session (day close at the shop's cutoff, or the
--    mechanic started on another Truck). Existing closes stay NULL.
-- 2. shop_settings: one row with the shop hours the day close reads (17:00, Monday–Friday by default).

DO $$ BEGIN
  CREATE TYPE "work_session_end_reason" AS ENUM ('day_close', 'switched_truck');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "work_sessions" ADD COLUMN IF NOT EXISTS "end_reason" "work_session_end_reason";

CREATE INDEX IF NOT EXISTS "work_sessions_user_id_ended_at_idx" ON "work_sessions"("user_id", "ended_at");

CREATE TABLE IF NOT EXISTS "shop_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "day_close_minutes" INTEGER NOT NULL DEFAULT 1020,
    "workdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "updated_by_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- The single row, so reads never fail (the API also creates it on first read).
INSERT INTO "shop_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
