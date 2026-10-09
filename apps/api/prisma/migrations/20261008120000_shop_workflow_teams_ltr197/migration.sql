-- LTR-197 / D28: each mandatory step has a team (one or more people) and a queue. Additive.
-- `shop_workflow_steps.default_mechanic_id` stays (no longer read once this ships; not dropped).

CREATE TABLE IF NOT EXISTS "shop_workflow_step_members" (
    "step_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "added_by_id" UUID,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_workflow_step_members_pkey" PRIMARY KEY ("step_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "shop_workflow_step_members_user_id_idx" ON "shop_workflow_step_members"("user_id");

DO $$ BEGIN
  ALTER TABLE "shop_workflow_step_members" ADD CONSTRAINT "shop_workflow_step_members_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "shop_workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shop_workflow_step_members" ADD CONSTRAINT "shop_workflow_step_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shop_workflow_step_members" ADD CONSTRAINT "shop_workflow_step_members_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Today's default owner becomes the step's first member: new Work Orders keep assigning to them.
INSERT INTO "shop_workflow_step_members" ("step_id", "user_id")
SELECT s."id", s."default_mechanic_id"
FROM "shop_workflow_steps" s
WHERE s."default_mechanic_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- D-SET7: Quality Check's team is every active Safety person, so nothing changes on day one.
INSERT INTO "shop_workflow_step_members" ("step_id", "user_id")
SELECT s."id", u."id"
FROM "shop_workflow_steps" s
JOIN "user_capabilities" c ON c."capability" = 'quality_check.perform'
JOIN "users" u ON u."id" = c."user_id" AND u."active" = true
WHERE s."step_key" = 'quality_check'
ON CONFLICT DO NOTHING;

-- LTR-197 / D28: the step whose team queue a Job waits in (set only for a Job born in a queue).
ALTER TABLE "work_order_jobs" ADD COLUMN IF NOT EXISTS "workflow_step_key" TEXT;
CREATE INDEX IF NOT EXISTS "work_order_jobs_workflow_step_key_idx" ON "work_order_jobs"("workflow_step_key");
-- No backfill: every team starts with at most one member (QC aside, whose Job is found by its lane), so no open
-- Job is in a queue yet. A Job gets its step key when it is created in a queue.
