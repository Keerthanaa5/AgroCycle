-- =============================================================================
-- AgroCycle Phase 2: Smart Logistics Schema Migration
-- Version: 005_smart_logistics.sql
-- Description: Minimal logistics tracking fields attached directly to procurement orders.
-- =============================================================================

ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS logistics JSONB DEFAULT NULL;
ALTER TABLE procurement_orders ADD COLUMN IF NOT EXISTS logistics_status VARCHAR(64) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_procurement_orders_logistics_status ON procurement_orders(logistics_status);
