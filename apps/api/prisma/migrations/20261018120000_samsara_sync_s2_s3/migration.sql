-- D35 / D42, Samsara S-2 + S-3 (OPEN_ISSUES §1x): odometer, location and faults written by the Samsara sync.
-- Additive only. The sync never writes trucks.mileage nor the Ninox columns (samsara_id, samsara_truck_location,
-- samsara_last_connected_date).

-- CreateEnum
CREATE TYPE "truck_fault_protocol" AS ENUM ('j1939', 'obdii');

-- CreateEnum
CREATE TYPE "truck_fault_severity" AS ENUM ('stop', 'warning', 'check_engine', 'pending', 'info');

-- AlterTable
ALTER TABLE "trucks" ADD COLUMN     "samsara_address" TEXT,
ADD COLUMN     "samsara_latitude" DOUBLE PRECISION,
ADD COLUMN     "samsara_location_at" TIMESTAMP(3),
ADD COLUMN     "samsara_longitude" DOUBLE PRECISION,
ADD COLUMN     "samsara_odometer_at" TIMESTAMP(3),
ADD COLUMN     "samsara_odometer_miles" INTEGER,
ADD COLUMN     "samsara_odometer_source" TEXT,
ADD COLUMN     "samsara_speed_mph" DOUBLE PRECISION,
ADD COLUMN     "samsara_synced_at" TIMESTAMP(3),
ADD COLUMN     "samsara_vehicle_id" TEXT;

-- CreateTable
CREATE TABLE "truck_faults" (
    "id" UUID NOT NULL,
    "truck_id" UUID NOT NULL,
    "fault_key" TEXT NOT NULL,
    "protocol" "truck_fault_protocol" NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "truck_fault_severity" NOT NULL,
    "spn_id" INTEGER,
    "fmi_id" INTEGER,
    "dtc_short_code" TEXT,
    "source_name" TEXT,
    "occurrence_count" INTEGER,
    "first_seen_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "cleared_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "truck_faults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "samsara_sync_state" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "last_run_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "last_error" TEXT,
    "last_trigger" TEXT,
    "vehicles" INTEGER NOT NULL DEFAULT 0,
    "trucks_updated" INTEGER NOT NULL DEFAULT 0,
    "faults_opened" INTEGER NOT NULL DEFAULT 0,
    "faults_cleared" INTEGER NOT NULL DEFAULT 0,
    "active_faults" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "samsara_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "truck_faults_truck_id_cleared_at_idx" ON "truck_faults"("truck_id", "cleared_at");

-- CreateIndex
CREATE INDEX "truck_faults_cleared_at_idx" ON "truck_faults"("cleared_at");

-- AddForeignKey
ALTER TABLE "truck_faults" ADD CONSTRAINT "truck_faults_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- At most one active row per truck and code; the same code after it cleared is a new row (history).
CREATE UNIQUE INDEX "truck_faults_one_active_idx" ON "truck_faults"("truck_id", "fault_key") WHERE "cleared_at" IS NULL;

ALTER TABLE "truck_faults" ADD CONSTRAINT "truck_faults_seen_check"
  CHECK ("last_seen_at" >= "first_seen_at" AND ("cleared_at" IS NULL OR "cleared_at" >= "first_seen_at"));
ALTER TABLE "trucks" ADD CONSTRAINT "trucks_samsara_odometer_source_check"
  CHECK ("samsara_odometer_source" IS NULL OR "samsara_odometer_source" IN ('obd', 'gps'));

-- The one sync state row.
ALTER TABLE "samsara_sync_state" ADD CONSTRAINT "samsara_sync_state_single_row_check" CHECK ("id" = 1);
INSERT INTO "samsara_sync_state" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
