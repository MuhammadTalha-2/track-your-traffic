-- Add event_type column to track conversion events (pageview, add_to_cart, checkout, purchase)
ALTER TABLE "tyt_visits" ADD COLUMN "event_type" TEXT NOT NULL DEFAULT 'pageview';

-- Index for filtering by event type per shop
CREATE INDEX "tyt_visits_shop_event_type_idx" ON "tyt_visits"("shop", "event_type");
