/**
 * WebSocket Server - Real-time chat and notifications
 */

import { Server as HTTPServer } from 'http';
import { WebSocket, WebSocketServer as WS } from 'ws';
import { logger } from '../observability/logger';
import { v4 as uuidv4 } from 'uuid';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: Date;
  messageId?: string;
}

export interface ClientConnection {
  id: string;
  userId?: string;
  sessionId?: string;
  ws: WebSocket;
  connectedAt: Date;
  lastActivity: Date;
}

export class WebSocketServer {
  private wss: WS;
  private clients: Map<string, ClientConnection> = new Map();
  private sessionClients: Map<string, Set<string>> = new Map(); // sessionId -> clientIds

  constructor(server: HTTPServer) {
    this.wss = new WS({ server });

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });

    logger.info('WebSocket server initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: any): void {
    const clientId = uuidv4();
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId') || undefined;
    const userId = url.searchParams.get('userId') || undefined;

    const client: ClientConnection = {
      id: clientId,
      userId,
      sessionId,
      ws,
      connectedAt: new Date(),
      lastActivity: new Date(),
    };

    this.clients.set(clientId, client);

    // Track session clients
    if (sessionId) {
      if (!this.sessionClients.has(sessionId)) {
        this.sessionClients.set(sessionId, new Set());
      }
      this.sessionClients.get(sessionId)!.add(clientId);
    }

    // Send connection confirmation
    this.sendToClient(clientId, {
      type: 'connected',
      payload: { clientId, sessionId },
    });

    // Handle messages
    ws.on('message', (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        this.handleMessage(clientId, message);
      } catch (error: any) {
        logger.error('Failed to parse WebSocket message', { error: error.message });
        this.sendToClient(clientId, {
          type: 'error',
          payload: { error: 'Invalid message format' },
        });
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      this.handleDisconnect(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', { clientId, error: error.message });
      this.handleDisconnect(clientId);
    });

    logger.info('WebSocket client connected', { clientId, sessionId, userId });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = new Date();

    switch (message.type) {
      case 'ping':
        this.sendToClient(clientId, { type: 'pong', payload: {} });
        break;
      case 'subscribe':
        // Subscribe to session updates
        if (message.payload.sessionId) {
          const sessionId = message.payload.sessionId;
          if (!this.sessionClients.has(sessionId)) {
            this.sessionClients.set(sessionId, new Set());
          }
          this.sessionClients.get(sessionId)!.add(clientId);
          client.sessionId = sessionId;
        }
        break;
      case 'unsubscribe':
        // Unsubscribe from session
        if (client.sessionId) {
          const clients = this.sessionClients.get(client.sessionId);
          if (clients) {
            clients.delete(clientId);
          }
        }
        break;
      default:
        logger.debug('Unknown message type', { type: message.type });
    }
  }

  /**
   * Broadcast message to session
   */
  broadcastToSession(sessionId: string, message: WebSocketMessage): void {
    const clients = this.sessionClients.get(sessionId);
    if (!clients) return;

    const messageStr = JSON.stringify({
      ...message,
      timestamp: message.timestamp.toISOString(),
    });

    let sent = 0;
    for (const clientId of clients) {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageStr);
          sent++;
        } catch (error: any) {
          logger.warn('Failed to send to client', { clientId, error: error.message });
        }
      }
    }

    logger.debug('Broadcast to session', { sessionId, sent, total: clients.size });
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: Omit<WebSocketMessage, 'timestamp'>): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: new Date(),
    };

    try {
      client.ws.send(JSON.stringify({
        ...fullMessage,
        timestamp: fullMessage.timestamp.toISOString(),
      }));
    } catch (error: any) {
      logger.error('Failed to send to client', { clientId, error: error.message });
    }
  }

  /**
   * Broadcast to all clients
   */
  broadcast(message: Omit<WebSocketMessage, 'timestamp'>): void {
    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: new Date(),
    };

    const messageStr = JSON.stringify({
      ...fullMessage,
      timestamp: fullMessage.timestamp.toISOString(),
    });

    let sent = 0;
    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageStr);
          sent++;
        } catch (error: any) {
          logger.warn('Failed to broadcast to client', { clientId });
        }
      }
    }

    logger.debug('Broadcast to all clients', { sent, total: this.clients.size });
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from session
    if (client.sessionId) {
      const clients = this.sessionClients.get(client.sessionId);
      if (clients) {
        clients.delete(clientId);
        if (clients.size === 0) {
          this.sessionClients.delete(client.sessionId);
        }
      }
    }

    this.clients.delete(clientId);
    logger.info('WebSocket client disconnected', { clientId });
  }

  /**
   * Get connection stats
   */
  getStats(): {
    totalClients: number;
    sessions: number;
    clientsBySession: Record<string, number>;
  } {
    const clientsBySession: Record<string, number> = {};
    for (const [sessionId, clients] of this.sessionClients.entries()) {
      clientsBySession[sessionId] = clients.size;
    }

    return {
      totalClients: this.clients.size,
      sessions: this.sessionClients.size,
      clientsBySession,
    };
  }
}

