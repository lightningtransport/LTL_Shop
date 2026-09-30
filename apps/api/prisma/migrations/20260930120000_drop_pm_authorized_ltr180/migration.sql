-- LTR-180: `users.pm_authorized` never granted anything; `mechanic.pm` in
-- user_capabilities is the only PM authority (LTR-95 / LTR-146). The API,
-- seeds and DTOs stopped reading and writing the column in this release, so
-- the column goes. Irreversible: the value is derivable from user_capabilities.
ALTER TABLE "users" DROP COLUMN IF EXISTS "pm_authorized";
