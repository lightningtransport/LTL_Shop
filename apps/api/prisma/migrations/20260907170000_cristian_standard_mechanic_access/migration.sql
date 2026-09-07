DO $$
DECLARE
  target_user_id UUID;
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM "users";
  SELECT "id" INTO target_user_id
  FROM "users"
  WHERE lower("email") = 'cristian@ltransl.com';

  IF target_user_id IS NULL THEN
    IF user_count > 0 THEN
      RAISE EXCEPTION 'Expected mechanic profile cristian@ltransl.com';
    END IF;
    RETURN;
  END IF;

  UPDATE "users"
  SET "role" = 'mechanic',
      "active" = true,
      "pm_authorized" = false
  WHERE "id" = target_user_id;

  DELETE FROM "user_capabilities"
  WHERE "user_id" = target_user_id
    AND "capability" <> 'mechanic.standard'::"AppCapability";

  INSERT INTO "user_capabilities" ("user_id", "capability")
  VALUES (target_user_id, 'mechanic.standard'::"AppCapability")
  ON CONFLICT DO NOTHING;
END $$;
