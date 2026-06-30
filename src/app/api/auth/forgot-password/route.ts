import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createPasswordResetToken,
  generateToken,
} from "@/backend/auth";
import { sendPasswordResetEmail } from "@/backend/postmark";

function sb() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function makeTemporaryPassword() {
  return `Wk!9${generateToken(16)}`;
}

function genericResponse() {
  return NextResponse.json({
    ok: true,
    message:
      "If an active account matches that email address, a password reset link has been sent.",
  });
}

function isEmailExistsError(error: any) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();

  return (
    code === "email_exists" ||
    message.includes("already been registered") ||
    message.includes("already registered") ||
    message.includes("already exists")
  );
}

async function findAuthUserByEmail(
  supabase: ReturnType<typeof sb>,
  email: string
): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();

  const perPage = 1000;
  let page = 1;

  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error("[forgot-password] listUsers failed", error);
      return null;
    }

    const users = data?.users || [];

    const match = users.find(
      (user) => String(user.email || "").trim().toLowerCase() === normalizedEmail
    );

    if (match?.id) {
      return match.id;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }

  console.error("[forgot-password] auth user search exceeded page limit", {
    email: normalizedEmail,
  });

  return null;
}

async function getOrCreateAuthUserId(
  supabase: ReturnType<typeof sb>,
  email: string
): Promise<{ authUserId: string; created: boolean } | null> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: createdUser, error: createError } =
    await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: makeTemporaryPassword(),
      email_confirm: true,
    });

  if (!createError && createdUser.user?.id) {
    return {
      authUserId: createdUser.user.id,
      created: true,
    };
  }

  if (!isEmailExistsError(createError)) {
    console.error("[forgot-password] auth user creation failed", createError);
    return null;
  }

  const existingAuthUserId = await findAuthUserByEmail(
    supabase,
    normalizedEmail
  );

  if (!existingAuthUserId) {
    console.error(
      "[forgot-password] auth user exists but could not be found by listUsers",
      { email: normalizedEmail }
    );
    return null;
  }

  return {
    authUserId: existingAuthUserId,
    created: false,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return genericResponse();
    }

    const supabase = sb();

    const { data: admin } = await supabase
      .from("admins")
      .select("id, email, auth_user_id, is_active")
      .eq("email", email)
      .maybeSingle();

    let table: "admins" | "residents";
    let profileId: string;
    let profileEmail: string;
    let authUserId: string | null;

    if (admin && admin.is_active !== false) {
      table = "admins";
      profileId = admin.id;
      profileEmail = admin.email;
      authUserId = admin.auth_user_id;
    } else {
      const { data: resident } = await supabase
        .from("residents")
        .select("id, email, auth_user_id, approval_status")
        .eq("email", email)
        .maybeSingle();

      if (!resident || resident.approval_status !== "approved") {
        return genericResponse();
      }

      table = "residents";
      profileId = resident.id;
      profileEmail = resident.email;
      authUserId = resident.auth_user_id;
    }

    let createdNewAuthUser = false;

    if (!authUserId) {
      const authResult = await getOrCreateAuthUserId(supabase, profileEmail);

      if (!authResult) {
        return genericResponse();
      }

      authUserId = authResult.authUserId;
      createdNewAuthUser = authResult.created;

      const { error: linkError } = await supabase
        .from(table)
        .update({ auth_user_id: authUserId })
        .eq("id", profileId);

      if (linkError) {
        console.error("[forgot-password] profile link failed", linkError);

        if (createdNewAuthUser) {
          await supabase.auth.admin.deleteUser(authUserId);
        }

        return genericResponse();
      }

      console.log("[forgot-password] linked auth user to profile", {
        table,
        profileId,
        authUserId,
        createdNewAuthUser,
      });
    }

    const rawToken = await createPasswordResetToken(authUserId);

    if (!rawToken) {
      return genericResponse();
    }

    const baseUrl = String(process.env.APP_BASE_URL || "").replace(/\/$/, "");

    if (!baseUrl) {
      throw new Error("APP_BASE_URL is not configured");
    }

    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(
      rawToken
    )}`;

    try {
      await sendPasswordResetEmail({
        to: profileEmail,
        resetUrl,
      });
    } catch (emailError) {
      console.error("[forgot-password] Postmark failed", emailError);
    }

    return genericResponse();
  } catch (error) {
    console.error("[POST /api/auth/forgot-password]", error);
    return genericResponse();
  }
}