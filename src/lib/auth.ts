/**
 * Frontend authentication client
 * 
 * This module provides frontend functions that communicate with the backend authentication API.
 * The backend is implemented in src/backend/ and provides the following endpoints:
 * 
 * - POST /api/auth/start - Request a magic login link
 * - GET /api/auth/verify?token=... - Verify magic link token and create session
 * - GET /api/auth/me - Get current session info
 * - POST /api/auth/logout - Destroy session
 * 
 * Backend services (src/backend/):
 * - auth.ts: Token generation, hashing, verification, and session management
 * - routes.ts: Express routes for the authentication API
 * - allowlist.ts: Checks if email is allowed to login (admin or approved resident)
 * - postmark.ts: Sends magic link emails via Postmark
 * - server.ts: Express server setup
 * 
 * The backend is integrated via setupAuthServer() which should be called in your main server file.
 */

export type AppRole = "admin" | "resident";

export type AppUser =
  | { loggedIn: false }
  | { loggedIn: true; email: string; role: AppRole };

/**
 * Get current session info from the backend
 * Calls GET /api/auth/me
 */
export async function getSession(): Promise<AppUser> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return { loggedIn: false };
    const data = await res.json();
    if (!data?.loggedIn) return { loggedIn: false };
    return data as AppUser;
  } catch {
    return { loggedIn: false };
  }
}

/**
 * Request a magic login link
 * Calls POST /api/auth/start
 * 
 * The backend will:
 * 1. Check if email is in the allowlist (admins or approved residents)
 * 2. Generate a secure token
 * 3. Send a magic link email via Postmark
 * 
 * Always returns success to prevent email enumeration attacks
 */
export async function requestMagicLink(email: string): Promise<void> {
  await fetch("/api/auth/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  });
  // Always succeed from the UI perspective (prevents email enumeration)
}

/**
 * Sign out the current user
 * Calls POST /api/auth/logout
 * 
 * The backend will:
 * 1. Destroy the session
 * 2. Clear the auth_session cookie
 */
export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}
