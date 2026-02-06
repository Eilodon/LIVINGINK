/**
 * PHASE 1 EMERGENCY: Enhanced Input Validation
 * Deep validation to prevent injection attacks
 */

import { Request, Response, NextFunction } from 'express';

export interface ValidationResult<T = unknown> {
  isValid: boolean;
  errors: string[];
  sanitized?: T;
}

export interface GameInput {
  targetX?: number;
  targetY?: number;
  space?: boolean;
  w?: boolean;
  seq?: number;
}

export interface PlayerOptionsInput {
  name?: string;
  shape?: string;
  pigment?: { r: number; g: number; b: number };
}

export interface RoomOptionsInput {
  mode?: string;
  level?: number;
  maxClients?: number;
  [key: string]: unknown;
}

export class InputValidator {
  // EIDOLON-V PHASE1: Username validation
  static validateUsername(username: unknown): ValidationResult<string> {
    const errors: string[] = [];

    if (typeof username !== 'string') {
      errors.push('Username must be a string');
      return { isValid: false, errors };
    }

    if (username.length < 3 || username.length > 20) {
      errors.push('Username must be 3-20 characters long');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, underscores, and hyphens');
    }

    // EIDOLON-V PHASE1: Prevent injection attempts
    if (/(<script|javascript:|data:|vbscript:)/i.test(username)) {
      errors.push('Username contains invalid characters');
    }

    // EIDOLON-V PHASE1: Block common attack patterns
    const blockedNames = ['admin', 'root', 'system', 'null', 'undefined', 'anonymous'];
    if (blockedNames.includes(username.toLowerCase())) {
      errors.push('Username is reserved');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: username.trim(),
    };
  }

  // EIDOLON-V PHASE1: Game input validation
  static validateGameInput(input: unknown): ValidationResult<GameInput> {
    const errors: string[] = [];
    const sanitized: GameInput = {};

    if (typeof input !== 'object' || input === null) {
      return { isValid: false, errors: ['Input must be an object'] };
    }

    const typedInput = input as Record<string, unknown>;

    // Validate target position
    if (typedInput.targetX !== undefined) {
      const targetX = Number(typedInput.targetX);
      if (isNaN(targetX) || !isFinite(targetX)) {
        errors.push('Invalid targetX coordinate');
      } else {
        // EIDOLON-V PHASE1: Clamp to reasonable world bounds
        sanitized.targetX = Math.max(-5000, Math.min(5000, targetX));
      }
    }

    if (typedInput.targetY !== undefined) {
      const targetY = Number(typedInput.targetY);
      if (isNaN(targetY) || !isFinite(targetY)) {
        errors.push('Invalid targetY coordinate');
      } else {
        sanitized.targetY = Math.max(-5000, Math.min(5000, targetY));
      }
    }

    // Validate boolean inputs
    if (typedInput.space !== undefined) {
      sanitized.space = Boolean(typedInput.space);
    }

    if (typedInput.w !== undefined) {
      sanitized.w = Boolean(typedInput.w);
    }

    // Validate sequence number
    if (typedInput.seq !== undefined) {
      const seq = Number(typedInput.seq);
      if (isNaN(seq) || seq < 0 || seq > Number.MAX_SAFE_INTEGER) {
        errors.push('Invalid sequence number');
      } else {
        // EIDOLON-V FIX: Allow full safe integer range for long sessions
        sanitized.seq = Math.floor(seq);
      }
    }

    // EIDOLON-V PHASE1: Check for suspicious patterns
    const inputStr = JSON.stringify(input);
    if (/(<script|javascript:|data:|vbscript:|on\w+\s*=)/i.test(inputStr)) {
      errors.push('Input contains potentially dangerous content');
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized,
    };
  }

  // EIDOLON-V PHASE1: Player options validation
  static validatePlayerOptions(options: unknown): ValidationResult<PlayerOptionsInput> {
    const errors: string[] = [];
    const sanitized: PlayerOptionsInput = {};

    if (typeof options !== 'object' || options === null) {
      return { isValid: false, errors: ['Options must be an object'] };
    }

    const typedOptions = options as Record<string, unknown>;

    // Validate name
    if (typedOptions.name !== undefined) {
      const nameResult = this.validateUsername(typedOptions.name);
      if (!nameResult.isValid) {
        errors.push(...nameResult.errors);
      } else {
        sanitized.name = nameResult.sanitized;
      }
    }

    // Validate shape
    if (typedOptions.shape !== undefined) {
      const validShapes = ['circle', 'square', 'triangle', 'hex'];
      const shapeStr = String(typedOptions.shape);
      if (!validShapes.includes(shapeStr)) {
        errors.push('Invalid shape. Must be: circle, square, triangle, or hex');
      } else {
        sanitized.shape = shapeStr;
      }
    }

    // Validate pigment
    if (typedOptions.pigment !== undefined) {
      if (typeof typedOptions.pigment !== 'object' || typedOptions.pigment === null) {
        errors.push('Pigment must be an object with r, g, b properties');
      } else {
        const pigment = typedOptions.pigment as Record<string, unknown>;
        const sanitizedPigment: { r: number; g: number; b: number } = { r: 0, g: 0, b: 0 };
        let pigmentError = false;

        ['r', 'g', 'b'].forEach(channel => {
          const value = Number(pigment[channel]);
          if (isNaN(value) || value < 0 || value > 1) {
            errors.push(`Pigment ${channel} must be a number between 0 and 1`);
            pigmentError = true;
          } else {
            (sanitizedPigment as any)[channel] = Math.max(0, Math.min(1, value));
          }
        });

        if (!pigmentError) {
          sanitized.pigment = sanitizedPigment;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized,
    };
  }

  // EIDOLON-V PHASE1: Sanitize string input
  static sanitizeString(input: unknown, maxLength: number = 1000): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .trim()
      .slice(0, maxLength)
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript URLs
      .replace(/data:/gi, '') // Remove data URLs
      .replace(/vbscript:/gi, ''); // Remove vbscript URLs
  }

  // EIDOLON-V PHASE1: Validate and sanitize room options
  static validateRoomOptions(options: unknown): ValidationResult<RoomOptionsInput> {
    const errors: string[] = [];
    const sanitized: RoomOptionsInput = {};

    if (typeof options !== 'object' || options === null) {
      return { isValid: false, errors: ['Room options must be an object'] };
    }

    const typedOptions = options as Record<string, unknown>;

    // EIDOLON-V PHASE1: Allow only known safe properties
    const allowedProperties = ['mode', 'level', 'maxClients'];

    for (const [key, value] of Object.entries(typedOptions)) {
      if (!allowedProperties.includes(key)) {
        errors.push(`Unknown property: ${key}`);
        continue;
      }

      switch (key) {
        case 'mode':
          if (typeof value === 'string' && value.length <= 50) {
            sanitized[key] = this.sanitizeString(value, 50);
          } else {
            errors.push('Invalid mode value');
          }
          break;

        case 'level':
          const level = Number(value);
          if (isNaN(level) || level < 1 || level > 100) {
            errors.push('Level must be a number between 1 and 100');
          } else {
            sanitized[key] = Math.floor(level);
          }
          break;

        case 'maxClients':
          const maxClients = Number(value);
          if (isNaN(maxClients) || maxClients < 1 || maxClients > 100) {
            errors.push('maxClients must be a number between 1 and 100');
          } else {
            sanitized[key] = Math.floor(maxClients);
          }
          break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized,
    };
  }
}

// EIDOLON-V PHASE1: Middleware for automatic input validation
export const validateInput = (validator: (input: unknown) => ValidationResult) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = validator(req.body);

    if (!result.isValid) {
      return res.status(400).json({
        error: 'Invalid input',
        details: result.errors,
      });
    }

    // Replace request body with sanitized version
    req.body = result.sanitized || req.body;
    next();
  };
};
