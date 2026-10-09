-- LTR-201 / D34 (LB-1): the shop's labor rate per hour, from a date. Additive only.
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'labor_rate_saved';

-- CreateTable
CREATE TABLE "labor_rates" (
    "id" UUID NOT NULL,
    "rate_cents_per_hour" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "effective_from" DATE NOT NULL,
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labor_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "labor_rates_effective_from_key" ON "labor_rates"("effective_from");

-- AddForeignKey
ALTER TABLE "labor_rates" ADD CONSTRAINT "labor_rates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "labor_rates" ADD CONSTRAINT "labor_rates_rate_check" CHECK ("rate_cents_per_hour" >= 0);
