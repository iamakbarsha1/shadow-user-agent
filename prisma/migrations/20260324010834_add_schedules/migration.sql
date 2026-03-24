-- CreateTable
CREATE TABLE "schedules" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "persona_id" TEXT NOT NULL,
    "cron_expression" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "generate_tests" BOOLEAN NOT NULL DEFAULT false,
    "last_run_at" TIMESTAMPTZ(3),
    "next_run_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedules_enabled_idx" ON "schedules"("enabled");
