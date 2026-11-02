/**
 * Scoped Agent Communication Hub (PX-06 / PX06-T03)
 * Provides multi-agent messaging, scoped threads, inboxes, direct messages,
 * timeouts, and acknowledgments.
 * Enforces the rule that threads must be scoped by at least two boundary criteria:
 * (e.g. project/repo, path glob, subject, members, task ID).
 */

import { AgentPrivacyRedactor } from '../privacy/AgentPrivacyRedactor';

export interface ThreadScopeConstraints {
  projectId?: string;
  repository?: string;
  pathGlob?: string;
  subject?: string;
  members?: string[];
  taskId?: string;
}

export interface AgentMessage {
  messageId: string;
  threadId: string;
  senderAgentId: string;
  recipientAgentId?: string; // If direct message
  content: string;
  timestamp: string;
  acknowledgedBy: string[];
  replyToMessageId?: string;
  metadata?: Record<string, any>;
}

export interface AgentThread {
  threadId: string;
  title: string;
  scope: ThreadScopeConstraints;
  members: Set<string>;
  messages: AgentMessage[];
  archived: boolean;
  createdAt: string;
  lastActivityAt: string;
}

export interface StartThreadOptions {
  threadId?: string;
  title: string;
  creatorAgentId: string;
  initialMembers?: string[];
  scope: ThreadScopeConstraints;
}

export interface SendMessageOptions {
  threadId: string;
  senderAgentId: string;
  recipientAgentId?: string;
  content: string;
  replyToMessageId?: string;
  metadata?: Record<string, any>;
}

export class AgentCommunicationHub {
  private threads: Map<string, AgentThread> = new Map();
  private registeredAgents: Map<string, { agentId: string; role: string; registeredAt: string }> = new Map();
  private waitListeners: Map<string, Array<{ agentId: string; resolve: (msg: AgentMessage) => void; timeoutTimer: NodeJS.Timeout }>> = new Map();

  /**
   * Register an active agent with the hub
   */
  public registerAgent(agentId: string, role: string): void {
    this.registeredAgents.set(agentId, {
      agentId,
      role,
      registeredAt: new Date().toISOString()
    });
  }

  /**
   * Unregister an agent
   */
  public unregisterAgent(agentId: string): void {
    this.registeredAgents.delete(agentId);
  }

  /**
   * Validate that the thread scope contains at least two criteria
   */
  public static validateScopeConstraints(scope: ThreadScopeConstraints): boolean {
    let definedCount = 0;
    if (scope.projectId) definedCount++;
    if (scope.repository) definedCount++;
    if (scope.pathGlob) definedCount++;
    if (scope.subject) definedCount++;
    if (scope.taskId) definedCount++;
    if (scope.members && scope.members.length > 0) definedCount++;

    return definedCount >= 2;
  }

  /**
   * Start a new scoped thread
   */
  public startThread(options: StartThreadOptions): AgentThread {
    if (!AgentCommunicationHub.validateScopeConstraints(options.scope)) {
      throw new Error(
        'Invalid thread scope: A thread must be constrained by at least two criteria (e.g. projectId, repository, pathGlob, subject, taskId, members).'
      );
    }

    const threadId = options.threadId || `thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const members = new Set<string>(options.initialMembers || []);
    members.add(options.creatorAgentId);

    const now = new Date().toISOString();
    const thread: AgentThread = {
      threadId,
      title: options.title,
      scope: options.scope,
      members,
      messages: [],
      archived: false,
      createdAt: now,
      lastActivityAt: now
    };

    this.threads.set(threadId, thread);
    return thread;
  }

  /**
   * Post a message to a thread
   */
  public sendMessage(options: SendMessageOptions): AgentMessage {
    const thread = this.threads.get(options.threadId);
    if (!thread) {
      throw new Error(`Thread '${options.threadId}' not found.`);
    }

    if (thread.archived) {
      throw new Error(`Cannot send message to archived thread '${options.threadId}'.`);
    }

    if (!thread.members.has(options.senderAgentId)) {
      throw new Error(`Agent '${options.senderAgentId}' is not a member of thread '${options.threadId}'.`);
    }

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const redactedContent = AgentPrivacyRedactor.redactString(options.content);

    const message: AgentMessage = {
      messageId,
      threadId: options.threadId,
      senderAgentId: options.senderAgentId,
      recipientAgentId: options.recipientAgentId,
      content: redactedContent,
      timestamp: now,
      acknowledgedBy: [options.senderAgentId],
      replyToMessageId: options.replyToMessageId,
      metadata: options.metadata ? AgentPrivacyRedactor.redactObject(options.metadata) : undefined
    };

    thread.messages.push(message);
    thread.lastActivityAt = now;

    // Wake up any agents waiting for messages on this thread
    const listeners = this.waitListeners.get(options.threadId);
    if (listeners && listeners.length > 0) {
      const remaining: typeof listeners = [];
      for (const listener of listeners) {
        if (!options.recipientAgentId || options.recipientAgentId === listener.agentId || options.senderAgentId === listener.agentId) {
          clearTimeout(listener.timeoutTimer);
          listener.resolve(message);
        } else {
          remaining.push(listener);
        }
      }
      this.waitListeners.set(options.threadId, remaining);
    }

    return message;
  }

  /**
   * Get inbox for a specific agent across all scoped threads
   */
  public getInbox(agentId: string, unacknowledgedOnly = false): AgentMessage[] {
    const results: AgentMessage[] = [];

    for (const thread of this.threads.values()) {
      if (thread.archived) continue;
      if (!thread.members.has(agentId)) continue;

      for (const msg of thread.messages) {
        // Direct messages filter: only show if for this agent or sent by this agent
        if (msg.recipientAgentId && msg.recipientAgentId !== agentId && msg.senderAgentId !== agentId) {
          continue;
        }

        if (unacknowledgedOnly && msg.acknowledgedBy.includes(agentId)) {
          continue;
        }

        results.push(msg);
      }
    }

    return results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Acknowledge receipt of a message
   */
  public acknowledgeMessage(threadId: string, messageId: string, agentId: string): boolean {
    const thread = this.threads.get(threadId);
    if (!thread) return false;

    const message = thread.messages.find(m => m.messageId === messageId);
    if (!message) return false;

    if (!message.acknowledgedBy.includes(agentId)) {
      message.acknowledgedBy.push(agentId);
      return true;
    }
    return false;
  }

  /**
   * Wait for next message on a thread with a timeout
   */
  public waitForNextMessage(threadId: string, agentId: string, timeoutMs = 10000): Promise<AgentMessage> {
    return new Promise((resolve, reject) => {
      const thread = this.threads.get(threadId);
      if (!thread) {
        return reject(new Error(`Thread '${threadId}' not found.`));
      }

      const timer = setTimeout(() => {
        // Remove listener
        const list = this.waitListeners.get(threadId) || [];
        this.waitListeners.set(
          threadId,
          list.filter(l => l.timeoutTimer !== timer)
        );
        reject(new Error(`Timed out waiting for message on thread '${threadId}' after ${timeoutMs}ms.`));
      }, timeoutMs);

      const list = this.waitListeners.get(threadId) || [];
      list.push({ agentId, resolve, timeoutTimer: timer });
      this.waitListeners.set(threadId, list);
    });
  }

  /**
   * Join an existing thread
   */
  public joinThread(threadId: string, agentId: string): void {
    const thread = this.threads.get(threadId);
    if (!thread) throw new Error(`Thread '${threadId}' not found.`);
    thread.members.add(agentId);
  }

  /**
   * Leave a thread
   */
  public leaveThread(threadId: string, agentId: string): void {
    const thread = this.threads.get(threadId);
    if (!thread) return;
    thread.members.delete(agentId);
  }

  /**
   * Archive a thread
   */
  public archiveThread(threadId: string): void {
    const thread = this.threads.get(threadId);
    if (thread) {
      thread.archived = true;
    }
  }

  /**
   * Get thread summary
   */
  public getThread(threadId: string): AgentThread | undefined {
    return this.threads.get(threadId);
  }

  /**
   * List all non-archived threads for an agent
   */
  public listThreadsForAgent(agentId: string): AgentThread[] {
    return Array.from(this.threads.values()).filter(t => !t.archived && t.members.has(agentId));
  }
}
