-- S3-4 (OPEN_ISSUES §1x): the truck's dash lights from Samsara. Additive only; written only by the Samsara sync.

-- AlterTable
ALTER TABLE "trucks" ADD COLUMN     "samsara_emissions_lamp" BOOLEAN,
ADD COLUMN     "samsara_lamps_at" TIMESTAMP(3),
ADD COLUMN     "samsara_protect_lamp" BOOLEAN,
ADD COLUMN     "samsara_stop_lamp" BOOLEAN,
ADD COLUMN     "samsara_warning_lamp" BOOLEAN;

