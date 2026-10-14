-- D42 / S-6 (OPEN_ISSUES §1x): Samsara faults become recommended Jobs. Additive only.

-- AlterTable
ALTER TABLE "truck_faults" ADD COLUMN     "came_back_work_order_id" UUID,
ADD COLUMN     "dismiss_reason" TEXT,
ADD COLUMN     "dismissed_at" TIMESTAMP(3),
ADD COLUMN     "dismissed_by_id" UUID;

-- AlterTable
ALTER TABLE "work_order_job_sources" ADD COLUMN     "truck_fault_id" UUID;

-- CreateTable
CREATE TABLE "samsara_fault_code_jobs" (
    "id" UUID NOT NULL,
    "code_key" TEXT NOT NULL,
    "catalog_job_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "samsara_fault_code_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "samsara_fault_code_jobs_code_key_key" ON "samsara_fault_code_jobs"("code_key");

-- CreateIndex
CREATE INDEX "work_order_job_sources_truck_fault_id_idx" ON "work_order_job_sources"("truck_fault_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_job_sources_work_order_job_id_truck_fault_id_key" ON "work_order_job_sources"("work_order_job_id", "truck_fault_id");

-- AddForeignKey
ALTER TABLE "truck_faults" ADD CONSTRAINT "truck_faults_dismissed_by_id_fkey" FOREIGN KEY ("dismissed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_faults" ADD CONSTRAINT "truck_faults_came_back_work_order_id_fkey" FOREIGN KEY ("came_back_work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_job_sources" ADD CONSTRAINT "work_order_job_sources_truck_fault_id_fkey" FOREIGN KEY ("truck_fault_id") REFERENCES "truck_faults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samsara_fault_code_jobs" ADD CONSTRAINT "samsara_fault_code_jobs_catalog_job_id_fkey" FOREIGN KEY ("catalog_job_id") REFERENCES "catalog_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samsara_fault_code_jobs" ADD CONSTRAINT "samsara_fault_code_jobs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A dismissal has its reason; a reason only with a dismissal.
ALTER TABLE "truck_faults" ADD CONSTRAINT "truck_faults_dismiss_check"
  CHECK (("dismissed_at" IS NULL) = ("dismiss_reason" IS NULL) AND ("dismiss_reason" IS NULL OR length(trim("dismiss_reason")) > 0));

-- Exactly one source id per row, matching its kind (widens the D41 check with the Samsara fault).
ALTER TABLE "work_order_job_sources" DROP CONSTRAINT "work_order_job_sources_one_source_check";
ALTER TABLE "work_order_job_sources" ADD CONSTRAINT "work_order_job_sources_one_source_check"
  CHECK (
    ("kind" = 'inspection_item' AND "inspection_item_id" IS NOT NULL AND "tire_reading_id" IS NULL AND "truck_fault_id" IS NULL)
    OR ("kind" = 'tire_reading' AND "tire_reading_id" IS NOT NULL AND "inspection_item_id" IS NULL AND "truck_fault_id" IS NULL)
    OR ("kind" = 'samsara_fault' AND "truck_fault_id" IS NOT NULL AND "inspection_item_id" IS NULL AND "tire_reading_id" IS NULL)
  );
