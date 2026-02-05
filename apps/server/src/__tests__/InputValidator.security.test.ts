/**
 * EIDOLON-V: InputValidator Security Tests
 * XSS, SQL Injection, and malicious input detection
 */

import { describe, it, expect } from 'vitest';
import { InputValidator } from '../validation/InputValidator';

describe('InputValidator Security Tests', () => {
  describe('XSS Prevention', () => {
    it('should reject script tags in username', () => {
      const result = InputValidator.validateUsername('<script>alert("xss")</script>');
      expect(result.isValid).toBe(false);
    });

    it('should reject javascript: protocol', () => {
      const result = InputValidator.validateUsername('javascript:alert(1)');
      expect(result.isValid).toBe(false);
    });

    it('should reject onerror handlers', () => {
      const result = InputValidator.validateUsername('<img src=x onerror=alert(1)>');
      expect(result.isValid).toBe(false);
    });

    it('should reject encoded script tags', () => {
      const result = InputValidator.validateUsername('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(result.isValid).toBe(false);
    });

    it('should sanitize script keywords', () => {
      const result = InputValidator.sanitizeString('<script>alert(1)</script>');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should reject SQL injection in username', () => {
      const result = InputValidator.validateUsername("admin' OR '1'='1");
      expect(result.isValid).toBe(false);
    });

    it('should reject SQL comments', () => {
      const result = InputValidator.validateUsername('admin--');
      expect(result.isValid).toBe(false);
    });

    it('should reject UNION attacks', () => {
      const result = InputValidator.validateUsername("admin' UNION SELECT * FROM users--");
      expect(result.isValid).toBe(false);
    });

    it('should reject DROP TABLE attempts', () => {
      const result = InputValidator.validateUsername("'; DROP TABLE users; --");
      expect(result.isValid).toBe(false);
    });
  });

  describe('Game Input Validation', () => {
    it('should clamp targetX to world bounds', () => {
      const result = InputValidator.validateGameInput({
        targetX: 100000,
        targetY: 0,
        seq: 1,
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitized?.targetX).toBeLessThanOrEqual(3400);
    });

    it('should clamp targetY to world bounds', () => {
      const result = InputValidator.validateGameInput({
        targetX: 0,
        targetY: -100000,
        seq: 1,
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitized?.targetY).toBeGreaterThanOrEqual(-3400);
    });

    it('should reject negative sequence numbers', () => {
      const result = InputValidator.validateGameInput({
        targetX: 100,
        targetY: 200,
        seq: -1,
      });
      expect(result.isValid).toBe(false);
    });

    it('should reject extremely large sequence numbers', () => {
      const result = InputValidator.validateGameInput({
        targetX: 100,
        targetY: 200,
        seq: Number.MAX_SAFE_INTEGER + 1,
      });
      expect(result.isValid).toBe(false);
    });

    it('should sanitize boolean inputs', () => {
      const result = InputValidator.validateGameInput({
        targetX: 100,
        targetY: 200,
        seq: 1,
        space: 'true',
        w: 1,
      });
      expect(result.isValid).toBe(true);
      expect(typeof result.sanitized?.space).toBe('boolean');
      expect(typeof result.sanitized?.w).toBe('boolean');
    });
  });

  describe('Player Options Validation', () => {
    it('should validate shape whitelist', () => {
      const result = InputValidator.validatePlayerOptions({
        name: 'Test',
        shape: 'circle',
      });
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid shapes', () => {
      const result = InputValidator.validatePlayerOptions({
        name: 'Test',
        shape: 'hacker_shape',
      });
      expect(result.isValid).toBe(false);
    });

    it('should clamp pigment values to 0-1 range', () => {
      const result = InputValidator.validatePlayerOptions({
        name: 'Test',
        pigment: { r: 1.5, g: -0.5, b: 2.0 },
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBeDefined();
      const sanitized = result.sanitized as { pigment: { r: number; g: number } };
      expect(sanitized.pigment.r).toBeLessThanOrEqual(1);
      expect(sanitized.pigment.g).toBeGreaterThanOrEqual(0);
    });

    it('should reject names that are too long', () => {
      const result = InputValidator.validatePlayerOptions({
        name: 'A'.repeat(100),
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('Room Options Validation', () => {
    it('should validate game mode', () => {
      const result = InputValidator.validateRoomOptions({
        mode: 'classic',
        maxClients: 10,
      });
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid game mode', () => {
      const result = InputValidator.validateRoomOptions({
        mode: 'hack_mode',
      });
      expect(result.isValid).toBe(false);
    });

    it('should clamp maxClients to valid range', () => {
      const result = InputValidator.validateRoomOptions({
        maxClients: 1000,
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitized?.maxClients).toBeLessThanOrEqual(50);
    });

    it('should reject negative maxClients', () => {
      const result = InputValidator.validateRoomOptions({
        maxClients: -5,
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe('Type Confusion Attacks', () => {
    it('should reject array instead of object', () => {
      const result = InputValidator.validateGameInput([] as any);
      expect(result.isValid).toBe(false);
    });

    it('should reject null input', () => {
      const result = InputValidator.validateGameInput(null as any);
      expect(result.isValid).toBe(false);
    });

    it('should reject undefined input', () => {
      const result = InputValidator.validateGameInput(undefined as any);
      expect(result.isValid).toBe(false);
    });

    it('should reject prototype pollution attempts', () => {
      const malicious = JSON.parse('{"__proto__": {"isAdmin": true}}');
      const result = InputValidator.validateGameInput(malicious);
      expect(result.isValid).toBe(false);
    });

    it('should reject constructor pollution', () => {
      const malicious = JSON.parse('{"constructor": {"prototype": {"isAdmin": true}}}');
      const result = InputValidator.validateGameInput(malicious);
      expect(result.isValid).toBe(false);
    });
  });

  describe('Buffer Overflow Prevention', () => {
    it('should reject extremely long strings', () => {
      const result = InputValidator.validateUsername('A'.repeat(10000));
      expect(result.isValid).toBe(false);
    });

    it('should reject deeply nested objects', () => {
      let nested: any = { targetX: 100 };
      for (let i = 0; i < 100; i++) {
        nested = { nested };
      }
      const result = InputValidator.validateGameInput(nested);
      expect(result.isValid).toBe(false);
    });

    it('should reject strings with null bytes', () => {
      const result = InputValidator.validateUsername('test\x00admin');
      expect(result.isValid).toBe(false);
    });
  });

  describe('Unicode and Encoding', () => {
    it('should handle unicode usernames correctly', () => {
      const result = InputValidator.validateUsername('🔥Player🔥');
      expect(result.isValid).toBe(true);
    });

    it('should reject right-to-left override characters', () => {
      const result = InputValidator.validateUsername('admin\u202Etest');
      expect(result.isValid).toBe(false);
    });

    it('should reject zero-width characters', () => {
      const result = InputValidator.validateUsername('admin\u200Btest');
      expect(result.isValid).toBe(false);
    });

    it('should normalize similar-looking characters', () => {
      const result = InputValidator.validateUsername('аdmin'); // Cyrillic 'а'
      expect(result.sanitized).not.toBe('admin');
    });
  });
});
