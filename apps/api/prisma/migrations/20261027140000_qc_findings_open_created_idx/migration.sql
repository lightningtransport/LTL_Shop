-- PF22 (LTR-239): Dashboard open QC findings are read by resolved_at IS NULL + created_at.

-- CreateIndex
CREATE INDEX "qc_findings_resolved_at_created_at_idx" ON "qc_findings"("resolved_at", "created_at");
