-- LTR-35: seed Detailing category + catalog job for Work Plan auto-Ready.
-- Idempotent. Does not delete Work Orders, categories, or catalog jobs.
-- Labels EN/ES stay 'Detailing' (PO 2026-09-14); do not translate.
-- Catalog UUIDs are per-environment; stable keys are category.name + job.display_name.

INSERT INTO job_categories (id, name, status, sort_order, created_at, updated_at)
SELECT gen_random_uuid(), 'Detailing', 'active', 14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM job_categories WHERE name = 'Detailing'
);

UPDATE job_categories
SET status = 'active',
    sort_order = 14,
    updated_at = CURRENT_TIMESTAMP
WHERE name = 'Detailing';

UPDATE job_categories
SET sort_order = 15,
    updated_at = CURRENT_TIMESTAMP
WHERE name = 'Other'
  AND sort_order <> 15;

UPDATE catalog_jobs job
SET category_id = category.id, status = 'active', updated_at = CURRENT_TIMESTAMP
FROM job_categories category
WHERE job.display_name = 'Detailing'
  AND category.name = 'Detailing'
  AND job.category_id <> category.id;

INSERT INTO catalog_jobs (id, category_id, display_name, status, created_at, updated_at)
SELECT gen_random_uuid(), category.id, 'Detailing', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM job_categories category
WHERE category.name = 'Detailing'
  AND NOT EXISTS (
    SELECT 1
    FROM catalog_jobs job
    WHERE job.category_id = category.id
      AND job.display_name = 'Detailing'
  );

UPDATE catalog_jobs job
SET status = 'active', updated_at = CURRENT_TIMESTAMP
FROM job_categories category
WHERE category.name = 'Detailing'
  AND job.category_id = category.id
  AND job.display_name = 'Detailing'
  AND job.status <> 'active';

INSERT INTO job_aliases (id, catalog_job_id, alias_text, alias_norm)
SELECT gen_random_uuid(), job.id, 'Detailing', 'detailing'
FROM catalog_jobs job
JOIN job_categories category ON category.id = job.category_id
WHERE category.name = 'Detailing'
  AND job.display_name = 'Detailing'
ON CONFLICT (alias_norm) DO UPDATE
SET alias_text = EXCLUDED.alias_text,
    catalog_job_id = EXCLUDED.catalog_job_id;
