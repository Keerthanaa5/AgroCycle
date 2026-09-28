# AgroCycle API Integration Audit Matrix

## 1. Scope & Verification Methodology

This document provides a line-by-line audit of all REST endpoints exposed by the AgroCycle Express backend, their frontend service mappings, request/response schema validations, HTTP error code contracts, and offline fallback policies.

---

## 2. API Endpoint Catalog & Contract Verification

### 2.1 System & Health Checks
- **`GET /api/health`**
  - Route: `backend/src/routes/healthRoutes.js`
  - Controller: `healthRoutes.js` inline
  - Response: `{ status: "ok", backend: "ok", service: "agrocycle-backend", timestamp: string }` (200 OK)
  - Integration Status: **🟢 CONNECTED**
- **`GET /api/health/db`**
  - Route: `backend/src/routes/healthRoutes.js`
  - Controller: `healthRoutes.js` inline
  - Execution: Executes `SELECT 1 AS alive` via `pg.Pool`
  - Response: `{ status: "ok", backend: "ok", database: "connected", connected: true }` (200 OK or 503)
  - Frontend Caller: `marketplaceService.js (checkHealth())`
  - Integration Status: **🟢 CONNECTED**

---

### 2.2 Users & Authentication Profile
- **`GET /api/v1/users/:userId`**
  - Controller: `userController.js (getUserById)`
  - Table: `users`
  - Status: **🟢 CONNECTED**
- **`POST /api/v1/users`**
  - Controller: `userController.js (upsertUser)`
  - Table: `users`
  - Payload: `{ userId, display_name, phone, roles, active_role, verification_status, language, aadhar_number, date_of_birth }`
  - Status: **🟢 CONNECTED**
- **`PATCH /api/v1/users/:userId`**
  - Controller: `userController.js (updateUser)`
  - Table: `users`
  - Status: **🟢 CONNECTED**

---

### 2.3 Farms & Location Services
- **`GET /api/v1/locations/:userId`**
  - Controller: `locationController.js (getUserLocations)`
  - Table: `farms_and_locations`
  - Status: **🟢 CONNECTED**
- **`POST /api/v1/locations`**
  - Controller: `locationController.js (saveLocation)`
  - Table: `farms_and_locations`
  - Payload: `{ userId, latitude, longitude, accuracy, farmId, farmName, source, city, district, state, country, isDefault }`
  - Status: **🟢 CONNECTED**

---

### 2.4 Viability Scanner & Field Assessments
- **`GET /api/v1/assessments`**
  - Controller: `assessmentController.js (getAssessments)`
  - Query Params: `userId`, `cropName`, `limit`, `offset`
  - Table: `field_assessments`
  - Status: **🟢 CONNECTED**
- **`GET /api/v1/assessments/:id`**
  - Controller: `assessmentController.js (getAssessmentById)`
  - Table: `field_assessments`
  - Status: **🟢 CONNECTED**
- **`POST /api/v1/assessments`**
  - Controller: `assessmentController.js (createAssessment)`
  - Table: `field_assessments`
  - Payload: `{ id, userId, cropName, cultivatedAcres, condition, primaryDisease, severityScore, confidence, visualCoverage, visualDiseaseBurden, samples, recommendation, commercialContext, location }`
  - Status: **🟢 CONNECTED**

---

### 2.5 Urban Waste Matcher & Marketplace Listings
- **`GET /api/v1/marketplace/listings` (Alias: `/api/listings`)**
  - Controller: `marketplaceController.js (getMarketplaceListings)`
  - Query Params: `crop_type`, `status`, `creator_id`, `district`, `state`, `limit`, `offset`
  - Table: `marketplace_listings`
  - Status: **🟢 CONNECTED**
- **`GET /api/v1/marketplace/listings/:id` (Alias: `/api/listings/:id`)**
  - Controller: `marketplaceController.js (getListingById)`
  - Table: `marketplace_listings`
  - Status: **🟢 CONNECTED**
- **`POST /api/v1/marketplace/listings` (Alias: `/api/listings`)**
  - Controller: `marketplaceController.js (createListing)`
  - Table: `marketplace_listings`
  - Payload: `{ id, creator_id, creator_role, crop_type, quantity_kg, condition, asking_price, status, location, farmer_name, contact_phone, image_url, source_assessment_id, title }`
  - Real-Time Broadcast: `listing:created`
  - Status: **🟢 CONNECTED**
- **`PATCH /api/v1/marketplace/listings/:id` (Alias: `/api/listings/:id`)**
  - Controller: `marketplaceController.js (updateListing)`
  - Auth Guard: Ownership verified against `creator_id` or admin role
  - Real-Time Broadcast: `listing:updated`
  - Status: **🟢 CONNECTED**
- **`DELETE /api/v1/marketplace/listings/:id` (Alias: `/api/listings/:id`)**
  - Controller: `marketplaceController.js (deleteListing)`
  - Auth Guard: Ownership verified against `creator_id` or admin role
  - Real-Time Broadcast: `listing:deleted`
  - Status: **🟢 CONNECTED**

---

### 2.6 AgroConnect Community Exchange
- **`GET /api/v1/agroconnect/posts` (Alias: `/api/agroconnect`)**
  - Controller: `agroconnectController.js (getAgroConnectPosts)`
  - Table: `agroconnect_posts`
  - Status: **🟢 CONNECTED**
- **`GET /api/v1/agroconnect/posts/:id` (Alias: `/api/agroconnect/:id`)**
  - Controller: `agroconnectController.js (getAgroConnectPostById)`
  - Table: `agroconnect_posts`
  - Status: **🟢 CONNECTED**
- **`POST /api/v1/agroconnect/posts` (Alias: `/api/agroconnect`)**
  - Controller: `agroconnectController.js (createAgroConnectPost)`
  - Supported Types: `offering_waste`, `requesting_resource`, `seeking_advice`, `sharing_knowledge`
  - Table: `agroconnect_posts`
  - Real-Time Broadcast: `agroconnect:created`
  - Status: **🟢 CONNECTED**
- **`PATCH /api/v1/agroconnect/posts/:id` (Alias: `/api/agroconnect/:id`)**
  - Controller: `agroconnectController.js (updateAgroConnectPost)`
  - Auth Guard: Creator only
  - Real-Time Broadcast: `agroconnect:updated`
  - Status: **🟢 CONNECTED**
- **`DELETE /api/v1/agroconnect/posts/:id` (Alias: `/api/agroconnect/:id`)**
  - Controller: `agroconnectController.js (deleteAgroConnectPost)`
  - Auth Guard: Creator only
  - Real-Time Broadcast: `agroconnect:deleted`
  - Status: **🟢 CONNECTED**
- **`POST /api/v1/agroconnect/posts/:id/interact`**
  - Controller: `agroconnectController.js (interactWithPost)`
  - Table: `agroconnect_posts.interactions`, creates `notifications` record
  - Status: **🟢 CONNECTED**
- **`PATCH /api/v1/agroconnect/posts/:id/connect`**
  - Controller: `agroconnectController.js (manageConnection)`
  - Table: `agroconnect_posts.connections`, creates `notifications` record
  - Status: **🟢 CONNECTED**

---

### 2.7 Smart Logistics & Live GPS Tracking
- **`GET /api/v1/logistics/drivers-vehicles`**
  - Controller: `logisticsController.js (getDriversAndVehicles)`
  - Tables: `logistics_drivers`, `logistics_vehicles`
  - Status: **🟢 CONNECTED**
- **`POST /api/v1/logistics/shipments`**
  - Controller: `logisticsController.js (createShipment)`
  - Tables: `logistics_shipments`, `logistics_shipment_stops`, `logistics_drivers`
  - Status: **🟢 CONNECTED**
- **`GET /api/v1/logistics/shipments`**
  - Controller: `logisticsController.js (listShipments)`
  - Auth Guard: Filtered by user role & participant ID
  - Status: **🟢 CONNECTED**
- **`GET /api/v1/logistics/shipments/:shipmentId`**
  - Controller: `logisticsController.js (getShipmentById)`
  - Auth Guard: Verifies participant membership (driver, buyer, farmer, admin)
  - Status: **🟢 CONNECTED**
- **`POST /api/v1/shipments/:shipmentId/location` (Alias: `/api/v1/logistics/shipments/:shipmentId/location`)**
  - Controller: `logisticsController.js (updateDriverLocation)`
  - Auth Guard: Strictly assigned driver or admin
  - Real-Time Broadcast: Room `shipment:<shipmentId>` receives `shipment:location_update`
  - Tables: `driver_current_locations`, `logistics_drivers`, `shipment_location_history` (bounded 100 points)
  - Status: **🟢 CONNECTED**
- **`GET /api/v1/shipments/:shipmentId/tracking` (Alias: `/api/v1/logistics/shipments/:shipmentId/tracking`)**
  - Controller: `logisticsController.js (getShipmentTracking)`
  - Privacy Guard: Returns ETA & distance for farmers/buyers; hides raw lat/lng
  - Status: **🟢 CONNECTED**
- **`PATCH /api/v1/shipments/:shipmentId/status`**
  - Controller: `logisticsController.js (updateShipmentStatus)`
  - State Machine: `MATCHED` -> `DRIVER_ASSIGNED` -> `READY_FOR_PICKUP` -> `IN_TRANSIT` -> `DELIVERED`
  - Real-Time Broadcast: `shipment:status_changed`
  - Status: **🟢 CONNECTED**
- **`PATCH /api/v1/shipments/:shipmentId/stops/:stopIndex`**
  - Controller: `logisticsController.js (updateStopStatus)`
  - Real-Time Broadcast: `shipment:stop_progress`
  - Status: **🟢 CONNECTED**

---

### 2.8 Market Intelligence & Buyer Requirements
- **`GET /api/v1/buyers/requirements`**
  - Controller: `buyerController.js (getBuyerRequirements)`
  - Table: `buyer_requirements`
  - Status: **🟢 CONNECTED**
- **`GET /api/v1/buyers/requirements/:id`**
  - Controller: `buyerController.js (getBuyerRequirementById)`
  - Table: `buyer_requirements`
  - Status: **🟢 CONNECTED**
- **`POST /api/v1/buyers/requirements`**
  - Controller: `buyerController.js (createBuyerRequirement)`
  - Table: `buyer_requirements`
  - Status: **🟢 CONNECTED**
- **`PATCH /api/v1/buyers/requirements/:id`**
  - Controller: `buyerController.js (updateBuyerRequirement)`
  - Table: `buyer_requirements`
  - Status: **🟢 CONNECTED**

---

### 2.9 Silage Bank Network
- **`GET /api/v1/silage/centers`**
  - Controller: `silageController.js (getSilageCenters)`
  - Table: `silage_centers`
  - Status: **🟢 CONNECTED**
- **`POST /api/v1/silage/centers`**
  - Controller: `silageController.js (createSilageCenter)`
  - Table: `silage_centers`
  - Status: **🟢 CONNECTED**
- **`GET /api/v1/silage/bookings`**
  - Controller: `silageController.js (getSilageBookings)`
  - Table: `silage_bookings`
  - Status: **🟢 CONNECTED**
- **`POST /api/v1/silage/bookings`**
  - Controller: `silageController.js (createSilageBooking)`
  - Table: `silage_bookings`
  - Status: **🟢 CONNECTED**
- **`PATCH /api/v1/silage/bookings/:id/status`**
  - Controller: `silageController.js (updateSilageBookingStatus)`
  - Table: `silage_bookings`
  - Status: **🟢 CONNECTED**

---

### 2.10 Carbon Cash Marketplace
- **`GET /api/v1/carbon/activities`**
  - Controller: `carbonController.js (getCarbonActivities)`
  - Table: `carbon_activities`
  - Status: **🟢 CONNECTED**
- **`GET /api/v1/carbon/activities/:id`**
  - Controller: `carbonController.js (getCarbonActivityById)`
  - Table: `carbon_activities`, `carbon_offers`
  - Status: **🟢 CONNECTED**
- **`POST /api/v1/carbon/activities`**
  - Controller: `carbonController.js (createCarbonActivity)`
  - Table: `carbon_activities`
  - Status: **🟢 CONNECTED**
- **`POST /api/v1/carbon/activities/:id/offers`**
  - Controller: `carbonController.js (submitCarbonOffer)`
  - Security Guard: Anti-self-sponsorship enforcement (`creator_id !== sponsor_id`)
  - Table: `carbon_offers`, `carbon_activities`
  - Status: **🟢 CONNECTED**
- **`PATCH /api/v1/carbon/activities/:id/offers/:offerId`**
  - Controller: `carbonController.js (respondToCarbonOffer)`
  - Auth Guard: Only creator can accept/reject
  - Status: **🟢 CONNECTED**

---

### 2.11 Claim Rocket Dossiers
- **`GET /api/v1/claims`**
  - Controller: `claimController.js (getClaimDossiers)`
  - Table: `claim_dossiers`
  - Status: **🟢 CONNECTED**
- **`GET /api/v1/claims/:id`**
  - Controller: `claimController.js (getClaimDossierById)`
  - Table: `claim_dossiers`
  - Status: **🟢 CONNECTED**
- **`POST /api/v1/claims`**
  - Controller: `claimController.js (createClaimDossier)`
  - Table: `claim_dossiers`
  - Status: **🟢 CONNECTED**
- **`DELETE /api/v1/claims/:id`**
  - Controller: `claimController.js (deleteClaimDossier)`
  - Table: `claim_dossiers`
  - Status: **🟢 CONNECTED**

---

### 2.12 Notifications System
- **`GET /api/v1/notifications/:userId`**
  - Controller: `notificationController.js (getUserNotifications)`
  - Table: `notifications`
  - Status: **🟢 CONNECTED**
- **`POST /api/v1/notifications`**
  - Controller: `notificationController.js (createNotification)`
  - Table: `notifications`
  - Status: **🟢 CONNECTED**
- **`PATCH /api/v1/notifications/:id/read`**
  - Controller: `notificationController.js (markNotificationRead)`
  - Table: `notifications`
  - Status: **🟢 CONNECTED**
- **`PATCH /api/v1/notifications/:userId/read-all`**
  - Controller: `notificationController.js (markAllNotificationsRead)`
  - Table: `notifications`
  - Status: **🟢 CONNECTED**

---

### 2.13 Remote Synchronization Adapter Gateway
- **`POST /api/v1/sync/:entityType`**
  - Controller: `syncController.js (syncEntityAction)`
  - Handled Entities: `marketplaceListing`, `cropPost`, `silageCenter`, `silageBooking`, `carbonActivity`, `carbonOffer`, `claimDossier`, `fieldAssessment`, `userLocation`, `userProfile`, `notification`
  - Idempotency Header: `X-Idempotency-Key` checked against `sync_events`
  - Status: **🟢 CONNECTED**
- **`POST /api/v1/sync`**
  - Controller: `syncController.js (syncBatch)`
  - Batch array processing with idempotency checks
  - Status: **🟢 CONNECTED**
- **`GET /api/v1/sync/:userId`**
  - Controller: `syncController.js (getUserSyncHistory)`
  - Status: **🟢 CONNECTED**

---

## 3. Error Code & Failure Handling Policy

| HTTP Status | Meaning in AgroCycle | Client Action | Treated as Offline? |
| :--- | :--- | :--- | :--- |
| **200 / 201** | Successful request | Update state, clear error banners, cache in IndexedDB | No |
| **400** | Validation error (e.g. invalid quantity, missing crop) | Surface specific validation message to user | **NO** (Never converts to offline) |
| **401** | Unauthenticated request | Redirect to login modal/screen | **NO** |
| **403** | Authorization error (e.g. modifying another user's listing, driver mismatch, self-sponsorship) | Display permission denied alert | **NO** |
| **404** | Resource not found | Show not found badge / empty state | **NO** |
| **500** | Backend runtime exception | Surface error alert with status code | **NO** |
| **Network Error** (e.g. fetch TypeError, server unreachable) | Genuine connection failure | Enqueue in `syncQueue`, save local draft, display "Saved as local pending draft" | **YES** |
