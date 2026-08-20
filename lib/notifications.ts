import { NotificationChannel, NotificationEvent, Prisma } from "@prisma/client";

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
};

export async function queueParentNotification(input: QueueInput) {
  const prefs = await input.tx.notificationPreference.findUnique({
    where: { parentId: input.parentId },
  });

  if (prefs && input.preferenceKey && !prefs[input.preferenceKey]) return;

  const rows: Prisma.NotificationCreateManyInput[] = [{
    userId: input.userId,
    channel: NotificationChannel.IN_APP,
    event: input.event,
    subject: input.subject,
    message: input.message,
    metadata: input.metadata,
  }];

  if (!prefs || prefs.emailEnabled) {
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

  if (prefs?.smsEnabled) {
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
