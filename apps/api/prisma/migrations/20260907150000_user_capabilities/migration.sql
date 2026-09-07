CREATE TYPE "AppCapability" AS ENUM ('admin.access', 'mechanic.standard', 'mechanic.pm');

CREATE TABLE "user_capabilities" (
    "user_id" UUID NOT NULL,
    "capability" "AppCapability" NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by_id" UUID,

    CONSTRAINT "user_capabilities_pkey" PRIMARY KEY ("user_id", "capability")
);

CREATE INDEX "user_capabilities_capability_idx" ON "user_capabilities"("capability");
CREATE INDEX "user_capabilities_granted_by_id_idx" ON "user_capabilities"("granted_by_id");

ALTER TABLE "user_capabilities"
  ADD CONSTRAINT "user_capabilities_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_capabilities"
  ADD CONSTRAINT "user_capabilities_granted_by_id_fkey"
  FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "user_capabilities" ("user_id", "capability")
SELECT "id", 'admin.access'::"AppCapability"
FROM "users"
WHERE "active" = true AND "role" IN ('manager', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO "user_capabilities" ("user_id", "capability")
SELECT "id", 'mechanic.standard'::"AppCapability"
FROM "users"
WHERE "active" = true AND "role" = 'mechanic' AND "pm_authorized" = false
ON CONFLICT DO NOTHING;

INSERT INTO "user_capabilities" ("user_id", "capability")
SELECT "id", 'mechanic.pm'::"AppCapability"
FROM "users"
WHERE "active" = true AND "pm_authorized" = true
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  configured_count integer;
  user_count integer;
  is_supabase boolean;
BEGIN
  SELECT COUNT(*) INTO user_count FROM "users";
  SELECT COUNT(*) INTO configured_count
  FROM "users"
  WHERE lower("email") IN ('ibrain@ltransl.com', 'cristian240588@hotmail.com');
  SELECT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
  ) INTO is_supabase;

  -- Empty databases and populated plain-Postgres demo databases can migrate
  -- before their local seed runs. A populated Supabase database, or any
  -- database containing one approved profile, must contain the complete pair.
  IF configured_count <> 2
     AND (configured_count > 0 OR (is_supabase AND user_count > 0)) THEN
    RAISE EXCEPTION 'Expected both approved multi-workspace Shop profiles; found % of 2', configured_count;
  END IF;
END $$;

UPDATE "users"
SET "role" = 'admin', "active" = true
WHERE lower("email") IN ('ibrain@ltransl.com', 'cristian240588@hotmail.com');

INSERT INTO "user_capabilities" ("user_id", "capability")
SELECT "id", capability
FROM "users"
CROSS JOIN unnest(ARRAY[
  'admin.access'::"AppCapability",
  'mechanic.standard'::"AppCapability",
  'mechanic.pm'::"AppCapability"
]) AS capability
WHERE lower("email") IN ('ibrain@ltransl.com', 'cristian240588@hotmail.com')
ON CONFLICT DO NOTHING;

ALTER TABLE "user_capabilities" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE "user_capabilities" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE "user_capabilities" FROM authenticated';
  END IF;
END $$;
