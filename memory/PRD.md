# campcook PRD

## Problem statement
Build a mobile app named campcook for fast, fresh campus canteen ordering.

## Architecture
- Expo SDK 57 React Native mobile frontend with Expo Router, local secure session storage, responsive phone layout, and a single connected ordering journey.
- FastAPI backend on port 8001 with MongoDB persistence for menu items, users, and orders.
- Payment boundary for Razorpay order creation and signature verification.
- Messaging boundary for Twilio Verify OTP, SMS order updates, and WhatsApp order updates.

## User personas
- Students who need quick meals between classes and want a simple campus payment flow.
- Staff who need the same menu and order tracking with a staff identity.
- Campus dining operators who need durable orders and status notifications.

## Core requirements (static)
- Welcome/auth screen with Student/Staff role selection, ID/email entry, SMS phone field, Google sign-in entry point, and “Good Food, Brighter Days” visual direction.
- Backend menu browsing with categories, search, popular dishes, item details, quantities, and cart totals.
- Checkout with Razorpay method choice and cash-at-counter fallback.
- Persistent orders and order tracking timeline.
- Profile with role, meal balance, order preferences, and notification status.
- Twilio OTP, SMS order updates, and WhatsApp order updates with secure server-only credentials.

## Implemented (2026-09-22)
- Replaced the starter screen with campcook’s green editorial mobile experience and connected navigation for welcome, menu, detail, cart, checkout, orders, and profile.
- Added seeded MongoDB menu data, demo session login, persistent cash orders, order history, secure session storage, and backend API helpers.
- Added Razorpay backend order/signature routes and native `react-native-razorpay` client path.
- Added Twilio Verify OTP, SMS, WhatsApp, and order notification routes with clear credential gating.
- Added Emergent-managed Google configuration endpoint and a safe frontend entry point.
- Added environment placeholders for Twilio, Razorpay, and managed Google callback configuration without exposing secrets.
- Verified with lint, API checks, Playwright mobile flow, and Expo tester regression suite (4/4 backend checks; critical frontend flow passed).

## Prioritized backlog

### P0
- Supply Razorpay test credentials and native-build configuration; verify UPI/card/wallet payment, signature verification, webhook capture, cancellation, and retry.
- Supply Twilio Account SID, Auth Token, Verify Service SID, SMS sender, and WhatsApp sender; verify OTP and message delivery in Twilio Test Mode.
- Supply Emergent-managed Google callback/session configuration and verify native sign-in, cold-start callback, expiry, and sign-out.

### P1
- Replace demo identifier login with verified campus identity and server-side session/JWT authorization.
- Add Razorpay webhook idempotency and payment reconciliation status updates to order tracking.
- Add admin/operator controls for menu availability and order status changes.
- Add live refresh or push updates for order timeline.

### P2
- Meal plan top-up and dining points.
- Saved pickup locations and reorder shortcuts.
- Analytics for popular dishes, notification delivery, and checkout conversion.

## Next tasks
1. Add the credentials listed in `/app/memory/test_credentials.md` / backend environment.
2. Rebuild a native development app because Razorpay does not run in Expo Go.
3. Run native payment, OTP, SMS, WhatsApp, and managed Google callback tests.