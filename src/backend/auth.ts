/**
 * Backend authentication logic (server-only)
 * - Magic link tokens stored in `magic_links`
 * - Sessions stored in `sessions` and sent to client via HttpOnly cookie (handled in API routes)
 */

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { checkAllowlist } from "./allowlist";

export type AppRole = "admin" | "resident";

export interface AuthToken {
  email: string;
  role: AppRole;
  expiresAt: Date;
}

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
 * Hash a raw token using MAGIC_LINK_SECRET (one-way; never store raw token)
 */
export function hashToken(rawToken: string): string {
  const secret = process.env.MAGIC_LINK_SECRET!;
  if (!secret) throw new Error("MAGIC_LINK_SECRET not set");
  return sha256(`${rawToken}:${secret}`);
}

/**
 * Hash a raw session token using SESSION_SECRET
 */
export function hashSession(rawSession: string): string {
  const secret = process.env.SESSION_SECRET!;
  if (!secret) throw new Error("SESSION_SECRET not set");
  return sha256(`${rawSession}:${secret}`);
}

/**
 * Store a magic link token hash in DB
 */
export async function storeToken(email: string, role: AppRole, tokenHash: string, expiresAt: Date): Promise<void> {
  const supabase = supabaseServer();
  const normalized = String(email || "").trim().toLowerCase();

  await supabase.from("magic_links").insert({
    email: normalized,
    role,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });
}

/**
 * Verify a raw token: checks DB, expiry, one-time use, returns email+role.
 * Marks token as consumed.
 */
export async function verifyToken(rawToken: string): Promise<AuthToken | null> {
  const supabase = supabaseServer();
  const tokenHash = hashToken(rawToken);

  const { data } = await supabase
    .from("magic_links")
    .select("id,email,role,expires_at,consumed_at")
    .eq("token_hash", tokenHash)
    .order("created_at", { ascending: false })
    .limit(1);

  const row = data?.[0];
  if (!row) return null;
  if (row.consumed_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  // Consume it (one-time use)
  await supabase.from("magic_links").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);

  return {
    email: row.email,
    role: row.role,
    expiresAt: new Date(row.expires_at),
  };
}

/**
 * Create a session for the user (must still be allowed: admin active / resident approved)
 * Returns the raw session token + session metadata (cookie setting happens in API route)
 */
export async function createSession(email: string, role: AppRole): Promise<{ rawSession: string; session: SessionData } | null> {
  const supabase = supabaseServer();
  const normalized = String(email || "").trim().toLowerCase();

  // Double-check allowlist/active state (source of truth)
  const allow = await checkAllowlist(normalized);
  if (!allow || allow.role !== role || !allow.isActive) return null;

  // Lookup user id
  const table = role === "admin" ? "admins" : "residents";
  const { data: user } = await supabase.from(table).select("id,email").eq("email", normalized).maybeSingle();
  if (!user?.id) return null;

  const rawSession = generateToken(32);
  const sessionHash = hashSession(rawSession);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const payload = {
    user_id: user.id,
    role,
    session_hash: sessionHash,
    expires_at: expiresAt.toISOString(),
  };

  const { data: inserted, error: insertError } = await supabase
    .from("sessions")
    .insert(payload)
    .select("id, user_id, role, session_hash, expires_at, created_at")
    .single();

  if (insertError) {
    console.error("[createSession] INSERT FAILED", {
      payload,
      insertError,
      supabaseUrl: process.env.SUPABASE_URL,
    });
    return null;
  }

  console.log("[createSession] INSERT OK", inserted);


  console.log("[createSession] session created", { userId: user.id, role, expiresAt });



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

/**
 * Get session info from raw session token (cookie value)
 */
export async function getSession(rawSession: string): Promise<SessionData | null> {
  if (!rawSession) return null;
  const supabase = supabaseServer();

  const sessionHash = hashSession(rawSession);

  const { data } = await supabase
    .from("sessions")
    .select("user_id,role,expires_at,revoked_at")
    .eq("session_hash", sessionHash)
    .order("created_at", { ascending: false })
    .limit(1);

  const row = data?.[0];
  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  // Fetch email from the correct table
  const table = row.role === "admin" ? "admins" : "residents";
  const { data: user } = await supabase.from(table).select("email").eq("id", row.user_id).maybeSingle();
  if (!user?.email) return null;

  return {
    loggedIn: true,
    email: user.email,
    role: row.role,
    userId: row.user_id,
    expiresAt: new Date(row.expires_at),
  };
}

/**
 * Revoke session by raw token (cookie value)
 */
export async function destroySession(rawSession: string): Promise<void> {
  if (!rawSession) return;
  const supabase = supabaseServer();
  const sessionHash = hashSession(rawSession);

  await supabase
    .from("sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("session_hash", sessionHash);
}

/**
 * Optional maintenance: clear expired tokens/sessions (safe to call occasionally)
 */
export async function cleanupExpired(): Promise<void> {
  const supabase = supabaseServer();
  const nowIso = new Date().toISOString();

  await supabase.from("magic_links").delete().lt("expires_at", nowIso);
  await supabase.from("sessions").delete().lt("expires_at", nowIso);
}
