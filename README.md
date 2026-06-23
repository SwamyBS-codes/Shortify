# Shortify — Smart URL Shortener

A production-ready, full-stack URL shortening service featuring detailed click analytics, custom short code aliases, onboarding hints, secure password protection, link expiration windows, and active/disabled toggles.

This repository hosts both the backend and frontend client in a monorepo setup: a Node.js/Express backend monolith communicating with PostgreSQL and Redis, and a React (Vite) frontend styled with a premium glassmorphic theme.

New here? This README gets you from a fresh clone to a running, audited, and optimized application.

---

## Table of Contents
1. [Tech Stack](#tech-stack)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [Running the App](#running-the-app)
7. [Database Setup & Seeding](#database-setup--seeding)
8. [Project Structure](#project-structure)
9. [API Documentation](#api-documentation)
10. [Authentication & Security](#authentication--security)
11. [Caching & Rate Limiting](#caching--rate-limiting)
12. [Verification & Linter](#verification--linter)

---

## Tech Stack

### Backend
- **Core**: Node.js & Express (Modular Monolith)
- **Database**: PostgreSQL (managed client, raw queries protected against SQL injection using tagged template literals)
- **Cache & Session Management**: Redis (used for analytics/redirection caching with automatic database fallback if unavailable)
- **Security**: Constant-time signature comparison for JWT checks (`crypto.timingSafeEqual`)
- **Rate Limiting**: Custom rate-limiter middleware preventing abuse

### Frontend
- **Core**: React (Vite build system)
- **Routing**: React Router DOM (v6)
- **State Management**: React Context (`AuthContext`, `LinkWorkspaceContext`, `ThemeContext`, `ToastContext`)
- **Styling**: Vanilla CSS (Custom tokens, premium glassmorphism gradients, micro-animations, and responsive grids)
- **Visual Features**: Dark/Light mode theme syncing, Dynamic QR Code generators, interactive analytical chart dashboards.

---

## Architecture

The project is structured as a two-tier monorepo:

```mermaid
graph TD
    Client[React Client SPA: Vite] -->|Requests /api| DevProxy[Vite Dev Server Proxy]
    DevProxy -->|Port 3001| Express[Express Server Boilerplate]
    Client -->|Direct Production| ProdDomain[duckdns.org Production Backend]
    Express -->|Read/Write| Postgres[(PostgreSQL Database)]
    Express -->|Cache/Rate Limits| Redis[(Redis Key-Value Cache)]
```

- **Client App**: Single Page Application communicating via an Axios HTTP client. In development, requests are proxied locally to port 3001. In production, they direct to the deployed server.
- **Backend API**: Stateless server processing shortened links, validation, authentication, and forwarding clicks to analytics.

---

## Prerequisites

Ensure you have the following installed on your system:
- **Node.js** (v18.x or higher)
- **PostgreSQL** (v14.x or higher)
- **Redis** (optional, recommended for production rate-limiting and caching)

---

## Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/SwamyBS-codes/URL-Shortner.git
   cd URL-Shortner
   ```

2. **Install dependencies** for both tiers:
   ```bash
   # Install client dependencies
   cd client && npm install
   
   # Install backend dependencies
   cd ../backend && npm install
   ```

3. **Set up configurations**: Follow the [Environment Variables](#environment-variables) section below to create `.env` files in both directories.

---

## Environment Variables

### Backend (`backend/.env`)
Create a `.env` file in the `backend/` directory:
```env
# Server Configuration
PORT=3001
BASE_URL=http://localhost:3001
JWT_SECRET=your_jwt_signing_secret_key_change_me_in_production

# PostgreSQL Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/dbname

# Redis Configuration (Optional, fallback to memory if omitted)
REDIS_URL=redis://127.0.0.1:6379
```

### Client (`client/.env`)
Create a `.env` file in the `client/` directory. Leave the URL commented out in development to use the Vite proxy:
```env
# API Base URL (Leave commented out for local Vite proxy, uncomment for production builds)
# VITE_API_BASE_URL=https://urlshortner-api.duckdns.org/api
```

---

## Running the App

### 1. Start the Backend API
From the root directory:
```bash
cd backend
npm run dev
```
The server will start on port `3001` (by default) with auto-reload enabled.

### 2. Start the Frontend client
In a new terminal shell:
```bash
cd client
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your browser.

---

## Database Setup & Seeding

The database tables are initialized automatically when you set up the DB.

To create or reset the tables manually, run the database configuration setup script:
```bash
cd backend
node src/setupDb.js
```
This script validates your `DATABASE_URL` and initializes the following schema:
- `users`: User profiles with encrypted credentials.
- `links`: Shortened URL data, expiration parameters, custom aliases, ownership.
- `clicks`: Analytical timestamps, IP addresses, user agents, referrers.

---

## Project Structure

```
URL_Shortner/
├── backend/
│   ├── src/
│   │   ├── cache/          # Redis and memory cache implementations
│   │   ├── data/           # Data stores & SQL query templates
│   │   ├── middleware/     # Auth checks, rate limiters, validation
│   │   ├── services/       # Business logic (redirections, analytics)
│   │   ├── utils/          # Encryptors, string generators, JWT helpers
│   │   ├── config.js       # Configuration parsing
│   │   ├── db.js           # DB client connector
│   │   ├── server.js       # Main server entrypoint & controllers
│   │   └── setupDb.js      # Migration/setup schema script
│   └── package.json
├── client/
│   ├── src/
│   │   ├── api/            # Axios instance and endpoints functions
│   │   ├── components/     # UI components (charts, tables, forms)
│   │   ├── context/        # React context wrappers
│   │   ├── pages/          # Layout views (dashboard, analytics, access)
│   │   ├── utils/          # Date formatting and validations
│   │   ├── App.jsx         # Router configuration
│   │   ├── index.css       # Core design tokens
│   │   └── App.css         # Styling overrides & Glassmorphism styles
│   └── eslint.config.js    # Linter rules config
└── README.md
```

---

## API Documentation

All API requests expect JSON payloads and return JSON responses. Authorized endpoints require a header format: `Authorization: Bearer <JWT_TOKEN>`.

### Public Redirection
- **`GET /:code`**
  Resolves the short code and performs a `302 Found` redirect. Handles expiration checks, password protection screens, and schedule checks.

### Auth Endpoints
- **`POST /api/register`**
  Creates a new user account.
  *Payload:* `{ "name": "...", "email": "...", "password": "..." }`
- **`POST /api/login`**
  Logs in a user and returns a token.
  *Payload:* `{ "email": "...", "password": "..." }`

### Short Link Operations (Authenticated / Optional Auth)
- **`POST /api/createlink`**
  Creates a shortened code.
  *Payload:*
  ```json
  {
    "url": "https://example.com",
    "customAlias": "optional-custom-alias",
    "password": "optionalPassword",
    "expirationType": "none | 1h | 6h | 12h | 1d | 7d | 30d | custom_range",
    "expirationStartDate": "ISO-date-string",
    "expirationEndDate": "ISO-date-string",
    "folder": "optional-folder",
    "tags": ["campaign", "social"]
  }
  ```
- **`GET /api/links`**
  Lists all links owned by the authenticated user.
- **`PUT /api/links/:code`**
  Updates settings (destination URL, alias, active state, expiration type) for an owned link.
- **`DELETE /api/links/:code`**
  Removes a link code and its analytics.

### Analytics & Metadata
- **`GET /api/links/:code/analytics`**
  Retrieves detailed click analytics (clicks over time, referrers, browsers, operating systems).
- **`GET /api/dashboard`**
  Retrieves quick-stats (total clicks, active count, expired count) for the logged-in user.

---

## Authentication & Security

1. **JWT Verification Security**: Tokens are signed using HMAC-SHA256. Signature comparison implements timing-safe comparison blocks using `crypto.timingSafeEqual` in Node.js to eliminate timing-attack vector leaks.
2. **SQL Injection Mitigation**: All SQL database operations are processed via the `postgres` driver's tagged template literals, ensuring input query values are sanitized automatically.
3. **Password Hashing**: User authentication passwords are encrypted using strong cryptographic methods.

---

## Caching & Rate Limiting

- **Caching**: Link redirection lookups are cached inside Redis. If Redis goes offline, the application logs a warning and queries PostgreSQL directly without throwing runtime exceptions.
- **Rate Limiting**: Custom rate limiting is applied globally and on a per-IP basis on endpoints like `/api/createlink` to protect database connections from spam requests.

---

## Verification & Linter

Clean code quality is maintained on the client. To run the static analysis check, execute:
```bash
cd client
npm run lint
```
All components are fully optimized with React hooks callbacks (`useCallback`), and any unused imports have been stripped to ensure maximum speed and bundle optimization.
