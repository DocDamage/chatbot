import http from 'http';
import { WebSocket } from 'ws';
import { WebSocketServer } from './WebSocketServer';

describe('RT-WS-001: WebSocketServer Real-time Communication Suite', () => {
  let server: http.Server;
  let wsServer: WebSocketServer;

  beforeEach((done) => {
    server = http.createServer();
    server.listen(0, () => {
      wsServer = new WebSocketServer(server);
      done();
    });
  });

  afterEach((done) => {
    (wsServer as any).wss.close(() => {
      server.close(done);
    });
  });

  it('handles client connections, parses session/user parameters, and sends connected event', () => {
    const mockWs: any = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      on: jest.fn(),
    };

    const req = {
      url: '/ws?sessionId=sess-123&userId=user-456',
      headers: { host: 'localhost:3000' }
    };

    // Trigger handleConnection
    (wsServer as any).handleConnection(mockWs, req);

    expect(mockWs.send).toHaveBeenCalled();
    const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
    expect(sentData.type).toBe('connected');
    expect(sentData.payload.sessionId).toBe('sess-123');

    const stats = wsServer.getStats();
    expect(stats.totalClients).toBe(1);
    expect(stats.sessions).toBe(1);
    expect(stats.clientsBySession['sess-123']).toBe(1);
  });

  it('processes incoming messages: ping, subscribe, unsubscribe, unknown, and invalid JSON', () => {
    const mockWs: any = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      on: jest.fn(),
    };

    const req = {
      url: '/ws',
      headers: { host: 'localhost:3000' }
    };

    (wsServer as any).handleConnection(mockWs, req);
    const clientId = Array.from((wsServer as any).clients.keys())[0] as string;

    // 1. Ping message
    (wsServer as any).handleMessage(clientId, {
      type: 'ping',
      payload: {},
      timestamp: new Date()
    });
    const pongData = JSON.parse(mockWs.send.mock.calls[1][0]);
    expect(pongData.type).toBe('pong');

    // 2. Subscribe message
    (wsServer as any).handleMessage(clientId, {
      type: 'subscribe',
      payload: { sessionId: 'new-session-789' },
      timestamp: new Date()
    });
    expect(wsServer.getStats().clientsBySession['new-session-789']).toBe(1);

    // 3. Unsubscribe message
    (wsServer as any).handleMessage(clientId, {
      type: 'unsubscribe',
      payload: {},
      timestamp: new Date()
    });
    expect((wsServer as any).sessionClients.get('new-session-789')?.has(clientId)).toBe(false);

    // 4. Unknown message
    (wsServer as any).handleMessage(clientId, {
      type: 'custom_unknown_action',
      payload: {},
      timestamp: new Date()
    });

    // 5. Message event listener with invalid JSON
    const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')[1];
    messageHandler(Buffer.from('not valid json'));
    const errorData = JSON.parse(mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1][0]);
    expect(errorData.type).toBe('error');
    expect(errorData.payload.error).toBe('Invalid message format');

    // 6. Message event listener with valid JSON
    messageHandler(Buffer.from(JSON.stringify({ type: 'ping', payload: {} })));
  });

  it('broadcasts to session, to all clients, and sends to individual client', () => {
    const mockWs1: any = { readyState: WebSocket.OPEN, send: jest.fn(), on: jest.fn() };
    const mockWs2: any = { readyState: WebSocket.OPEN, send: jest.fn(), on: jest.fn() };
    const mockWsClosed: any = { readyState: WebSocket.CLOSED, send: jest.fn(), on: jest.fn() };
    const mockWsThrow: any = {
      readyState: WebSocket.OPEN,
      send: jest.fn().mockImplementation(() => { throw new Error('Send failed'); }),
      on: jest.fn()
    };

    (wsServer as any).handleConnection(mockWs1, { url: '/ws?sessionId=room-a', headers: { host: 'localhost' } });
    (wsServer as any).handleConnection(mockWs2, { url: '/ws?sessionId=room-a', headers: { host: 'localhost' } });
    (wsServer as any).handleConnection(mockWsClosed, { url: '/ws?sessionId=room-b', headers: { host: 'localhost' } });
    (wsServer as any).handleConnection(mockWsThrow, { url: '/ws?sessionId=room-a', headers: { host: 'localhost' } });

    const clientIds = Array.from((wsServer as any).clients.keys()) as string[];
    const id1 = clientIds[0];
    const idClosed = clientIds[2];
    const idThrow = clientIds[3];

    // Broadcast to session (includes throwing client)
    wsServer.broadcastToSession('room-a', {
      type: 'chat',
      payload: { text: 'hello room-a' },
      timestamp: new Date()
    });
    expect(mockWs1.send).toHaveBeenCalled();
    expect(mockWs2.send).toHaveBeenCalled();

    // Broadcast to non-existent session
    wsServer.broadcastToSession('non-existent-room', {
      type: 'chat',
      payload: {},
      timestamp: new Date()
    });

    // Broadcast to all clients
    wsServer.broadcast({
      type: 'global_alert',
      payload: { alert: 'server update' }
    });

    // Send to individual client
    wsServer.sendToClient(id1, {
      type: 'direct_msg',
      payload: { text: 'for you only' }
    });

    // Send to throwing client
    wsServer.sendToClient(idThrow, {
      type: 'direct_msg',
      payload: { text: 'will fail' }
    });

    // Send to closed client / non-existent client
    wsServer.sendToClient(idClosed, { type: 'noop', payload: {} });
    wsServer.sendToClient('fake-id', { type: 'noop', payload: {} });
  });

  it('handles client errors and disconnections with clean session tracking', () => {
    const mockWs: any = { readyState: WebSocket.OPEN, send: jest.fn(), on: jest.fn() };
    (wsServer as any).handleConnection(mockWs, { url: '/ws?sessionId=single-room', headers: { host: 'localhost' } });

    // Trigger close handler
    const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')[1];
    closeHandler();

    expect(wsServer.getStats().totalClients).toBe(0);
    expect(wsServer.getStats().sessions).toBe(0);

    // Trigger error handler
    const mockWs2: any = { readyState: WebSocket.OPEN, send: jest.fn(), on: jest.fn() };
    (wsServer as any).handleConnection(mockWs2, { url: '/ws', headers: { host: 'localhost' } });
    const errorHandler = mockWs2.on.mock.calls.find((call: any) => call[0] === 'error')[1];
    errorHandler(new Error('Connection reset'));

    expect(wsServer.getStats().totalClients).toBe(0);

    // Disconnecting non-existent client does not crash
    (wsServer as any).handleDisconnect('non-existent-client');
  });
});
