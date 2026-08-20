# CanteenCo Verification Runbook

## 1. Install and environment

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL`: Neon pooled runtime URL (`-pooler` hostname).
- `DIRECT_URL`: Neon direct URL used by Prisma CLI/migrations.
- `AUTH_SECRET`: long random secret.
- optional seed credentials.
- notification provider variables only when those providers are ready.

Never commit `.env`.

## 2. First database setup

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run db:seed
npm run db:smoke
```

Expected smoke output reports `database: "ok"` and row counts.

## 3. Code verification

```bash
npm run check:static
npm run typecheck
npm run build
```

Or run all code checks after dependencies are installed:

```bash
npm run verify
```

## 4. End-to-end acceptance path

Use test data only.

1. Open `/parent/register` and submit one parent with two students.
2. Confirm the registration stays pending and no wallet can be used yet.
3. Approve the registration from `/admin/registrations`.
4. Verify one family wallet is created for the parent and both students share it.
5. Verify student display codes use class-first format such as `3C-001` and `3C-002`.
6. Create a `$20` top-up request from the parent wallet.
7. Confirm the wallet balance does not change while the request is pending.
8. Confirm the top-up as admin and verify exactly one `$20` credit transaction.
9. At `/cashier`, find a student by display code and complete a normal sale.
10. Verify the shared family wallet decreases and the transaction references that student.
11. Repeat with the second child and verify it spends from the same wallet.
12. Attempt a sale above the balance. Verify normal confirmation is blocked.
13. If school overdraft is enabled, use a valid admin password and confirm the configured negative limit is enforced.
14. Create a parent pre-order with a pickup slot and verify the wallet debit occurs once.
15. Move the order through Preparing -> Ready -> Picked Up and verify notifications are queued.
16. Print/reprint the compact order label and verify order number, student code/class and pickup slot are present.
17. Refund a completed walk-in sale from Admin. Verify the original sale remains, becomes Refunded, and a separate positive refund transaction is created.
18. Review `/admin/audit` and confirm administrative changes are recorded.
19. Review `/admin/notifications` for pending/sent/failed delivery state.
20. Confirm `/api/health` returns HTTP 200 and `database: "reachable"`.

## 5. Financial invariants that must always hold

- A parent has one family wallet, regardless of number of children.
- Wallet balance changes only through documented business transactions.
- Original sales/top-ups/pre-orders are never deleted to correct money movements.
- Refunds create separate positive wallet transactions.
- Top-up credit is idempotent: one pending request can be confirmed only once.
- Sale and pre-order submissions use idempotency keys.
- Product prices are recalculated on the server from the database.
- A student QR token is independent of the class-based display code.
- Overdraft requires school policy, configured lower limit and admin approval.

## 6. Before real parent/student data

Do not onboard production users until all of these have passed:

- successful migration on the production database;
- successful `npm run verify`;
- end-to-end acceptance path above;
- production backup/restore procedure tested;
- production authentication secrets configured;
- notification sender/domain configuration validated;
- HTTPS deployment and least-privilege production access reviewed.

## 7. GitHub CI

`.github/workflows/ci.yml` runs on every push and pull request. It performs static checks, Prisma Client generation, TypeScript checking and a production Next.js build using non-production placeholder database URLs. It never connects to the production database.

After the first successful local dependency install, commit the generated `package-lock.json` and change CI from `npm install` to `npm ci` for reproducible installs.
