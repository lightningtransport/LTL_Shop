-- D47 / HU-M20 (LTR-246): why an adjustment moved the shelf. Nullable: purchases, Jobs, returns and reversals have none.
CREATE TYPE "stock_adjust_reason" AS ENUM ('count', 'received', 'damaged', 'lost', 'other');

ALTER TABLE "stock_movements" ADD COLUMN "reason_code" "stock_adjust_reason";

-- Counts written before D47 were the only adjustments: they are counts.
UPDATE "stock_movements" SET "reason_code" = 'count' WHERE "kind" = 'adjust';
