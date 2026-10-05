# campcook PRD

## Problem statement
Build a mobile app named campcook for fast, fresh campus canteen ordering, with a caterer operations workspace for the kitchen team.

## Architecture
- Expo SDK 57 React Native frontend with expo-router file routes: customer app under `app/(customer)/` tabs (home, orders, cart, profile) plus `app/detail.tsx` and `app/checkout.tsx`; hidden caterer workspace under `app/caterer/` (login + Today/Queue/Menu/Sales tabs + order detail + offline-bill modal).
- Shared state: `src/store.tsx` (customer session/cart/menu) and `src/caterer.tsx` (caterer session, kitchen types/helpers). Shared styles in `src/ui.ts`; theme tokens in `src/theme.ts` (botanical green).
- FastAPI backend on port 8001 with MongoDB: menu, users, sessions (stable user ids per identifier), orders (app + offline source), caterers.
- Razorpay and Twilio remain credential-gated scaffolds (503 until keys supplied).

## User personas
- Students/staff ordering meals between classes.
- Campus catering operators running the kitchen queue, menu, offline billing, and daily sales.

## Core requirements (static)
- Customer: sign-in (student/staff ID or email), browse menu, dish detail, cart with visible quantities, checkout (Razorpay when configured, cash at counter), order tracking, profile.
- Caterer: separate hidden login (staff ID/email), live queue with accept → preparing → ready → completed, order detail with customer contact/notes/pickup, menu management (add/edit/price/availability), daily sales summary, offline billing persisted to the same DB.
- Twilio OTP/SMS/WhatsApp updates and Emergent-managed Google sign-in activate once credentials/platform config are supplied.

## Implemented (2026-10-05)
- Split the monolithic customer screen into expo-router routes with real tab navigation; every profile row now works (orders link, pickup preference persisted, payment/help sheets).
- Dish cards show a − count + stepper so added quantities are visible at a glance; cart tab badge mirrors totals.
- Caterer workspace: `/caterer/login` (demo staff ID CAT1001), Today dashboard (earnings, stats, queue preview, offline-bill entry), Queue (filters, 1-tap status transitions with haptics, APP/OFFLINE + payment pills), order detail (contact, call button, notes, sticky status bar), Menu manager (search, availability switches, add/edit modal), Sales (revenue hero, payment-method bars, source split, top dishes).
- Backend caterer API: `/api/caterer/login|orders|orders/{id}|orders/{id}/status|menu (GET/POST/PATCH)|sales|offline-orders` with 401/403 role guards and validated status transitions.
- Offline bills persist in `orders` with `source: "offline"` and feed sales/queue.
- Auth hardening: stable user id per identifier + `sessions` collection; order history survives sign-out/sign-in (was the HIGH bug found in testing).
- Testing agent passes: full customer + caterer flows green; focused re-verification of auth fix green; pytest 9/9.

## Implemented (2026-10-05, round 4)
- Emergent-managed Google sign-in is live: web redirect + native auth-session flow, `POST /api/auth/session` exchange (one-time session_id guard, user upsert by email, 7-day sessions), `GET /api/auth/me` validation on startup, `google_managed_ready: true`.
- Discreet "Kitchen staff? Caterer sign-in" link on the welcome screen → `/caterer/login` (works in Expo Go where there is no address bar).
- Caterer sales export: CSV (share sheet on native, file download on web) and daily PDF report via expo-print + expo-sharing (native; web shows guidance).
- Testing agent pass: 14/14 pytest, all UI flows green.

## Prioritized backlog

### P0
- Supply Razorpay test credentials; verify native payment, signature, webhook.
- Supply Twilio credentials; verify OTP + SMS/WhatsApp order updates.

### P1
- Complete Emergent-managed Google sign-in end-to-end (playbook + callback config).
- Live refresh/push updates for order status; Razorpay webhook reconciliation.
- More caterer accounts management UI (currently seed-based).

### P2
- Meal plan top-up, saved pickup locations, reorder shortcuts, analytics.

## Next tasks
1. Add Razorpay/Twilio credentials to backend env and run native tests (Razorpay needs a dev build, not Expo Go).
2. Wire managed Google sign-in per integration playbook.
