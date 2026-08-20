# CanteenCo

Multi-school canteen platform for family wallets, student sales, pre-orders and parent notifications.

## Current milestone
Foundation created: Next.js/TypeScript project metadata, Prisma 7 configuration, production-oriented database schema and architecture documentation.

## Local setup (next step)
1. Copy `.env.example` to `.env`.
2. Add Neon pooled `DATABASE_URL` and direct `DIRECT_URL`.
3. Run `npm install`.
4. Run `npm run prisma:generate`.
5. Run `npm run prisma:migrate -- --name init`.
6. Run `npm run dev`.

Do not use real parent/student data until authentication, authorization, backups, privacy controls and production database policies are complete.


## Authentication foundation

- Parent login: `/`
- Parent registration: `/parent/register`
- Staff login: `/staff/login`
- Role redirect: `/staff/redirect`
- Super Admin / School Admin: `/admin`
- Cashier: `/cashier`
- Parent portal: `/parent`

The application uses Auth.js credentials authentication with role checks on the server. Parent, cashier and admin routes are protected independently.

## Local database setup

1. Copy `.env.example` to `.env`.
2. Add your Neon pooled `DATABASE_URL` and direct `DIRECT_URL`.
3. Set a strong `AUTH_SECRET`.
4. Run `npm install`.
5. Run `npm run prisma:generate`.
6. Run `npm run prisma:migrate -- --name init`.
7. Optionally set the `SEED_*` variables and run `npm run db:seed`.
8. Run `npm run dev`.

Do not use real parent/student data until the production database, backups, access controls and deployment environment have been reviewed.

## Verification

After dependencies and Neon environment variables are configured:

```bash
npm run check:static
npm run db:smoke
npm run verify
```

See `docs/Testing.md` for the full end-to-end acceptance checklist and financial invariants.
