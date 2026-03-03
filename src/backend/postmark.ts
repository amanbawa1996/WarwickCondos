/**
 * Postmark email service
 * Handles sending magic link emails
 */

const POSTMARK_API_KEY = process.env.POSTMARK_API_KEY || '';
const POSTMARK_FROM_EMAIL = process.env.POSTMARK_FROM_EMAIL || 'noreply@example.com';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

export interface SendEmailOptions {
  to: string;
  token: string;
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

  const verifyUrl = buildVerifyUrl(options.token);

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
        Subject: "Your Warwick Condos login link",
        TextBody: `Sign in (15 minutes): ${verifyUrl}`,
        HtmlBody: `
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
      }),
    });

    bodyText = await res.text();

    // Always log status + body (freeze requirement)
    console.log("[POSTMARK] status:", res.status);
    console.log("[POSTMARK] body:", bodyText);

    if (!res.ok) {
      // DEV fallback: print link and DO NOT throw
      if (process.env.NODE_ENV !== "production") {
        console.log("[DEV MAGIC LINK]", verifyUrl);
        console.log("[DEV NOTE] Postmark blocked send (dev fallback).");
        return;
      }

      // PROD: throw to surface operational issue
      throw new Error(`Postmark send failed: ${res.status} - ${bodyText}`);
    }

    // Success: do nothing else (no fake "sent" logs)
    return;
  } catch (err) {
    // Network-level failure (or thrown above)
    if (process.env.NODE_ENV !== "production") {
      console.log("[DEV MAGIC LINK]", verifyUrl);
      console.log("[DEV NOTE] Postmark send error (dev fallback). Error:", err);
      return;
    }
    console.error("[POSTMARK] send error:", err);
    throw err;
  }
}

// /**
//  * Send magic link email
//  */
// export async function sendMagicLinkEmail(email: string, token: string): Promise<void> {
//   const magicLink = `${APP_BASE_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;

//   const textBody = `
// Magic Login Link

// Click the link below to login to your account. This link expires in 15 minutes.

// ${magicLink}

// If you didn't request this link, you can safely ignore this email.

// ---
// Do not reply to this email. This is an automated message.
// `.trim();

//   const htmlBody = `
// <html>
//   <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
//     <h2>Magic Login Link</h2>
//     <p>Click the link below to login to your account. This link expires in 15 minutes.</p>
//     <p>
//       <a href="${magicLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
//         Login to Your Account
//       </a>
//     </p>
//     <p>Or copy and paste this link in your browser:</p>
//     <p><code>${magicLink}</code></p>
//     <p style="color: #666; font-size: 12px;">If you didn't request this link, you can safely ignore this email.</p>
//     <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
//     <p style="color: #999; font-size: 12px;">Do not reply to this email. This is an automated message.</p>
//   </body>
// </html>
// `.trim();

//   await sendEmail({
//     to: email,
//     subject: 'Your Magic Login Link',
//     textBody,
//     htmlBody,
//   });
// }
