-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('mechanic', 'manager', 'admin');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('created', 'in_progress', 'waiting_paused', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('to_do', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'normal', 'high', 'critical');

-- CreateEnum
CREATE TYPE "PauseReason" AS ENUM ('waiting_for_parts', 'waiting_for_approval', 'waiting_for_vendor', 'waiting_for_equipment', 'waiting_for_bay', 'waiting_for_driver', 'truck_unavailable', 'working_on_another_wo', 'break', 'end_of_shift', 'other');

-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('work_order_created', 'work_started', 'job_added', 'job_completed', 'job_cancelled', 'work_paused', 'pause_reason_changed', 'work_resumed', 'mechanic_added', 'mechanic_removed', 'priority_changed', 'notes_updated', 'work_order_completed', 'manager_correction');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'mechanic',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "supabase_auth_id" TEXT,
    "ninox_external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trucks" (
    "id" UUID NOT NULL,
    "truck_number" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "mileage" INTEGER,
    "company" TEXT,
    "owner" TEXT,
    "ninox_external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trucks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "ninox_external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_jobs" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "ninox_external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_aliases" (
    "id" UUID NOT NULL,
    "catalog_job_id" UUID NOT NULL,
    "alias_text" TEXT NOT NULL,
    "alias_norm" TEXT NOT NULL,

    CONSTRAINT "job_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" UUID NOT NULL,
    "display_id" TEXT NOT NULL,
    "truck_id" UUID NOT NULL,
    "primary_category_id" UUID NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'created',
    "priority" "Priority" NOT NULL DEFAULT 'normal',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "completed_by_id" UUID,
    "total_active_labor_ms" BIGINT NOT NULL DEFAULT 0,
    "total_waiting_ms" BIGINT NOT NULL DEFAULT 0,
    "idempotency_key" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "ninox_external_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_jobs" (
    "id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "catalog_job_id" UUID,
    "category_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "custom_description" TEXT,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "status" "JobStatus" NOT NULL DEFAULT 'to_do',
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by_id" UUID NOT NULL,
    "completed_at" TIMESTAMP(3),
    "completed_by_id" UUID,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_reason" TEXT,
    "mapped_catalog_job_id" UUID,
    "review_status" TEXT,
    "ninox_external_id" TEXT,

    CONSTRAINT "work_order_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_sessions" (
    "id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pause_events" (
    "id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "reason" "PauseReason" NOT NULL,
    "notes" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "duration_ms" BIGINT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pause_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mechanic_assignments" (
    "id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "mechanic_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by_id" UUID NOT NULL,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "mechanic_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "work_order_id" UUID,
    "event_type" "ActivityEventType" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "user_id" UUID NOT NULL,
    "previous_value" JSONB,
    "new_value" JSONB,
    "relevant_value" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_supabase_auth_id_key" ON "users"("supabase_auth_id");

-- CreateIndex
CREATE UNIQUE INDEX "trucks_truck_number_key" ON "trucks"("truck_number");

-- CreateIndex
CREATE INDEX "trucks_truck_number_idx" ON "trucks"("truck_number");

-- CreateIndex
CREATE UNIQUE INDEX "job_categories_name_key" ON "job_categories"("name");

-- CreateIndex
CREATE INDEX "catalog_jobs_category_id_status_idx" ON "catalog_jobs"("category_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "job_aliases_alias_norm_key" ON "job_aliases"("alias_norm");

-- CreateIndex
CREATE INDEX "job_aliases_catalog_job_id_idx" ON "job_aliases"("catalog_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_display_id_key" ON "work_orders"("display_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_idempotency_key_key" ON "work_orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");

-- CreateIndex
CREATE INDEX "work_orders_truck_id_status_idx" ON "work_orders"("truck_id", "status");

-- CreateIndex
CREATE INDEX "work_orders_created_by_id_idx" ON "work_orders"("created_by_id");

-- CreateIndex
CREATE INDEX "work_order_jobs_work_order_id_status_idx" ON "work_order_jobs"("work_order_id", "status");

-- CreateIndex
CREATE INDEX "work_sessions_work_order_id_idx" ON "work_sessions"("work_order_id");

-- CreateIndex
CREATE INDEX "pause_events_work_order_id_idx" ON "pause_events"("work_order_id");

-- CreateIndex
CREATE INDEX "mechanic_assignments_mechanic_id_idx" ON "mechanic_assignments"("mechanic_id");

-- CreateIndex
CREATE UNIQUE INDEX "mechanic_assignments_work_order_id_mechanic_id_key" ON "mechanic_assignments"("work_order_id", "mechanic_id");

-- CreateIndex
CREATE INDEX "activity_logs_work_order_id_created_at_idx" ON "activity_logs"("work_order_id", "created_at");

-- AddForeignKey
ALTER TABLE "catalog_jobs" ADD CONSTRAINT "catalog_jobs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "job_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_jobs" ADD CONSTRAINT "catalog_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_aliases" ADD CONSTRAINT "job_aliases_catalog_job_id_fkey" FOREIGN KEY ("catalog_job_id") REFERENCES "catalog_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_primary_category_id_fkey" FOREIGN KEY ("primary_category_id") REFERENCES "job_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_jobs" ADD CONSTRAINT "work_order_jobs_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_jobs" ADD CONSTRAINT "work_order_jobs_catalog_job_id_fkey" FOREIGN KEY ("catalog_job_id") REFERENCES "catalog_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_jobs" ADD CONSTRAINT "work_order_jobs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "job_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_jobs" ADD CONSTRAINT "work_order_jobs_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_jobs" ADD CONSTRAINT "work_order_jobs_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pause_events" ADD CONSTRAINT "pause_events_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pause_events" ADD CONSTRAINT "pause_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanic_assignments" ADD CONSTRAINT "mechanic_assignments_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanic_assignments" ADD CONSTRAINT "mechanic_assignments_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

