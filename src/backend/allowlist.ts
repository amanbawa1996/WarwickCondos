/**
 * Allowlist service
 * Checks if an email is allowed to login and returns their role
 * Uses CMS collections: admins and residents
 */

/**
 * Allowlist service (server-only)
 * Checks if an email is allowed to login and returns their role.
 *
 * Supabase tables:
 * - admins: is_active boolean
 * - residents: approval_status enum ('pending'|'approved'|'rejected'|'inactive')
 */

import { createClient } from "@supabase/supabase-js";

export interface AllowlistEntry {
  email: string;
  role: "admin" | "resident";
  isActive: boolean;
}

function supabaseServer() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Check if an email is in the allowlist and return their role
 * Returns null if email is not found or not active
 */
export async function checkAllowlist(email: string): Promise<AllowlistEntry | null> {
  try {
    // Check admins collection first
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) return null;

    const supabase = supabaseServer();

    const adminRes = await supabase.from("admins").select("email, is_active").eq("email",normalized).maybeSingle();
    if (adminRes.data) {
      return {
        email: adminRes.data.email,
        role: "admin",
        isActive: adminRes.data.is_active !== false,
      };
    }

    const residentRes = await supabase.from("residents").select("email, approval_status").eq("email",normalized).maybeSingle();
    if (residentRes.data) {
      return {
        email: residentRes.data.email,
        role: "resident",
        isActive: residentRes.data.approval_status !== false,
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Error checking allowlist:', error);
    throw error;
  }
}
