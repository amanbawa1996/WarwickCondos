/**
 * Backend API routes for authentication
 * Handles magic link flow: /api/auth/start, /api/auth/verify, /api/auth/me, /api/auth/logout
 */

import { Router, Request, Response } from 'express';
import { generateToken, storeToken, verifyToken, createSession, getSession, destroySession } from './auth';
import { sendEmail } from './postmark';
import { checkAllowlist } from './allowlist';

const router = Router();

const SESSION_COOKIE_NAME = 'auth_session';
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * POST /api/auth/start
 * Request a magic login link
 * Always returns 200 OK to prevent email enumeration
 */
router.post('/auth/start', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is in allowlist (but don't reveal if it's not)
    const allowlistEntry = await checkAllowlist(normalizedEmail);

    if (allowlistEntry && allowlistEntry.isActive) {
      // Generate token and send email
      const token = generateToken();
      storeToken(normalizedEmail, token);

      try {
        await sendEmail(normalizedEmail, token);
        console.log(`✅ Magic link sent to ${normalizedEmail}`);
      } catch (emailError) {
        console.error('❌ Failed to send email:', emailError);
        // Still return 200 to prevent enumeration
      }
    } else {
      console.log(`⚠️ Login attempt for non-allowlisted email: ${normalizedEmail}`);
      // Still return 200 to prevent enumeration
    }

    // Always return success to prevent email enumeration
    res.status(200).json({ message: 'If your email is registered, you will receive a magic link shortly.' });
  } catch (error) {
    console.error('❌ Error in /api/auth/start:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/verify?token=...
 * Verify magic link token and create session
 * Redirects to dashboard on success, or back to login on failure
 */
router.get('/auth/verify', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.redirect('/login?error=invalid_token');
    }

    // Verify token
    const tokenData = verifyToken(token);

    if (!tokenData) {
      console.warn('❌ Invalid or expired token');
      return res.redirect('/login?error=token_expired');
    }

    // Double-check allowlist (in case status changed)
    const allowlistEntry = await checkAllowlist(tokenData.email);

    if (!allowlistEntry || !allowlistEntry.isActive) {
      console.warn(`❌ User no longer in allowlist: ${tokenData.email}`);
      return res.redirect('/login?error=not_allowed');
    }

    // Create session
    const sessionId = createSession(tokenData.email, allowlistEntry.role);

    // Set session cookie
    res.cookie(SESSION_COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);

    console.log(`✅ Session created for ${tokenData.email} (${allowlistEntry.role})`);

    // Redirect to appropriate dashboard
    const redirectUrl = allowlistEntry.role === 'admin' ? '/admin' : '/dashboard';
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('❌ Error in /api/auth/verify:', error);
    res.redirect('/login?error=server_error');
  }
});

/**
 * GET /api/auth/me
 * Get current session info
 */
router.get('/auth/me', (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies[SESSION_COOKIE_NAME];

    if (!sessionId) {
      return res.status(401).json({ loggedIn: false });
    }

    const session = getSession(sessionId);

    if (!session) {
      res.clearCookie(SESSION_COOKIE_NAME);
      return res.status(401).json({ loggedIn: false });
    }

    res.json({
      loggedIn: true,
      email: session.email,
      role: session.role,
    });
  } catch (error) {
    console.error('❌ Error in /api/auth/me:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Destroy session
 */
router.post('/auth/logout', (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies[SESSION_COOKIE_NAME];

    if (sessionId) {
      destroySession(sessionId);
    }

    res.clearCookie(SESSION_COOKIE_NAME);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('❌ Error in /api/auth/logout:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
