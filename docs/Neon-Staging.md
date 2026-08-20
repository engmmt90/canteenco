# Neon staging setup

The staging database is the first real PostgreSQL database used to validate CanteenCo before production.

## Create the Neon project/branch

Create a Neon project or a dedicated staging branch. In the Neon dashboard, copy both connection strings:

- **Pooled** connection string → `DATABASE_URL`
- **Direct** connection string → `DIRECT_URL`

The pooled hostname normally contains `-pooler`. The direct hostname does not.

## Local staging file

Copy:

```bash
cp .env.staging.example .env.staging
```

Paste the two staging connection strings and generate long random values for `AUTH_SECRET` and `NOTIFICATION_WORKER_SECRET`.

Do not commit `.env.staging`.

## Validate before touching the database

```bash
npm install
npm run prisma:generate
npm run staging:doctor
npm run schema:invariants
```

`staging:doctor` refuses:
- a non-pooled `DATABASE_URL`;
- a pooled `DIRECT_URL`;
- obviously mismatched database names;
- `NODE_ENV=production`.

## Initial migration

There is intentionally no hand-written `init` SQL in this repository.

On the first controlled staging database:

```bash
npx prisma migrate dev --name init
```

Review the newly generated `prisma/migrations/<timestamp>_init/migration.sql`.

Then:

```bash
git add prisma/migrations
git commit -m "Add initial Prisma migration"
```

Run all acceptance tests in `docs/Testing.md`.

## Future staging deploys

Once at least one migration is committed:

```bash
npm run staging:deploy
```

This performs:
1. pooled/direct connection validation;
2. staging acknowledgement check;
3. `prisma migrate deploy`;
4. database smoke test.

## GitHub staging deployment

The repository contains `.github/workflows/staging-database.yml`.

Create a GitHub Environment named **staging** and add:

- `STAGING_DATABASE_URL`
- `STAGING_DIRECT_URL`
- `STAGING_AUTH_SECRET`
- `STAGING_NOTIFICATION_WORKER_SECRET`

Run the workflow manually with **Actions → Staging Database Deploy → Run workflow**.

The workflow never seeds demo data and is manual-only.
