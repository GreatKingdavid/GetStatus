-- AlterTable
ALTER TABLE "CheckResult" ADD COLUMN "dnsResolutionTime" INTEGER,
ADD COLUMN "sslExpiresAt" TIMESTAMP(3),
ADD COLUMN "sslValid" BOOLEAN;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN "expectedResponse" JSONB;

-- CreateIndex
CREATE INDEX "CheckResult_serviceId_checkedAt_idx"
ON "CheckResult"("serviceId", "checkedAt");
