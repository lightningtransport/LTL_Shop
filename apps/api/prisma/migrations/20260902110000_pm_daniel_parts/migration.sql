ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'pm_details_updated';
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'truck_mileage_corrected';

ALTER TABLE "users" ADD COLUMN "pm_authorized" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "part_categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "part_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "parts" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "part_number" TEXT,
    "display_name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "part_fitments" (
    "id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "part_fitments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pm_services" (
    "id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "observed_mileage" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pm_services_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pm_service_parts" (
    "id" UUID NOT NULL,
    "pm_service_id" UUID NOT NULL,
    "part_category_id" UUID NOT NULL,
    "part_id" UUID NOT NULL,
    CONSTRAINT "pm_service_parts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "truck_mileage_adjustments" (
    "id" UUID NOT NULL,
    "truck_id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "previous_mileage" INTEGER,
    "observed_mileage" INTEGER NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "truck_mileage_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "part_categories_slug_key" ON "part_categories"("slug");
CREATE UNIQUE INDEX "part_categories_name_key" ON "part_categories"("name");
CREATE UNIQUE INDEX "parts_category_id_part_number_display_name_key" ON "parts"("category_id", "part_number", "display_name");
CREATE INDEX "parts_category_id_active_idx" ON "parts"("category_id", "active");
CREATE INDEX "part_fitments_part_id_idx" ON "part_fitments"("part_id");
CREATE INDEX "part_fitments_make_model_idx" ON "part_fitments"("make", "model");
CREATE UNIQUE INDEX "pm_services_work_order_id_key" ON "pm_services"("work_order_id");
CREATE UNIQUE INDEX "pm_service_parts_pm_service_id_part_category_id_key" ON "pm_service_parts"("pm_service_id", "part_category_id");
CREATE INDEX "truck_mileage_adjustments_truck_id_created_at_idx" ON "truck_mileage_adjustments"("truck_id", "created_at");
CREATE INDEX "truck_mileage_adjustments_work_order_id_idx" ON "truck_mileage_adjustments"("work_order_id");

ALTER TABLE "parts" ADD CONSTRAINT "parts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "part_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "part_fitments" ADD CONSTRAINT "part_fitments_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pm_services" ADD CONSTRAINT "pm_services_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pm_service_parts" ADD CONSTRAINT "pm_service_parts_pm_service_id_fkey" FOREIGN KEY ("pm_service_id") REFERENCES "pm_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pm_service_parts" ADD CONSTRAINT "pm_service_parts_part_category_id_fkey" FOREIGN KEY ("part_category_id") REFERENCES "part_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pm_service_parts" ADD CONSTRAINT "pm_service_parts_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "truck_mileage_adjustments" ADD CONSTRAINT "truck_mileage_adjustments_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "truck_mileage_adjustments" ADD CONSTRAINT "truck_mileage_adjustments_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "truck_mileage_adjustments" ADD CONSTRAINT "truck_mileage_adjustments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
