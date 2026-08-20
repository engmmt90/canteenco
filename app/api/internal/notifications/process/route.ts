import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, sendSms } from "@/lib/notification-providers";
import { NotificationChannel } from "@prisma/client";

const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  if (!process.env.NOTIFICATION_WORKER_SECRET ||
      request.headers.get("authorization") !== `Bearer ${process.env.NOTIFICATION_WORKER_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const jobs = await prisma.notification.findMany({
    where: {
      channel: { in: [NotificationChannel.EMAIL, NotificationChannel.SMS] },
      sentAt: null,
      failedAt: null,
      processingAt: null,
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    include: { user: { select: { email: true, phone: true } } },
    orderBy: { createdAt: "asc" },
    take: 25,
  });

  let sent = 0, retried = 0, failed = 0;

  for (const job of jobs) {
    const claimed = await prisma.notification.updateMany({
      where: { id: job.id, sentAt: null, failedAt: null, processingAt: null },
      data: { processingAt: new Date() },
    });
    if (claimed.count !== 1) continue;

    try {
      let result: { providerMessageId?: string };
      if (job.channel === NotificationChannel.EMAIL) {
        if (!job.user.email) throw new Error("Recipient email is missing");
        result = await sendEmail({
          to: job.user.email,
          subject: job.subject || "CanteenCo notification",
          text: job.message,
        });
      } else {
        if (!job.user.phone) throw new Error("Recipient phone number is missing");
        result = await sendSms({ to: job.user.phone, text: job.message });
      }

      await prisma.notification.update({
        where: { id: job.id },
        data: {
          sentAt: new Date(),
          processingAt: null,
          providerMessageId: result.providerMessageId,
          failureReason: null,
        },
      });
      sent++;
    } catch (error) {
      const attempt = job.attemptCount + 1;
      const finalFailure = attempt >= MAX_ATTEMPTS;
      const delayMinutes = Math.min(60, 2 ** attempt);
      await prisma.notification.update({
        where: { id: job.id },
        data: {
          attemptCount: attempt,
          processingAt: null,
          failedAt: finalFailure ? new Date() : null,
          nextAttemptAt: finalFailure ? null : new Date(Date.now() + delayMinutes * 60_000),
          failureReason: error instanceof Error ? error.message.slice(0, 500) : "Delivery failed",
        },
      });
      finalFailure ? failed++ : retried++;
    }
  }

  return NextResponse.json({ processed: jobs.length, sent, retried, failed });
}
