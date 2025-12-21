/**
 * User Service - User management
 * In-memory implementation (should be replaced with database)
 */

import { User } from './AuthService';
import { logger } from '../observability/logger';

export class UserService {
  private users: Map<string, User> = new Map();

  /**
   * Create a new user
   */
  createUser(userData: Omit<User, 'id'>): User {
    const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const user: User = {
      id,
      ...userData,
    };

    this.users.set(id, user);
    logger.info('User created', { userId: id });

    return user;
  }

  /**
   * Get user by ID
   */
  getUserById(userId: string): User | undefined {
    return this.users.get(userId);
  }

  /**
   * Get user by email
   */
  getUserByEmail(email: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return undefined;
  }

  /**
   * Update user
   */
  updateUser(userId: string, updates: Partial<User>): User | null {
    const user = this.users.get(userId);
    if (!user) return null;

    const updated = { ...user, ...updates };
    this.users.set(userId, updated);
    logger.info('User updated', { userId });

    return updated;
  }

  /**
   * Delete user
   */
  deleteUser(userId: string): boolean {
    const deleted = this.users.delete(userId);
    if (deleted) {
      logger.info('User deleted', { userId });
    }
    return deleted;
  }

  /**
   * List all users
   */
  listUsers(): User[] {
    return Array.from(this.users.values());
  }
}

