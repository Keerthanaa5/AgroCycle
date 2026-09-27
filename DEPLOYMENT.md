# AgroCycle — Production Deployment Guide

This document outlines the step-by-step production deployment instructions for both the Node.js/Express backend service and the React 18 + Vite Progressive Web Application (PWA).

---

## 1. Architecture Overview

```mermaid
flowchart TD
    subgraph Client [Client Browser / PWA]
        FE[React 18 + Vite Frontend]
        IDB[(IndexedDB AgroCycleDB)]
        SW[ServiceWorker & WASM Cache]
        FE <--> IDB
        FE <--> SW
    end

    subgraph CDN [Static Frontend Hosting]
        Vercel[Vercel / Netlify / Cloudflare Pages]
        Vercel -->|Serves Bundle| FE
    end

    subgraph CloudBackend [Backend Service]
        Express[Node.js / Express API Gateway]
        Pool[pg Connection Pool]
        Express --> Pool
    end

    subgraph Database [Cloud Database]
        Neon[(Neon PostgreSQL Serverless)]
        Pool -->|SSL Encrypted| Neon
    end

    FE -- "Online Sync / REST API (VITE_API_BASE_URL)" --> Express
```

---

## 2. Environment Variables

### A. Backend (`backend/.env`)

| Variable | Required | Production Value / Example | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | Optional | `5000` (or provided by host) | Server listening port (binds to `0.0.0.0`) |
| `NODE_ENV` | **Yes** | `production` | Enables production security & masks stack traces |
| `DATABASE_URL` | **Yes** | `postgresql://user:password@ep-xyz.region.aws.neon.tech/neondb?sslmode=require` | Neon PostgreSQL SSL connection string |
| `FRONTEND_URL` | **Yes** | `https://app.agrocycle.in,https://agrocycle.in` | Whitelisted CORS origin(s), comma-separated |
| `DB_SSL` | Optional | `true` | Enforces SSL for database connections |
| `DB_POOL_MIN` | Optional | `2` | Minimum pool connections |
| `DB_POOL_MAX` | Optional | `10` | Maximum pool connections |
| `BODY_LIMIT` | Optional | `10mb` | Maximum JSON request body limit |

> [!IMPORTANT]
> `DATABASE_URL` must **NEVER** be shared with the frontend or committed to Git.

### B. Frontend (`.env.production` or Platform Environment Settings)

| Variable | Required | Production Value / Example | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | **Yes** | `https://api.agrocycle.in/api/v1` | Public REST API base URL for synchronization |

---

## 3. Database Deployment & Migration (Neon PostgreSQL)

1. **Verify Database Connectivity**:
   Ensure `DATABASE_URL` is set in your backend hosting environment variables.
2. **Apply Migrations**:
   Run the idempotent database migration runner from the `backend/` directory:
   ```bash
   cd backend
   npm run db:migrate
   ```
3. **Verify Migration Status**:
   ```bash
   npm run db:status
   ```
   *Expected Output*: `[APPLIED] 001_initial_schema.sql`

---

## 4. Backend Deployment (Render, Railway, Fly.io, or VPS)

### Build & Start Commands
* **Root Directory**: `backend`
* **Install Command**: `npm install --production=false`
* **Build / Migration Command**: `npm run db:migrate`
* **Start Command**: `npm start` (runs `node src/server.js`)

### Host & Port Binding
* The backend automatically binds to `0.0.0.0` using `process.env.PORT`.
* Default fallback port: `5000`.

### Health Check Verification
After deployment, verify the backend endpoints:
1. **Service Health**:
   ```bash
   curl -i https://<your-backend-domain>/api/v1/health
   ```
   *Expected response*: `HTTP 200 OK` with `{"status":"ok","service":"agrocycle-backend"}`
2. **Database Health**:
   ```bash
   curl -i https://<your-backend-domain>/api/v1/health/db
   ```
   *Expected response*: `HTTP 200 OK` with `{"status":"ok","connected":true}`

---

## 5. Frontend Deployment (Vercel, Netlify, Cloudflare Pages)

### Build & Publish Configuration
* **Root Directory**: `./` (project root)
* **Build Command**: `npm run build`
* **Output Directory**: `dist`
* **Environment Variables**:
  * `VITE_API_BASE_URL=https://<your-backend-domain>/api/v1`

### Offline-First / PWA Verification
* Ensure `public/models/` and `public/wasm/` assets are deployed with the bundle.
* The Service Worker (`public/sw.js`) automatically pre-caches:
  * Application shell (`index.html`, CSS, JS)
  * Local YOLO11n ONNX edge vision model (`/models/agrocycle_yolo11n.onnx`)
  * WebAssembly runtime binaries (`/wasm/ort-wasm-simd-threaded.*`)
* All spatial scanning and Layer B decision algorithms function 100% offline.

---

## 6. Pre-Deployment Verification Checklist

Before directing production traffic:

- [ ] Run backend unit and integration tests:
  ```bash
  cd backend && npm test && npm run test:phase4 && npm run test:phase5
  ```
- [ ] Verify migration status on live database:
  ```bash
  cd backend && npm run db:status
  ```
- [ ] Clean up any test fixtures from the database:
  ```bash
  cd backend && node src/db/cleanup_test_fixtures.js
  ```
- [ ] Build the frontend production bundle:
  ```bash
  npm run build
  ```
- [ ] Confirm no secrets or `.env` files are tracked by Git:
  ```bash
  git status --ignored
  ```
- [ ] Verify CORS origins whitelist matches your production frontend domains.
