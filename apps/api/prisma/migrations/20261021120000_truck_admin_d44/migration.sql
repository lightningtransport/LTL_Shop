-- D44 (LTR-215): trucks are created, edited and deactivated in the Shop; Samsara is connected from the truck.
-- Additive only: nullable columns, no default, no backfill. The 158 trucks already paired keep `samsara_vehicle_id`.

-- AlterTable
ALTER TABLE "trucks" ADD COLUMN     "deactivated_at" TIMESTAMPTZ(3),
ADD COLUMN     "deactivated_by_id" UUID,
ADD COLUMN     "samsara_proposed_vehicle_id" TEXT,
ADD COLUMN     "samsara_vehicle_name" TEXT;

-- AddForeignKey
ALTER TABLE "trucks" ADD CONSTRAINT "trucks_deactivated_by_id_fkey" FOREIGN KEY ("deactivated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
