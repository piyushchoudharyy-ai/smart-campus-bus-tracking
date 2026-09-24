# 🚌 Smart Campus Bus Tracking System
> **Hardware-Free, Real-Time Campus Transit Platform with Offline-First Driver GPS Tracking**

Built for university campuses, college transit networks, and hackathon/SIH-style demonstrations. Turns any driver's smartphone into a real-time GPS tracking device with zero external hardware costs.

---

## 🌟 Key Highlights & Architecture

- **No Hardware Required**: The driver's smartphone browser acts as the GPS tracker using the HTML5 Geolocation API.
- **Offline-First Synchronization**: Continues recording GPS fixes when the vehicle enters cellular dead zones. Queues coordinates in **IndexedDB** and automatically batch-synchronizes with deduplication when connectivity returns.
- **Real-Time WebSocket Gateway**: Bi-directional updates via **Socket.io** (`bus:location_updated`, `emergency:created`, `occupancy:updated`, `trip:started`, etc.) with automatic fallback to polling.
- **Interactive Fleet Maps**: OpenStreetMap & Leaflet interactive maps with route polylines, sequence stop badges, heading indicators, and emergency pulsing animations.
- **Dynamic ETA Engine**: Accurate ETA predictions in minutes using the **Haversine formula**, adaptive speed factoring, and intermediate stop dwell times. Automatically alerts students when a bus is within 350 meters.
- **Distraction-Free Driver Cockpit**: Large touch targets for Start/End Trip, passenger headcount (+ / -), connectivity indicators, and an instant **Emergency Hotline**.
- **Centralized Admin Fleet Console**: Full CRUD for buses, drivers, routes, and stops; delay detection; occupancy metrics; emergency dispatcher; and a built-in **GPS Simulation Engine** for presentations.
- **HTTPS & Secure Context Ready**: Designed to work over public HTTPS required by mobile browsers for Geolocation API access.

---

## 👥 Three Dedicated User Roles

| Role | Features | Default Credentials |
| :--- | :--- | :--- |
| **🎓 Student** | Interactive live map, upcoming stops timeline, real-time ETAs in minutes, bus occupancy rate, route filters, approaching alerts | `student@campus.edu` / `student123` |
| **👨‍✈️ Driver** | Start/End trip, smartphone GPS tracking, IndexedDB offline buffering, passenger count (+/-), 1-tap Emergency dispatch | `driver1@campus.edu` / `driver123` |
| **👑 Admin** | Live fleet monitoring, bus/driver/route management, emergency resolution, operational analytics, GPS simulation engine | `admin@campus.edu` / `admin123` |

> ⚡ **Quick Demo Persona Switch**: The login screen and top navigation bar include instant 1-click persona buttons to switch between Admin, Driver, and Student views instantly during presentations.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Leaflet, Lucide Icons, Socket.io-client, `idb` (IndexedDB).
- **Backend**: Node.js v24, Express, TypeScript, Socket.io, JWT (`jsonwebtoken`), `bcryptjs`.
- **Database**: SQLite using Node.js built-in `node:sqlite` (`DatabaseSync` - zero native compilation issues, ultra-fast WAL mode).
- **Real-Time & Sync**: WebSocket events + IndexedDB offline FIFO queue with batch endpoint `/api/location/batch`.

---

## 📁 Project Structure

```
Campus X/
├── client/                      # Frontend Application (Standalone & Deployable)
│   ├── src/
│   │   ├── components/          # Navbar, StatusBadge, Modal, CampusMap, NotificationDrawer
│   │   ├── hooks/               # useAuth, useSocket, useOfflineSync
│   │   ├── pages/               # AdminDashboard, DriverDashboard, StudentDashboard, Login, Register
│   │   ├── services/            # api.ts, socket.ts, offlineStorage.ts, geolocation.ts
│   │   ├── types.ts             # Self-contained frontend TypeScript interfaces
│   │   └── vite-env.d.ts        # Vite environment types
│   ├── index.html
│   ├── vite.config.ts
│   ├── .env.example
│   └── package.json
├── server/                      # Backend API & WebSocket Gateway (Standalone & Deployable)
│   ├── src/
│   │   ├── db/                  # schema.sql, index.ts (node:sqlite), seed.ts
│   │   ├── middleware/          # auth.ts (JWT & roles), error.ts
│   │   ├── routes/              # auth, buses, drivers, routes, stops, trips, location, emergency, occupancy, analytics, simulation
│   │   ├── services/            # etaService.ts, socketService.ts, simulationService.ts
│   │   ├── utils/               # haversine.ts, jwt.ts
│   │   ├── types.ts             # Self-contained backend TypeScript interfaces
│   │   ├── config.ts            # Production environment configuration
│   │   └── index.ts             # Server entry point (binds 0.0.0.0, trust proxy, static file server)
│   ├── .env.example
│   ├── campus_bus.db            # SQLite database
│   └── package.json
├── shared/
│   └── types.ts                 # Shared contract definitions
├── test_e2e.js                  # Automated End-to-End Test Suite
└── README.md
```

---

## ⚙️ Environment Variables Reference

### Backend (`server/.env`)
| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port for HTTP API and WebSocket server (Render/Railway inject this automatically) |
| `HOST` | `0.0.0.0` | IP interface to bind to (`0.0.0.0` required for cloud containers) |
| `NODE_ENV` | `production` | Set to `production` in live environments |
| `JWT_SECRET` | *(required)* | Secure random string used to sign and verify JWT authentication tokens |
| `CORS_ORIGIN` | `*` | Comma-separated list of allowed frontend origins (e.g., `https://my-campus.vercel.app`) or `*` |
| `DB_PATH` | `./campus_bus.db`| Path to SQLite database file |

### Frontend (`client/.env`)
| Variable | Default | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `/api` | Base URL for REST API. Set to `https://your-api.onrender.com/api` if deployed separately |
| `VITE_SOCKET_URL` | *(origin)* | Host for Socket.io gateway. Set to `https://your-api.onrender.com` if deployed separately |

---

## 🚢 Public Internet Deployment Options

You can deploy this application using either of two modern patterns:

### Option A: Unified Single-Service Deployment (Recommended for simplicity)
*Host backend, API, WebSockets, and built frontend from a single web service (e.g. Render, Railway, Fly.io, or VPS).*

1. **Build Frontend**:
   ```bash
   cd client
   npm install
   npm run build
   ```
2. **Build & Seed Backend**:
   ```bash
   cd ../server
   npm install
   npm run build
   npm run seed
   ```
3. **Start Production Service**:
   ```bash
   npm start
   # Executes: node dist/index.js
   ```
   *The server binds to `0.0.0.0:$PORT` and automatically serves the static production frontend from `client/dist` while handling API routes under `/api` and WebSockets under `/socket.io`.*

---

### Option B: Decoupled Multi-Service Deployment

#### 1. Backend Service (e.g., Render / Railway / Fly.io / Heroku)
- **Root Directory**: `server`
- **Build Command**: `npm install && npm run build && npm run seed`
- **Start Command**: `npm start`
- **Environment Variables**:
  - `PORT`: `5000` (or platform default)
  - `HOST`: `0.0.0.0`
  - `NODE_ENV`: `production`
  - `JWT_SECRET`: `<secure-random-token>`
  - `CORS_ORIGIN`: `https://your-frontend-app.vercel.app`

#### 2. Frontend Static Site (e.g., Vercel / Netlify / Cloudflare Pages)
- **Root Directory**: `client`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_URL`: `https://your-backend-api.onrender.com/api`
  - `VITE_SOCKET_URL`: `https://your-backend-api.onrender.com`

---

## 🔒 Important Security & HTTPS Notice

> [!IMPORTANT]
> **Mobile Geolocation requires HTTPS**: Modern mobile browsers (iOS Safari, Android Chrome) strictly block access to `navigator.geolocation` on insecure HTTP connections when accessed over public domain names or IP addresses.
> 
> When deploying for public use, ensure your hosting provider provides **HTTPS/SSL** (enabled automatically for free on Vercel, Netlify, Render, Railway, Cloudflare, etc.).

---

## 🧪 Automated Testing & Verification

Run the comprehensive integration test suite anytime:
```bash
node test_e2e.js
```

All 14 test suites verify:
- ✅ Backend health & SQLite database integrity
- ✅ Authentication (Admin, Driver, Student)
- ✅ Live enriched telemetry and route stops sequence
- ✅ Real-time Haversine ETA computation
- ✅ Driver smartphone GPS update ingestion
- ✅ **Offline-First IndexedDB batch synchronization**
- ✅ Dynamic passenger occupancy count
- ✅ Emergency SOS dispatch & admin resolution
- ✅ Fleet analytics and KPIs
- ✅ Real-time GPS simulation engine
