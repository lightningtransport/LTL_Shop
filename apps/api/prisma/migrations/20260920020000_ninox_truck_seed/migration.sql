-- Additive Monday-launch columns for the one-shot Ninox TrucksDB E seed.
-- NEVER DROP these columns. NEVER rewrite mileage, owner, company, make,
-- model, year, or truck_number on existing rows (the seed is insert-only).

ALTER TABLE "trucks" ADD COLUMN IF NOT EXISTS "yard_location" TEXT;
ALTER TABLE "trucks" ADD COLUMN IF NOT EXISTS "ninox_mechanic_status" TEXT;
ALTER TABLE "trucks" ADD COLUMN IF NOT EXISTS "dispatcher" TEXT;
ALTER TABLE "trucks" ADD COLUMN IF NOT EXISTS "insurance" TEXT;
ALTER TABLE "trucks" ADD COLUMN IF NOT EXISTS "license_plate" TEXT;

CREATE TABLE IF NOT EXISTS "ninox_truck_seed_runs" (
    "id" UUID NOT NULL,
    "source_table_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "records_read" INTEGER NOT NULL,
    "inserted_count" INTEGER NOT NULL,
    "skipped_count" INTEGER NOT NULL,
    "skipped_ninox_query" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ninox_truck_seed_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ninox_truck_seed_runs_status_source_table_id_idx"
    ON "ninox_truck_seed_runs"("status", "source_table_id");
