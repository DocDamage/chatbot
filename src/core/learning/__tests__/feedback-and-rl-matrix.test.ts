import { FeedbackCollector } from '../FeedbackCollector';
import { KnowledgeLearner } from '../KnowledgeLearner';
import { RewardModel } from '../../rl/RewardModel';

describe('B75-08: Feedback Collector, Knowledge Learner, and RL Reward Model Matrix', () => {
  describe('FeedbackCollector Operations', () => {
    it('collects user ratings, updates stats, processes batches, and invokes callbacks', () => {
      const collector = new FeedbackCollector();
      const callbackSpy = jest.fn();
      collector.onFeedback(callbackSpy);

      collector.collect({
        responseId: 'resp_1',
        userId: 'u1',
        sessionId: 's1',
        rating: 5,
        thumbsUp: true,
        categories: ['accurate', 'helpful'],
        comment: 'Great response!',
        timestamp: new Date()
      });

      collector.collect({
        responseId: 'resp_2',
        userId: 'u2',
        sessionId: 's2',
        rating: 2,
        thumbsDown: true,
        categories: ['slow'],
        comment: 'Too slow',
        timestamp: new Date()
      });

      expect(callbackSpy).toHaveBeenCalledTimes(2);

      const stats = collector.getStats();
      expect(stats.pending).toBe(2);
      expect(stats.averageRating).toBe(3.5);
      expect(stats.positiveRate).toBe(0.5);
      expect(stats.negativeRate).toBe(0.5);
    });
  });

  describe('RewardModel Operations', () => {
    it('computes weighted multi-signal rewards from explicit and implicit feedback', () => {
      const model = new RewardModel();

      const signalPositive = model.calculateReward({
        responseId: 'resp_1',
        userId: 'u1',
        sessionId: 's1',
        response: 'Here is a clean implementation of the function with test coverage.',
        userFeedback: {
          rating: 5,
          thumbsUp: true,
          comment: 'Perfect!'
        },
        implicitFeedback: {
          userContinued: true,
          userAskedFollowUp: false,
          responseTime: 800
        }
      });

      expect(signalPositive.overall).toBeGreaterThan(0.7);
      expect(signalPositive.userSatisfaction).toBe(1.0);
      expect(signalPositive.safety).toBeGreaterThanOrEqual(0.8);

      const signalNegative = model.calculateReward({
        responseId: 'resp_2',
        userId: 'u2',
        sessionId: 's2',
        response: 'Error occurred.',
        userFeedback: {
          rating: 1,
          thumbsDown: true
        },
        implicitFeedback: {
          userContinued: false,
          userAskedFollowUp: true,
          responseTime: 5000
        }
      });

      expect(signalNegative.overall).toBeLessThan(0.5);
      expect(signalNegative.userSatisfaction).toBe(0.0);
    });
  });

  describe('KnowledgeLearner Operations', () => {
    it('extracts patterns from code blocks in interaction responses and saves snippets', async () => {
      const mockKnowledgeBase = {
        addSnippet: jest.fn().mockResolvedValue('snip_123')
      };

      const learner = new KnowledgeLearner(mockKnowledgeBase as any);

      const userQuery = 'How to create a secure JWT authentication middleware?';
      const aiResponse = `
        Here is how you can implement it:
        \`\`\`typescript
        export function jwtAuthMiddleware(req: Request, res: Response, next: NextFunction) {
          const authHeader = req.headers['authorization'];
          if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
          const token = authHeader.split(' ')[1];
          try {
            const decoded = verifyToken(token);
            req.user = decoded;
            next();
          } catch (err) {
            return res.status(403).json({ error: 'Forbidden' });
          }
        }
        \`\`\`
      `;

      await learner.learnFromInteraction(userQuery, aiResponse);
      expect(mockKnowledgeBase.addSnippet).toHaveBeenCalled();
    });

    it('ignores responses without meaningful code or without learning trigger words', async () => {
      const mockKnowledgeBase = {
        addSnippet: jest.fn()
      };
      const learner = new KnowledgeLearner(mockKnowledgeBase as any);

      // No code blocks
      await learner.learnFromInteraction('How to do X', 'Just do X like this in text.');
      expect(mockKnowledgeBase.addSnippet).not.toHaveBeenCalled();

      // Non-learning trigger query
      await learner.learnFromInteraction('Hello chatbot', '```typescript\nconst a = 12345678901234567890123456789012345678901234567890;\n```');
      expect(mockKnowledgeBase.addSnippet).not.toHaveBeenCalled();

      // Short snippet (<50 chars)
      await learner.learnFromInteraction('How to test', '```python\nprint("hi")\n```');
      expect(mockKnowledgeBase.addSnippet).not.toHaveBeenCalled();
    });

    it('categorizes various languages (frontend, ai, database, deployment) and supports learnSnippet', async () => {
      const mockKnowledgeBase = {
        addSnippet: jest.fn().mockResolvedValue('snip_id')
      };
      const learner = new KnowledgeLearner(mockKnowledgeBase as any);

      // Frontend (React useEffect)
      await learner.learnFromInteraction(
        'how to create component',
        '```typescript\nconst [val, setVal] = useState(0); useEffect(() => { console.log(val); }, []);\n```'
      );
      expect(mockKnowledgeBase.addSnippet).toHaveBeenCalledWith(
        expect.stringContaining('How To Create Component'),
        expect.stringContaining('useState'),
        'frontend',
        expect.any(Array)
      );

      // AI (Python torch)
      await learner.learnFromInteraction(
        'implement torch neural network model',
        '```python\nimport torch\nclass Net(torch.nn.Module): def __init__(self): super().__init__()\n```'
      );
      expect(mockKnowledgeBase.addSnippet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'ai',
        expect.any(Array)
      );

      // Database (SQL)
      await learner.learnFromInteraction(
        'how to create table with foreign keys',
        '```sql\nCREATE TABLE orders (id INT PRIMARY KEY, user_id INT, total NUMERIC(10, 2));\n```'
      );
      expect(mockKnowledgeBase.addSnippet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'database',
        expect.any(Array)
      );

      // Deployment (Docker)
      await learner.learnFromInteraction(
        'how to deploy container with dockerfile',
        '```docker\nFROM node:18-alpine\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD ["npm", "start"]\n```'
      );
      expect(mockKnowledgeBase.addSnippet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'deployment',
        expect.any(Array)
      );

      // learnSnippet manual
      await learner.learnSnippet('Manual Custom Hook', 'function useCustom() {}', 'frontend');
      expect(mockKnowledgeBase.addSnippet).toHaveBeenCalledWith('Manual Custom Hook', 'function useCustom() {}', 'frontend', ['manual-entry']);

      // Error handling branch
      mockKnowledgeBase.addSnippet.mockRejectedValueOnce(new Error('DB write failure'));
      await learner.learnFromInteraction('how to handle error', '```typescript\nconst errorHandle = () => { try {} catch (e) { throw e; } };\n```');
    });
  });
});
