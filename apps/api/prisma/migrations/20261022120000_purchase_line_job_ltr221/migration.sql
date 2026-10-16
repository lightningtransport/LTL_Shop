-- D45 / ST-1 (LTR-221): a purchase line can name the Job of its truck it was bought for. Additive: old lines stay NULL.
ALTER TABLE "part_purchase_lines" ADD COLUMN "work_order_job_id" UUID;

CREATE INDEX "part_purchase_lines_work_order_job_id_idx" ON "part_purchase_lines"("work_order_job_id");

ALTER TABLE "part_purchase_lines" ADD CONSTRAINT "part_purchase_lines_work_order_job_id_fkey" FOREIGN KEY ("work_order_job_id") REFERENCES "work_order_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
