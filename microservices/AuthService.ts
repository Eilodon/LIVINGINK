/**
 * PHASE 3: Auth Service - Authentication Microservice
 * Handles user authentication, authorization, and session management
 */

import express from 'express';
import { Server } from 'http';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { db } from '../server/src/database/PostgreSQLManager';
import { cache } from '../server/src/database/RedisManager';
import { logger } from '../server/src/logging/Logger';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  isActive: boolean;
  isGuest: boolean;
  createdAt: Date;
  lastLogin?: Date;
}

export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    isGuest: boolean;
  };
  token: string;
  expiresIn: number;
  refreshToken?: string;
}

export class AuthService {
  private static instance: AuthService;
  private app: express.Application;
  private server: Server;
  private jwtSecret: string;
  private jwtExpiresIn: string;
  private refreshTokenExpiresIn: string;

  private constructor() {
    this.app = express();
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

    this.setupMiddleware();
    this.setupRoutes();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // EIDOLON-V PHASE3: Setup middleware
  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug('Auth Service Request', {
        method: req.method,
        url: req.url,
        ip: req.ip
      });
      next();
    });
  }

  // EIDOLON-V PHASE3: Setup routes
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'auth-service',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
    });

    // Register new user
    this.app.post('/auth/register', async (req, res) => {
      try {
        const { username, email, password, confirmPassword }: RegisterRequest = req.body;

        // Validate input
        if (!username || !email || !password || !confirmPassword) {
          return res.status(400).json({
            error: 'All fields are required'
          });
        }

        if (password !== confirmPassword) {
          return res.status(400).json({
            error: 'Passwords do not match'
          });
        }

        if (username.length < 3 || username.length > 50) {
          return res.status(400).json({
            error: 'Username must be between 3 and 50 characters'
          });
        }

        // Check if user already exists
        const existingUser = await db.query(
          'SELECT id FROM users WHERE username = $1 OR email = $2',
          [username, email]
        );

        if (existingUser.rows.length > 0) {
          return res.status(409).json({
            error: 'User already exists'
          });
        }

        // Hash password
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create user
        const result = await db.query(
          `INSERT INTO users (username, email, password_hash, salt, is_active, is_guest, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           RETURNING id, username, email, is_guest, created_at`,
          [username, email, passwordHash, salt, true, false]
        );

        const user = result.rows[0];

        // Create user stats
        await db.query(
          'INSERT INTO user_stats (user_id, games_played, total_score, highest_score, level) VALUES ($1, 0, 0, 0, 1)',
          [user.id]
        );

        logger.info('User registered', { userId: user.id, username, email });

        res.status(201).json({
          message: 'User registered successfully',
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            isGuest: user.is_guest
          }
        });

      } catch (error) {
        logger.error('Registration failed', { error: error instanceof Error ? error.message : String(error) }, error instanceof Error ? error : undefined);
        res.status(500).json({
          error: 'Registration failed'
        });
      }
    });

    // Login user
    this.app.post('/auth/login', async (req, res) => {
      try {
        const { username, password, rememberMe }: LoginRequest = req.body;

        if (!username || !password) {
          return res.status(400).json({
            error: 'Username and password are required'
          });
        }

        // Find user
        const result = await db.query(
          'SELECT id, username, email, password_hash, salt, is_active, is_guest, created_at FROM users WHERE username = $1',
          [username]
        );

        if (result.rows.length === 0) {
          return res.status(401).json({
            error: 'Invalid credentials'
          });
        }

        const user = result.rows[0];

        if (!user.is_active) {
          return res.status(401).json({
            error: 'Account is deactivated'
          });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
          return res.status(401).json({
            error: 'Invalid credentials'
          });
        }

        // Update last login
        await db.query(
          'UPDATE users SET last_login = NOW() WHERE id = $1',
          [user.id]
        );

        // Generate tokens
        const token = this.generateToken(user);
        const refreshToken = this.generateRefreshToken(user);

        // Cache session
        await cache.set(`session:${token}`, {
          userId: user.id,
          username: user.username,
          email: user.email,
          isGuest: user.is_guest
        }, rememberMe ? 86400 * 7 : 3600); // 7 days or 1 hour

        logger.info('User logged in', { userId: user.id, username });

        const response: AuthResponse = {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            isGuest: user.is_guest
          },
          token,
          expiresIn: rememberMe ? 86400 * 7 : 3600,
          refreshToken
        };

        res.json(response);

      } catch (error) {
        logger.error('Login failed', { error: error instanceof Error ? error.message : String(error) }, error instanceof Error ? error : undefined);
        res.status(500).json({
          error: 'Login failed'
        });
      }
    });

    // Verify token
    this.app.get('/auth/verify', async (req, res) => {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return res.status(401).json({
            error: 'No token provided'
          });
        }

        // Check cache first
        const cachedSession = await cache.get(`session:${token}`);
        if (cachedSession) {
          return res.json({
            authenticated: true,
            user: cachedSession
          });
        }

        // Verify JWT
        const decoded = jwt.verify(token, this.jwtSecret) as any;

        // Get fresh user data
        const userResult = await db.query(
          'SELECT id, username, email, is_active, is_guest FROM users WHERE id = $1',
          [decoded.userId]
        );

        if (userResult.rows.length === 0) {
          return res.status(401).json({
            error: 'Invalid token'
          });
        }

        const user = userResult.rows[0];

        if (!user.is_active) {
          return res.status(401).json({
            error: 'Account is deactivated'
          });
        }

        // Update cache
        await cache.set(`session:${token}`, {
          userId: user.id,
          username: user.username,
          email: user.email,
          isGuest: user.is_guest
        }, 3600);

        res.json({
          authenticated: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            isGuest: user.is_guest
          }
        });

      } catch (error) {
        logger.error('Token verification failed', { error: error instanceof Error ? error.message : String(error) }, error instanceof Error ? error : undefined);
        res.status(401).json({
          error: 'Invalid token'
        });
      }
    });

    // Logout
    this.app.post('/auth/logout', async (req, res) => {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (token) {
          // Remove from cache
          await cache.del(`session:${token}`);
        }

        res.json({
          message: 'Logged out successfully'
        });

      } catch (error) {
        logger.error('Logout failed', { error: error instanceof Error ? error.message : String(error) }, error instanceof Error ? error : undefined);
        res.status(500).json({
          error: 'Logout failed'
        });
      }
    });

    // Refresh token
    this.app.post('/auth/refresh', async (req, res) => {
      try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
          return res.status(400).json({
            error: 'Refresh token is required'
          });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, this.jwtSecret) as any;

        // Get user data
        const userResult = await db.query(
          'SELECT id, username, email, is_active, is_guest FROM users WHERE id = $1',
          [decoded.userId]
        );

        if (userResult.rows.length === 0) {
          return res.status(401).json({
            error: 'Invalid refresh token'
          });
        }

        const user = userResult.rows[0];

        if (!user.is_active) {
          return res.status(401).json({
            error: 'Account is deactivated'
          });
        }

        // Generate new access token
        const newToken = this.generateToken(user);

        // Update cache
        await cache.set(`session:${newToken}`, {
          userId: user.id,
          username: user.username,
          email: user.email,
          isGuest: user.is_guest
        }, 3600);

        res.json({
          token: newToken,
          expiresIn: 3600
        });

      } catch (error) {
        logger.error('Token refresh failed', { error: error instanceof Error ? error.message : String(error) }, error instanceof Error ? error : undefined);
        res.status(401).json({
          error: 'Invalid refresh token'
        });
      }
    });

    // Get user profile
    this.app.get('/auth/profile', async (req, res) => {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return res.status(401).json({
            error: 'Authentication required'
          });
        }

        const decoded = jwt.verify(token, this.jwtSecret) as any;

        const userResult = await db.query(
          `SELECT u.id, u.username, u.email, u.created_at, u.last_login,
                  us.games_played, us.total_score, us.highest_score, us.level, us.experience_points
           FROM users u
           LEFT JOIN user_stats us ON u.id = us.user_id
           WHERE u.id = $1 AND u.is_active = true`,
          [decoded.userId]
        );

        if (userResult.rows.length === 0) {
          return res.status(404).json({
            error: 'User not found'
          });
        }

        const user = userResult.rows[0];

        res.json({
          id: user.id,
          username: user.username,
          email: user.email,
          isGuest: user.is_guest,
          createdAt: user.created_at,
          lastLogin: user.last_login,
          stats: {
            gamesPlayed: user.games_played || 0,
            totalScore: user.total_score || 0,
            highestScore: user.highest_score || 0,
            level: user.level || 1,
            experiencePoints: user.experience_points || 0
          }
        });

      } catch (error) {
        logger.error('Get profile failed', { error: error instanceof Error ? error.message : String(error) }, error instanceof Error ? error : undefined);
        res.status(500).json({
          error: 'Failed to get profile'
        });
      }
    });
  }

  // EIDOLON-V PHASE3: Generate JWT token
  private generateToken(user: any): string {
    const options: SignOptions = { expiresIn: this.jwtExpiresIn as string | number };
    return jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
        isGuest: user.is_guest
      },
      this.jwtSecret,
      options
    );
  }

  // EIDOLON-V PHASE3: Generate refresh token
  private generateRefreshToken(user: any): string {
    const options: SignOptions = { expiresIn: this.refreshTokenExpiresIn as string | number };
    return jwt.sign(
      {
        userId: user.id,
        username: user.username,
        type: 'refresh'
      },
      this.jwtSecret,
      options
    );
  }

  // EIDOLON-V PHASE3: Start service
  async start(port: number = 3001): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, (err?: Error) => {
        if (err) {
          logger.error('Failed to start Auth Service', { port, error: err.message }, err);
          reject(err);
        } else {
          logger.info('Auth Service started', { port });
          resolve();
        }
      });
    });
  }

  // EIDOLON-V PHASE3: Stop service
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Auth Service stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // EIDOLON-V PHASE3: Get Express app
  getApp(): express.Application {
    return this.app;
  }
}

// EIDOLON-V PHASE3: Export singleton instance
export const authService = AuthService.getInstance();
