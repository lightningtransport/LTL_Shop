-- D45 / ST-5 (LTR-225, P29): a completed PM takes its parts off the shelf (when they are there) and charges the
-- truck a flat oil change price. Additive.
ALTER TABLE "stock_movements" ADD COLUMN "pm_service_id" UUID;
CREATE INDEX "stock_movements_pm_service_id_idx" ON "stock_movements"("pm_service_id");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_pm_service_id_fkey" FOREIGN KEY ("pm_service_id") REFERENCES "pm_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "pm_oil_prices" (
    "id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pm_oil_prices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pm_oil_prices_effective_from_key" ON "pm_oil_prices"("effective_from");
ALTER TABLE "pm_oil_prices" ADD CONSTRAINT "pm_oil_prices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
