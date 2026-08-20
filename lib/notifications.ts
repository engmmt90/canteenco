import { NotificationChannel, NotificationEvent, Prisma } from "@/generated/prisma/client";

type PreferenceKey =
  | "notifyTopUp"
  | "notifyPurchase"
  | "notifyPreOrder"
  | "notifyPickup"
  | "notifyRefund"
  | "notifyLowBalance";

type QueueInput = {
  tx: Prisma.TransactionClient;
  parentId: string;
  userId: string;
  event: NotificationEvent;
  subject: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
  preferenceKey?: PreferenceKey;
  schoolId?: string;
};

export async function queueParentNotification(input: QueueInput) {
  const prefs = await input.tx.notificationPreference.findUnique({
    where: { parentId: input.parentId },
  });

  if (prefs && input.preferenceKey && !prefs[input.preferenceKey]) return;

  const schoolSettings = input.schoolId
    ? await input.tx.schoolSettings.findUnique({ where: { schoolId: input.schoolId } })
    : null;

  const rows: Prisma.NotificationCreateManyInput[] = [{
    userId: input.userId,
    channel: NotificationChannel.IN_APP,
    event: input.event,
    subject: input.subject,
    message: input.message,
    metadata: input.metadata,
  }];

  if ((!prefs || prefs.emailEnabled) && (schoolSettings?.emailNotificationsEnabled ?? true)) {
    rows.push({
      userId: input.userId,
      channel: NotificationChannel.EMAIL,
      event: input.event,
      subject: input.subject,
      message: input.message,
      metadata: input.metadata,
      nextAttemptAt: new Date(),
    });
  }

  if (prefs?.smsEnabled && (schoolSettings?.smsNotificationsEnabled ?? true)) {
    rows.push({
      userId: input.userId,
      channel: NotificationChannel.SMS,
      event: input.event,
      subject: input.subject,
      message: input.message,
      metadata: input.metadata,
      nextAttemptAt: new Date(),
    });
  }

  if (prefs?.pushEnabled) {
    rows.push({
      userId: input.userId,
      channel: NotificationChannel.PUSH,
      event: input.event,
      subject: input.subject,
      message: input.message,
      metadata: input.metadata,
      nextAttemptAt: new Date(),
    });
  }

  await input.tx.notification.createMany({ data: rows });
}
