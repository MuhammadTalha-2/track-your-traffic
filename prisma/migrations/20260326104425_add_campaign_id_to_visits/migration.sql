-- AlterTable
ALTER TABLE "tyt_visits" ADD COLUMN     "campaign_id" INTEGER;

-- CreateIndex
CREATE INDEX "tyt_campaigns_shop_campaign_idx" ON "tyt_campaigns"("shop", "campaign");

-- CreateIndex
CREATE INDEX "tyt_visits_shop_campaign_idx" ON "tyt_visits"("shop", "campaign");

-- CreateIndex
CREATE INDEX "tyt_visits_campaign_id_idx" ON "tyt_visits"("campaign_id");

-- AddForeignKey
ALTER TABLE "tyt_visits" ADD CONSTRAINT "tyt_visits_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "tyt_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
