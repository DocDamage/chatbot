import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { AuthService } from '../AuthService';

describe('RT-PLAT-004 / RT-AUTH-001: AuthService JWT Lifecycle Suite', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.JWT_SECRET = 'a-very-long-secure-random-jwt-secret-key-32-chars';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when JWT_SECRET is missing from both constructor and environment', () => {
    delete process.env.JWT_SECRET;
    expect(() => new AuthService()).toThrow('JWT_SECRET is required for authentication');
  });

  it('generates, verifies, and extracts Bearer tokens', () => {
    const authService = new AuthService();
    const token = authService.generateToken({
      id: 'usr-999',
      email: 'tester@example.com',
      roles: ['admin']
    });

    expect(typeof token).toBe('string');

    // Valid verification
    const payload = authService.verifyToken(token);
    expect(payload?.userId).toBe('usr-999');
    expect(payload?.email).toBe('tester@example.com');
    expect(payload?.roles).toEqual(['admin']);

    // Extract from header
    expect(authService.extractTokenFromHeader(`Bearer ${token}`)).toBe(token);
    expect(authService.extractTokenFromHeader('Basic xyz')).toBeNull();
    expect(authService.extractTokenFromHeader(undefined)).toBeNull();
    expect(authService.extractTokenFromHeader('Bearer')).toBeNull();
  });

  it('returns null on invalid verification and refreshes valid tokens', () => {
    const authService = new AuthService();
    expect(authService.verifyToken('completely.invalid.token')).toBeNull();

    const originalToken = authService.generateToken({
      id: 'usr-refresh',
      email: 'refresh@example.com',
      roles: ['user']
    });

    const refreshedToken = authService.refreshToken(originalToken);
    expect(refreshedToken).toBeDefined();
    expect(typeof refreshedToken).toBe('string');

    const refreshedPayload = authService.verifyToken(refreshedToken!);
    expect(refreshedPayload?.userId).toBe('usr-refresh');
    expect(refreshedPayload?.email).toBe('refresh@example.com');

    expect(authService.refreshToken('invalid-token')).toBeNull();
  });
});
