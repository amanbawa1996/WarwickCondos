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



// function buildVerifyUrl(token: string) {
//   const base = APP_BASE_URL|| "http://localhost:3000";
//   const u = new URL("/api/auth/verify", base);
//   u.searchParams.set("token", token);
//   return u.toString();
// }

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


export async function sendPasswordResetEmail({
    to,
    resetUrl,
  }: {
    to: string;
    resetUrl: string;
  }) {
    return sendEmail({
      to,
      subject: "Reset your Warwick Condo password",
      textBody: `A request was made to reset your Warwick Condo password.

  Use this link to create a new password:

  ${resetUrl}

  This link expires in one hour. If you did not request a password reset, you may ignore this email.`,
      htmlBody: `
        <p>A request was made to reset your Warwick Condo password.</p>
        <p>
          <a href="${resetUrl}">Create a new password</a>
        </p>
        <p>This link expires in one hour.</p>
        <p>If you did not request a password reset, you may ignore this email.</p>
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

export interface SendPaymentRequestEmailOptions {
  to: string;
  residentName?: string;
  unitNumber?: string | null;
  workOrderTitle: string;
  actualCost?: number | null;
  estimatedCost?: number | null;
  workOrderUrl?: string;
}

export async function sendPaymentRequestEmail(
  options: SendPaymentRequestEmailOptions
): Promise<void> {
  const residentDisplayName = options.residentName?.trim() || "Resident";

  const actualCost =
    typeof options.actualCost === "number" && options.actualCost > 0
      ? options.actualCost
      : null;

  await sendEmail({
    to: options.to,
    subject: `Payment Request - Warwick Condos${
      options.unitNumber ? ` - Unit ${options.unitNumber}` : ""
    }`,
    textBody: [
      `Hello ${residentDisplayName},`,
      ``,
      `A payment request has been added for your Warwick Condos work order.`,
      ``,
      `Work Order: ${options.workOrderTitle}`,
      `Unit: ${options.unitNumber || "N/A"}`,
      actualCost !== null ? `Amount Requested: $${actualCost.toFixed(2)}` : null,
      ``,
      `Please log in to the Warwick Condos resident portal to review the payment request and select your payment method.`,
      ``,
      `Review Payment Request: ${options.workOrderUrl}`,
      ``,
      `Thank you,`,
      `Warwick Condos`,
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
    htmlBody: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Payment Request</h2>
          <p>Hello ${residentDisplayName},</p>
          <p>A payment request has been added for your Warwick Condos work order.</p>

          <table cellpadding="8" cellspacing="0" border="0" style="border-collapse: collapse; width: 100%; max-width: 620px;">
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Work Order</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.workOrderTitle}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Unit</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.unitNumber || "N/A"}</td>
            </tr>
            ${
              actualCost !== null
                ? `
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Amount Requested</strong></td>
              <td style="border-bottom: 1px solid #ddd;">$${actualCost.toFixed(2)}</td>
            </tr>
            `
                : ""
            }
          </table>

          <p style="margin-top: 24px;">
            Please log in to the Warwick Condos resident portal to review the payment request and select your payment method.
          </p>

          <p>
            <a href="${options.workOrderUrl}">Review Payment Request</a>
          </p>

          <p>Thank you,<br/>Warwick Condos</p>

          <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;" />
          <p style="color:#999;font-size:12px;">Do not reply to this email. This is an automated message.</p>
        </body>
      </html>
    `,
  });
}

function getAdminNotificationRecipients(): string[] {
  return String(process.env.WARWICK_ADMIN_NOTIFY_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface SendResidentRegistrationAlertEmailOptions {
  residentName: string;
  residentEmail: string;
  phoneNumber?: string | null;
  unitNumber?: string | null;
}

export async function sendResidentRegistrationAlertEmail(
  options: SendResidentRegistrationAlertEmailOptions
): Promise<void> {
  const recipients = getAdminNotificationRecipients();
  if (!recipients.length) return;

  await sendEmail({
    to: recipients.join(","),
    subject: "New Resident Registration - Warwick Condos",
    textBody: [
      `A new resident registration has been submitted.`,
      ``,
      `Name: ${options.residentName}`,
      `Email: ${options.residentEmail}`,
      `Phone: ${options.phoneNumber || "N/A"}`,
      `Unit: ${options.unitNumber || "N/A"}`,
    ].join("\n"),
    htmlBody: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>New Resident Registration</h2>
          <p>A new resident registration has been submitted.</p>
          <table cellpadding="8" cellspacing="0" border="0" style="border-collapse: collapse; width: 100%; max-width: 620px;">
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Name</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.residentName}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Email</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.residentEmail}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Phone</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.phoneNumber || "N/A"}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Unit</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.unitNumber || "N/A"}</td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });
}

export interface SendResidentApprovedEmailOptions {
  to: string;
  firstName?: string;
}

export async function sendResidentApprovedEmail(
  options: SendResidentApprovedEmailOptions
): Promise<void> {
  const firstName = options.firstName?.trim() || "Resident";

  await sendEmail({
    to: options.to,
    subject: "Your Warwick Condos Account Has Been Approved",
    textBody: [
      `Hello ${firstName},`,
      ``,
      `Your Warwick Condos account has been approved.`,
      `You may now log in using your registered email address and verification code.`,
      ``,
      `Thank you,`,
      `Warwick Condos`,
    ].join("\n"),
    htmlBody: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Account Approved</h2>
          <p>Hello ${firstName},</p>
          <p>Your Warwick Condos account has been approved.</p>
          <p>You may now log in using your registered email address and verification code.</p>
          <p>Thank you,<br/>Warwick Condos</p>
        </body>
      </html>
    `,
  });
}

export interface SendWorkOrderCreatedAdminAlertEmailOptions {
  title: string;
  description: string;
  unitNumber: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  priority?: string | null;
}

export async function sendWorkOrderCreatedAdminAlertEmail(
  options: SendWorkOrderCreatedAdminAlertEmailOptions
): Promise<void> {
  const recipients = getAdminNotificationRecipients();
  if (!recipients.length) return;

  await sendEmail({
    to: recipients.join(","),
    subject: `New Work Order Submitted - Unit ${options.unitNumber}`,
    textBody: [
      `A new work order has been submitted.`,
      ``,
      `Title: ${options.title}`,
      `Unit: ${options.unitNumber}`,
      `Owner: ${options.ownerName || "N/A"}`,
      `Email: ${options.ownerEmail || "N/A"}`,
      `Priority: ${options.priority || "medium"}`,
      `Description: ${options.description}`,
    ].join("\n"),
    htmlBody: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>New Work Order Submitted</h2>
          <table cellpadding="8" cellspacing="0" border="0" style="border-collapse: collapse; width: 100%; max-width: 620px;">
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Title</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.title}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Unit</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.unitNumber}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Owner</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.ownerName || "N/A"}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Email</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.ownerEmail || "N/A"}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Priority</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.priority || "medium"}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Description</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.description}</td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });
}

export interface SendStaffAssignmentEmailOptions {
  to: string;
  staffName?: string;
  workOrderTitle: string;
  unitNumber?: string | null;
  priority?: string | null;
}

export async function sendStaffAssignmentEmail(
  options: SendStaffAssignmentEmailOptions
): Promise<void> {
  const staffName = options.staffName?.trim() || "Team Member";

  await sendEmail({
    to: options.to,
    subject: `New Work Order Assignment - ${options.workOrderTitle}`,
    textBody: [
      `Hello ${staffName},`,
      ``,
      `You have been assigned a work order.`,
      `Title: ${options.workOrderTitle}`,
      `Unit: ${options.unitNumber || "N/A"}`,
      `Priority: ${options.priority || "N/A"}`,
      ``,
    ].join("\n"),
    htmlBody: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>New Work Order Assignment</h2>
          <p>Hello ${staffName},</p>
          <p>You have been assigned a work order.</p>
          <table cellpadding="8" cellspacing="0" border="0" style="border-collapse: collapse; width: 100%; max-width: 620px;">
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Title</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.workOrderTitle}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Unit</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.unitNumber || "N/A"}</td>
            </tr>
            <tr>
              <td style="border-bottom: 1px solid #ddd;"><strong>Priority</strong></td>
              <td style="border-bottom: 1px solid #ddd;">${options.priority || "N/A"}</td>
            </tr>
          </table>
          
        </body>
      </html>
    `,
  });
}