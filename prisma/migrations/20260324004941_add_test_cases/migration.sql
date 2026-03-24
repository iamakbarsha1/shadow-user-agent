-- CreateTable
CREATE TABLE "test_cases" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "test_code" TEXT NOT NULL,
    "framework" TEXT NOT NULL DEFAULT 'playwright',
    "status" TEXT NOT NULL DEFAULT 'generated',
    "last_run_at" TIMESTAMPTZ(3),
    "last_result" JSONB,
    "selector_map" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_cases_run_id_idx" ON "test_cases"("run_id");

-- CreateIndex
CREATE INDEX "test_cases_status_idx" ON "test_cases"("status");

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
