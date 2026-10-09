-- LTR-57: the Custom Jobs review inbox logs its decisions. Additive only (a new Activity Log value).
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'custom_jobs_reviewed';
