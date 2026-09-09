-- Idempotency records make readiness mutations safe to retry without applying
-- an operation twice. The key is intentionally global for the API surface.
CREATE TABLE "readiness_mutations" (
  "idempotency_key" TEXT NOT NULL,
  "assessment_id" UUID NOT NULL,
  "target_key" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "actor_id" UUID NOT NULL,
  "result" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "readiness_mutations_pkey" PRIMARY KEY ("idempotency_key")
);

CREATE INDEX "readiness_mutations_assessment_id_created_at_idx"
  ON "readiness_mutations"("assessment_id", "created_at");

CREATE INDEX "readiness_mutations_target_key_operation_payload_hash_idx"
  ON "readiness_mutations"("target_key", "operation", "payload_hash");

ALTER TABLE "readiness_mutations"
  ADD CONSTRAINT "readiness_mutations_assessment_id_fkey"
  FOREIGN KEY ("assessment_id") REFERENCES "truck_readiness_assessments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_orders"
  ADD COLUMN "idempotency_payload_hash" TEXT,
  ADD COLUMN "idempotency_actor_id" UUID;
