DO $$
DECLARE
  invalid_display_ids integer;
  duplicate_open_orders integer;
BEGIN
  SELECT count(*)
  INTO invalid_display_ids
  FROM "work_orders"
  WHERE "display_id" !~ '^WO-[0-9]{3,}$';

  IF invalid_display_ids > 0 THEN
    RAISE EXCEPTION
      'Cannot add work-order sequence: % display IDs do not match WO-<number>. Correct them before retrying.',
      invalid_display_ids;
  END IF;

  SELECT count(*)
  INTO duplicate_open_orders
  FROM (
    SELECT "truck_id"
    FROM "work_orders"
    WHERE "status" IN ('created', 'in_progress', 'waiting_paused')
    GROUP BY "truck_id"
    HAVING count(*) > 1
  ) AS duplicates;

  IF duplicate_open_orders > 0 THEN
    RAISE EXCEPTION
      'Cannot enforce one open work order per truck: % trucks have duplicate open orders. Resolve them before retrying.',
      duplicate_open_orders;
  END IF;
END $$;

CREATE SEQUENCE "work_order_display_id_seq";

DO $$
DECLARE
  highest_display_id bigint;
BEGIN
  SELECT COALESCE(MAX((substring("display_id" FROM '^WO-([0-9]+)$'))::bigint), 0)
  INTO highest_display_id
  FROM "work_orders";

  IF highest_display_id = 0 THEN
    PERFORM setval('"work_order_display_id_seq"', 1, false);
  ELSE
    PERFORM setval('"work_order_display_id_seq"', highest_display_id, true);
  END IF;
END $$;

CREATE UNIQUE INDEX "work_orders_one_open_per_truck_idx"
ON "work_orders" ("truck_id")
WHERE "status" IN ('created', 'in_progress', 'waiting_paused');
