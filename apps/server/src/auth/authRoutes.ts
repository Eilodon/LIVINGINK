/**
 * EIDOLON-V OPEN BETA: Authentication Routes
 * Login, logout, and user management endpoints
 * Now with Redis-backed rate limiting for brute force protection
 */

import express, { Request } from 'express';
import { AuthService, authMiddleware, optionalAuthMiddleware } from './AuthService';
import { logger } from '../logging/Logger';
import { authRateLimiter } from '../security/RateLimiter';

// EIDOLON-V PHASE1: Extend Express Request interface
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
}

const router = express.Router();

// EIDOLON-V OPEN BETA: Stricter rate limiting for auth endpoints (10 attempts per 15 min)
router.post('/login', authRateLimiter.middleware(), async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password required',
      });
    }

    // EIDOLON-V PHASE1: Rate limiting for login attempts
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    logger.security('Login attempt', { clientIp, username });

    const authResult = await AuthService.authenticate(username, password);

    if (!authResult) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    res.json({
      success: true,
      token: authResult.token,
      user: authResult.user,
      expiresAt: authResult.expiresAt,
    });
  } catch (error) {
    logger.error('🔐 PHASE1: Login error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// EIDOLON-V PHASE1: Guest login endpoint (for quick testing)
router.post('/guest', authRateLimiter.middleware(), (req, res) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    logger.security('Guest login', { clientIp });

    const guestResult = AuthService.createGuestUser();

    res.json({
      success: true,
      token: guestResult.token,
      user: guestResult.user,
      expiresAt: guestResult.expiresAt,
      isGuest: true,
    });
  } catch (error) {
    logger.error('🔐 PHASE1: Guest login error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// EIDOLON-V PHASE1: Verify token endpoint
router.get('/verify', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    if (req.user) {
      res.json({
        authenticated: true,
        user: req.user,
      });
    } else {
      res.json({
        authenticated: false,
        message: 'No valid token provided',
      });
    }
  } catch (error) {
    console.error('🔐 PHASE1: Verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// EIDOLON-V PHASE1: Logout endpoint
router.post('/logout', authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      AuthService.logout(token);
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('🔐 PHASE1: Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// EIDOLON-V PHASE1: Get session stats (admin only)
router.get('/stats', authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    // EIDOLON-V PHASE1: Only admin can see stats
    if (req.user?.username !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = AuthService.getSessionStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('🔐 PHASE1: Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
