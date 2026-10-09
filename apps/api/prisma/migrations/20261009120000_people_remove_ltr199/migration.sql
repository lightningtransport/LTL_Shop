-- LTR-199 / D31: "Remove from Shop" keeps the person's history. Additive.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "removed_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "removed_by_id" UUID;
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_removed_by_id_fkey" FOREIGN KEY ("removed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
