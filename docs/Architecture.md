# CanteenCo Architecture

## Product goal
CanteenCo is a multi-school canteen platform for parent-managed family wallets, student identification, cashier sales, pre-orders, notifications and reporting.

## Core roles
- **Super Admin**: manages all schools, products, users, approvals, reports and settings.
- **School Admin**: reserved for future delegation to one school.
- **Cashier**: sales, student lookup, pre-order preparation/pickup and label printing only.
- **Parent**: manages children, family wallet, top-up requests, pre-orders, statements and notification preferences.

## Non-negotiable business rules
1. A parent has **one family wallet** shared by all approved children.
2. Each purchase still records the student who used the family wallet.
3. Parents can **request** a top-up but cannot credit their own wallet. A super admin confirms cash receipt before crediting the wallet.
4. Wallet ledger entries are immutable at application level. Corrections are new reversing/refund entries, never deletion of financial history.
5. Product catalogue and prices are global across all schools in v1.
6. A student can be found by QR token, display code (for example `3C-001`), or name search.
7. The QR contains only an opaque stable token. Student details are always loaded server-side.
8. Negative-balance sales are optional per school and require admin password re-authentication for each override.
9. Pre-order cutoff time is configurable per school.
10. Pre-orders debit the family wallet when confirmed. Pickup only changes order status and sends notification.
11. Parent notifications are configurable by event and channel. Transaction history remains visible even if notifications are disabled.
12. Inventory management is explicitly deferred to a future phase.

## Technical baseline
- Next.js 16 App Router
- TypeScript
- PostgreSQL (Neon planned)
- Prisma ORM 7
- API-first service layer so future iOS/Android apps reuse the same business logic
- Soft deletion for mutable business records; no deletion for wallet transactions
- Server-side validation and price calculation
- Idempotent sale confirmation to prevent double charging (implementation milestone)

## Main modules
`auth`, `schools`, `parents`, `students`, `wallets`, `products`, `sales`, `preorders`, `notifications`, `reports`, `audit`.

## Cash Top-Up Workflow
- Parents submit a top-up request for AUD $5, $10, $20, $50, $100, or a validated custom amount.
- Creating a request never changes the family wallet balance.
- A request starts as `PENDING` and may be cancelled while still pending.
- Only an authorised admin can confirm a request after physically receiving the cash.
- Confirmation is atomic and idempotent: the request is conditionally moved from `PENDING` to `CONFIRMED`, the family wallet is credited once, and a `TOP_UP` wallet transaction is created in the same database transaction.
- `WalletTransaction.topUpRequestId` is unique, providing an additional database-level guard against duplicate credits.
- Every confirmed cash top-up creates an audit-log entry and queues notifications according to the parent's notification preferences.


## Cashier sales
- Student lookup accepts QR token, display code such as `3C-001`, or name.
- Product prices are always recalculated server-side from the active product catalogue.
- Family-wallet debit, Sale, SaleItems and WalletTransaction are committed in one serializable database transaction.
- Each sale carries a unique idempotency key to prevent double submission.
- Negative balances require school policy to allow them, must remain above the configured minimum balance, and require a valid active admin password.
- The QR token remains independent of the student display code.

## Pre-orders
- Parent selects an approved child, active products, pickup date and an active school pickup slot.
- Same-day ordering respects the per-school `preOrderCutoffTime`.
- The full amount is debited from the shared family wallet at order confirmation.
- Pre-orders do not permit overdraft in the current release.
- Workflow: `CONFIRMED -> PREPARING -> READY -> PICKED_UP`.
- Before preparation, a parent may cancel a confirmed order; the original order remains and a separate refund wallet transaction restores the balance.
- Cashier label printing uses a compact 62mm x 40mm print layout with order number, student, class and pickup slot.
- Pre-order creation is idempotent to prevent duplicate debit on double submission.

## Notification delivery
- Business actions queue notifications; they never wait for an external email/SMS provider.
- `IN_APP` notifications are available immediately.
- `EMAIL` and `SMS` notifications are queued in the `Notification` table and processed by `POST /api/internal/notifications/process`.
- The worker endpoint requires `Authorization: Bearer <NOTIFICATION_WORKER_SECRET>`.
- Email adapter uses Resend when configured; SMS adapter uses Twilio when configured. Provider code is isolated so either service can be replaced later.
- Failed deliveries retry with exponential backoff up to five attempts.
- Parent preferences independently control channels and event types, including a configurable low-balance threshold.

## Admin reporting
- Dashboard sales metric now reads completed sales from the database.
- Reports support school filtering for Super Admin and automatic school scoping for School Admin.
- Reports include sales, pre-orders, active students, negative wallets and wallet balances.
- Student search supports name and display code such as `3C-001`.
- Sales can be exported as CSV from an authenticated admin endpoint.
- Family-wallet review exposes shared balance alongside all active children attached to the parent.

## Admin management
- Super Admin can create schools with timezone/settings foundation.
- Admins can create catalogue products used by cashier and pre-order flows.
- Super Admin can create Cashier or School Admin accounts; School Admin is scoped to its own school.
- Staff passwords are hashed with bcrypt and never stored as plaintext.
- Active/inactive state is represented explicitly for schools, products and staff.
