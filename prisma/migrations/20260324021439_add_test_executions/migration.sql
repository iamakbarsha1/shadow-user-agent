-- CreateTable
CREATE TABLE "test_executions" (
    "id" UUID NOT NULL,
    "test_case_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "output" TEXT,
    "diagnosis" JSONB,
    "healed_code" TEXT,
    "executed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_executions_test_case_id_idx" ON "test_executions"("test_case_id");

-- CreateIndex
CREATE INDEX "test_executions_executed_at_idx" ON "test_executions"("executed_at");

-- AddForeignKey
ALTER TABLE "test_executions" ADD CONSTRAINT "test_executions_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
