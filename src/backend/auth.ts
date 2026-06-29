
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { checkAllowlist } from "./allowlist";

export type AppRole = "admin" | "resident";

export interface SessionData {
  loggedIn: true;
  email: string;
  role: AppRole;
  userId: string;
  expiresAt: Date;
}

function supabaseServer() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Supabase env vars missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  return createClient(url, key, { auth: { persistSession: false } });
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Hash a raw session token using SESSION_SECRET
 */
export function hashSession(rawSession: string): string {
  const secret = process.env.SESSION_SECRET!;
  if (!secret) throw new Error("SESSION_SECRET not set");
  return sha256(`${rawSession}:${secret}`);
}


function hashPasswordResetToken(rawToken: string): string {
  const secret = process.env.PASSWORD_RESET_KEY!;
  if (!secret) throw new Error("PASSWORD_RESET_KEY not set");

  return sha256(`${rawToken}:${secret}`);
}

/**
 * Create a session for the user (must still be allowed: admin active / resident approved)
 * Returns the raw session token + session metadata (cookie setting happens in API route)
 */
export async function createSession(
  email: string,
  role: AppRole
): Promise<{ rawSession: string; session: SessionData } | null> {
  const supabase = supabaseServer();
  const normalized = String(email || "").trim().toLowerCase();

  const allow = await checkAllowlist(normalized);
  if (!allow || allow.role !== role || !allow.isActive) {
    return null;
  }

  const table = role === "admin" ? "admins" : "residents";

  const { data: user } = await supabase
    .from(table)
    .select("id, email")
    .eq("email", normalized)
    .maybeSingle();

  if (!user?.id) return null;

  const rawSession = generateToken(32);
  const sessionHash = hashSession(rawSession);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const { error } = await supabase.from("sessions").insert({
    user_id: user.id,
    role,
    session_hash: sessionHash,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error("[createSession] insert failed", error);
    return null;
  }

  return {
    rawSession,
    session: {
      loggedIn: true,
      email: normalized,
      role,
      userId: user.id,
      expiresAt,
    },
  };
}

export async function getSession(
  rawSession: string
): Promise<SessionData | null> {
  if (!rawSession) return null;

  const supabase = supabaseServer();
  const sessionHash = hashSession(rawSession);

  const { data } = await supabase
    .from("sessions")
    .select("user_id, role, expires_at, revoked_at")
    .eq("session_hash", sessionHash)
    .order("created_at", { ascending: false })
    .limit(1);

  const row = data?.[0];

  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  const table = row.role === "admin" ? "admins" : "residents";

  const { data: user } = await supabase
    .from(table)
    .select("email")
    .eq("id", row.user_id)
    .maybeSingle();

  if (!user?.email) return null;

  return {
    loggedIn: true,
    email: user.email,
    role: row.role,
    userId: row.user_id,
    expiresAt: new Date(row.expires_at),
  };
}

export async function destroySession(rawSession: string): Promise<void> {
  if (!rawSession) return;

  const supabase = supabaseServer();
  const sessionHash = hashSession(rawSession);

  await supabase
    .from("sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("session_hash", sessionHash);
}

export async function createPasswordResetToken(
  authUserId: string
): Promise<string | null> {
  const supabase = supabaseServer();

  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

  const { data: recentToken } = await supabase
    .from("password_reset_tokens")
    .select("id")
    .eq("auth_user_id", authUserId)
    .gte("created_at", oneMinuteAgo)
    .is("consumed_at", null)
    .limit(1)
    .maybeSingle();

  if (recentToken) return null;

  const now = new Date().toISOString();

  await supabase
    .from("password_reset_tokens")
    .update({ consumed_at: now })
    .eq("auth_user_id", authUserId)
    .is("consumed_at", null);

  const rawToken = generateToken(32);
  const tokenHash = hashPasswordResetToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const { error } = await supabase.from("password_reset_tokens").insert({
    auth_user_id: authUserId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  if (error) throw error;

  return rawToken;
}

export async function consumePasswordResetToken(
  rawToken: string
): Promise<{ authUserId: string } | null> {
  const supabase = supabaseServer();
  const tokenHash = hashPasswordResetToken(rawToken);

  const { data: tokenRow } = await supabase
    .from("password_reset_tokens")
    .select("id, auth_user_id, expires_at, consumed_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!tokenRow) return null;
  if (tokenRow.consumed_at) return null;
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) return null;

  const { data: consumedRow, error } = await supabase
    .from("password_reset_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", tokenRow.id)
    .is("consumed_at", null)
    .select("auth_user_id")
    .maybeSingle();

  if (error || !consumedRow) return null;

  return {
    authUserId: consumedRow.auth_user_id,
  };
}

export async function cleanupExpired(): Promise<void> {
  const supabase = supabaseServer();
  const nowIso = new Date().toISOString();

  await supabase.from("password_reset_tokens").delete().lt("expires_at", nowIso);
  await supabase.from("sessions").delete().lt("expires_at", nowIso);
}
