# AgroCycle Backend Service

The lightweight, robust backend foundation and API gateway for the AgroCycle agricultural rescue and circular economy platform.

---

## 1. Overview

AgroCycle Backend provides server-side infrastructure designed to complement AgroCycle's offline-first React PWA. It provides health monitoring, PostgreSQL relational database schema management, and future sync endpoints for cross-device persistence.

### Key Architectural Characteristics
- **Framework**: Node.js with Express.js (ES Modules)
- **Database**: PostgreSQL with `pg` connection pooling
- **Security**: Hardened HTTP headers via `helmet`, origin-validated CORS, request payload size limits.
- **Resilience**: Centralized error handling, standardized JSON error responses, zero credential/stack trace exposure in production.
- **Port Binding**: Binds to `process.env.PORT` on `0.0.0.0` for cloud deployment compatibility.

---

## 2. Directory Structure

```
backend/
├── src/
│   ├── config/
│   │   └── env.js            # Centralized environment validation
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 001_initial_schema.sql  # Canonical PostgreSQL schema
│   │   ├── migrate.js        # Transactional migration runner
│   │   ├── status.js         # Migration status inspector
│   │   └── pool.js           # Centralized PostgreSQL connection pool
│   ├── middleware/
│   │   ├── errorHandler.js   # Centralized error handler
│   │   ├── notFound.js       # 404 handler
│   │   └── requestLogger.js  # Clean structured request logger
│   ├── routes/
│   │   └── healthRoutes.js   # Health & DB health check routes
│   ├── app.js                # Express application configuration
│   └── server.js             # HTTP server entrypoint & graceful shutdown
├── .env.example              # Environment template
├── package.json              # Backend dependencies and scripts
└── README.md                 # Backend documentation
```

---

## 3. Environment Variables

Create a `.env` file inside the `backend/` directory by copying `.env.example`:

```bash
cp .env.example .env
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Port number for the HTTP server to listen on | `5000` |
| `NODE_ENV` | Environment mode (`development` or `production`) | `development` |
| `FRONTEND_URL` | Allowed frontend origins (comma-separated for multiple) | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection URI | `postgresql://...` |
| `DB_SSL` | Enable SSL for cloud databases | `false` (auto in production) |
| `DB_POOL_MIN` | Minimum pool connections | `2` |
| `DB_POOL_MAX` | Maximum pool connections | `10` |
| `BODY_LIMIT` | Maximum allowable request body size | `10mb` |

---

## 4. Commands

### Installation
From the `backend/` directory:
```bash
npm install
```

### Development Mode (with hot-reload / watch)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Run Tests
```bash
npm test              # Core REST API & Database Tests
npm run test:phase4   # Remote Sync Integration Tests
npm run test:phase5   # Domain Modules Integration Tests
```

### Run Database Migrations
```bash
npm run db:migrate    # Apply SQL migrations
npm run db:status     # Inspect migration status
```

---

## 5. API Endpoints

### Health & Monitoring
* `GET /api/v1/health` — Service health status
* `GET /api/v1/health/db` — PostgreSQL database connectivity check

### Users & Authentication Profiles
* `GET /api/v1/users/:userId` — Fetch user profile
* `POST /api/v1/users` — Create/upsert user
* `PATCH /api/v1/users/:userId` — Update user details / verification status

### Farms & GPS Locations
* `GET /api/v1/locations/:userId` — List user farms/locations
* `GET /api/v1/locations/:userId/:farmId` — Get specific farm location
* `POST /api/v1/locations` — Save GPS captured farm coordinates

### Field Assessments (Viability Scanner)
* `GET /api/v1/assessments?user_id=...` — Query field scans
* `GET /api/v1/assessments/:id` — Get assessment with 5-point spatial samples & recommendations
* `POST /api/v1/assessments` — Save field assessment

### Marketplace Listings (Urban Waste Matcher)
* `GET /api/v1/marketplace/listings` — Query listings by crop, status, district
* `GET /api/v1/marketplace/listings/:id` — Get single listing
* `POST /api/v1/marketplace/listings` — Create listing (linked to assessment)
* `PATCH /api/v1/marketplace/listings/:id` — Update price/status
* `DELETE /api/v1/marketplace/listings/:id` — Remove listing

### Buyer Requirements (Market Demand)
* `GET /api/v1/buyers/requirements` — Query buyer demand
* `GET /api/v1/buyers/requirements/:id` — Get requirement
* `POST /api/v1/buyers/requirements` — Create demand requirement

### Silage Bank
* `GET /api/v1/silage/centers` — List processing hubs
* `POST /api/v1/silage/centers` — Register processing facility
* `GET /api/v1/silage/bookings` — Query farmer bookings
* `POST /api/v1/silage/bookings` — Book feed pickup
* `PATCH /api/v1/silage/bookings/:id/status` — Status transition

### Carbon Cash
* `GET /api/v1/carbon/activities` — List eco-activities
* `POST /api/v1/carbon/activities` — Farmer logs eco-practice
* `POST /api/v1/carbon/activities/:id/offers` — Sponsor submits offer (anti-self-sponsorship guarded)
* `PATCH /api/v1/carbon/activities/:id/offers/:offerId` — Farmer accepts/declines offer

### Claim Rocket
* `GET /api/v1/claims` — List loss evidence dossiers
* `POST /api/v1/claims` — Create loss documentation dossier

### AgroConnect
* `GET /api/v1/agroconnect/posts` — Query community exchange posts
* `POST /api/v1/agroconnect/posts` — Create community post

### Notifications
* `GET /api/v1/notifications/:userId` — Fetch user notifications
* `POST /api/v1/notifications` — Create notification
* `PATCH /api/v1/notifications/:id/read` — Mark as read
* `PATCH /api/v1/notifications/:userId/read-all` — Mark all read

### Remote Synchronization Gateway
* `POST /api/v1/sync/:entityType` — Idempotent sync for offline queue (`X-Idempotency-Key` header)
* `POST /api/v1/sync/batch` — Batch sync offline queue
* `GET /api/v1/sync/:userId` — User sync audit trail

---

## 6. Entity to PostgreSQL Mapping

| Existing IndexedDB / Local Store | PostgreSQL Relational Table | Primary Key | Key Relationships / Purpose |
| :--- | :--- | :--- | :--- |
| `STORES.USERS` | `users` | `user_id` | Canonical user identity, roles (`farmer`, `buyer`), verification status. |
| `STORES.USER_LOCATIONS` | `farms_and_locations` | `id` | `user_id` $\rightarrow$ `users(user_id)`. Farm GPS, state, district, taluk. |
| `STORES.SCAN_HISTORY` | `field_assessments` | `id` | `user_id` $\rightarrow$ `users(user_id)`. 5-point spatial samples, disease severity, recommendations. |
| `STORES.MARKETPLACE_LISTINGS` | `marketplace_listings` | `id` | `creator_id` $\rightarrow$ `users(user_id)`, `source_assessment_id` $\rightarrow$ `field_assessments(id)`. Urban Waste Matcher listings. |
| `Registered Buyers` | `buyer_requirements` | `id` | `buyer_id` $\rightarrow$ `users(user_id)`. Active demand, target price, buying radius. |
| `STORES.SILAGE_CENTERS` | `silage_centers` | `id` | Silage processing hubs, capacity, and pricing. |
| `STORES.SILAGE_BOOKINGS` | `silage_bookings` | `id` | `creator_id` $\rightarrow$ `users(user_id)`, `center_id` $\rightarrow$ `silage_centers(id)`. |
| `STORES.CARBON_ACTIVITIES` | `carbon_activities` | `id` | `creator_id` $\rightarrow$ `users(user_id)`. Eco-practices, CO2 saved, carbon credits earned. |
| `STORES.CARBON_OFFERS` | `carbon_offers` | `id` | `activity_id` $\rightarrow$ `carbon_activities(id)`, `sponsor_id` $\rightarrow$ `users(user_id)`. |
| `STORES.CLAIM_DOSSIERS` | `claim_dossiers` | `id` | `creator_id` $\rightarrow$ `users(user_id)`, `source_assessment_id` $\rightarrow$ `field_assessments(id)`. ClaimRocket dossiers. |
| `STORES.AGRO_CONNECT` | `agroconnect_posts` | `id` | `creator_id` $\rightarrow$ `users(user_id)`. Community exchange and fodder requests. |
| `STORES.NOTIFICATIONS` | `notifications` | `id` | `user_id` $\rightarrow$ `users(user_id)`. In-app notifications. |
| `Future Remote Sync` | `sync_events` | `id` | `user_id` $\rightarrow$ `users(user_id)`. Remote audit log for queued offline actions with idempotency keys. |
