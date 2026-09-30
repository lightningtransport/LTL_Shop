-- LTR-185 / D19: Safety performs the Quality Check.
ALTER TYPE "AppCapability" ADD VALUE IF NOT EXISTS 'quality_check.perform';
-- A returned Quality Check is a blocker on the QC Job with its own reason.
ALTER TYPE "blocker_reason" ADD VALUE IF NOT EXISTS 'quality_check_failed';
