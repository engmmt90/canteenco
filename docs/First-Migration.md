# First migration gate

CanteenCo handles parent funds, so the first database migration is treated as a release artifact.

## Before generating `init`

1. Use a disposable development/staging Neon branch or PostgreSQL database.
2. Configure `DIRECT_URL` to that database for Prisma CLI work.
3. Run `npm run schema:invariants`.
4. Run `npm run prisma:generate`.
5. Generate the migration:
   `npm run prisma:migrate -- --name init`.
6. Review every generated table, foreign key, unique constraint and index.
7. Confirm the following invariants:
   - exactly one `Wallet` per `ParentProfile`;
   - students do not own balances directly;
   - student display codes are unique per school and sequence per class;
   - `Sale` and `PreOrder` have unique idempotency keys;
   - original sale debit is separate from sale refund transactions;
   - top-up, sale and pre-order transaction references are unique where one-to-one;
   - historical item names are snapshotted for sales.
8. Run the development seed only with `ALLOW_DEMO_SEED=true`.
9. Execute the acceptance flow in `docs/Testing.md`.

## Production

Production must never generate a migration. It only applies committed migrations:

`npm run db:deploy`

`NODE_ENV=production npm run migration:preflight` blocks deployment when no committed migration exists or demo seeding is enabled.
