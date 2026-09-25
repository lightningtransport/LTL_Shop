-- Activity Log events for append-only notes (enum values must be committed before use).
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'note_added';
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'work_request_handled';

-- LTR-126 / D8: Work Order notes become append-only entries with author and time.
-- A mechanic "work request" asks the Manager for additional work on the Truck.
DO $$ BEGIN
  CREATE TYPE "WorkOrderNoteKind" AS ENUM ('note', 'work_request');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "work_order_notes" (
    "id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "kind" "WorkOrderNoteKind" NOT NULL DEFAULT 'note',
    "body" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handled_at" TIMESTAMP(3),
    "handled_by_id" UUID,

    CONSTRAINT "work_order_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "work_order_notes_work_order_id_created_at_idx" ON "work_order_notes"("work_order_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "work_order_notes" ADD CONSTRAINT "work_order_notes_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "work_order_notes" ADD CONSTRAINT "work_order_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "work_order_notes" ADD CONSTRAINT "work_order_notes_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill: the current shared notes text becomes the first entry of each Work Order.
-- Author and time come from the last notes edit when there is one, otherwise the creator.
-- work_orders.notes is kept (not dropped) so this migration is reversible.
INSERT INTO "work_order_notes" ("id", "work_order_id", "kind", "body", "author_id", "created_at")
SELECT gen_random_uuid(), wo."id", 'note', btrim(wo."notes"),
       COALESCE(last_edit."user_id", wo."created_by_id"),
       COALESCE(last_edit."created_at", wo."created_at")
FROM "work_orders" wo
LEFT JOIN LATERAL (
  SELECT al."user_id", al."created_at"
  FROM "activity_logs" al
  WHERE al."work_order_id" = wo."id" AND al."event_type" = 'notes_updated'
  ORDER BY al."created_at" DESC
  LIMIT 1
) last_edit ON TRUE
WHERE wo."notes" IS NOT NULL AND btrim(wo."notes") <> ''
  AND NOT EXISTS (SELECT 1 FROM "work_order_notes" n WHERE n."work_order_id" = wo."id");
