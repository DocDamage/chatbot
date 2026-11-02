import http from 'http';
import { WebSocket } from 'ws';
import { WebSocketServer } from '../WebSocketServer';

describe('RT-WS-001: WebSocketServer Real-time Chat & Session Multicasting Suite', () => {
  let server: http.Server;
  let wsServer: WebSocketServer;
  let port: number;

  beforeAll((done) => {
    server = http.createServer();
    wsServer = new WebSocketServer(server);
    server.listen(0, () => {
      const addr = server.address();
      port = typeof addr === 'object' && addr ? addr.port : 8080;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => done());
  });

  it('manages client connections, tracks sessions via URL params, and provides connection statistics', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/?sessionId=sess-123&userId=user-abc`);

    ws.on('open', () => {
      const stats = wsServer.getStats();
      expect(stats.totalClients).toBeGreaterThanOrEqual(1);
      expect(stats.sessions).toBeGreaterThanOrEqual(1);
      expect(stats.clientsBySession['sess-123']).toBe(1);
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'connected') {
        expect(msg.payload.sessionId).toBe('sess-123');
        ws.close();
      }
    });

    ws.on('close', () => {
      setTimeout(() => {
        const stats = wsServer.getStats();
        expect(stats.clientsBySession['sess-123']).toBeUndefined();
        done();
      }, 50);
    });
  });

  it('handles ping/pong and session subscribe/unsubscribe message workflows', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/`);
    let receivedPong = false;

    ws.on('open', () => {
      // Send ping
      ws.send(JSON.stringify({ type: 'ping', payload: {}, timestamp: new Date() }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'pong') {
        receivedPong = true;
        // Subscribe to session
        ws.send(JSON.stringify({
          type: 'subscribe',
          payload: { sessionId: 'dynamic-session' },
          timestamp: new Date()
        }));

        setTimeout(() => {
          const stats = wsServer.getStats();
          expect(stats.clientsBySession['dynamic-session']).toBe(1);

          // Broadcast to session
          wsServer.broadcastToSession('dynamic-session', {
            type: 'chat',
            payload: { text: 'Hello Session' },
            timestamp: new Date()
          });
        }, 30);
      }

      if (msg.type === 'chat' && msg.payload.text === 'Hello Session') {
        expect(receivedPong).toBe(true);

        // Unsubscribe
        ws.send(JSON.stringify({
          type: 'unsubscribe',
          payload: {},
          timestamp: new Date()
        }));

        setTimeout(() => {
          ws.close();
          done();
        }, 30);
      }
    });
  });

  it('handles broadcast and malformed json message errors', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/`);

    ws.on('open', () => {
      // Send invalid non-json message
      ws.send('not valid json {]');
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'error') {
        expect(msg.payload.error).toBe('Invalid message format');

        // Test global broadcast
        wsServer.broadcast({
          type: 'announcement',
          payload: { notice: 'Maintenance' }
        });
      }

      if (msg.type === 'announcement') {
        expect(msg.payload.notice).toBe('Maintenance');
        ws.close();
        done();
      }
    });
  });
});
