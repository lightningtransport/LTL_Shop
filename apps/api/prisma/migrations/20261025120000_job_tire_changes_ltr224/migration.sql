-- D45 / ST-4 (LTR-224): the tire to put at each position on the Tires Job the inspection created (steer New, drive
-- Recap proposed). Confirming takes it from the stock; with none on the shelf it stays "to buy". Additive.
CREATE TABLE "job_tire_changes" (
    "id" UUID NOT NULL,
    "work_order_job_id" UUID NOT NULL,
    "tire_reading_id" UUID,
    "position" "tire_position" NOT NULL,
    "tire_type" "tire_type" NOT NULL,
    "part_id" UUID,
    "stock_movement_id" UUID,
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_tire_changes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_tire_changes_stock_movement_id_key" ON "job_tire_changes"("stock_movement_id");
CREATE UNIQUE INDEX "job_tire_changes_work_order_job_id_position_key" ON "job_tire_changes"("work_order_job_id", "position");

ALTER TABLE "job_tire_changes" ADD CONSTRAINT "job_tire_changes_work_order_job_id_fkey" FOREIGN KEY ("work_order_job_id") REFERENCES "work_order_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_tire_changes" ADD CONSTRAINT "job_tire_changes_tire_reading_id_fkey" FOREIGN KEY ("tire_reading_id") REFERENCES "tire_readings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_tire_changes" ADD CONSTRAINT "job_tire_changes_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_tire_changes" ADD CONSTRAINT "job_tire_changes_stock_movement_id_fkey" FOREIGN KEY ("stock_movement_id") REFERENCES "stock_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_tire_changes" ADD CONSTRAINT "job_tire_changes_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
