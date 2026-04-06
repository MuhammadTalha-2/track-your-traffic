-- Fix URL-encoded campaign names stored with + instead of spaces
-- e.g. "Summer+Sale+2026" → "Summer Sale 2026"
-- This was caused by getUrlParams() not decoding + signs before decodeURIComponent.
UPDATE "tyt_visits"
SET "campaign" = REPLACE("campaign", '+', ' ')
WHERE "campaign" LIKE '%+%';
