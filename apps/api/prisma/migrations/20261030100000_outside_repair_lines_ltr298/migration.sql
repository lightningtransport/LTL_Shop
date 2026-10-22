-- LTR-298: the jobs on an outside shop's invoice, one row each. Additive only: repairs saved before keep their
-- description and amount and read as one line.
CREATE TABLE "outside_repair_lines" (
    "id" UUID NOT NULL,
    "repair_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "outside_repair_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outside_repair_lines_repair_id_idx" ON "outside_repair_lines"("repair_id");

ALTER TABLE "outside_repair_lines" ADD CONSTRAINT "outside_repair_lines_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "outside_repairs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
