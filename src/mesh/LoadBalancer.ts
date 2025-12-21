/**
 * Load Balancer - Distribute load across instances
 * Research: Microservices Best Practices
 */

import { Service } from '../services/ServiceRegistry';
import { logger } from '../core/observability/logger';

export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  RANDOM = 'random',
  WEIGHTED = 'weighted'
}

export class LoadBalancer {
  private services: Service[] = [];
  private currentIndex: number = 0;
  private strategy: LoadBalancingStrategy;
  private connectionCounts: Map<string, number> = new Map();

  constructor(strategy: LoadBalancingStrategy = LoadBalancingStrategy.ROUND_ROBIN) {
    this.strategy = strategy;
  }

  /**
   * Add service to load balancer
   */
  addService(service: Service): void {
    if (!this.services.find(s => s.id === service.id)) {
      this.services.push(service);
      this.connectionCounts.set(service.id, 0);
      logger.info('Service added to load balancer', { serviceId: service.id, strategy: this.strategy });
    }
  }

  /**
   * Get next service based on strategy
   */
  getNextService(): Service | null {
    const healthy = this.services.filter(s => s.health === 'healthy');
    if (healthy.length === 0) {
      logger.warn('No healthy services available');
      return null;
    }

    let selected: Service;

    switch (this.strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        selected = healthy[this.currentIndex % healthy.length];
        this.currentIndex++;
        break;

      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        selected = healthy.reduce((min, service) => {
          const minConnections = this.connectionCounts.get(min.id) || 0;
          const serviceConnections = this.connectionCounts.get(service.id) || 0;
          return serviceConnections < minConnections ? service : min;
        });
        break;

      case LoadBalancingStrategy.RANDOM:
        selected = healthy[Math.floor(Math.random() * healthy.length)];
        break;

      case LoadBalancingStrategy.WEIGHTED:
        // Simple weighted: prefer services with better health
        selected = healthy[0]; // Would implement proper weighting
        break;

      default:
        selected = healthy[0];
    }

    // Increment connection count
    this.connectionCounts.set(selected.id, (this.connectionCounts.get(selected.id) || 0) + 1);

    return selected;
  }

  /**
   * Release connection
   */
  releaseConnection(serviceId: string): void {
    const count = this.connectionCounts.get(serviceId) || 0;
    if (count > 0) {
      this.connectionCounts.set(serviceId, count - 1);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalServices: this.services.length,
      healthyServices: this.services.filter(s => s.health === 'healthy').length,
      connectionCounts: Object.fromEntries(this.connectionCounts.entries())
    };
  }
}

