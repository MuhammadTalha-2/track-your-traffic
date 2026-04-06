-- Add device_type and country columns to tyt_visits
ALTER TABLE "tyt_visits" ADD COLUMN "device_type" TEXT NOT NULL DEFAULT 'desktop';
ALTER TABLE "tyt_visits" ADD COLUMN "country"     TEXT NOT NULL DEFAULT '';

CREATE INDEX "tyt_visits_shop_device_type_idx" ON "tyt_visits"("shop", "device_type");
CREATE INDEX "tyt_visits_shop_country_idx"     ON "tyt_visits"("shop", "country");

-- Create tyt_orders table for revenue attribution
CREATE TABLE "tyt_orders" (
  "id"         SERIAL          NOT NULL,
  "shop"       TEXT            NOT NULL DEFAULT '',
  "order_id"   TEXT            NOT NULL,
  "revenue"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency"   TEXT            NOT NULL DEFAULT 'USD',
  "source"     TEXT            NOT NULL DEFAULT '',
  "medium"     TEXT            NOT NULL DEFAULT '',
  "campaign"   TEXT            NOT NULL DEFAULT '',
  "channel"    TEXT            NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tyt_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tyt_orders_shop_order_id_key" ON "tyt_orders"("shop", "order_id");
CREATE INDEX "tyt_orders_shop_created_at_idx"  ON "tyt_orders"("shop", "created_at");
CREATE INDEX "tyt_orders_shop_source_idx"      ON "tyt_orders"("shop", "source");
