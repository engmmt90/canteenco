"use server";

import { headers } from "next/headers";

import { auth } from "@/auth";

const SUPPORT_EMAIL = "support@canteengo.com.au";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 3;
const MIN_FORM_FILL_MS = 3000;
const MAX_FORM_AGE_MS = 2 * 60 * 60 * 1000;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const contactRateLimit = new Map<string, RateLimitEntry>();

export type ContactFormState = {
  ok: boolean;
  error?: string;
  success?: string;
};

export async function submitContactForm(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  try {
    const session = await auth();

    const name = String(
      formData.get("name") ?? "",
    ).trim();

    const email = String(
      formData.get("email") ?? "",
    )
      .trim()
      .toLowerCase();

    const subject = String(
      formData.get("subject") ?? "",
    ).trim();

    const message = String(
      formData.get("message") ?? "",
    ).trim();

    const website = String(
      formData.get("website") ?? "",
    ).trim();

    const startedAt = Number(
      formData.get("startedAt") ?? 0,
    );

    // Honeypot: real users never see or fill this field.
    if (website) {
      return spamSuccess();
    }

    const now = Date.now();

    if (
      !Number.isFinite(startedAt) ||
      startedAt <= 0 ||
      now - startedAt < MIN_FORM_FILL_MS ||
      now - startedAt > MAX_FORM_AGE_MS
    ) {
      return spamSuccess();
    }

    if (!name) {
      return {
        ok: false,
        error: "Please enter your name.",
      };
    }

    if (!email) {
      return {
        ok: false,
        error:
          "Please enter your email address.",
      };
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email,
      )
    ) {
      return {
        ok: false,
        error:
          "Please enter a valid email address.",
      };
    }

    if (!subject) {
      return {
        ok: false,
        error:
          "Please enter a subject.",
      };
    }

    if (!message) {
      return {
        ok: false,
        error:
          "Please enter your message.",
      };
    }

    if (name.length > 120) {
      return {
        ok: false,
        error: "Name is too long.",
      };
    }

    if (subject.length > 200) {
      return {
        ok: false,
        error: "Subject is too long.",
      };
    }

    if (message.length > 5000) {
      return {
        ok: false,
        error: "Message is too long.",
      };
    }

    const requestHeaders = await headers();
    const forwardedFor =
      requestHeaders.get("x-forwarded-for") ?? "";
    const clientIp =
      forwardedFor.split(",")[0]?.trim() ||
      requestHeaders.get("x-real-ip") ||
      "unknown";

    const rateLimitKey = `${clientIp}:${email}`;

    if (!consumeRateLimit(rateLimitKey, now)) {
      return {
        ok: false,
        error:
          "Too many messages have been submitted. Please wait 15 minutes and try again.",
      };
    }

    const combinedText =
      `${subject}\n${message}`.toLowerCase();

    // The public support form is for parent/support enquiries, not sales outreach.
    // Silently accept obvious marketing spam so automated senders do not learn
    // which rule blocked them.
    if (
      !session?.user &&
      looksLikeMarketingSpam(combinedText)
    ) {
      return spamSuccess();
    }

    const apiKey =
      process.env.RESEND_API_KEY?.trim();

    const from =
      process.env.NOTIFICATION_EMAIL_FROM?.trim();

    if (!apiKey || !from) {
      console.error(
        "Contact email provider is not configured.",
      );

      return {
        ok: false,
        error:
          "Email service is not configured. Please try again later.",
      };
    }

    const accountEmail =
      session?.user?.email ?? email;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>CanteenGo Contact Form</h2>

        <p>A support request has been submitted.</p>

        <hr />

        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Account email:</strong> ${escapeHtml(accountEmail)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>

        <h3>Message</h3>

        <div style="
          white-space: pre-wrap;
          background: #f5f5f5;
          padding: 16px;
          border-radius: 8px;
        ">
          ${escapeHtml(message)}
        </div>
      </div>
    `;

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
          to: [SUPPORT_EMAIL],
          reply_to: email,
          subject:
            `CanteenGo Support: ${subject}`,
          html,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "Resend email error:",
        response.status,
        errorText,
      );

      return {
        ok: false,
        error:
          "We could not send your message right now. Please try again.",
      };
    }

    return {
      ok: true,
      success:
        "Your message has been sent to CanteenGo Support.",
    };
  } catch (error) {
    console.error(
      "Contact form error:",
      error,
    );

    return {
      ok: false,
      error:
        "Something went wrong. Please try again.",
    };
  }
}

function consumeRateLimit(
  key: string,
  now: number,
) {
  const current = contactRateLimit.get(key);

  if (!current || current.resetAt <= now) {
    contactRateLimit.set(key, {
      count: 1,
      resetAt:
        now + RATE_LIMIT_WINDOW_MS,
    });

    return true;
  }

  if (
    current.count >=
    RATE_LIMIT_MAX_ATTEMPTS
  ) {
    return false;
  }

  current.count += 1;
  contactRateLimit.set(key, current);

  return true;
}

function looksLikeMarketingSpam(
  value: string,
) {
  const marketingPatterns = [
    /\bseo\b/,
    /organic (traffic|clients?|leads?)/,
    /website traffic/,
    /digital marketing/,
    /backlinks?/,
    /search engine optimization/,
    /improve your (website|ranking|traffic)/,
    /marketing strateg(?:y|ies)/,
    /rank (your|on) google/,
    /lead generation/,
    /not interested.{0,20}(send|reply).{0,10}no/,
  ];

  const matches = marketingPatterns.filter(
    (pattern) => pattern.test(value),
  ).length;

  const urlCount =
    value.match(
      /https?:\/\/|www\./g,
    )?.length ?? 0;

  return matches >= 2 || urlCount >= 3;
}

function spamSuccess(): ContactFormState {
  return {
    ok: true,
    success:
      "Your message has been sent to CanteenGo Support.",
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}