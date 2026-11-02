import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import {
  requireAuth,
  optionalAuth,
  requireRole,
  requireCsrfForStateChange,
  auditPrivilegedRequest
} from '../../middleware/auth';
import {
  requireApiKey,
  requireScope,
  apiKeyService
} from '../../middleware/apiKeyAuth';
import { AuthService } from '../../core/auth/AuthService';
import { AuthenticationError, AuthorizationError } from '../../utils/errors';

describe('RT-PLAT-004 / RT-SEC-003: Auth and API Key Middleware Security Suite', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let authService: AuthService;
  let validToken: string;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.JWT_SECRET = 'super-secret-jwt-key-for-test-32-chars-long';
    process.env.CSRF_TOKEN = 'expected-csrf-secret-12345';
    authService = new AuthService(process.env.JWT_SECRET);
    validToken = authService.generateToken({
      id: 'user-123',
      email: 'user@example.com',
      roles: ['user', 'developer']
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('requireAuth middleware', () => {
    it('authenticates valid Bearer token and populates req.user', () => {
      const req = {
        headers: { authorization: `Bearer ${validToken}` }
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      requireAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual({
        userId: 'user-123',
        email: 'user@example.com',
        roles: ['user', 'developer']
      });
    });

    it('throws AuthenticationError when no token is provided', () => {
      const req = { headers: {} } as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      expect(() => requireAuth(req, res, next)).toThrow(AuthenticationError);
      expect(next).not.toHaveBeenCalled();
    });

    it('throws AuthenticationError when token is invalid', () => {
      const req = {
        headers: { authorization: 'Bearer invalid.token.payload' }
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      expect(() => requireAuth(req, res, next)).toThrow(AuthenticationError);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth middleware', () => {
    it('populates req.user when valid token is present', () => {
      const req = {
        headers: { authorization: `Bearer ${validToken}` }
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      optionalAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user?.userId).toBe('user-123');
    });

    it('continues without error and without user when token is missing', () => {
      const req = { headers: {} } as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      optionalAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it('continues gracefully when invalid token is provided', () => {
      const req = {
        headers: { authorization: 'Bearer bad.token' },
        path: '/api/chat',
        method: 'GET',
        ip: '127.0.0.1'
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      optionalAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });
  });

  describe('requireRole middleware', () => {
    it('allows access when user has the required role', () => {
      const req = {
        user: { userId: 'u1', roles: ['admin', 'user'] }
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      requireRole('admin')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('throws AuthenticationError when user is not attached', () => {
      const req = {} as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      expect(() => requireRole('admin')(req, res, next)).toThrow(AuthenticationError);
      expect(next).not.toHaveBeenCalled();
    });

    it('throws AuthorizationError when user lacks the required role', () => {
      const req = {
        user: { userId: 'u1', roles: ['user'] }
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      expect(() => requireRole('admin', 'superadmin')(req, res, next)).toThrow(AuthorizationError);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireCsrfForStateChange middleware', () => {
    it('passes through when request does not use cookies', () => {
      const req = { headers: {} } as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      requireCsrfForStateChange(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('throws AuthenticationError when cookie is present but CSRF_TOKEN is unconfigured', () => {
      delete process.env.CSRF_TOKEN;
      const req = {
        headers: { cookie: 'session=123' }
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      expect(() => requireCsrfForStateChange(req, res, next)).toThrow(AuthenticationError);
    });

    it('throws AuthenticationError when provided token does not match', () => {
      const req = {
        headers: { cookie: 'session=123', 'x-csrf-token': 'wrong-token' }
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      expect(() => requireCsrfForStateChange(req, res, next)).toThrow(AuthenticationError);
    });

    it('passes when valid CSRF token matches header', () => {
      const req = {
        headers: { cookie: 'session=123', 'x-csrf-token': 'expected-csrf-secret-12345' }
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      requireCsrfForStateChange(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('auditPrivilegedRequest middleware', () => {
    it('logs access and invokes next', () => {
      const req = {
        method: 'POST',
        path: '/api/admin/clear-cache',
        user: { userId: 'admin-1', roles: ['admin'] }
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      auditPrivilegedRequest('admin:clear_cache')(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireApiKey and requireScope middleware', () => {
    it('authenticates valid API key from header and attaches to req', () => {
      const createdKey = apiKeyService.generateKey({
        name: 'test-key',
        userId: 'test-user',
        scopes: ['read:chat', 'write:chat']
      });
      const req = {
        headers: { 'x-api-key': createdKey.key }
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      requireApiKey(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.apiKey?.userId).toBe('test-user');
      expect(req.apiKey?.scopes).toEqual(['read:chat', 'write:chat']);
    });

    it('throws AuthenticationError when no API key provided', () => {
      const req = { headers: {} } as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      expect(() => requireApiKey(req, res, next)).toThrow(AuthenticationError);
    });

    it('throws AuthenticationError for invalid API key format', () => {
      const req = {
        headers: { 'x-api-key': 'invalid-format-key' }
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn() as unknown as NextFunction;

      expect(() => requireApiKey(req, res, next)).toThrow(AuthenticationError);
    });

    it('enforces required scopes with wildcard support', () => {
      const reqMatching = {
        apiKey: { id: 'k1', scopes: ['read:chat', 'tools:execute'] }
      } as unknown as Request;
      const reqWildcard = {
        apiKey: { id: 'k2', scopes: ['*'] }
      } as unknown as Request;
      const reqMissing = {
        apiKey: { id: 'k3', scopes: ['read:chat'] }
      } as unknown as Request;
      const reqNoKey = {} as Request;

      const res = {} as Response;
      const next1 = jest.fn() as unknown as NextFunction;
      const next2 = jest.fn() as unknown as NextFunction;

      requireScope('tools:execute')(reqMatching, res, next1);
      expect(next1).toHaveBeenCalled();

      requireScope('tools:execute')(reqWildcard, res, next2);
      expect(next2).toHaveBeenCalled();

      expect(() => requireScope('tools:execute')(reqMissing, res, jest.fn() as unknown as NextFunction)).toThrow(AuthorizationError);
      expect(() => requireScope('tools:execute')(reqNoKey, res, jest.fn() as unknown as NextFunction)).toThrow(AuthenticationError);
    });
  });
});
