ALTER TABLE "Notification"
ADD COLUMN IF NOT EXISTS "parentReadAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Notification_parentReadAt_createdAt_idx"
ON "Notification" ("parentReadAt", "createdAt");