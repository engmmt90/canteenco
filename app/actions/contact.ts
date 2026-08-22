"use server";

import { requireParent } from "@/lib/authz";

const SUPPORT_EMAIL = "support@canteenco.com.au";

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
    const session = await requireParent();

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const subject = String(formData.get("subject") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();

    if (!name) {
      return { ok: false, error: "Please enter your name." };
    }

    if (!email) {
      return {
        ok: false,
        error: "Please enter your email address.",
      };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        ok: false,
        error: "Please enter a valid email address.",
      };
    }

    if (!subject) {
      return { ok: false, error: "Please enter a subject." };
    }

    if (!message) {
      return { ok: false, error: "Please enter your message." };
    }

    if (name.length > 120) {
      return { ok: false, error: "Name is too long." };
    }

    if (subject.length > 200) {
      return { ok: false, error: "Subject is too long." };
    }

    if (message.length > 5000) {
      return { ok: false, error: "Message is too long." };
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();

    if (!apiKey) {
      console.error("RESEND_API_KEY is not configured.");

      return {
        ok: false,
        error:
          "Email service is not configured. Please try again later.",
      };
    }

    const accountEmail = session.user.email ?? email;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>CanteenCo Contact Form</h2>

        <p>A parent has submitted a new support request.</p>

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
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:
            "CanteenCo Support <support@canteenco.com.au>",
          to: [SUPPORT_EMAIL],
          reply_to: email,
          subject: `Parent Support: ${subject}`,
          html,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

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
        "Your message has been sent to CanteenCo Support.",
    };
  } catch (error) {
    console.error("Contact form error:", error);

    return {
      ok: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}