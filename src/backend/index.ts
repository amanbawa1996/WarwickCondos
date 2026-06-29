/**
 * Backend authentication module
 * Exports all auth-related functions and types
 */

export { generateToken, createSession, getSession, destroySession, cleanupExpired, createPasswordResetToken, consumePasswordResetToken } from './auth';
export type { AppRole, SessionData } from './auth';

export { sendEmail, sendPasswordResetEmail} from './postmark';
export type { SendEmailOptions } from './postmark';

export { checkAllowlist } from './allowlist';
export type { AllowlistEntry } from './allowlist';

