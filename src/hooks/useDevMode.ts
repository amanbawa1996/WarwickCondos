import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getDevRole, getMockMemberData, isDevMode, type DevRole } from '@/utils/devModeHelper';

/**
 * Hook to use development mode features
 * Returns mock member data and role based on localStorage and URL parameter
 * Listens for URL changes to update role dynamically
 */
export function useDevMode() {
  const [role, setRole] = useState<DevRole>('resident');
  const [member, setMember] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    if (isDevMode()) {
      // CRITICAL: Check URL parameter FIRST to allow switching between residents
      // Priority: URL parameter > localStorage > default (resident)
      const params = new URLSearchParams(window.location.search);
      const urlRole = params.get('role') as DevRole | null;
      
      let devRole: DevRole;
      let residentEmail: string | null = null;
      
      if (urlRole) {
        // URL parameter takes priority (allows switching between residents)
        devRole = urlRole;
        
        // If URL has resident role, check for email parameter
        if (urlRole === 'resident') {
          residentEmail = params.get('email');
        }
      } else {
        // Fall back to localStorage
        const storedRole = localStorage.getItem('devModeRole') as DevRole | null;
        devRole = storedRole || 'resident';
      }
      
      console.log('🔍 useDevMode - Role Detection:', {
        urlRole,
        storedRole: localStorage.getItem('devModeRole'),
        devRole,
        residentEmail,
        pathname: location.pathname,
        search: location.search,
        timestamp: new Date().toISOString(),
      });

      setRole(devRole);
      
      // Get member data with optional email override for residents
      const memberData = getMockMemberData(devRole, residentEmail);
      setMember(memberData);
      
      console.log('✅ useDevMode - Member Data Set:', {
        role: devRole,
        loginEmail: memberData?.loginEmail,
        firstName: memberData?.contact?.firstName,
        timestamp: new Date().toISOString(),
      });
    }
    setIsLoading(false);
  }, [location]); // Re-run when location changes (including URL parameters)

  return {
    role,
    member,
    isLoading,
    isAdmin: role === 'admin',
    isResident: role === 'resident',
  };
}
