-- Additive: introduce the Manager capability. Enum value add only; never drop.
ALTER TYPE "AppCapability" ADD VALUE IF NOT EXISTS 'work_orders.manage';
