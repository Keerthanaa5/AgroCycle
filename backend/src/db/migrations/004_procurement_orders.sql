-- =============================================================================
-- AgroCycle Buyer-Side Fresh Produce Procurement Orders Schema Migration
-- Version: 004_procurement_orders.sql
-- Description: Buyer fresh produce procurement, multi-farmer lot allocations,
-- procurement economics, and status progression without logistics.
-- =============================================================================

CREATE TABLE IF NOT EXISTS procurement_orders (
  id VARCHAR(128) PRIMARY KEY,
  order_id VARCHAR(128) UNIQUE NOT NULL,
  buyer_id VARCHAR(128) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  buyer_name VARCHAR(255) NOT NULL,
  buyer_phone VARCHAR(32),
  crop VARCHAR(128) NOT NULL,
  category VARCHAR(64) DEFAULT 'vegetable',
  requested_quantity_kg NUMERIC(12,2) NOT NULL,
  quality_grade VARCHAR(64),
  required_date VARCHAR(64),
  max_price_per_kg NUMERIC(10,2),
  delivery_location VARCHAR(255),
  delivery_latitude DOUBLE PRECISION,
  delivery_longitude DOUBLE PRECISION,
  status VARCHAR(64) DEFAULT 'CONFIRMED',
  order_type VARCHAR(64) DEFAULT 'ACCEPTED_RECOMMENDATION',
  match_type VARCHAR(64) DEFAULT 'MARKET',
  farmer_allocations JSONB DEFAULT '[]'::jsonb,
  procurement_summary JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_procurement_orders_id ON procurement_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_procurement_orders_buyer ON procurement_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_procurement_orders_crop ON procurement_orders(crop);
CREATE INDEX IF NOT EXISTS idx_procurement_orders_status ON procurement_orders(status);
CREATE INDEX IF NOT EXISTS idx_procurement_orders_created ON procurement_orders(created_at DESC);
