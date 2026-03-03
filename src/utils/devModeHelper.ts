/**
 * Development Mode Helper
 * Provides role detection via URL parameter and mock member data
 * Usage: ?role=admin or ?role=resident
 */

export type DevRole = 'admin' | 'resident';

/**
 * Get the role from URL parameter, localStorage, or default to resident
 * Priority: URL parameter > localStorage > default (resident)
 */
export function getDevRole(): DevRole {
  if (typeof window === 'undefined') return 'resident';
  
  // Check URL parameter first
  const params = new URLSearchParams(window.location.search);
  const urlRole = params.get('role');
  if (urlRole === 'resident') return 'resident';
  if (urlRole === 'admin') return 'admin';
  
  // Check localStorage for persisted role
  const storedRole = localStorage.getItem('devModeRole');
  if (storedRole === 'resident') return 'resident';
  if (storedRole === 'admin') return 'admin';
  
  return 'resident'; // Default to resident
}

/**
 * Get mock member data based on role
 * For residents, uses the email from URL parameter, localStorage, or from actual resident data
 * For admins, uses actual admin data from database
 * 
 * @param role - 'admin' or 'resident'
 * @param emailOverride - Optional email to use for resident (from URL parameter)
 * @param adminData - Optional admin data from database
 */
export function getMockMemberData(role: DevRole, emailOverride?: string | null, adminData?: any) {
  if (role === 'admin') {
    // Use actual admin data if provided
    if (adminData) {
      return {
        _id: adminData._id || 'admin-001',
        loginEmail: adminData.email,
        loginEmailVerified: true,
        status: 'APPROVED',
        contact: {
          firstName: adminData.fullName?.split(' ')[0] || 'Admin',
          lastName: adminData.fullName?.split(' ').slice(1).join(' ') || 'User',
          phones: adminData.phoneNumber ? [adminData.phoneNumber] : [],
        },
        profile: {
          nickname: adminData.fullName || 'Admin User',
          photo: null,
          title: adminData.role || 'Administrator',
        },
        _createdDate: adminData._createdDate || new Date(),
        _updatedDate: adminData._updatedDate || new Date(),
      };
    }
    
    // No fallback - admin data must be provided from database
    return null;
  }

  // Resident role - use email from override or localStorage
  // If no email is available, return null (user must be authenticated)
  const residentEmail = emailOverride || localStorage.getItem('residentEmail');
  
  if (!residentEmail) {
    return null;
  }

  const firstName = localStorage.getItem('residentFirstName') || 'Resident';
  const lastName = localStorage.getItem('residentLastName') || 'User';

  return {
    _id: 'resident-001',
    loginEmail: residentEmail,
    loginEmailVerified: true,
    status: 'APPROVED',
    contact: {
      firstName,
      lastName,
      phones: [],
    },
    profile: {
      nickname: `${firstName} ${lastName}`,
      photo: null,
      title: 'Resident',
    },
    _createdDate: new Date(),
    _updatedDate: new Date(),
  };
}

/**
 * Check if we're in development mode (no authentication required)
 */
export function isDevMode(): boolean {
  // Always in dev mode for early development
  return true;
}
