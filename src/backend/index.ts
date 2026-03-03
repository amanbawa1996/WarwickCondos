/**
 * Backend authentication module
 * Exports all auth-related functions and types
 */

export { generateToken, hashToken, storeToken, verifyToken, createSession, getSession, destroySession, cleanupExpired } from './auth';
export type { AuthToken, SessionData } from './auth';

export { sendEmail, sendMagicLinkEmail } from './postmark';
export type { SendEmailOptions } from './postmark';

export { checkAllowlist } from './allowlist';
export type { AllowlistEntry } from './allowlist';

export { default as setupAuthServer } from './server';
