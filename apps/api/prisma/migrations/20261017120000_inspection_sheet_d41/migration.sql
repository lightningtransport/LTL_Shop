-- D41: the inspection sheet (53 checks, 10 tires), its editable list, tire readings and the common
-- Work Order Job source (also used by Samsara S-6, D42). Additive only.

-- CreateEnum
CREATE TYPE "inspection_section" AS ENUM ('interior', 'engine', 'exterior');

-- CreateEnum
CREATE TYPE "inspection_item_result" AS ENUM ('ok', 'defect', 'na');

-- CreateEnum
CREATE TYPE "tire_position" AS ENUM ('LF', 'RF', 'LFO', 'LFI', 'RFI', 'RFO', 'LRO', 'LRI', 'RRI', 'RRO');

-- CreateEnum
CREATE TYPE "tire_reading_status" AS ENUM ('ok', 'watch', 'fix');

-- CreateEnum
CREATE TYPE "work_order_job_source_kind" AS ENUM ('inspection_item', 'tire_reading', 'samsara_fault');

-- AlterEnum
ALTER TYPE "AppCapability" ADD VALUE IF NOT EXISTS 'inspection.perform';

-- AlterEnum


ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'inspection_saved';
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'inspection_defects_added';
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'inspection_checklist_updated';

-- CreateTable
CREATE TABLE "inspection_checklist_items" (
    "id" UUID NOT NULL,
    "section" "inspection_section" NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "catalog_job_id" UUID,
    "workflow_step_key" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "seed_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "inspection_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "steer_target_psi" INTEGER NOT NULL DEFAULT 110,
    "drive_target_psi" INTEGER NOT NULL DEFAULT 95,
    "steer_min_tread" INTEGER NOT NULL DEFAULT 4,
    "drive_min_tread" INTEGER NOT NULL DEFAULT 2,
    "watch_pct" INTEGER NOT NULL DEFAULT 10,
    "fix_pct" INTEGER NOT NULL DEFAULT 20,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "truck_inspections" (
    "id" UUID NOT NULL,
    "truck_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "work_order_id" UUID,
    "inspected_by_id" UUID NOT NULL,
    "inspected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mileage" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "truck_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "truck_inspection_items" (
    "id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "checklist_item_id" UUID,
    "section" "inspection_section" NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "catalog_job_id" UUID,
    "workflow_step_key" TEXT,
    "result" "inspection_item_result" NOT NULL,
    "note" TEXT,
    "added_later_at" TIMESTAMP(3),
    "added_later_by_id" UUID,

    CONSTRAINT "truck_inspection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tire_readings" (
    "id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "truck_id" UUID NOT NULL,
    "position" "tire_position" NOT NULL,
    "psi" INTEGER NOT NULL,
    "tread" INTEGER NOT NULL,
    "target_psi" INTEGER NOT NULL,
    "min_tread" INTEGER NOT NULL,
    "status" "tire_reading_status" NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tire_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_job_sources" (
    "id" UUID NOT NULL,
    "work_order_job_id" UUID NOT NULL,
    "kind" "work_order_job_source_kind" NOT NULL,
    "inspection_item_id" UUID,
    "tire_reading_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,

    CONSTRAINT "work_order_job_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inspection_checklist_items_seed_key_key" ON "inspection_checklist_items"("seed_key");

-- CreateIndex
CREATE INDEX "inspection_checklist_items_section_active_sort_order_idx" ON "inspection_checklist_items"("section", "active", "sort_order");

-- CreateIndex
CREATE INDEX "inspection_checklist_items_catalog_job_id_idx" ON "inspection_checklist_items"("catalog_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "truck_inspections_assessment_id_key" ON "truck_inspections"("assessment_id");

-- CreateIndex
CREATE INDEX "truck_inspections_truck_id_inspected_at_idx" ON "truck_inspections"("truck_id", "inspected_at");

-- CreateIndex
CREATE INDEX "truck_inspections_work_order_id_idx" ON "truck_inspections"("work_order_id");

-- CreateIndex
CREATE INDEX "truck_inspection_items_inspection_id_result_idx" ON "truck_inspection_items"("inspection_id", "result");

-- CreateIndex
CREATE UNIQUE INDEX "truck_inspection_items_inspection_id_checklist_item_id_key" ON "truck_inspection_items"("inspection_id", "checklist_item_id");

-- CreateIndex
CREATE INDEX "tire_readings_truck_id_position_read_at_idx" ON "tire_readings"("truck_id", "position", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "tire_readings_inspection_id_position_key" ON "tire_readings"("inspection_id", "position");

-- CreateIndex
CREATE INDEX "work_order_job_sources_inspection_item_id_idx" ON "work_order_job_sources"("inspection_item_id");

-- CreateIndex
CREATE INDEX "work_order_job_sources_tire_reading_id_idx" ON "work_order_job_sources"("tire_reading_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_job_sources_work_order_job_id_inspection_item_id_key" ON "work_order_job_sources"("work_order_job_id", "inspection_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_job_sources_work_order_job_id_tire_reading_id_key" ON "work_order_job_sources"("work_order_job_id", "tire_reading_id");

-- AddForeignKey
ALTER TABLE "inspection_checklist_items" ADD CONSTRAINT "inspection_checklist_items_catalog_job_id_fkey" FOREIGN KEY ("catalog_job_id") REFERENCES "catalog_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_checklist_items" ADD CONSTRAINT "inspection_checklist_items_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_settings" ADD CONSTRAINT "inspection_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_inspections" ADD CONSTRAINT "truck_inspections_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_inspections" ADD CONSTRAINT "truck_inspections_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "truck_readiness_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_inspections" ADD CONSTRAINT "truck_inspections_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_inspections" ADD CONSTRAINT "truck_inspections_inspected_by_id_fkey" FOREIGN KEY ("inspected_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_inspection_items" ADD CONSTRAINT "truck_inspection_items_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "truck_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_inspection_items" ADD CONSTRAINT "truck_inspection_items_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "inspection_checklist_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_inspection_items" ADD CONSTRAINT "truck_inspection_items_catalog_job_id_fkey" FOREIGN KEY ("catalog_job_id") REFERENCES "catalog_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_inspection_items" ADD CONSTRAINT "truck_inspection_items_added_later_by_id_fkey" FOREIGN KEY ("added_later_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tire_readings" ADD CONSTRAINT "tire_readings_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "truck_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tire_readings" ADD CONSTRAINT "tire_readings_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_job_sources" ADD CONSTRAINT "work_order_job_sources_work_order_job_id_fkey" FOREIGN KEY ("work_order_job_id") REFERENCES "work_order_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_job_sources" ADD CONSTRAINT "work_order_job_sources_inspection_item_id_fkey" FOREIGN KEY ("inspection_item_id") REFERENCES "truck_inspection_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_job_sources" ADD CONSTRAINT "work_order_job_sources_tire_reading_id_fkey" FOREIGN KEY ("tire_reading_id") REFERENCES "tire_readings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_job_sources" ADD CONSTRAINT "work_order_job_sources_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A checklist item creates a catalog Job or adds a note to a mandatory step: exactly one of the two.
ALTER TABLE "inspection_checklist_items" ADD CONSTRAINT "inspection_checklist_items_target_check"
  CHECK (("catalog_job_id" IS NULL) <> ("workflow_step_key" IS NULL));
ALTER TABLE "truck_inspection_items" ADD CONSTRAINT "truck_inspection_items_target_check"
  CHECK (("catalog_job_id" IS NULL) <> ("workflow_step_key" IS NULL));
ALTER TABLE "truck_inspection_items" ADD CONSTRAINT "truck_inspection_items_note_check"
  CHECK ("result" <> 'defect' OR length(trim(coalesce("note", ''))) > 0);

-- Tire readings and limits are positive numbers.
ALTER TABLE "tire_readings" ADD CONSTRAINT "tire_readings_values_check"
  CHECK ("psi" >= 0 AND "tread" >= 0 AND "target_psi" > 0 AND "min_tread" >= 0);
ALTER TABLE "inspection_settings" ADD CONSTRAINT "inspection_settings_values_check"
  CHECK ("id" = 1 AND "steer_target_psi" > 0 AND "drive_target_psi" > 0 AND "steer_min_tread" >= 0
    AND "drive_min_tread" >= 0 AND "watch_pct" > 0 AND "fix_pct" > "watch_pct");

-- Exactly one source id per row, matching its kind. Samsara S-6 widens this when it adds samsara_fault_id.
ALTER TABLE "work_order_job_sources" ADD CONSTRAINT "work_order_job_sources_one_source_check"
  CHECK (
    ("kind" = 'inspection_item' AND "inspection_item_id" IS NOT NULL AND "tire_reading_id" IS NULL)
    OR ("kind" = 'tire_reading' AND "tire_reading_id" IS NOT NULL AND "inspection_item_id" IS NULL)
  );

-- The shop's tire limits (D41): 110 / 95 PSI, 4/32 and 2/32 tread, watch at 10 %, fix at 20 %.
INSERT INTO "inspection_settings" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
