-- LTR-200 / D32 (PC-3): outside shop invoices for a truck, optionally tied to the Job sent out (D24). Additive only.
-- CreateTable
CREATE TABLE "outside_repairs" (
    "id" UUID NOT NULL,
    "truck_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "invoice_norm" TEXT NOT NULL,
    "invoice_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "work_order_id" UUID,
    "work_order_job_id" UUID,
    "external_kind" "job_external_kind",
    "notes" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "voided_at" TIMESTAMP(3),
    "voided_by_id" UUID,
    "void_reason" TEXT,

    CONSTRAINT "outside_repairs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outside_repairs_idempotency_key_key" ON "outside_repairs"("idempotency_key");

-- CreateIndex
CREATE INDEX "outside_repairs_truck_id_invoice_date_idx" ON "outside_repairs"("truck_id", "invoice_date");

-- CreateIndex
CREATE INDEX "outside_repairs_vendor_id_invoice_norm_idx" ON "outside_repairs"("vendor_id", "invoice_norm");

-- CreateIndex
CREATE INDEX "outside_repairs_work_order_job_id_idx" ON "outside_repairs"("work_order_job_id");

-- AddForeignKey
ALTER TABLE "outside_repairs" ADD CONSTRAINT "outside_repairs_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outside_repairs" ADD CONSTRAINT "outside_repairs_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outside_repairs" ADD CONSTRAINT "outside_repairs_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outside_repairs" ADD CONSTRAINT "outside_repairs_work_order_job_id_fkey" FOREIGN KEY ("work_order_job_id") REFERENCES "work_order_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outside_repairs" ADD CONSTRAINT "outside_repairs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outside_repairs" ADD CONSTRAINT "outside_repairs_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- D-PC8: one invoice number per vendor among the outside repairs not voided (purchases are checked by the API too).
CREATE UNIQUE INDEX "outside_repairs_vendor_invoice_open_key" ON "outside_repairs" ("vendor_id", "invoice_norm") WHERE "voided_at" IS NULL;
ALTER TABLE "outside_repairs" ADD CONSTRAINT "outside_repairs_amount_check" CHECK ("amount_cents" >= 0);
