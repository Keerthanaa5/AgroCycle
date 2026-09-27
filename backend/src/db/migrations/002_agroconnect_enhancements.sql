-- 002_agroconnect_enhancements.sql
-- Enhances agroconnect_posts to support 4 crop-focused community post types:
-- 1. Offering Crop Waste
-- 2. Requesting Crop Resource
-- 3. Seeking Crop Advice
-- 4. Sharing Crop Knowledge

-- Allow quantity_kg and condition to be NULL for advice & knowledge posts
ALTER TABLE agroconnect_posts ALTER COLUMN quantity_kg DROP NOT NULL;
ALTER TABLE agroconnect_posts ALTER COLUMN condition DROP NOT NULL;

-- Add topic, resource_needed, description, interactions, and connections
ALTER TABLE agroconnect_posts ADD COLUMN IF NOT EXISTS topic VARCHAR(255);
ALTER TABLE agroconnect_posts ADD COLUMN IF NOT EXISTS resource_needed VARCHAR(255);
ALTER TABLE agroconnect_posts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE agroconnect_posts ADD COLUMN IF NOT EXISTS interactions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE agroconnect_posts ADD COLUMN IF NOT EXISTS connections JSONB DEFAULT '[]'::jsonb;

-- Additional indexes for crop and post_type search
CREATE INDEX IF NOT EXISTS idx_agroconnect_topic ON agroconnect_posts(topic);
CREATE INDEX IF NOT EXISTS idx_agroconnect_location ON agroconnect_posts(location);
