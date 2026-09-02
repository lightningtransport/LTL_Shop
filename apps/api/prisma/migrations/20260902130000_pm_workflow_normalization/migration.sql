-- PM is now a single service rather than a job checklist. Preserve legacy
-- records as cancelled audit history so open PM orders can finish normally.
UPDATE "work_order_jobs" AS job
SET
  "status" = 'cancelled',
  "cancelled_at" = CURRENT_TIMESTAMP,
  "cancelled_reason" = 'PM workflow normalization'
FROM "work_orders" AS work_order
JOIN "job_categories" AS category
  ON category."id" = work_order."primary_category_id"
WHERE job."work_order_id" = work_order."id"
  AND category."name" = 'PM'
  AND job."status" = 'to_do';
