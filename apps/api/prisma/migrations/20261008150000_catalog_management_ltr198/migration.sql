-- LTR-198 / D30: the Manager manages the Job Catalog. Additive.

-- System Jobs and Categories (PM, Alignment, Detailing, Quality Check) are found by a fixed key, not by name.
ALTER TABLE "catalog_jobs" ADD COLUMN IF NOT EXISTS "system_key" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_jobs_system_key_key" ON "catalog_jobs"("system_key");
ALTER TABLE "job_categories" ADD COLUMN IF NOT EXISTS "system_key" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "job_categories_system_key_key" ON "job_categories"("system_key");

-- JC1: what the release's catalog load created, so a later load finds it again by key and never by name.
ALTER TABLE "catalog_jobs" ADD COLUMN IF NOT EXISTS "seed_key" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_jobs_seed_key_key" ON "catalog_jobs"("seed_key");
ALTER TABLE "job_categories" ADD COLUMN IF NOT EXISTS "seed_key" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "job_categories_seed_key_key" ON "job_categories"("seed_key");

-- JC3 / D-SET9: why a Category is inactive (optional, one line).
ALTER TABLE "job_categories" ADD COLUMN IF NOT EXISTS "inactive_reason" TEXT;

-- SW5: a Work Order Job made from a System Job keeps its key, so renaming the catalog Job does not move it out of
-- its Yard lane or its Shop workflow step.
ALTER TABLE "work_order_jobs" ADD COLUMN IF NOT EXISTS "system_key" TEXT;

-- The step Jobs, by the Shop workflow (ids differ per environment).
UPDATE "catalog_jobs" cj SET "system_key" = CASE s."step_key" WHEN 'pm' THEN 'pm_a' ELSE s."step_key" END
FROM "shop_workflow_steps" s
WHERE s."catalog_job_id" = cj."id" AND cj."system_key" IS NULL;

-- PM B Service lives next to PM A in the PM Category.
UPDATE "catalog_jobs" cj SET "system_key" = 'pm_b'
FROM "job_categories" jc
WHERE jc."id" = cj."category_id" AND jc."name" = 'PM' AND cj."display_name" = 'PM B Service' AND cj."system_key" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "catalog_jobs" x WHERE x."system_key" = 'pm_b');

-- System Categories: PM, Detailing and Quality Check (Alignment lives in Suspension & Steering, a normal Category).
UPDATE "job_categories" jc SET "system_key" = k."key"
FROM (VALUES ('pm', 'pm_a'), ('detailing', 'detailing'), ('quality_check', 'quality_check')) AS k("key", "job_key"),
     "catalog_jobs" cj
WHERE cj."system_key" = k."job_key" AND cj."category_id" = jc."id" AND jc."system_key" IS NULL;

UPDATE "work_order_jobs" j SET "system_key" = cj."system_key"
FROM "catalog_jobs" cj
WHERE j."catalog_job_id" = cj."id" AND cj."system_key" IS NOT NULL AND j."system_key" IS NULL AND j."helper_of_job_id" IS NULL;

-- JC3: the two Categories LTR-24 merged into others say so.
UPDATE "job_categories" SET "inactive_reason" = 'Merged into Suspension & Steering (LTR-24)'
WHERE "name" = 'Alignment' AND "status" = 'inactive' AND "inactive_reason" IS NULL;
UPDATE "job_categories" SET "inactive_reason" = 'Merged into Air & Brake System (LTR-24)'
WHERE "name" = 'Air System' AND "status" = 'inactive' AND "inactive_reason" IS NULL;

-- JC5: aliases ignore accents ("líneas" = "lineas"). Recompute alias_norm the way the API now normalizes and drop the
-- near-duplicates that become the same (the oldest row of each Job wins; a clash between two Jobs keeps the first).
CREATE TEMP TABLE "alias_renorm" AS
SELECT "id", "catalog_job_id",
       regexp_replace(translate(lower("alias_text"), 'áàâäãåéèêëíìîïóòôöõúùûüñç', 'aaaaaaeeeeiiiiooooouuuunc'), '[^a-z0-9]', '', 'g') AS "norm",
       row_number() OVER (
         PARTITION BY regexp_replace(translate(lower("alias_text"), 'áàâäãåéèêëíìîïóòôöõúùûüñç', 'aaaaaaeeeeiiiiooooouuuunc'), '[^a-z0-9]', '', 'g')
         ORDER BY "alias_norm" = regexp_replace(translate(lower("alias_text"), 'áàâäãåéèêëíìîïóòôöõúùûüñç', 'aaaaaaeeeeiiiiooooouuuunc'), '[^a-z0-9]', '', 'g') DESC, "id"
       ) AS "rank"
FROM "job_aliases";
DELETE FROM "job_aliases" a USING "alias_renorm" r WHERE r."id" = a."id" AND (r."rank" > 1 OR r."norm" = '');
UPDATE "job_aliases" a SET "alias_norm" = r."norm" FROM "alias_renorm" r WHERE r."id" = a."id" AND a."alias_norm" <> r."norm";
DROP TABLE "alias_renorm";

-- SW5: every Work Order Job made from a catalog Job gets that Job's system key, whichever code path creates it or
-- switches it (PM A ↔ PM B). A helper Job ("… · helper") is work of its own and gets none.
CREATE OR REPLACE FUNCTION "work_order_jobs_copy_system_key"() RETURNS trigger AS $$
BEGIN
  IF NEW."helper_of_job_id" IS NOT NULL OR NEW."catalog_job_id" IS NULL THEN
    NEW."system_key" := NULL;
  ELSE
    SELECT cj."system_key" INTO NEW."system_key" FROM "catalog_jobs" cj WHERE cj."id" = NEW."catalog_job_id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "work_order_jobs_copy_system_key" ON "work_order_jobs";
CREATE TRIGGER "work_order_jobs_copy_system_key"
BEFORE INSERT OR UPDATE OF "catalog_job_id", "helper_of_job_id" ON "work_order_jobs"
FOR EACH ROW EXECUTE FUNCTION "work_order_jobs_copy_system_key"();
