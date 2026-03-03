/**
 * SIMPLIFIED Role Detection System
 * 
 * For Development/Unpublished Sites:
 * - First logged-in user is automatically admin (site creator)
 * - No email restrictions
 * 
 * For Production/Published Sites:
 * - Email-based admin detection
 */

const ADMIN_EMAIL_DOMAINS: string[] = [];
let ADMIN_EMAILS: string[] = [];

// SIMPLIFIED: Always in development mode (site creator auto-admin)
const IS_DEVELOPMENT_MODE = true;

// Load admin emails from localStorage if available
if (typeof window !== 'undefined') {
  const storedAdmins = localStorage.getItem('condoflow_admin_emails');
  if (storedAdmins) {
    try {
      ADMIN_EMAILS = JSON.parse(storedAdmins);
    } catch (e) {
      console.error('Failed to parse stored admin emails:', e);
    }
  }
}

export type UserRole = 'admin' | 'resident';

/**
 * SIMPLIFIED: Detect user role
 * - First login = admin (site creator)
 * - Subsequent logins = check CMS collections dynamically
 */
export async function detectUserRole(email?: string): Promise<UserRole> {
  if (!email) return 'resident';

  const lowerEmail = email.toLowerCase();

  // In development mode, first login is always admin
  if (IS_DEVELOPMENT_MODE) {
    const creatorEmail = getCreatorEmail();
    if (!creatorEmail) {
      // First login - this is the creator
      setCreatorEmail(lowerEmail);
      return 'admin';
    }
    if (lowerEmail === creatorEmail) {
      return 'admin';
    }
  }

  // Check CMS collections dynamically
  try {
    const { BaseCrudService } = await import('@/integrations');
    const entities = await import('@/entities');

    // Check if email exists in admins collection
    const adminsResponse = await BaseCrudService.getAll<entities.Admins>('admins');
    const admins = adminsResponse?.items || [];
    if (admins.some(a => a.email?.toLowerCase() === lowerEmail)) {
      return 'admin';
    }

    // Check if email exists in residents collection
    const residentsResponse = await BaseCrudService.getAll<entities.Residents>('residents');
    const residents = residentsResponse?.items || [];
    if (residents.some(r => r.email?.toLowerCase() === lowerEmail)) {
      return 'resident';
    }
  } catch (error) {
    console.error('Error checking CMS collections for role detection:', error);
  }

  return 'resident';
}

/**
 * Get the creator's email
 */
export function getCreatorEmail(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('condoflow_creator_email');
  }
  return null;
}

/**
 * Set the creator's email (called on first login)
 */
export function setCreatorEmail(email: string): void {
  if (typeof window !== 'undefined') {
    const existingCreator = localStorage.getItem('condoflow_creator_email');
    if (!existingCreator) {
      localStorage.setItem('condoflow_creator_email', email.toLowerCase());
    }
  }
}

/**
 * Check if user is admin
 */
export async function isAdmin(email?: string): Promise<boolean> {
  return (await detectUserRole(email)) === 'admin';
}

/**
 * Add an email to the admin list (deprecated - use CMS instead)
 */
export function addAdminEmail(email: string): void {
  console.warn('addAdminEmail is deprecated. Use the Admins CMS collection instead.');
  const lowerEmail = email.toLowerCase();
  if (!ADMIN_EMAILS.includes(lowerEmail)) {
    ADMIN_EMAILS.push(lowerEmail);
    if (typeof window !== 'undefined') {
      localStorage.setItem('condoflow_admin_emails', JSON.stringify(ADMIN_EMAILS));
    }
  }
}

/**
 * Get all admin emails (deprecated - use CMS instead)
 */
export function getAdminEmails(): string[] {
  console.warn('getAdminEmails is deprecated. Use the Admins CMS collection instead.');
  return [...ADMIN_EMAILS];
}
