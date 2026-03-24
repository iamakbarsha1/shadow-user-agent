-- CreateTable
CREATE TABLE "usage_records" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "related_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_allocations" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "total_credits" INTEGER NOT NULL DEFAULT 500,
    "used_credits" INTEGER NOT NULL DEFAULT 0,
    "period_start" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period_end" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "credit_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_records_user_id_idx" ON "usage_records"("user_id");

-- CreateIndex
CREATE INDEX "usage_records_created_at_idx" ON "usage_records"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "credit_allocations_user_id_key" ON "credit_allocations"("user_id");

-- CreateIndex
CREATE INDEX "credit_allocations_user_id_idx" ON "credit_allocations"("user_id");
