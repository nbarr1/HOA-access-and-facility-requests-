const RESEND_URL = "https://api.resend.com/emails";

export async function sendPasswordLink(to: string, link: string, isNew: boolean) {
  const subject = isNew ? "Set up your HOA dashboard password" : "Reset your HOA dashboard password";
  const action = isNew ? "create your password" : "reset your password";
  const html = `<p>Click the link below to ${action}:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour.</p>`;

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.HOA_EMAIL_FROM,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Email send failed: ${body}`);
  }
}
