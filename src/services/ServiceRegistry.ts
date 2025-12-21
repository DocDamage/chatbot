/**
 * Service Registry - Service discovery
 * Research: Microservices Best Practices
 */

import { logger } from '../core/observability/logger';

export interface Service {
  id: string;
  name: string;
  url: string;
  health: 'healthy' | 'unhealthy' | 'unknown';
  metadata?: Record<string, any>;
}

export class ServiceRegistry {
  private services: Map<string, Service> = new Map();

  /**
   * Register a service
   */
  register(service: Service): void {
    this.services.set(service.id, service);
    logger.info('Service registered', { serviceId: service.id, name: service.name, url: service.url });
  }

  /**
   * Get service by ID
   */
  get(serviceId: string): Service | undefined {
    return this.services.get(serviceId);
  }

  /**
   * Get all services
   */
  getAll(): Service[] {
    return Array.from(this.services.values());
  }

  /**
   * Get healthy services
   */
  getHealthy(): Service[] {
    return Array.from(this.services.values()).filter(s => s.health === 'healthy');
  }

  /**
   * Update service health
   */
  updateHealth(serviceId: string, health: Service['health']): void {
    const service = this.services.get(serviceId);
    if (service) {
      service.health = health;
      logger.debug('Service health updated', { serviceId, health });
    }
  }

  /**
   * Unregister service
   */
  unregister(serviceId: string): void {
    this.services.delete(serviceId);
    logger.info('Service unregistered', { serviceId });
  }
}

