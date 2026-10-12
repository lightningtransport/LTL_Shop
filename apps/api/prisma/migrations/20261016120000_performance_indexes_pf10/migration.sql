-- PF10 (OPEN_ISSUES §1s): indexes on the columns the hot paths filter or sort by. Indexes only; no column changes.
-- work_orders: default sort of the mechanic list, the Dashboard queue and the Admin list; Dashboard counts and History.
CREATE INDEX "work_orders_updated_at_idx" ON "work_orders"("updated_at");
CREATE INDEX "work_orders_status_completed_at_idx" ON "work_orders"("status", "completed_at");
-- work_sessions: closeDue reads the open sessions before every mechanic read.
CREATE INDEX "work_sessions_ended_at_idx" ON "work_sessions"("ended_at");
-- truck_cost_entries: the ledger's "not reversed" check and the per-Work-Order / per-vendor lookups.
CREATE INDEX "truck_cost_entries_reverses_entry_id_idx" ON "truck_cost_entries"("reverses_entry_id");
CREATE INDEX "truck_cost_entries_work_order_id_idx" ON "truck_cost_entries"("work_order_id");
CREATE INDEX "truck_cost_entries_vendor_id_idx" ON "truck_cost_entries"("vendor_id");
-- activity_logs: Quality Check history by user; outside repairs by entity and event.
CREATE INDEX "activity_logs_user_id_created_at_idx" ON "activity_logs"("user_id", "created_at");
CREATE INDEX "activity_logs_entity_type_event_type_created_at_idx" ON "activity_logs"("entity_type", "event_type", "created_at");
-- work_order_jobs: mechanic detail (completed by), Custom Jobs inbox, Jobs at an external shop.
CREATE INDEX "work_order_jobs_completed_by_id_idx" ON "work_order_jobs"("completed_by_id");
CREATE INDEX "work_order_jobs_is_custom_review_status_idx" ON "work_order_jobs"("is_custom", "review_status");
CREATE INDEX "work_order_jobs_external_since_idx" ON "work_order_jobs"("external_since");
-- work_order_notes: open work requests on the Dashboard.
CREATE INDEX "work_order_notes_kind_handled_at_idx" ON "work_order_notes"("kind", "handled_at");
-- pause_events: active mechanic-reported blockers.
CREATE INDEX "pause_events_work_order_id_is_official_pause_resolved_at_idx" ON "pause_events"("work_order_id", "is_official_pause", "resolved_at");
