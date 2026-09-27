-- LTR-156 / D15, D16: shop workflow configuration (step -> catalog Job -> default mechanic).
-- Additive. Schema only: no runtime reads it until LTR-157 (PR 7).
-- step_key is text (values from ShopWorkflowStepKey in @ltl-shop/shared) so steps can be added later.
CREATE TABLE IF NOT EXISTS "shop_workflow_steps" (
    "id" UUID NOT NULL,
    "step_key" TEXT NOT NULL,
    "catalog_job_id" UUID NOT NULL,
    "default_mechanic_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_workflow_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shop_workflow_steps_step_key_key" ON "shop_workflow_steps"("step_key");

DO $$ BEGIN
  ALTER TABLE "shop_workflow_steps" ADD CONSTRAINT "shop_workflow_steps_catalog_job_id_fkey" FOREIGN KEY ("catalog_job_id") REFERENCES "catalog_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shop_workflow_steps" ADD CONSTRAINT "shop_workflow_steps_default_mechanic_id_fkey" FOREIGN KEY ("default_mechanic_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shop_workflow_steps" ADD CONSTRAINT "shop_workflow_steps_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed the four mandatory steps that MANDATORY_WORK_PLAN_JOBS defines today, with no default mechanic.
-- Catalog ids differ per environment, so each step resolves its Job by the stable catalog names.
-- An environment without the catalog row gets no step (prisma/seed.ts fills it for local databases).
INSERT INTO "shop_workflow_steps" ("id", "step_key", "catalog_job_id", "sort_order")
SELECT gen_random_uuid(), seed."step_key", catalog."id", seed."sort_order"
FROM (VALUES
  ('pm', 'PM', 'PM A Service', 10),
  ('alignment', 'Suspension & Steering', 'Alignment', 20),
  ('detailing', 'Detailing', 'Detailing', 30),
  ('quality_check', 'Quality Check', 'Quality Check', 40)
) AS seed("step_key", "category_name", "job_name", "sort_order")
JOIN LATERAL (
  SELECT cj."id"
  FROM "catalog_jobs" cj
  JOIN "job_categories" jc ON jc."id" = cj."category_id"
  WHERE cj."display_name" = seed."job_name" AND cj."status" = 'active'
    AND jc."name" = seed."category_name" AND jc."status" = 'active'
  ORDER BY cj."created_at"
  LIMIT 1
) catalog ON TRUE
ON CONFLICT ("step_key") DO NOTHING;
