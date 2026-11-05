-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'AGENCY',
    "creditBalance" INTEGER NOT NULL DEFAULT 150,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "externalEventId" TEXT,
    "scanId" TEXT,
    "pinId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevicePool" (
    "imageId" TEXT NOT NULL,
    "proxyId" TEXT NOT NULL,
    "slotIndex" SERIAL NOT NULL,
    "hardwareModel" TEXT,
    "hardwareBrand" TEXT,
    "bootstrappedAt" TIMESTAMP(3),
    "adbAddr" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownUntil" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevicePool_pkey" PRIMARY KEY ("imageId")
);

-- CreateTable
CREATE TABLE "GridScan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "targetBusiness" TEXT NOT NULL,
    "targetPlaceId" TEXT,
    "targetType" TEXT NOT NULL DEFAULT 'mobile_maps',
    "phoneBrand" TEXT NOT NULL DEFAULT 'Samsung',
    "phoneModel" TEXT NOT NULL DEFAULT 'Galaxy S23 Ultra',
    "trackAiOverviews" BOOLEAN NOT NULL DEFAULT false,
    "scheduleType" TEXT NOT NULL DEFAULT 'once',
    "scheduleCron" TEXT,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,
    "zip" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "ispId" TEXT NOT NULL,
    "gridSize" INTEGER NOT NULL DEFAULT 11,
    "spacingKm" DOUBLE PRECISION NOT NULL DEFAULT 1.60934,
    "totalPins" INTEGER NOT NULL,
    "completedPins" INTEGER NOT NULL DEFAULT 0,
    "failedPins" INTEGER NOT NULL DEFAULT 0,
    "campaignId" TEXT NOT NULL,
    "shareToken" TEXT,
    "requestKey" TEXT,
    "leadEmail" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "creditsCharged" INTEGER NOT NULL,
    "creditsRefunded" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "arp" DOUBLE PRECISION,
    "atrp" DOUBLE PRECISION,
    "solv" DOUBLE PRECISION,
    "aioTriggerRate" DOUBLE PRECISION,
    "aioCitationRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GridScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GridPin" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "rowIdx" INTEGER NOT NULL,
    "colIdx" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "zip" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isRefunded" BOOLEAN NOT NULL DEFAULT false,
    "assignedDeviceId" TEXT,
    "rankFound" INTEGER,
    "matchedDumpIdx" INTEGER,
    "topCompetitors" JSONB,
    "hasAiOverview" BOOLEAN NOT NULL DEFAULT false,
    "targetCitedInAi" BOOLEAN NOT NULL DEFAULT false,
    "aiOverviewText" TEXT,
    "aiCitations" JSONB,
    "proxyMeta" JSONB,
    "videoUrl" TEXT,
    "dumpsTarUrl" TEXT,
    "metaJsonUrl" TEXT,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GridPin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageBucket" (
    "key" TEXT NOT NULL,
    "bucket" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "UsageBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "cents" INTEGER NOT NULL,
    "captureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedger_externalEventId_key" ON "CreditLedger"("externalEventId");

-- CreateIndex
CREATE INDEX "CreditLedger_userId_createdAt_idx" ON "CreditLedger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedger_pinId_reason_key" ON "CreditLedger"("pinId", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "DevicePool_proxyId_key" ON "DevicePool"("proxyId");

-- CreateIndex
CREATE UNIQUE INDEX "DevicePool_slotIndex_key" ON "DevicePool"("slotIndex");

-- CreateIndex
CREATE UNIQUE INDEX "GridScan_shareToken_key" ON "GridScan"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "GridScan_requestKey_key" ON "GridScan"("requestKey");

-- CreateIndex
CREATE INDEX "GridScan_userId_createdAt_idx" ON "GridScan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GridPin_scanId_status_idx" ON "GridPin"("scanId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GridPin_scanId_rowIdx_colIdx_key" ON "GridPin"("scanId", "rowIdx", "colIdx");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_captureId_key" ON "PaymentOrder"("captureId");

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GridScan" ADD CONSTRAINT "GridScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GridPin" ADD CONSTRAINT "GridPin_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "GridScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

