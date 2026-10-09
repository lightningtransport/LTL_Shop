-- LTR-200 / D32 (PC-2): parts invoices and their lines. Additive only: two new tables and their indexes.
-- CreateTable
CREATE TABLE "part_purchases" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_norm" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "subtotal_cents" INTEGER NOT NULL,
    "tax_cents" INTEGER NOT NULL DEFAULT 0,
    "freight_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "voided_at" TIMESTAMP(3),
    "voided_by_id" UUID,
    "void_reason" TEXT,

    CONSTRAINT "part_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_purchase_lines" (
    "id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "part_id" UUID,
    "description" TEXT NOT NULL,
    "part_number" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_cost_cents" INTEGER NOT NULL,
    "line_total_cents" INTEGER NOT NULL,
    "truck_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "part_purchase_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "part_purchases_idempotency_key_key" ON "part_purchases"("idempotency_key");

-- CreateIndex
CREATE INDEX "part_purchases_invoice_date_idx" ON "part_purchases"("invoice_date");

-- CreateIndex
CREATE INDEX "part_purchases_vendor_id_invoice_norm_idx" ON "part_purchases"("vendor_id", "invoice_norm");

-- CreateIndex
CREATE INDEX "part_purchase_lines_purchase_id_idx" ON "part_purchase_lines"("purchase_id");

-- CreateIndex
CREATE INDEX "part_purchase_lines_part_id_idx" ON "part_purchase_lines"("part_id");

-- CreateIndex
CREATE INDEX "part_purchase_lines_truck_id_idx" ON "part_purchase_lines"("truck_id");

-- AddForeignKey
ALTER TABLE "part_purchases" ADD CONSTRAINT "part_purchases_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_purchases" ADD CONSTRAINT "part_purchases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_purchases" ADD CONSTRAINT "part_purchases_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_purchase_lines" ADD CONSTRAINT "part_purchase_lines_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "part_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_purchase_lines" ADD CONSTRAINT "part_purchase_lines_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_purchase_lines" ADD CONSTRAINT "part_purchase_lines_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- D-PC8: one invoice number per vendor among the purchases not voided (the API checks first; this is the net).
CREATE UNIQUE INDEX "part_purchases_vendor_invoice_open_key" ON "part_purchases" ("vendor_id", "invoice_norm") WHERE "voided_at" IS NULL;
-- Money is whole cents and never negative.
ALTER TABLE "part_purchases" ADD CONSTRAINT "part_purchases_cents_check" CHECK ("subtotal_cents" >= 0 AND "tax_cents" >= 0 AND "freight_cents" >= 0 AND "total_cents" = "subtotal_cents" + "tax_cents" + "freight_cents");
ALTER TABLE "part_purchase_lines" ADD CONSTRAINT "part_purchase_lines_amount_check" CHECK ("quantity" > 0 AND "unit_cost_cents" >= 0 AND "line_total_cents" >= 0);
