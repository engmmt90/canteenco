ALTER TABLE "Notification"
ADD COLUMN IF NOT EXISTS "adminReadAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "adminClearedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Notification_adminClearedAt_createdAt_idx"
ON "Notification" ("adminClearedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_adminReadAt_createdAt_idx"
ON "Notification" ("adminReadAt", "createdAt");
