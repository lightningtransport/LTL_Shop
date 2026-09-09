-- Add Job retries are stored independently of Work Order creation idempotency.
CREATE TABLE "work_order_mutations" (
  "idempotency_key" TEXT NOT NULL,
  "work_order_id" UUID NOT NULL,
  "operation" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "actor_id" UUID NOT NULL,
  "result" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "work_order_mutations_pkey" PRIMARY KEY ("idempotency_key")
);

CREATE INDEX "work_order_mutations_work_order_id_created_at_idx"
  ON "work_order_mutations"("work_order_id", "created_at");

CREATE INDEX "work_order_mutations_work_order_id_operation_payload_hash_idx"
  ON "work_order_mutations"("work_order_id", "operation", "payload_hash");

ALTER TABLE "work_order_mutations"
  ADD CONSTRAINT "work_order_mutations_work_order_id_fkey"
  FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
