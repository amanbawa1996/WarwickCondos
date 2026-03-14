import { NextResponse } from "next/server";
import { checkAllowlist } from "@/backend/allowlist";
import { generateOtpCode, hashOtp, storeOtp} from "@/backend/auth";
import { sendOtpEmail  } from "@/backend/postmark";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ ok: true });
    }

    const normalizedEmail = email.trim().toLowerCase();

   

    // Check role + active status (admins.is_active, residents.approval_status === 'approved')
    const allow = await checkAllowlist(email);

    if (!allow || !allow.isActive) {
      // Do not leak that user isn't allowed/found
      return NextResponse.json({ ok: true });
    }

    const otp = generateOtpCode();
    const otpHash = hashOtp(allow.email, otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await storeOtp(allow.email, allow.role, otpHash, expiresAt);

    // Create token (raw token is only sent via email)
    // const rawToken = generateToken(32);
    // const tokenHash = hashToken(rawToken);
    // const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // // Store token in DB
    // await storeToken(allow.email, allow.role, tokenHash, expiresAt);

    // Send email with verify link
    try {
        await sendOtpEmail ({
        to: allow.email,
        otp,
      });
    } catch (e) {
    // In development, Postmark may block sending (pending approval).
    // We still want to test end-to-end, so log the magic link.
        if (process.env.NODE_ENV !== "production") {
        console.log("[DEV OTP]", { email: allow.email, otp });
        console.log("[DEV NOTE] Postmark send failed. Error:", e);
      } else {
        console.log("[AUTH START EMAIL ERROR]", e);
      }
    }


    return NextResponse.json({ ok: true });
  } catch (err) {
    // Still return ok to avoid leaking anything
    return NextResponse.json({ ok: true });
  }
}

// import { NextResponse } from "next/server";
// import { checkAllowlist } from "@/backend/allowlist";
// import { createMagicLinkToken } from "@/backend/auth";
// import { sendEmail } from "@/backend/postmark";

// export async function POST(req: Request) {
//   try {
//     const { email } = await req.json();

//     if (!email || typeof email !== "string") {
//       return NextResponse.json({ ok: true });
//     }

//     const normalizedEmail = email.trim().toLowerCase();

//     const allow = await allowlist(normalizedEmail);

//     // Always return ok to avoid enumeration
//     if (!allow || !allow.isActive) {
//       return NextResponse.json({ ok: true });
//     }

//     const { token } = await createMagicLinkToken({
//       email: normalizedEmail,
//       role: allow.role,
//     });

//     // 🔑 sendEmail handles DEV fallback + PROD throwing
//     await sendEmail({
//       to: normalizedEmail,
//       token,
//     });

//     // ❌ NO success log here
//     // ❌ NO branching on send result

//     return NextResponse.json({ ok: true });
//   } catch (err) {
//     // Still return ok to prevent enumeration
//     console.error("[AUTH START ERROR]", err);
//     return NextResponse.json({ ok: true });
//   }
// }
