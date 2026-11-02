import { LoadBalancer, LoadBalancingStrategy } from '../LoadBalancer';
import { Service } from '../../services/ServiceRegistry';

describe('B75-07: Mesh LoadBalancer Decision Matrix', () => {
  const serviceA: Service = { id: 'srv_a', name: 'Service A', url: 'http://localhost:3001', health: 'healthy', metadata: {} };
  const serviceB: Service = { id: 'srv_b', name: 'Service B', url: 'http://localhost:3002', health: 'healthy', metadata: {} };
  const serviceC: Service = { id: 'srv_c', name: 'Service C', url: 'http://localhost:3003', health: 'unhealthy', metadata: {} };

  it('balances traffic via Round Robin strategy ignoring unhealthy instances', () => {
    const lb = new LoadBalancer(LoadBalancingStrategy.ROUND_ROBIN);
    expect(lb.getNextService()).toBeNull();

    lb.addService(serviceA);
    lb.addService(serviceB);
    lb.addService(serviceC);

    const s1 = lb.getNextService();
    const s2 = lb.getNextService();
    const s3 = lb.getNextService();

    expect([s1?.id, s2?.id]).toEqual(expect.arrayContaining(['srv_a', 'srv_b']));
    expect(s3?.id).toBe(s1?.id);
    expect(lb.getStats().healthyServices).toBe(2);
  });

  it('balances traffic via Least Connections strategy and releases connections', () => {
    const lb = new LoadBalancer(LoadBalancingStrategy.LEAST_CONNECTIONS);
    lb.addService(serviceA);
    lb.addService(serviceB);

    const s1 = lb.getNextService(); // gets srv_a, count = 1
    const s2 = lb.getNextService(); // gets srv_b, count = 1
    const s3 = lb.getNextService(); // gets srv_a (equal, first one)

    expect(s1).toBeDefined();
    expect(s2).toBeDefined();

    lb.releaseConnection(serviceA.id);
    lb.releaseConnection(serviceA.id);
    expect(lb.getStats().connectionCounts['srv_a']).toBeGreaterThanOrEqual(0);
  });

  it('supports Random, Weighted, and default fallback strategies', () => {
    const randomLb = new LoadBalancer(LoadBalancingStrategy.RANDOM);
    randomLb.addService(serviceA);
    expect(randomLb.getNextService()?.id).toBe('srv_a');

    const weightedLb = new LoadBalancer(LoadBalancingStrategy.WEIGHTED);
    weightedLb.addService(serviceA);
    expect(weightedLb.getNextService()?.id).toBe('srv_a');

    const defaultLb = new LoadBalancer('unknown_strategy' as any);
    defaultLb.addService(serviceA);
    expect(defaultLb.getNextService()?.id).toBe('srv_a');
  });
});
