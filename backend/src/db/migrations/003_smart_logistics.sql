-- =============================================================================
-- AgroCycle Smart Logistics & Driver Live Location Schema Migration
-- Version: 003_smart_logistics.sql
-- Description: Real-time driver GPS tracking, vehicle consolidation, 
-- multi-buyer shipments, stop progression, and privacy-protected tracking.
-- =============================================================================

-- 1. LOGISTICS DRIVERS
CREATE TABLE IF NOT EXISTS logistics_drivers (
  driver_id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) REFERENCES users(user_id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(32),
  current_shipment_id VARCHAR(128),
  status VARCHAR(64) DEFAULT 'available',
  current_latitude DOUBLE PRECISION,
  current_longitude DOUBLE PRECISION,
  last_location_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_logistics_drivers_user ON logistics_drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_logistics_drivers_status ON logistics_drivers(status);
CREATE INDEX IF NOT EXISTS idx_logistics_drivers_current_shipment ON logistics_drivers(current_shipment_id);

-- 2. LOGISTICS VEHICLES
CREATE TABLE IF NOT EXISTS logistics_vehicles (
  vehicle_id VARCHAR(128) PRIMARY KEY,
  driver_id VARCHAR(128) REFERENCES logistics_drivers(driver_id) ON DELETE SET NULL,
  vehicle_type VARCHAR(128) NOT NULL,
  registration_number VARCHAR(64),
  capacity_kg NUMERIC(12,2) NOT NULL,
  base_rate_per_km NUMERIC(10,2) DEFAULT 60.00,
  status VARCHAR(64) DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_logistics_vehicles_driver ON logistics_vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_logistics_vehicles_capacity ON logistics_vehicles(capacity_kg);
CREATE INDEX IF NOT EXISTS idx_logistics_vehicles_status ON logistics_vehicles(status);

-- 3. LOGISTICS SHIPMENTS (Supports Multi-Farmer & Multi-Buyer)
CREATE TABLE IF NOT EXISTS logistics_shipments (
  id VARCHAR(128) PRIMARY KEY,
  shipment_id VARCHAR(128) UNIQUE NOT NULL,
  primary_buyer_id VARCHAR(128) REFERENCES users(user_id) ON DELETE SET NULL,
  driver_id VARCHAR(128) REFERENCES logistics_drivers(driver_id) ON DELETE SET NULL,
  vehicle_id VARCHAR(128) REFERENCES logistics_vehicles(vehicle_id) ON DELETE SET NULL,
  crop VARCHAR(128) NOT NULL,
  total_quantity_kg NUMERIC(12,2) NOT NULL,
  vehicle_capacity_kg NUMERIC(12,2) NOT NULL,
  vehicle_utilization_percent NUMERIC(5,2) NOT NULL,
  estimated_distance_km NUMERIC(10,2) NOT NULL,
  estimated_transport_cost NUMERIC(12,2) NOT NULL,
  transport_cost_per_kg NUMERIC(10,4) NOT NULL,
  status VARCHAR(64) DEFAULT 'MATCHED',
  buyer_allocations JSONB DEFAULT '[]'::jsonb,
  farmer_allocations JSONB DEFAULT '[]'::jsonb,
  route JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_logistics_shipments_id ON logistics_shipments(shipment_id);
CREATE INDEX IF NOT EXISTS idx_logistics_shipments_status ON logistics_shipments(status);
CREATE INDEX IF NOT EXISTS idx_logistics_shipments_driver ON logistics_shipments(driver_id);
CREATE INDEX IF NOT EXISTS idx_logistics_shipments_buyer ON logistics_shipments(primary_buyer_id);
CREATE INDEX IF NOT EXISTS idx_logistics_shipments_crop ON logistics_shipments(crop);

-- 4. SHIPMENT STOPS (Pickups & Multi-Drop Deliveries)
CREATE TABLE IF NOT EXISTS logistics_shipment_stops (
  id VARCHAR(128) PRIMARY KEY,
  shipment_id VARCHAR(128) NOT NULL REFERENCES logistics_shipments(shipment_id) ON DELETE CASCADE,
  stop_index INTEGER NOT NULL,
  stop_type VARCHAR(32) NOT NULL,
  farmer_id VARCHAR(128),
  buyer_id VARCHAR(128),
  location_name VARCHAR(255),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  quantity_kg NUMERIC(12,2) DEFAULT 0,
  cumulative_load_kg NUMERIC(12,2) DEFAULT 0,
  distance_from_prev_km NUMERIC(10,2) DEFAULT 0,
  status VARCHAR(64) DEFAULT 'PENDING',
  arrival_time TIMESTAMPTZ,
  completion_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_logistics_stops_shipment ON logistics_shipment_stops(shipment_id, stop_index);
CREATE INDEX IF NOT EXISTS idx_logistics_stops_status ON logistics_shipment_stops(status);
CREATE INDEX IF NOT EXISTS idx_logistics_stops_farmer ON logistics_shipment_stops(farmer_id);
CREATE INDEX IF NOT EXISTS idx_logistics_stops_buyer ON logistics_shipment_stops(buyer_id);

-- 5. DRIVER CURRENT LOCATIONS (Latest Throttled Device GPS)
CREATE TABLE IF NOT EXISTS driver_current_locations (
  driver_id VARCHAR(128) PRIMARY KEY REFERENCES logistics_drivers(driver_id) ON DELETE CASCADE,
  shipment_id VARCHAR(128) REFERENCES logistics_shipments(shipment_id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION DEFAULT 0,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  timestamp TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_driver_locations_shipment ON driver_current_locations(shipment_id);

-- 6. SHIPMENT LOCATION HISTORY (Bounded Retention Audit Trail)
CREATE TABLE IF NOT EXISTS shipment_location_history (
  id VARCHAR(128) PRIMARY KEY,
  shipment_id VARCHAR(128) NOT NULL REFERENCES logistics_shipments(shipment_id) ON DELETE CASCADE,
  driver_id VARCHAR(128) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION DEFAULT 0,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shipment_loc_history_shipment ON shipment_location_history(shipment_id, recorded_at DESC);
