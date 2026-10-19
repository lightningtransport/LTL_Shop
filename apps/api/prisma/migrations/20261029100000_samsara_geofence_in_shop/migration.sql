-- D49 (LTR-55): the Samsara geofence of each truck's last GPS point, and when it entered the shop geofence.
-- Written only by the Samsara sync. Display only: nothing else reads it to change work.
ALTER TABLE "trucks"
ADD COLUMN     "samsara_geofence_id" TEXT,
ADD COLUMN     "samsara_geofence_name" TEXT,
ADD COLUMN     "samsara_in_shop_since" TIMESTAMP(3);
