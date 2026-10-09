-- LTR-200 / D32 (PC-1): Parts & costs base — vendors, part cost and usual vendor, invoice files and the Truck cost
-- ledger (written from PC-2 on). Additive only: new enums, new tables, new nullable columns, new enum values.
-- CreateEnum
CREATE TYPE "part_source" AS ENUM ('seed', 'app');

-- CreateEnum
CREATE TYPE "attachment_owner_type" AS ENUM ('part_purchase', 'outside_repair', 'internal_invoice');

-- CreateEnum
CREATE TYPE "truck_cost_kind" AS ENUM ('part_purchase', 'outside_repair', 'labor', 'internal_invoice');

-- AlterEnum


ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'vendor_saved';
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'part_catalog_updated';
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'part_purchase_saved';
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'part_purchase_voided';
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'outside_repair_saved';
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'outside_repair_voided';

-- AlterTable
ALTER TABLE "parts" ADD COLUMN     "default_vendor_id" UUID,
ADD COLUMN     "source" "part_source" NOT NULL DEFAULT 'seed',
ADD COLUMN     "unit_cost_cents" INTEGER;

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "does_parts" BOOLEAN NOT NULL DEFAULT true,
    "does_repairs" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "email" TEXT,
    "account_number" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "object_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "owner_type" "attachment_owner_type",
    "owner_id" UUID,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "truck_cost_entries" (
    "id" UUID NOT NULL,
    "truck_id" UUID NOT NULL,
    "kind" "truck_cost_kind" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "occurred_on" DATE NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "work_order_id" UUID,
    "vendor_id" UUID,
    "description" TEXT NOT NULL,
    "reverses_entry_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "truck_cost_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachments_owner_type_owner_id_idx" ON "attachments"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "truck_cost_entries_truck_id_occurred_on_idx" ON "truck_cost_entries"("truck_id", "occurred_on");

-- CreateIndex
CREATE INDEX "truck_cost_entries_source_type_source_id_idx" ON "truck_cost_entries"("source_type", "source_id");

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_default_vendor_id_fkey" FOREIGN KEY ("default_vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_cost_entries" ADD CONSTRAINT "truck_cost_entries_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_cost_entries" ADD CONSTRAINT "truck_cost_entries_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_cost_entries" ADD CONSTRAINT "truck_cost_entries_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_cost_entries" ADD CONSTRAINT "truck_cost_entries_reverses_entry_id_fkey" FOREIGN KEY ("reverses_entry_id") REFERENCES "truck_cost_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_cost_entries" ADD CONSTRAINT "truck_cost_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A vendor name is unique without caring about capitals or spaces at the ends ("fleetpride" = "FleetPride").
CREATE UNIQUE INDEX "vendors_name_lower_key" ON "vendors" (lower(btrim("name")));
-- Money is whole cents and never negative on a reference cost.
ALTER TABLE "parts" ADD CONSTRAINT "parts_unit_cost_cents_check" CHECK ("unit_cost_cents" IS NULL OR "unit_cost_cents" >= 0);
