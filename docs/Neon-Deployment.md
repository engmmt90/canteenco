# Neon production connection runbook

## Database connections
Use a dedicated Neon production project, separate from development/testing.

- `DATABASE_URL`: pooled Neon connection for the running Next.js application.
- `DIRECT_URL`: direct Neon connection for Prisma migrations and CLI administration.

Never commit either connection string to Git.

## Required secrets
- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET` (32+ random characters)
- `NOTIFICATION_WORKER_SECRET` (32+ random characters)

Optional delivery providers:
- `RESEND_API_KEY` + `NOTIFICATION_EMAIL_FROM`
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM_NUMBER`

## Preflight
```bash
npm install
npm run env:doctor
npm run prisma:generate
npm run check:static
```

## Migrations
For the first controlled development database:
```bash
npm run prisma:migrate -- --name init
```
Commit the generated `prisma/migrations` directory.

For staging/production after migrations are committed:
```bash
npm run db:deploy
```
Do not use `prisma migrate dev` against production.

## Seed
Seed development/test only unless the seed file has been explicitly reviewed for production:
```bash
npm run db:seed
```

## Smoke test
```bash
npm run db:smoke
```
Then start the app and check `/api/health`.

## Acceptance test
Run every item in `docs/Testing.md`, especially the shared family wallet for multiple children, top-up approval, cashier purchase, negative-balance controls, pre-order cutoff/pickup, cancellations/refunds, audit trail, and notification queue.

## Go-live gate
Do not load real student/parent data until backups and restore are tested, least-privilege credentials are configured, logs are checked for secret/sensitive-data leakage, HTTPS/secure cookies are confirmed, notification senders are verified, and staging acceptance tests pass.
