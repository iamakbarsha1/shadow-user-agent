-- CreateTable
CREATE TABLE "runs" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "persona_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "error_message" TEXT,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "captured_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "report_type" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screenshots" (
    "id" UUID NOT NULL,
    "observation_id" UUID NOT NULL,
    "file_path" TEXT NOT NULL,
    "captured_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screenshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "runs_status_idx" ON "runs"("status");

-- CreateIndex
CREATE INDEX "runs_started_at_idx" ON "runs"("started_at");

-- CreateIndex
CREATE INDEX "observations_run_id_idx" ON "observations"("run_id");

-- CreateIndex
CREATE INDEX "observations_event_type_idx" ON "observations"("event_type");

-- CreateIndex
CREATE INDEX "reports_run_id_idx" ON "reports"("run_id");

-- CreateIndex
CREATE INDEX "reports_report_type_idx" ON "reports"("report_type");

-- CreateIndex
CREATE INDEX "screenshots_observation_id_idx" ON "screenshots"("observation_id");

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
