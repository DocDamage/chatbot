import { AgentCommunicationHub } from '../communication/AgentCommunicationHub';
import { TaskScheduler } from '../../scheduler/TaskScheduler';

describe('B75-08: Agent Communication Hub and Task Scheduler Matrix', () => {
  describe('AgentCommunicationHub Operations', () => {
    it('manages agent registration, thread scope validation, messages, and inboxes', () => {
      const hub = new AgentCommunicationHub();

      hub.registerAgent('agent_planner', 'planner');
      hub.registerAgent('agent_coder', 'coder');

      // Scope validation: must have at least 2 criteria
      expect(() =>
        hub.startThread({
          title: 'Refactor Auth Module',
          creatorAgentId: 'agent_planner',
          scope: { projectId: 'chatbot' } // Only 1 criteria -> should throw
        })
      ).toThrow('Invalid thread scope');

      // Valid thread with 2 criteria
      const thread = hub.startThread({
        title: 'Refactor Auth Module',
        creatorAgentId: 'agent_planner',
        initialMembers: ['agent_coder'],
        scope: { projectId: 'chatbot', repository: 'chatbot-repo' }
      });

      expect(thread.threadId).toBeDefined();
      expect(thread.members.has('agent_planner')).toBe(true);
      expect(thread.members.has('agent_coder')).toBe(true);

      // Send message
      const msg = hub.sendMessage({
        threadId: thread.threadId,
        senderAgentId: 'agent_planner',
        content: 'Please refactor the token validator function.'
      });

      expect(msg.messageId).toBeDefined();
      expect(msg.content).toContain('refactor the token validator');

      // Non-member sending message should throw
      expect(() =>
        hub.sendMessage({
          threadId: thread.threadId,
          senderAgentId: 'agent_unknown',
          content: 'Hello'
        })
      ).toThrow('is not a member of thread');

      // Acknowledge message
      hub.acknowledgeMessage(thread.threadId, msg.messageId, 'agent_coder');
      const updatedThread = hub.getThread(thread.threadId);
      expect(updatedThread?.messages[0].acknowledgedBy).toContain('agent_coder');

      // Check inbox
      const inbox = hub.getInbox('agent_coder');
      expect(inbox.length).toBeGreaterThan(0);

      // Archive thread
      hub.archiveThread(thread.threadId);
      expect(hub.getThread(thread.threadId)?.archived).toBe(true);
      expect(() =>
        hub.sendMessage({
          threadId: thread.threadId,
          senderAgentId: 'agent_planner',
          content: 'Another message'
        })
      ).toThrow('Cannot send message to archived thread');
    });

    it('supports direct messages, waiting for messages, joining/leaving threads, and unregistering', async () => {
      const hub = new AgentCommunicationHub();

      hub.registerAgent('ag1', 'reviewer');
      hub.registerAgent('ag2', 'author');

      const thread = hub.startThread({
        title: 'Review PR',
        creatorAgentId: 'ag1',
        initialMembers: ['ag2'],
        scope: { pathGlob: 'src/**', taskId: 'task-99' }
      });

      // Join and leave thread
      hub.joinThread(thread.threadId, 'ag3');
      expect(hub.listThreadsForAgent('ag3').length).toBe(1);

      hub.leaveThread(thread.threadId, 'ag3');
      expect(hub.listThreadsForAgent('ag3').length).toBe(0);

      // Wait for message async
      const waitPromise = hub.waitForNextMessage(thread.threadId, 'ag2', 2000);

      // Direct message to ag2
      const dm = hub.sendMessage({
        threadId: thread.threadId,
        senderAgentId: 'ag1',
        recipientAgentId: 'ag2',
        content: 'Direct note to author'
      });

      const received = await waitPromise;
      expect(received.messageId).toBe(dm.messageId);

      // Timeout test
      await expect(hub.waitForNextMessage(thread.threadId, 'ag1', 50)).rejects.toThrow('Timed out waiting');

      // Unacknowledged inbox filter
      const unackInbox = hub.getInbox('ag2', true);
      expect(unackInbox.length).toBe(1);

      hub.acknowledgeMessage(thread.threadId, dm.messageId, 'ag2');
      const emptyUnack = hub.getInbox('ag2', true);
      expect(emptyUnack.length).toBe(0);

      // Unregister agent
      hub.unregisterAgent('ag1');
    });
  });

  describe('TaskScheduler Operations', () => {
    it('schedules tasks, executes them manually, and manages task lifecycle', async () => {
      const scheduler = new TaskScheduler();

      let executed = false;
      const taskId = await scheduler.addTask({
        name: 'Health Check Task',
        cron: '0 * * * *',
        action: async () => {
          executed = true;
        }
      });

      expect(taskId).toBeDefined();
      expect(scheduler.getTask(taskId)).toBeDefined();

      const result = await scheduler.executeTask(taskId);
      expect(result.success).toBe(true);
      expect(executed).toBe(true);

      const removed = scheduler.removeTask(taskId);
      expect(removed).toBe(true);
      expect(scheduler.getTask(taskId)).toBeUndefined();
    });
  });
});
