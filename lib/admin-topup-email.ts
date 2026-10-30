const SUPPORT_EMAIL = "support@canteengo.com.au";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendNewTopUpAdminEmail(input: {
  parentName: string;
  parentEmail?: string | null;
  studentNames: string[];
  amount: number;
}) {
  try {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.NOTIFICATION_EMAIL_FROM?.trim();

    if (!apiKey || !from) {
      console.error("New top-up admin email provider is not configured.");
      return;
    }

    const students =
      input.studentNames.length > 0
        ? input.studentNames.map((name) => escapeHtml(name)).join(", ")
        : "Not specified";

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>New Top-Up Request – Action Required</h2>
        <p>A new wallet top-up request has been submitted.</p>
        <hr />
        <p><strong>Parent:</strong> ${escapeHtml(input.parentName)}</p>
        <p><strong>Student${input.studentNames.length === 1 ? "" : "s"}:</strong> ${students}</p>
        <p><strong>Amount:</strong> $${input.amount.toFixed(2)}</p>
        <p>Please log in to <strong>canteengo.com.au</strong> to review and approve or reject the request.</p>
      </div>
    `;

    const body: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      reply_to?: string;
    } = {
      from,
      to: [SUPPORT_EMAIL],
      subject: "New Top-Up Request – Action Required",
      html,
    };

    if (input.parentEmail) {
      body.reply_to = input.parentEmail;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "New top-up admin email error:",
        response.status,
        errorText,
      );
    }
  } catch (error) {
    // Email is only an admin alert. The top-up request must still succeed if delivery fails.
    console.error("New top-up admin email failed:", error);
  }
}
