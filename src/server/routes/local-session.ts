import { Router } from 'express';
import { AuthService } from '../../core/auth/AuthService';

/** Single-user sign-in is available only on an explicitly local, loopback-bound instance. */
export function createLocalSessionRouter(): Router {
  const router = Router();
  router.post('/local-session', (req, res) => {
    if (process.env.DEPLOYMENT_MODE !== 'local' || !['127.0.0.1', '::1', 'localhost'].includes(process.env.HOST || '127.0.0.1')) {
      return res.status(404).json({ error: 'Not found' });
    }
    const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    const allowedHosts = new Set([`127.0.0.1:${process.env.PORT || '3001'}`, `localhost:${process.env.PORT || '3001'}`]);
    const allowedOrigins = new Set([...allowedHosts].map(host => `http://${host}`));
    // The development UI proxies API calls to the same local server.
    allowedOrigins.add('http://localhost:3000');
    allowedOrigins.add('http://127.0.0.1:3000');
    if (!loopback.includes(req.socket.remoteAddress || '') || !allowedHosts.has(req.get('host') || '')
      || (req.get('origin') && !allowedOrigins.has(req.get('origin')!)) || req.get('sec-fetch-site') === 'cross-site') {
      return res.status(403).json({ error: 'Local sign-in requires the local application origin' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ token: new AuthService().generateToken({ id: 'local-user', roles: ['admin', 'developer'] }), userId: 'local-user' });
  });
  return router;
}
