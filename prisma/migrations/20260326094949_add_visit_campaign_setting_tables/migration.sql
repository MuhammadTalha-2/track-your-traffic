-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "expires" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tyt_visits" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "medium" TEXT NOT NULL DEFAULT '',
    "campaign" TEXT NOT NULL DEFAULT '',
    "channel" TEXT NOT NULL DEFAULT '',
    "landing_page" TEXT NOT NULL DEFAULT '',
    "referrer" TEXT NOT NULL DEFAULT '',
    "click_id_type" TEXT NOT NULL DEFAULT '',
    "visitor_hash" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tyt_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tyt_campaigns" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "medium" TEXT NOT NULL DEFAULT '',
    "campaign" TEXT NOT NULL DEFAULT '',
    "term" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "goal_visits" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT NOT NULL DEFAULT '',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tyt_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tyt_settings" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL DEFAULT '',
    "key" TEXT NOT NULL DEFAULT '',
    "value" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tyt_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tyt_visits_shop_idx" ON "tyt_visits"("shop");

-- CreateIndex
CREATE INDEX "tyt_visits_shop_channel_idx" ON "tyt_visits"("shop", "channel");

-- CreateIndex
CREATE INDEX "tyt_visits_shop_source_idx" ON "tyt_visits"("shop", "source");

-- CreateIndex
CREATE INDEX "tyt_visits_shop_created_at_idx" ON "tyt_visits"("shop", "created_at");

-- CreateIndex
CREATE INDEX "tyt_visits_shop_visitor_hash_idx" ON "tyt_visits"("shop", "visitor_hash");

-- CreateIndex
CREATE INDEX "tyt_campaigns_shop_idx" ON "tyt_campaigns"("shop");

-- CreateIndex
CREATE INDEX "tyt_campaigns_shop_status_idx" ON "tyt_campaigns"("shop", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tyt_campaigns_shop_slug_key" ON "tyt_campaigns"("shop", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "tyt_settings_shop_key_key" ON "tyt_settings"("shop", "key");
