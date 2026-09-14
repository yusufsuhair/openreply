import nodemailer from "nodemailer";

export async function sendOperationalEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  const from = process.env.EMAIL_FROM ?? "OpenReply <login@example.com>";

  if (process.env.EMAIL_SERVER) {
    await nodemailer.createTransport(process.env.EMAIL_SERVER).sendMail({
      from,
      to,
      subject,
      text,
    });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email transport is not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });

  if (!response.ok) {
    throw new Error(`Email provider returned ${response.status}`);
  }
}
