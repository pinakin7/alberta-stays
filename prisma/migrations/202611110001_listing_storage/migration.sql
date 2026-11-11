-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'csv',
    "permissionReference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "priceCad" DECIMAL(14,2) NOT NULL,
    "bedrooms" INTEGER,
    "mlsNumber" TEXT,
    "boardId" INTEGER,
    "brokerageName" TEXT,
    "expiresAt" TIMESTAMP(3),
    "marketId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioSnapshot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "outputs" JSONB NOT NULL,
    "calculationVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScenarioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Market_name_key" ON "Market"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_url_key" ON "DataSource"("url");

-- CreateIndex
CREATE INDEX "Listing_marketId_retrievedAt_idx" ON "Listing"("marketId", "retrievedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_sourceId_externalId_key" ON "Listing"("sourceId", "externalId");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defense in depth beyond application validation.
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_priceCad_check" CHECK ("priceCad" > 0 AND "priceCad" <= 10000000);
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_bedrooms_check" CHECK ("bedrooms" IS NULL OR "bedrooms" BETWEEN 0 AND 99);
