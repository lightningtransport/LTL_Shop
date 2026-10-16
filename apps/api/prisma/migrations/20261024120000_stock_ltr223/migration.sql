-- D45 / ST-3 (LTR-223): the Shop's stock. A purchase line without a truck goes to stock or is a Shop supply; the
-- stock is a list of movements that is only added to. Lines saved before have no truck = Shop supplies (P25: the
-- Manager counts what is there by hand, nothing enters stock on its own).
CREATE TYPE "purchase_line_destination" AS ENUM ('truck', 'stock', 'shop_supplies');
CREATE TYPE "stock_movement_kind" AS ENUM ('purchase_in', 'issue', 'return', 'adjust', 'reversal');

ALTER TABLE "part_purchase_lines" ADD COLUMN "destination" "purchase_line_destination" NOT NULL DEFAULT 'truck';
UPDATE "part_purchase_lines" SET "destination" = 'shop_supplies' WHERE "truck_id" IS NULL;

CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "kind" "stock_movement_kind" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "value_cents" INTEGER NOT NULL,
    "purchase_id" UUID,
    "work_order_job_id" UUID,
    "truck_id" UUID,
    "reason" TEXT,
    "reverses_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_movements_part_id_created_at_idx" ON "stock_movements"("part_id", "created_at");
CREATE INDEX "stock_movements_purchase_id_idx" ON "stock_movements"("purchase_id");
CREATE INDEX "stock_movements_work_order_job_id_idx" ON "stock_movements"("work_order_job_id");
-- A movement is undone at most once.
CREATE UNIQUE INDEX "stock_movements_reverses_id_key" ON "stock_movements"("reverses_id") WHERE "reverses_id" IS NOT NULL;

ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "part_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_work_order_job_id_fkey" FOREIGN KEY ("work_order_job_id") REFERENCES "work_order_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reverses_id_fkey" FOREIGN KEY ("reverses_id") REFERENCES "stock_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
