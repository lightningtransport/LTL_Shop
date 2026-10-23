-- D57 / LTR-302: the tread Watch margin moves from a constant to Setup.
ALTER TABLE "inspection_settings" ADD COLUMN "tread_watch_margin" INTEGER NOT NULL DEFAULT 2;
