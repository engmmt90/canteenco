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
