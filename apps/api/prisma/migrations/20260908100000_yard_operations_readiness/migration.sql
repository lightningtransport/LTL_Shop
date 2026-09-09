-- Additive Yard Operations Phase 1 domain. Presence, location, and departure
-- data deliberately remain outside this migration.
ALTER TYPE "AppCapability" ADD VALUE IF NOT EXISTS 'yard.operations.manage';

ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'readiness_assessment_started';
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'readiness_requirement_updated';
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'readiness_approved';
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'readiness_approval_invalidated';
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'readiness_assessment_closed';

CREATE TYPE "ReadinessAssessmentStatus" AS ENUM ('under_review', 'ready', 'closed');
CREATE TYPE "ReadinessRequirementType" AS ENUM (
  'inspection',
  'required_repairs',
  'pm',
  'alignment',
  'detailing',
  'quality_check'
);
CREATE TYPE "ReadinessRequirementOutcome" AS ENUM (
  'not_evaluated',
  'required',
  'not_required',
  'completed',
  'waived'
);

CREATE TABLE "truck_readiness_assessments" (
  "id" UUID NOT NULL,
  "truck_id" UUID NOT NULL,
  "status" "ReadinessAssessmentStatus" NOT NULL DEFAULT 'under_review',
  "version" INTEGER NOT NULL DEFAULT 1,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_by_id" UUID NOT NULL,
  "ready_at" TIMESTAMP(3),
  "approved_by_id" UUID,
  "closed_at" TIMESTAMP(3),
  "closed_by_id" UUID,
  "closed_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "truck_readiness_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "readiness_requirements" (
  "id" UUID NOT NULL,
  "assessment_id" UUID NOT NULL,
  "type" "ReadinessRequirementType" NOT NULL,
  "outcome" "ReadinessRequirementOutcome" NOT NULL DEFAULT 'not_evaluated',
  "waiver_reason" TEXT,
  "evidence_work_order_id" UUID,
  "evaluated_by_id" UUID,
  "evaluated_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "readiness_requirements_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "work_orders"
  ADD COLUMN "readiness_assessment_id" UUID;

CREATE INDEX "truck_readiness_assessments_truck_id_status_idx"
  ON "truck_readiness_assessments"("truck_id", "status");
CREATE INDEX "truck_readiness_assessments_status_updated_at_idx"
  ON "truck_readiness_assessments"("status", "updated_at");
CREATE INDEX "truck_readiness_assessments_started_by_id_idx"
  ON "truck_readiness_assessments"("started_by_id");
CREATE UNIQUE INDEX "truck_readiness_assessments_active_truck_id_key"
  ON "truck_readiness_assessments"("truck_id")
  WHERE "status" IN ('under_review', 'ready');

CREATE UNIQUE INDEX "readiness_requirements_assessment_id_type_key"
  ON "readiness_requirements"("assessment_id", "type");
CREATE INDEX "readiness_requirements_assessment_id_outcome_idx"
  ON "readiness_requirements"("assessment_id", "outcome");
CREATE INDEX "readiness_requirements_evidence_work_order_id_idx"
  ON "readiness_requirements"("evidence_work_order_id");
CREATE INDEX "readiness_requirements_evaluated_by_id_idx"
  ON "readiness_requirements"("evaluated_by_id");
CREATE INDEX "work_orders_readiness_assessment_id_idx"
  ON "work_orders"("readiness_assessment_id");

ALTER TABLE "truck_readiness_assessments"
  ADD CONSTRAINT "truck_readiness_assessments_truck_id_fkey"
  FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "truck_readiness_assessments"
  ADD CONSTRAINT "truck_readiness_assessments_started_by_id_fkey"
  FOREIGN KEY ("started_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "truck_readiness_assessments"
  ADD CONSTRAINT "truck_readiness_assessments_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "truck_readiness_assessments"
  ADD CONSTRAINT "truck_readiness_assessments_closed_by_id_fkey"
  FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "readiness_requirements"
  ADD CONSTRAINT "readiness_requirements_assessment_id_fkey"
  FOREIGN KEY ("assessment_id") REFERENCES "truck_readiness_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "readiness_requirements"
  ADD CONSTRAINT "readiness_requirements_evidence_work_order_id_fkey"
  FOREIGN KEY ("evidence_work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "readiness_requirements"
  ADD CONSTRAINT "readiness_requirements_evaluated_by_id_fkey"
  FOREIGN KEY ("evaluated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "work_orders"
  ADD CONSTRAINT "work_orders_readiness_assessment_id_fkey"
  FOREIGN KEY ("readiness_assessment_id") REFERENCES "truck_readiness_assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
