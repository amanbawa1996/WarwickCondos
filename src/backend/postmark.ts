/**
 * Postmark email service
 * Handles sending magic link emails
 */

const POSTMARK_API_KEY = process.env.POSTMARK_API_KEY || "";
const POSTMARK_FROM_EMAIL =
  process.env.POSTMARK_FROM_EMAIL || "Warwick Condos <no-reply@warwickcondos.com>";
const POSTMARK_REPLY_TO =
  process.env.POSTMARK_REPLY_TO || "aman.bawa@blueskyhospitalitysolutions.com";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

export interface SendEmailOptions {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  replyTo?: string;
}

export interface SendMagicLinkEmailOptions {
  to: string;
  token: string;
}

export interface SendOtpEmailOptions {
  to: string;
  otp: string;
}

export interface SendPaymentReceiptEmailOptions {
  to: string;
  residentName?: string;
  unitNumber?: string;
  workOrderTitle: string;
  actualCost: number;
  processingFee: number;
  totalChargeAmount: number;
  paymentDate: string;
  cardBrand?: string;
  cardLast4?: string;
  paymentIntentId: string;
}

function buildVerifyUrl(token: string) {
  const base = APP_BASE_URL|| "http://localhost:3000";
  const u = new URL("/api/auth/verify", base);
  u.searchParams.set("token", token);
  return u.toString();
}

/**
 * Send an email via Postmark
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  if (!POSTMARK_API_KEY) {
    console.error("❌ POSTMARK_SERVER_TOKEN not configured");
    throw new Error("POSTMARK_SERVER_TOKEN not set");
  }
  if (!POSTMARK_FROM_EMAIL) {
    console.error("❌ POSTMARK_FROM_EMAIL not configured");
    throw new Error("POSTMARK_FROM_EMAIL not set");
  }

  // const verifyUrl = buildVerifyUrl(options.token);

  let res: Response;
  let bodyText = "";

  try {
    res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": POSTMARK_API_KEY,
      },
      body: JSON.stringify({
        From: POSTMARK_FROM_EMAIL,
        To: options.to,
        ReplyTo: options.replyTo || POSTMARK_REPLY_TO,
        Subject: options.subject,
        TextBody: options.textBody,
        HtmlBody: options.htmlBody,
      }),
    });

    bodyText = await res.text();

    // Always log status + body (freeze requirement)
    console.log("[POSTMARK] status:", res.status);
    console.log("[POSTMARK] body:", bodyText);

    if (!res.ok) {
      // DEV fallback: print link and DO NOT throw
      if (process.env.NODE_ENV !== "production") {
        console.log("[DEV NOTE] Postmark blocked send (dev fallback).");
        console.log("[DEV EMAIL PAYLOAD]", {
          to: options.to,
          subject: options.subject,
          textBody: options.textBody,
        });
        return;
      }

      // PROD: throw to surface operational issue
      throw new Error(`Postmark send failed: ${res.status} - ${bodyText}`);
    }

    // Success: do nothing else (no fake "sent" logs)
    return;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[DEV NOTE] Postmark send error (dev fallback). Error:", err);
      console.log("[DEV EMAIL PAYLOAD]", {
        to: options.to,
        subject: options.subject,
        textBody: options.textBody,
      });
      return;
    }

    console.error("[POSTMARK] send error:", err);
    throw err;
  }
}

export async function sendMagicLinkEmail(options: SendMagicLinkEmailOptions): Promise<void> {
  const verifyUrl = buildVerifyUrl(options.token);

  await sendEmail({
    to: options.to,
    subject: "Your Warwick Condos login link",
    textBody: `Sign in (15 minutes): ${verifyUrl}`,
    htmlBody: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Magic Login Link</h2>
          <p>Click to sign in (valid for 15 minutes).</p>
          <p>
            <a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#007bff;color:#fff;text-decoration:none;border-radius:4px;">
              Login to Your Warwick Condos Account
            </a>
          </p>
          <p>If you didn’t request this, you can ignore this email.</p>
          <p>Or copy and paste this link in your browser:</p>
          <p><code>${verifyUrl}</code></p>
          <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;" />
          <p style="color:#999;font-size:12px;">Do not reply to this email. This is an automated message.</p>
        </body>
      </html>
    `,
  });
}

/**
 * OTP sender
 */
export async function sendOtpEmail(options: SendOtpEmailOptions): Promise<void> {
  await sendEmail({
    to: options.to,
    subject: "Your Warwick verification code",
    textBody: `Your Warwick Condos verification code is: ${options.otp}. This code expires in 10 minutes. If you did not request this code, you can ignore this email.`,
    htmlBody: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Warwick Condos Verification Code</h2>
          <p>Your verification code is:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:16px 0;">
            ${options.otp}
          </div>
          <p>This code expires in 10 minutes.</p>
          <p>If you did not request this code, you can ignore this email.</p>
          <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;" />
          <p style="color:#999;font-size:12px;">Do not reply to this email. This is an automated message.</p>
        </body>
      </html>
    `,
  });
}

export interface SendPaymentReceiptEmailOptions {
  to: string;
  residentName?: string;
  unitNumber?: string;
  workOrderTitle: string;
  actualCost: number;
  processingFee: number;
  totalChargeAmount: number;
  paymentDate: string;
  cardBrand?: string;
  cardLast4?: string;
  paymentIntentId: string;
}

export async function sendPaymentReceiptEmail(
  options: SendPaymentReceiptEmailOptions
): Promise<void> {
  const residentDisplayName =
    options.residentName?.trim() || "Resident";

  const cardDisplay =
    options.cardBrand && options.cardLast4
      ? `${options.cardBrand.toUpperCase()} ending in ${options.cardLast4}`
      : "Saved card on file";

  await sendEmail({
    to: options.to,
    subject: `Payment Receipt - Warwick Condos${options.unitNumber ? ` - Unit ${options.unitNumber}` : ""}`,
    textBody: [
      `Hello ${residentDisplayName},`,
      ``,
      `This email confirms your payment for a Warwick Condos work order.`,
      ``,
      `Work Order: ${options.workOrderTitle}`,
      `Unit: ${options.unitNumber || "N/A"}`,
      `Actual Cost: $${options.actualCost.toFixed(2)}`,
      `Credit Card Processing Fee: $${options.processingFee.toFixed(2)}`,
      `Total Charged: $${options.totalChargeAmount.toFixed(2)}`,
      `Payment Date: ${options.paymentDate}`,
      `Card: ${cardDisplay}`,
      `Reference: ${options.paymentIntentId}`,
      ``,
      `Thank you,`,
      `Warwick Condos`,
    ].join("\n"),
    htmlBody: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Payment Receipt</h2>
          <p>Hello ${residentDisplayName},</p>
          <p>This email confirms your payment for a Warwick Condos work order.</p>

          <table cellpadding="8" cellspacing="0" border="0" style="border-collapse: collapse; width: 100%; max-width: 620px;">
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Work Order</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.workOrderTitle}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Unit</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.unitNumber || "N/A"}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Actual Cost</strong></td>
              <td style="border-bottom: 1px solid #ddd;">$${options.actualCost.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Credit Card Processing Fee</strong></td>
              <td style="border-bottom: 1px solid #ddd;">$${options.processingFee.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Total Charged</strong></td>
              <td style="border-bottom: 1px solid #ddd;">$${options.totalChargeAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Payment Date</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.paymentDate}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Card</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${cardDisplay}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Reference</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.paymentIntentId}</td>
            </tr>
          </table>

          <p style="margin-top: 24px;">Thank you,<br/>Warwick Condos</p>

          <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;" />
          <p style="color:#999;font-size:12px;">Do not reply to this email. This is an automated message.</p>
        </body>
      </html>
    `,
  });
}