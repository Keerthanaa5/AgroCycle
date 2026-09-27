-- =============================================================================
-- AgroCycle Initial Database Schema Migration
-- Version: 001_initial_schema.sql
-- Description: Core relational schema mapping AgroCycle IndexedDB/Local stores
-- =============================================================================

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(128) PRIMARY KEY,
  display_name VARCHAR(255),
  phone VARCHAR(32),
  roles TEXT[] DEFAULT '{"farmer"}',
  active_role VARCHAR(64) DEFAULT 'farmer',
  verification_status VARCHAR(64) DEFAULT 'pending',
  language VARCHAR(32) DEFAULT 'english',
  aadhar_number VARCHAR(32),
  date_of_birth VARCHAR(32),
  total_carbon_credits NUMERIC(12,2) DEFAULT 0,
  total_earnings_inr NUMERIC(12,2) DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  total_exchanges INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_active_role ON users(active_role);
CREATE INDEX IF NOT EXISTS idx_users_verification ON users(verification_status);

-- 2. FARMS & LOCATIONS
CREATE TABLE IF NOT EXISTS farms_and_locations (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  farm_id VARCHAR(128) DEFAULT 'default',
  farm_name VARCHAR(255) DEFAULT 'Main Farm',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION DEFAULT 0,
  source VARCHAR(64) DEFAULT 'device-gps',
  city VARCHAR(255),
  district VARCHAR(255),
  state VARCHAR(255),
  country VARCHAR(255) DEFAULT 'India',
  is_default BOOLEAN DEFAULT TRUE,
  captured_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_farms_user_id ON farms_and_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_farms_user_farm ON farms_and_locations(user_id, farm_id);
CREATE INDEX IF NOT EXISTS idx_farms_district_state ON farms_and_locations(district, state);

-- 3. FIELD ASSESSMENTS (VIABILITY SCANNER)
CREATE TABLE IF NOT EXISTS field_assessments (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  farm_id VARCHAR(128) DEFAULT 'default',
  crop_name VARCHAR(128) NOT NULL,
  cultivated_acres NUMERIC(10,2) DEFAULT 1.0,
  condition VARCHAR(64),
  primary_disease VARCHAR(255),
  severity_score NUMERIC(5,2) DEFAULT 0,
  confidence NUMERIC(5,2) DEFAULT 0,
  visual_coverage NUMERIC(5,2) DEFAULT 0,
  visual_disease_burden NUMERIC(5,2) DEFAULT 0,
  spatial_samples JSONB DEFAULT '[]'::jsonb,
  recommendation JSONB DEFAULT '{}'::jsonb,
  commercial_context JSONB DEFAULT '{}'::jsonb,
  location_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON field_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_crop ON field_assessments(crop_name);
CREATE INDEX IF NOT EXISTS idx_assessments_created ON field_assessments(created_at DESC);

-- 4. MARKETPLACE LISTINGS (URBAN WASTE MATCHER)
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id VARCHAR(128) PRIMARY KEY,
  creator_id VARCHAR(128) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  creator_role VARCHAR(64) DEFAULT 'farmer',
  source_assessment_id VARCHAR(128) REFERENCES field_assessments(id) ON DELETE SET NULL,
  title VARCHAR(255),
  crop_type VARCHAR(128) NOT NULL,
  quantity_kg NUMERIC(12,2) NOT NULL,
  condition VARCHAR(64) NOT NULL,
  asking_price NUMERIC(10,2),
  status VARCHAR(64) DEFAULT 'listed',
  location VARCHAR(255),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  district VARCHAR(255),
  state VARCHAR(255),
  matched_buyer VARCHAR(255),
  buyer_type VARCHAR(64),
  farmer_name VARCHAR(255),
  contact_phone VARCHAR(32),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marketplace_creator ON marketplace_listings(creator_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_crop_status ON marketplace_listings(crop_type, status);
CREATE INDEX IF NOT EXISTS idx_marketplace_created ON marketplace_listings(created_at DESC);

-- 5. BUYER REQUIREMENTS (MARKET INTELLIGENCE)
CREATE TABLE IF NOT EXISTS buyer_requirements (
  id VARCHAR(128) PRIMARY KEY,
  buyer_id VARCHAR(128) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  business_type VARCHAR(128),
  crop VARCHAR(128) NOT NULL,
  variety VARCHAR(128),
  quantity_required NUMERIC(12,2) NOT NULL,
  unit VARCHAR(32) DEFAULT 'kg',
  target_price NUMERIC(10,2),
  buying_radius_km NUMERIC(8,2) DEFAULT 50.0,
  city VARCHAR(255),
  district VARCHAR(255),
  state VARCHAR(255),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  contact_person VARCHAR(255),
  phone VARCHAR(32),
  email VARCHAR(255),
  verification_status VARCHAR(64) DEFAULT 'verified',
  status VARCHAR(64) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_buyer_req_buyer ON buyer_requirements(buyer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_req_crop_status ON buyer_requirements(crop, status);
CREATE INDEX IF NOT EXISTS idx_buyer_req_district ON buyer_requirements(district, state);

-- 6. SILAGE CENTERS
CREATE TABLE IF NOT EXISTS silage_centers (
  id VARCHAR(128) PRIMARY KEY,
  creator_id VARCHAR(128) REFERENCES users(user_id) ON DELETE SET NULL,
  creator_role VARCHAR(64) DEFAULT 'cattle_owner',
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  district VARCHAR(255),
  state VARCHAR(255),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  capacity_kg NUMERIC(12,2) DEFAULT 0,
  available_kg NUMERIC(12,2) DEFAULT 0,
  price_per_kg NUMERIC(10,2) DEFAULT 0,
  contact_phone VARCHAR(32),
  status VARCHAR(64) DEFAULT 'operational',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_silage_centers_location ON silage_centers(district, state);

-- 7. SILAGE BOOKINGS (SILAGE BANK)
CREATE TABLE IF NOT EXISTS silage_bookings (
  id VARCHAR(128) PRIMARY KEY,
  creator_id VARCHAR(128) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  center_id VARCHAR(128) REFERENCES silage_centers(id) ON DELETE SET NULL,
  crop_type VARCHAR(128) NOT NULL,
  quantity_kg NUMERIC(12,2) NOT NULL,
  pickup_date VARCHAR(64),
  price_per_kg NUMERIC(10,2),
  total_price NUMERIC(12,2),
  status VARCHAR(64) DEFAULT 'requested',
  farmer_name VARCHAR(255),
  location VARCHAR(255),
  contact_phone VARCHAR(32),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_silage_bookings_creator ON silage_bookings(creator_id);
CREATE INDEX IF NOT EXISTS idx_silage_bookings_center ON silage_bookings(center_id);
CREATE INDEX IF NOT EXISTS idx_silage_bookings_status ON silage_bookings(status);

-- 8. CARBON ACTIVITIES (CARBON CASH)
CREATE TABLE IF NOT EXISTS carbon_activities (
  id VARCHAR(128) PRIMARY KEY,
  creator_id VARCHAR(128) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  creator_role VARCHAR(64) DEFAULT 'farmer',
  activity_type VARCHAR(64) NOT NULL,
  description TEXT,
  area_acres NUMERIC(10,2) NOT NULL,
  co2_saved_kg NUMERIC(12,2) DEFAULT 0,
  credits_earned NUMERIC(12,2) DEFAULT 0,
  credit_value_inr NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(64) DEFAULT 'pending',
  sponsor_id VARCHAR(128) REFERENCES users(user_id) ON DELETE SET NULL,
  proof_image_url TEXT,
  farmer_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_carbon_activities_creator ON carbon_activities(creator_id);
CREATE INDEX IF NOT EXISTS idx_carbon_activities_status ON carbon_activities(status);
CREATE INDEX IF NOT EXISTS idx_carbon_activities_sponsor ON carbon_activities(sponsor_id);

-- 9. CARBON OFFERS
CREATE TABLE IF NOT EXISTS carbon_offers (
  id VARCHAR(128) PRIMARY KEY,
  activity_id VARCHAR(128) NOT NULL REFERENCES carbon_activities(id) ON DELETE CASCADE,
  sponsor_id VARCHAR(128) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  offered_price_inr NUMERIC(12,2) NOT NULL,
  status VARCHAR(64) DEFAULT 'offered',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_carbon_offers_activity ON carbon_offers(activity_id);
CREATE INDEX IF NOT EXISTS idx_carbon_offers_sponsor ON carbon_offers(sponsor_id);

-- 10. CLAIM DOSSIERS (CLAIM ROCKET)
CREATE TABLE IF NOT EXISTS claim_dossiers (
  id VARCHAR(128) PRIMARY KEY,
  creator_id VARCHAR(128) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  farmer_id VARCHAR(128),
  source_assessment_id VARCHAR(128) REFERENCES field_assessments(id) ON DELETE SET NULL,
  farmer_name VARCHAR(255) NOT NULL,
  mobile_number VARCHAR(32) NOT NULL,
  aadhar_number VARCHAR(32) NOT NULL,
  date_of_birth VARCHAR(32) NOT NULL,
  crop_type VARCHAR(128) NOT NULL,
  damage_type VARCHAR(64) NOT NULL,
  damage_percentage NUMERIC(5,2) DEFAULT 0,
  area_acres NUMERIC(10,2) DEFAULT 0,
  estimated_loss_inr NUMERIC(12,2) DEFAULT 0,
  claim_amount_inr NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(64) DEFAULT 'draft',
  damage_image_url TEXT,
  location VARCHAR(255),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  ai_report TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_claims_creator ON claim_dossiers(creator_id);
CREATE INDEX IF NOT EXISTS idx_claims_crop_status ON claim_dossiers(crop_type, status);
CREATE INDEX IF NOT EXISTS idx_claims_created ON claim_dossiers(created_at DESC);

-- 11. AGROCONNECT POSTS (COMMUNITY)
CREATE TABLE IF NOT EXISTS agroconnect_posts (
  id VARCHAR(128) PRIMARY KEY,
  creator_id VARCHAR(128) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  creator_role VARCHAR(64) DEFAULT 'farmer',
  title VARCHAR(255) NOT NULL,
  crop_type VARCHAR(128) NOT NULL,
  quantity_kg NUMERIC(12,2) NOT NULL,
  condition VARCHAR(64) NOT NULL,
  location VARCHAR(255) NOT NULL,
  post_type VARCHAR(64) NOT NULL,
  image_url TEXT,
  contact_phone VARCHAR(32),
  farmer_name VARCHAR(255),
  rating NUMERIC(3,2) DEFAULT 0,
  status VARCHAR(64) DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agroconnect_creator ON agroconnect_posts(creator_id);
CREATE INDEX IF NOT EXISTS idx_agroconnect_crop_post_type ON agroconnect_posts(crop_type, post_type);
CREATE INDEX IF NOT EXISTS idx_agroconnect_created ON agroconnect_posts(created_at DESC);

-- 12. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(64) DEFAULT 'system',
  is_read BOOLEAN DEFAULT FALSE,
  action_url VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 13. SYNC EVENTS (FUTURE REMOTE SYNC AUDIT LOG)
CREATE TABLE IF NOT EXISTS sync_events (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  action_type VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(64) DEFAULT 'processed',
  processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_events_idempotency ON sync_events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_sync_events_user_time ON sync_events(user_id, created_at DESC);
