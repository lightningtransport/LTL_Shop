-- LTR-201 / D34 (LB-2): internal invoices to Finance, per truck and month, built from the cost ledger. Additive only.
-- CreateEnum
CREATE TYPE "internal_invoice_status" AS ENUM ('draft', 'sent', 'accepted', 'void');

-- AlterEnum


ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'internal_invoice_sent';
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'internal_invoice_accepted';
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'internal_invoice_voided';

-- CreateTable
CREATE TABLE "internal_invoices" (
    "id" UUID NOT NULL,
    "number" TEXT,
    "truck_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "internal_invoice_status" NOT NULL DEFAULT 'draft',
    "subtotal_parts_cents" INTEGER NOT NULL DEFAULT 0,
    "subtotal_outside_cents" INTEGER NOT NULL DEFAULT 0,
    "subtotal_labor_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "sent_by_id" UUID,
    "accepted_at" TIMESTAMP(3),
    "accepted_by_id" UUID,
    "voided_at" TIMESTAMP(3),
    "voided_by_id" UUID,
    "void_reason" TEXT,

    CONSTRAINT "internal_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_invoice_lines" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "cost_entry_id" UUID NOT NULL,
    "kind" "truck_cost_kind" NOT NULL,
    "description" TEXT NOT NULL,
    "occurred_on" DATE NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "internal_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_invoices_number_key" ON "internal_invoices"("number");

-- CreateIndex
CREATE INDEX "internal_invoices_truck_id_period_start_idx" ON "internal_invoices"("truck_id", "period_start");

-- CreateIndex
CREATE INDEX "internal_invoices_status_idx" ON "internal_invoices"("status");

-- CreateIndex
CREATE INDEX "internal_invoice_lines_invoice_id_idx" ON "internal_invoice_lines"("invoice_id");

-- CreateIndex
CREATE INDEX "internal_invoice_lines_cost_entry_id_idx" ON "internal_invoice_lines"("cost_entry_id");

-- AddForeignKey
ALTER TABLE "internal_invoices" ADD CONSTRAINT "internal_invoices_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_invoices" ADD CONSTRAINT "internal_invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_invoices" ADD CONSTRAINT "internal_invoices_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_invoices" ADD CONSTRAINT "internal_invoices_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_invoices" ADD CONSTRAINT "internal_invoices_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_invoice_lines" ADD CONSTRAINT "internal_invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "internal_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_invoice_lines" ADD CONSTRAINT "internal_invoice_lines_cost_entry_id_fkey" FOREIGN KEY ("cost_entry_id") REFERENCES "truck_cost_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A ledger row is charged once: on at most one invoice that is not voided.
CREATE UNIQUE INDEX "internal_invoice_lines_cost_entry_active_key" ON "internal_invoice_lines" ("cost_entry_id") WHERE "active";
