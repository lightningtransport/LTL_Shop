-- D46 / SQ-3 (LTR-232): what Safety finds at the Quality Check, and the Job that takes care of it. Additive.
CREATE TYPE "qc_finding_kind" AS ENUM ('blocking', 'note');
CREATE TYPE "qc_finding_resolution" AS ENUM ('job_added', 'added_to_job', 'dismissed');
ALTER TYPE "work_order_job_source_kind" ADD VALUE 'qc_finding';

CREATE TABLE "qc_findings" (
    "id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "kind" "qc_finding_kind" NOT NULL,
    "text" TEXT NOT NULL,
    "catalog_job_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolution" "qc_finding_resolution",
    "resolved_job_id" UUID,
    "dismiss_reason" TEXT,
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "qc_findings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "qc_findings_work_order_id_resolved_at_idx" ON "qc_findings"("work_order_id", "resolved_at");

ALTER TABLE "qc_findings" ADD CONSTRAINT "qc_findings_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "qc_findings" ADD CONSTRAINT "qc_findings_catalog_job_id_fkey" FOREIGN KEY ("catalog_job_id") REFERENCES "catalog_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "qc_findings" ADD CONSTRAINT "qc_findings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "qc_findings" ADD CONSTRAINT "qc_findings_resolved_job_id_fkey" FOREIGN KEY ("resolved_job_id") REFERENCES "work_order_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "qc_findings" ADD CONSTRAINT "qc_findings_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "work_order_job_sources" ADD COLUMN "qc_finding_id" UUID;
CREATE UNIQUE INDEX "work_order_job_sources_work_order_job_id_qc_finding_id_key" ON "work_order_job_sources"("work_order_job_id", "qc_finding_id");
ALTER TABLE "work_order_job_sources" ADD CONSTRAINT "work_order_job_sources_qc_finding_id_fkey" FOREIGN KEY ("qc_finding_id") REFERENCES "qc_findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
