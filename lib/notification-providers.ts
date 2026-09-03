type DeliveryResult = {
  providerMessageId?: string;
};

type EmailAttachment = {
  filename: string;
  content: string;
};

export async function sendEmail(args: {
  to: string;
  subject: string;
  text: string;
  attachments?: EmailAttachment[];
}): Promise<DeliveryResult> {
  const apiKey =
    process.env.RESEND_API_KEY;

  const from =
    process.env.NOTIFICATION_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error(
      "Email provider is not configured",
    );
  }

  const response = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${apiKey}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        text: args.text,
        ...(args.attachments?.length
          ? {
              attachments:
                args.attachments,
            }
          : {}),
      }),
    },
  );

  const body =
    await response
      .json()
      .catch(
        () => ({}),
      );

  if (!response.ok) {
    throw new Error(
      body?.message ||
        `Email provider returned ${response.status}`,
    );
  }

  return {
    providerMessageId:
      body?.id,
  };
}

export async function sendSms(args: {
  to: string;
  text: string;
}): Promise<DeliveryResult> {
  const sid =
    process.env.TWILIO_ACCOUNT_SID;

  const token =
    process.env.TWILIO_AUTH_TOKEN;

  const from =
    process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    throw new Error(
      "SMS provider is not configured",
    );
  }

  const form =
    new URLSearchParams({
      To: args.to,
      From: from,
      Body: args.text,
    });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Basic ${Buffer.from(
            `${sid}:${token}`,
          ).toString("base64")}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: form,
    },
  );

  const body =
    await response
      .json()
      .catch(
        () => ({}),
      );

  if (!response.ok) {
    throw new Error(
      body?.message ||
        `SMS provider returned ${response.status}`,
    );
  }

  return {
    providerMessageId:
      body?.sid,
  };
}