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
