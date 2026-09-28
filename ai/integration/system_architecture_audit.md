# AgroCycle End-to-End System Architecture Audit

## 1. Executive Summary & Architectural Overview

AgroCycle is a distributed, multi-role agricultural resilience and recovery platform designed for Indian farmers, commercial buyers, and transport logistics drivers. The system architecture combines:
- **Client Tier**: React 18 SPA (Vite) with role-guarded views, bilingual/multilingual localization (English, Tamil, Hindi), on-device ONNX/WASM AI inference (YOLOv8/11n), and offline-first persistence (IndexedDB + localStorage fallback mirror).
- **Network / Synchronization Layer**: Dual-mode data access utilizing direct REST endpoints for live online operations and an offline idempotency-backed Sync Queue (`syncQueue` + `syncManager` + `FutureRemoteSyncAdapter`) routing to `/api/v1/sync/:entityType`.
- **Real-Time Layer**: Socket.IO server with global broadcast channels for marketplace and community events, alongside authenticated, privacy-partitioned WebSocket rooms (`shipment:<shipmentId>`) for smart logistics telemetry.
- **Backend Tier**: Express.js API gateway mounted under both `/api` and `/api/v1`, featuring helmet security, CORS origin validation, request logging, body size guards, input validation, and PostgreSQL connection pooling (`pg.Pool`).
- **Persistence Tier**: PostgreSQL relational database with 13 tables across 3 incremental migrations (`001_initial_schema.sql`, `002_agroconnect_enhancements.sql`, `003_smart_logistics.sql`), enforcing foreign keys, cascade deletes, and composite indexes.
- **AI Tier**: Local deterministic decision engines (rescue decision engine, field assessment engine, logistics consolidation engine) combined with cloud LLM integrations (Gemini 2.5/3.5/flash and Groq Llama 3.3) for contextual advisory.

---

## 2. Global Module Map

```
+---------------------------------------------------------------------------------------------------+
|                                       AGROCYCLE APPLICATION                                       |
+---------------------------------------------------------------------------------------------------+
                                                  |
         +----------------------------------------+----------------------------------------+
         |                                                                                 |
         v                                                                                 v
+------------------------------------+                           +------------------------------------+
|          FRONTEND MODULES          |                           |          BACKEND SERVICES          |
+------------------------------------+                           +------------------------------------+
| 1. Viability Scanner (YOLOv8/ONNX) |                           | 1. Assessment Routes & Controller  |
| 2. Urban Waste Matcher (Market)    |<==== HTTP REST / Sync ===>| 2. Marketplace Routes & Controller |
| 3. Smart Logistics & GPS Tracking  |<==== Real-Time Socket ===>| 3. Logistics Routes & Controller   |
| 4. AgroConnect Farmer Community    |<==== Real-Time Socket ===>| 4. AgroConnect Routes & Controller |
| 5. Silage Bank Network             |<==== HTTP REST / Sync ===>| 5. Silage Routes & Controller      |
| 6. Carbon Cash Marketplace         |<==== HTTP REST / Sync ===>| 6. Carbon Routes & Controller      |
| 7. Claim Rocket Dossier Generator  |<==== HTTP REST / Sync ===>| 7. Claim Routes & Controller       |
| 8. Market Intelligence & Pricing   |<==== HTTP REST API ======>| 8. Buyer Routes & Controller       |
| 9. Intercrop Wizard & AI Assistant |<==== Direct Gemini/Groq =>| 9. Notification Routes & Controller|
| 10. Dashboard & Profile Management |<==== HTTP REST / Sync ===>| 10. User & Location Controller     |
| 11. Offline Sync Queue / localDB   |<==== POST /api/v1/sync ==>| 11. Sync Controller & Idempotency  |
+------------------------------------+                           +------------------------------------+
                                                                                   |
                                                                                   v
                                                                 +------------------------------------+
                                                                 |        POSTGRESQL DATABASE         |
                                                                 +------------------------------------+
                                                                 | • users                            |
                                                                 | • farms_and_locations              |
                                                                 | • field_assessments                |
                                                                 | • marketplace_listings             |
                                                                 | • buyer_requirements               |
                                                                 | • silage_centers & bookings        |
                                                                 | • carbon_activities & offers       |
                                                                 | • claim_dossiers                   |
                                                                 | • agroconnect_posts                |
                                                                 | • notifications                    |
                                                                 | • sync_events (audit log)          |
                                                                 | • logistics_drivers & vehicles     |
                                                                 | • logistics_shipments & stops      |
                                                                 | • driver_current_locations         |
                                                                 | • shipment_location_history        |
                                                                 +------------------------------------+
```

---

## 3. Frontend-to-Backend-to-Database Traceability Matrix

| Feature / Page | Frontend Service / Hook | API Endpoint(s) | HTTP Method | Backend Controller Handler | PostgreSQL Table(s) | Real-Time Events / Rooms | Offline / Fallback Capability |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication & Profile** | `AuthContext.jsx`, `roleManager.js` | `/api/v1/users/:userId`, `/api/v1/users` | `GET`, `POST`, `PATCH` | `getUserById`, `upsertUser`, `updateUser` | `users` | N/A | `localStorage` fallback mirror |
| **Farm GPS & Location** | `locationService.js`, `FarmLocationCard.jsx` | `/api/v1/locations`, `/api/v1/locations/:userId` | `GET`, `POST` | `getUserLocations`, `saveLocation` | `farms_and_locations`, `users` | N/A | Cached in IndexedDB & localDB |
| **Viability Scanner** | `yoloScanner.js`, `fieldAssessmentEngine.js` | `/api/v1/assessments`, `/api/v1/assessments/:id` | `GET`, `POST` | `getAssessments`, `createAssessment` | `field_assessments`, `users` | N/A | 100% Local WASM Inference + Offline DB |
| **Assessment Handoff** | `assessmentHandoffService.js` | In-memory + sessionStorage | Internal | Handoff pipeline | `field_assessments` ref | N/A | Retained across page navigation |
| **Urban Waste Matcher** | `marketplaceService.js`, `WasteMarket.jsx` | `/api/v1/marketplace/listings`, `/api/v1/marketplace/listings/:id` | `GET`, `POST`, `PATCH`, `DELETE` | `getMarketplaceListings`, `createListing`, `updateListing`, `deleteListing` | `marketplace_listings`, `field_assessments`, `users` | `listing:created`, `listing:updated`, `listing:deleted` | IndexedDB cache + `syncQueue` offline draft |
| **AgroConnect Community** | `AgroConnect.jsx`, `realtimeSocketClient.js` | `/api/v1/agroconnect/posts`, `/api/v1/agroconnect/posts/:id/interact`, `/api/v1/agroconnect/posts/:id/connect` | `GET`, `POST`, `PATCH`, `DELETE` | `getAgroConnectPosts`, `createAgroConnectPost`, `updateAgroConnectPost`, `deleteAgroConnectPost`, `interactWithPost`, `manageConnection` | `agroconnect_posts`, `notifications`, `users` | `agroconnect:created`, `agroconnect:updated`, `agroconnect:deleted` | IndexedDB cache + `syncQueue` fallback |
| **Smart Logistics & Consolidation** | `logisticsService.js`, `SmartLogistics.jsx` | `/api/v1/logistics/shipments`, `/api/v1/logistics/shipments/:id`, `/api/v1/logistics/drivers-vehicles` | `GET`, `POST` | `createShipment`, `listShipments`, `getShipmentById`, `getDriversAndVehicles` | `logistics_shipments`, `logistics_shipment_stops`, `logistics_drivers`, `logistics_vehicles` | `shipment:<id>` room subscription | Deterministic local consolidation + offline DB |
| **Driver Live GPS Tracking** | `gpsTrackingService.js`, `SmartLogistics.jsx` | `/api/v1/shipments/:id/location`, `/api/v1/shipments/:id/tracking` | `POST`, `GET` | `updateDriverLocation`, `getShipmentTracking` | `driver_current_locations`, `logistics_drivers`, `shipment_location_history` | `shipment:location_update` | Throttled buffered GPS queue |
| **Logistics State Transitions** | `logisticsService.js`, `SmartLogistics.jsx` | `/api/v1/shipments/:id/status`, `/api/v1/shipments/:id/stops/:stopIndex` | `PATCH` | `updateShipmentStatus`, `updateStopStatus` | `logistics_shipments`, `logistics_shipment_stops`, `logistics_drivers`, `logistics_vehicles` | `shipment:status_changed`, `shipment:stop_progress` | State machine sync via `syncQueue` |
| **Market Intelligence** | `buyerService.js`, `marketPriceService.js`, `buyerMatchingService.js` | `/api/v1/buyers/requirements`, `/api/v1/buyers/requirements/:id` | `GET`, `POST`, `PATCH` | `getBuyerRequirements`, `createBuyerRequirement`, `updateBuyerRequirement` | `buyer_requirements`, `users` | N/A | Cached Agmarknet dataset + IndexedDB |
| **Silage Bank** | `SilageBank.jsx`, `syncManager.js` | `/api/v1/silage/centers`, `/api/v1/silage/bookings`, `/api/v1/sync/silagecenter`, `/api/v1/sync/silagebooking` | `GET`, `POST`, `PATCH` | `getSilageCenters`, `createSilageCenter`, `getSilageBookings`, `createSilageBooking`, `syncEntityAction` | `silage_centers`, `silage_bookings`, `users`, `sync_events` | N/A | Offline-first IndexedDB + `syncQueue` adapter |
| **Carbon Cash** | `CarbonCash.jsx`, `syncManager.js` | `/api/v1/carbon/activities`, `/api/v1/carbon/activities/:id/offers`, `/api/v1/sync/carbonactivit` | `GET`, `POST`, `PATCH` | `getCarbonActivities`, `createCarbonActivity`, `submitCarbonOffer`, `respondToCarbonOffer`, `syncEntityAction` | `carbon_activities`, `carbon_offers`, `users`, `sync_events` | N/A | Offline-first IndexedDB + `syncQueue` adapter |
| **Claim Rocket** | `ClaimRocket.jsx`, `claimRocketService.js` | `/api/v1/claims`, `/api/v1/claims/:id`, `/api/v1/sync/claim` | `GET`, `POST`, `DELETE` | `getClaimDossiers`, `createClaimDossier`, `deleteClaimDossier`, `syncEntityAction` | `claim_dossiers`, `field_assessments`, `users`, `sync_events` | N/A | Offline Dossier generation + `syncQueue` adapter |
| **System Notifications** | `NotificationBell.jsx` | `/api/v1/notifications/:userId`, `/api/v1/notifications/:id/read`, `/api/v1/notifications/:userId/read-all` | `GET`, `PATCH`, `POST`, `DELETE` | `getUserNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `deleteNotification` | `notifications`, `users` | Polled / Event-driven | IndexedDB fallback |
| **AI Assistant & Intercrop** | `geminiService.js`, `groqService.js`, `AIAssistant.jsx`, `IntercropWizard.jsx` | Cloud APIs (Google Generative AI, Groq API) | `POST` | Direct Client Proxy with model fallback cascade | N/A | N/A | Rule-based offline deterministic agronomic engine fallback |

---

## 4. Real-Time Socket Architecture & Security Boundaries

### 4.1 Broadcast Channels
- `listing:created`: Broadcast to all connected clients when any user publishes a marketplace listing.
- `listing:updated`: Broadcast when a listing status or price changes.
- `listing:deleted`: Broadcast when a listing is removed.
- `agroconnect:created`: Broadcast when a farmer shares advice, resource requests, or waste offerings.
- `agroconnect:updated`: Broadcast when a post is edited or interacted with.
- `agroconnect:deleted`: Broadcast when a post is removed.

### 4.2 Authenticated Shipment Rooms (`shipment:<shipmentId>`)
- Room Access Control: Upon `subscribe:shipment`, the backend verifies that the requesting `userId` is either:
  1. The assigned Driver (`driver_user_id` or `driver_id`).
  2. The primary Buyer (`primary_buyer_id`).
  3. A participating Buyer listed in `buyer_allocations`.
  4. A participating Farmer listed in `farmer_allocations`.
  5. An Admin (`admin`).
- Unauthenticated or unauthorized clients receive `subscription:error (UNAUTHORIZED_SHIPMENT_SUBSCRIPTION)` and are blocked from the room.
- Privacy-Sanitized Telemetry: Farmers and Buyers receive estimated ETA minutes, remaining distance in km, stop index, and progress percentage. **ZERO raw driver GPS coordinates (latitude/longitude) are sent to Farmers or Buyers.** Raw coordinates are transmitted exclusively to the Driver and Admins.

---

## 5. Offline & Synchronization Architecture

```
[User Action]
      │
      ├──> [Online: fetch() Direct to API] ──> [PostgreSQL 201/200] ──> [Socket.IO Broadcast] ──> [IndexedDB Cache]
      │
      └──> [Network Failure / Offline]
                 │
                 ├──> [Save Local Draft in IndexedDB + localStorage] (sync_status = 'pending')
                 │
                 ├──> [Enqueue Action in syncQueue]
                 │
                 └──> [syncManager on Online Event]
                            │
                            ├──> [POST /api/v1/sync/:entityType] (with X-Idempotency-Key)
                            │
                            ├──> [PostgreSQL Upsert + sync_events Audit Log]
                            │
                            └──> [Update Local Record: sync_status = 'synced']
```

---

## 6. Database Foreign-Key Integrity

- `farms_and_locations.user_id` -> `users(user_id)` ON DELETE CASCADE
- `field_assessments.user_id` -> `users(user_id)` ON DELETE CASCADE
- `marketplace_listings.creator_id` -> `users(user_id)` ON DELETE CASCADE
- `marketplace_listings.source_assessment_id` -> `field_assessments(id)` ON DELETE SET NULL
- `buyer_requirements.buyer_id` -> `users(user_id)` ON DELETE CASCADE
- `silage_centers.creator_id` -> `users(user_id)` ON DELETE SET NULL
- `silage_bookings.creator_id` -> `users(user_id)` ON DELETE CASCADE
- `silage_bookings.center_id` -> `silage_centers(id)` ON DELETE SET NULL
- `carbon_activities.creator_id` -> `users(user_id)` ON DELETE CASCADE
- `carbon_activities.sponsor_id` -> `users(user_id)` ON DELETE SET NULL
- `carbon_offers.activity_id` -> `carbon_activities(id)` ON DELETE CASCADE
- `carbon_offers.sponsor_id` -> `users(user_id)` ON DELETE CASCADE
- `claim_dossiers.creator_id` -> `users(user_id)` ON DELETE CASCADE
- `claim_dossiers.source_assessment_id` -> `field_assessments(id)` ON DELETE SET NULL
- `agroconnect_posts.creator_id` -> `users(user_id)` ON DELETE CASCADE
- `notifications.user_id` -> `users(user_id)` ON DELETE CASCADE
- `sync_events.user_id` -> `users(user_id)` ON DELETE CASCADE
- `logistics_drivers.user_id` -> `users(user_id)` ON DELETE SET NULL
- `logistics_vehicles.driver_id` -> `logistics_drivers(driver_id)` ON DELETE SET NULL
- `logistics_shipments.primary_buyer_id` -> `users(user_id)` ON DELETE SET NULL
- `logistics_shipments.driver_id` -> `logistics_drivers(driver_id)` ON DELETE SET NULL
- `logistics_shipments.vehicle_id` -> `logistics_vehicles(vehicle_id)` ON DELETE SET NULL
- `logistics_shipment_stops.shipment_id` -> `logistics_shipments(shipment_id)` ON DELETE CASCADE
- `driver_current_locations.driver_id` -> `logistics_drivers(driver_id)` ON DELETE CASCADE
- `driver_current_locations.shipment_id` -> `logistics_shipments(shipment_id)` ON DELETE SET NULL
- `shipment_location_history.shipment_id` -> `logistics_shipments(shipment_id)` ON DELETE CASCADE

---

## 7. Identified Disconnected / Partially Connected Paths

1. **Payment / Transaction Settlement Gateway**:
   - Status: **⚪ NOT IMPLEMENTED**
   - Rationale: Marketplace and Silage modules facilitate price discovery, communication, and logistical aggregation; no active UPI/Razorpay/Stripe live escrow gateway is connected on backend.
2. **Government PMFBY / National Insurance API Submission**:
   - Status: **⚪ NOT IMPLEMENTED**
   - Rationale: Claim Rocket generates legally structured claim dossiers with embedded YOLOv8 computer vision damage percentages and visual evidence PDFs for self-submission by the farmer; no live PMFBY government REST gateway exists.
3. **Direct Silage & Carbon Direct-REST vs Sync-Queue**:
   - Status: **🟢 CONNECTED (Dual Route)**
   - Rationale: Frontend UI uses offline-first `syncQueue` -> `/api/v1/sync/:entityType` for immediate local responsiveness, while dedicated `/api/v1/silage/*` and `/api/v1/carbon/*` direct endpoints exist on the backend.
