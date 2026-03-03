/**
 * Navigation Helper Utility
 * Handles correct path navigation, removing any /src prefixes
 */

/**
 * Get the correct path by removing any /src prefix
 * @param path - The path to correct
 * @returns The corrected path without /src prefix
 */
export function getCorrectPath(path: string): string {
  // Remove any /src prefix that might have been added
  if (path.startsWith('/src')) {
    return path.replace('/src', '');
  }
  return path;
}

/**
 * Navigate to a path with correct handling of /src prefixes
 * @param navigate - React Router's navigate function
 * @param path - The path to navigate to
 * @param options - Optional navigation options
 */
export function navigateCorrectly(
  navigate: (to: string, options?: { replace?: boolean; state?: any }) => void,
  path: string,
  options?: { replace?: boolean; state?: any }
) {
  const correctPath = getCorrectPath(path);
  navigate(correctPath, { replace: true, ...options });
}

/**
 * Get the current correct path from window.location
 * @returns The current path without /src prefix
 */
export function getCurrentCorrectPath(): string {
  if (typeof window === 'undefined') return '/';
  return getCorrectPath(window.location.pathname);
}

/**
 * Check if we're currently at a /src path
 * @returns True if the current path has /src prefix
 */
export function isAtSrcPath(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/src');
}

/**
 * Redirect from /src path to correct path
 * This should be called on page load to fix any /src prefixed URLs
 */
export function fixSrcPathIfNeeded(): void {
  if (typeof window === 'undefined') return;
  
  if (isAtSrcPath()) {
    const correctPath = getCurrentCorrectPath();
    console.warn('🔄 Fixing /src path:', {
      from: window.location.pathname,
      to: correctPath,
    });
    window.history.replaceState(null, '', correctPath);
  }
}
