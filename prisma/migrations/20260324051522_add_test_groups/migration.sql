-- CreateTable
CREATE TABLE "test_groups" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "run_on_schedule" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "test_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_group_memberships" (
    "id" UUID NOT NULL,
    "test_group_id" UUID NOT NULL,
    "test_case_id" UUID NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "test_group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_groups_name_idx" ON "test_groups"("name");

-- CreateIndex
CREATE INDEX "test_group_memberships_test_group_id_idx" ON "test_group_memberships"("test_group_id");

-- CreateIndex
CREATE INDEX "test_group_memberships_test_case_id_idx" ON "test_group_memberships"("test_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_group_memberships_test_group_id_test_case_id_key" ON "test_group_memberships"("test_group_id", "test_case_id");

-- AddForeignKey
ALTER TABLE "test_group_memberships" ADD CONSTRAINT "test_group_memberships_test_group_id_fkey" FOREIGN KEY ("test_group_id") REFERENCES "test_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_group_memberships" ADD CONSTRAINT "test_group_memberships_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
