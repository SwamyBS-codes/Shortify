# URL Shortener — Interview Summary

This document summarizes the URL Shortener project for interview purposes: overview, architecture, component walkthrough, situational "why" explanations, and demo talking points.

**Project Overview**
- Purpose: A self-hostable URL shortener service (API + frontend) that creates short links, supports custom aliases, password protection, expiration, analytics, and user accounts.
- Stack: Node.js (ESM) backend (Express), PostgreSQL (postgres), Redis (optional cache), Vite + React frontend.
- Key features: create short links, redirect handling, password-protected links, expiration and scheduling, link analytics, rate limiting, optional auth, caching, and alias validation.

**Repository Layout (important paths)**
- Backend: backend/
  - `backend/src/server.js` — Express server and routes
  - `backend/src/services/linkService.js` — Core business logic for links
  - `backend/src/services/authService.js` — Registration/login/token logic
  - `backend/src/data/linkStore.js` — Postgres data access for URLs
  - `backend/src/data/userStore.js` — Postgres data access for users
  - `backend/src/cache/redisCache.js` — Redis caching helpers
  - `backend/src/middleware/` — `optionalAuth.js`, `rateLimiter.js`, `requestLogger.js`
  - `backend/src/utils/` — helpers (`slug.js`, `formatLink.js`, `token.js`, `visitMetadata.js`)
- Frontend: client/ (React + Vite)
  - `client/src/components` — UI pieces for creation, dashboard, analytics
  - `client/src/api` — wrappers for backend endpoints

**High-level Architecture**
- Client (React app) calls REST API on the backend for creating links, fetching link metadata, analytics, and auth.
- Backend implements express routes, uses `linkService` and `authService` for business rules.
- Data layer: Postgres stores `urls`, `users`, and `url_visits` tables. `linkStore` and `userStore` provide SQL access.
- Redis optional cache stores mapping `short:code:{code}` => original URL to speed redirects.
- Middleware layer: rate limiting, request logging, optional auth injection.
- Redirect flow: public route `/:code` or `/api/resolveLink/:code` -> `resolveShortLink` -> optionally serve password screen or 302 redirect.

**Key Implementation Details (concise)**
- Slug generation and alias rules: `slug.js` creates random slugs and sanitizes custom aliases; `linkService.aliasIsAllowed` enforces regex and reserved words.
- Link creation: `createShortLink` validates input, normalizes URL, avoids shortening own domain, reuses existing link when appropriate, hashes password with `bcrypt`, stores link in Postgres via `addUrl`.
- Redirect optimization: `resolveShortLink` checks Redis cache; increments click counts and records visit in `url_visits`.
- Security & robustness: rate limiting (several buckets), `helmet`, CORS origin whitelist, password-protection handling with explicit error codes (e.g., `PASSWORD_REQUIRED`, `EXPIRED`, `INACTIVE`).
- Auth: `registerUser` and `loginUser` validate inputs, hash passwords, and return JWTs produced by `utils/token.js`.

**Situational Interview Questions & Suggested Answers**
- Q: Why did you choose Node.js + Express and Postgres?
  - A: Fast iteration and ecosystem for REST APIs; Express is lightweight and composable with middlewares. Postgres provides strong relational guarantees, array support for tags, and robustness for analytics queries.
- Q: Why use Redis cache for redirects?
  - A: Redirects are high-QPS and simple lookups; caching reduces DB load and latency for common short codes. The cache is optional—graceful fallback when Redis unavailable.
- Q: How do you handle collisions for slugs?
  - A: Generate candidate slugs and check `checkCodeExists`; attempt up to a bounded number of times (5) then fail fast. Custom aliases are sanitized and checked for availability before use.
- Q: How do you protect against abuse?
  - A: Rate limiting per-route, `helmet`, CORS, and optional request logging to detect suspicious patterns. Redis reconnection strategy avoids crashing the app.
- Q: How are password-protected links implemented?
  - A: Passwords hashed with `bcrypt`; protected links return a `PASSWORD_REQUIRED` error on resolve and a separate verification endpoint `/api/links/:code/verify` which compares hashes and records visits on success.
- Q: Why separate `service` and `data` layers?
  - A: Separation of concerns: services contain business rules, validation, caching logic; data layer contains SQL queries. This aids testing and maintainability.
- Q: How do you ensure a link cannot shorten your own domain?
  - A: `assertNotOwnDomain` parses URLs and compares hostnames with `BASE_URL` to prevent self-referential shortening.

**Common Follow-ups (short answers)**
- Database indexes: index `short_code`, `original_url`, and `url_visits.url_id`. Consider partial indexes for active links.
- Consistency: use DB transactions for multi-step updates (not shown everywhere—could be added). Ensure cache invalidation when updating custom aliases.
- Scaling: separate read/write DB, use Redis cluster or CDN for redirects, enqueue analytics writes with a worker, and use a CDN or edge functions for redirects.

**Demo talking points & steps**
- Show homepage and link creation, demonstrate custom alias and password protection.
- Create a short link and show redirect latency; mention cache hit vs miss behavior.
- Open analytics view to show visits, device/browser breakdown, and clicks over time.
- Walk through `server.js` and `linkService.js` to explain a request flow end-to-end.

**Edge cases & improvements to mention**
- Add transactional safety for alias swaps and cache invalidation.
- Add link preview metadata scraping to improve titles.
- Add rate-limited IP-based blocking and CAPTCHA for anonymous creation.
- Harden JWT secret management and rotate keys.

---
If you'd like, I can:
- Produce a one-page cheat-sheet (600–800 characters) for interview notes.
- Generate a short demo script with exact terminal commands and URLs.
- Add suggested answers for behavioral/situational questions (e.g., trade-offs, incident response).

Tell me which next step you want.