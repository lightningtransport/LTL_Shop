-- D46 / SQ-3 (LTR-232): a Job source of kind qc_finding points to exactly one Safety finding. Its own migration:
-- Postgres does not let the transaction that added the enum value ('qc_finding') use it.
ALTER TABLE "work_order_job_sources" DROP CONSTRAINT "work_order_job_sources_one_source_check";
ALTER TABLE "work_order_job_sources" ADD CONSTRAINT "work_order_job_sources_one_source_check"
  CHECK (
    ("kind" = 'inspection_item' AND "inspection_item_id" IS NOT NULL AND "tire_reading_id" IS NULL AND "truck_fault_id" IS NULL AND "qc_finding_id" IS NULL)
    OR ("kind" = 'tire_reading' AND "tire_reading_id" IS NOT NULL AND "inspection_item_id" IS NULL AND "truck_fault_id" IS NULL AND "qc_finding_id" IS NULL)
    OR ("kind" = 'samsara_fault' AND "truck_fault_id" IS NOT NULL AND "inspection_item_id" IS NULL AND "tire_reading_id" IS NULL AND "qc_finding_id" IS NULL)
    OR ("kind" = 'qc_finding' AND "qc_finding_id" IS NOT NULL AND "inspection_item_id" IS NULL AND "tire_reading_id" IS NULL AND "truck_fault_id" IS NULL)
  );
