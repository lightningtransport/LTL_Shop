-- Additive Truck operational-status events. Off Duty mutations and downtime
-- metrics stay out of this migration.
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'truck_returned_to_service';

CREATE TYPE "TruckServiceStatus" AS ENUM ('in_service', 'off_duty');

CREATE TABLE "truck_service_status_events" (
  "id" UUID NOT NULL,
  "truck_id" UUID NOT NULL,
  "status" "TruckServiceStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "work_order_id" UUID,
  "actor_id" UUID NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "truck_service_status_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "truck_service_status_events_work_order_id_key"
  ON "truck_service_status_events"("work_order_id");
CREATE INDEX "truck_service_status_events_truck_id_occurred_at_idx"
  ON "truck_service_status_events"("truck_id", "occurred_at");
CREATE INDEX "truck_service_status_events_actor_id_idx"
  ON "truck_service_status_events"("actor_id");

ALTER TABLE "truck_service_status_events"
  ADD CONSTRAINT "truck_service_status_events_truck_id_fkey"
  FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "truck_service_status_events"
  ADD CONSTRAINT "truck_service_status_events_work_order_id_fkey"
  FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "truck_service_status_events"
  ADD CONSTRAINT "truck_service_status_events_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
