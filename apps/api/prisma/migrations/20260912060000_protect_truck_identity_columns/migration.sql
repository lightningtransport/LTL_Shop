-- Protect live Truck identity columns that already exist in production.
-- Production public.trucks already has samsara_id (numeric),
-- samsara_last_connected_date (date), samsara_truck_location (text), and vin (text).
-- This migration is additive and idempotent so prisma migrate deploy is safe on
-- both fresh local/CI databases and the live Shop database.
-- NEVER DROP these columns. NEVER rewrite mileage, owner, company, make, model,
-- year, or truck_number.

ALTER TABLE "trucks" ADD COLUMN IF NOT EXISTS "samsara_id" DECIMAL;
ALTER TABLE "trucks" ADD COLUMN IF NOT EXISTS "samsara_last_connected_date" DATE;
ALTER TABLE "trucks" ADD COLUMN IF NOT EXISTS "samsara_truck_location" TEXT;
ALTER TABLE "trucks" ADD COLUMN IF NOT EXISTS "vin" TEXT;
