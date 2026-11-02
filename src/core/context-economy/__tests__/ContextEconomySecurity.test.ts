import { ReversibleContextStore } from '../reversible-store/ReversibleContextStore';
import { ContextContentRouter } from '../router/ContextContentRouter';
import { ContextBudgetPlanner } from '../budgets/ContextBudgetPlanner';
import { ContextCheckpointManager } from '../checkpoints/ContextCheckpointManager';
import { ModelAssistedCompressor } from '../compressors/ModelAssistedCompressor';

describe('ContextEconomySecurity (PX-03 / PX03-T09)', () => {
  let store: ReversibleContextStore;
  let router: ContextContentRouter;
  let checkpoints: ContextCheckpointManager;

  beforeEach(() => {
    store = ReversibleContextStore.getInstance();
    router = ContextContentRouter.getInstance();
    checkpoints = ContextCheckpointManager.getInstance();
    store.clear();
    checkpoints.clear();
  });

  it('enforces tenant isolation and prevents cross-user context leakage', () => {
    const record = store.store({
      ownerId: 'user-alice',
      projectId: 'proj-alpha',
      contentType: 'source_code',
      originalContent: 'const secretKey = "SUPER_SECRET_ALICE";',
      compressedContent: '/* secret code */',
      compressionMethod: 'test',
      accessScope: 'user_only'
    });

    // Alice can retrieve
    const aliceFetch = store.retrieve(record.contextKey, { userId: 'user-alice' });
    expect(aliceFetch.success).toBe(true);
    expect(aliceFetch.content).toBe('const secretKey = "SUPER_SECRET_ALICE";');

    // Bob cannot retrieve Alice's user-only context
    const bobFetch = store.retrieve(record.contextKey, { userId: 'user-bob' });
    expect(bobFetch.success).toBe(false);
    expect(bobFetch.reason).toContain('Access denied');

    // Admin can retrieve
    const adminFetch = store.retrieve(record.contextKey, { userId: 'admin-user', isAdmin: true });
    expect(adminFetch.success).toBe(true);
  });

  it('rejects expired context keys safely', () => {
    const record = store.store({
      ownerId: 'user-alice',
      contentType: 'json_payload',
      originalContent: '{"temp": 123}',
      compressedContent: '{"temp": 123}',
      compressionMethod: 'test',
      ttlSeconds: -10 // Already expired
    });

    const fetchResult = store.retrieve(record.contextKey, { userId: 'user-alice' });
    expect(fetchResult.success).toBe(false);
    expect(fetchResult.reason).toContain('expired');
  });

  it('detects fabricated source anchors and falls back to deterministic compression', async () => {
    const rawContent = `
export class SecureVault {
  public openDoor(token: string): boolean {
    return token === "vault-token";
  }
}
`;

    // Simulate an adversarial / hallucinating LLM summarizer that drops the required SecureVault anchor
    const adversarialSummarizer = async () => {
      return 'Summary: The door opens automatically for everyone.';
    };

    const res = await ModelAssistedCompressor.compress(rawContent, {
      allowLossySynthesis: true,
      maxTargetTokens: 100,
      expectedSourceAnchors: ['SecureVault', 'openDoor'],
      mockLlmSummarizer: adversarialSummarizer
    });

    // Should detect missing anchors and fallback to deterministic outline
    expect(res.methodUsed).toBe('deterministic_fallback');
    expect(res.compressed).toContain('SecureVault');
    expect(res.anchorsValidated).toBe(false);
  });

  it('isolates tool deduplication caches across arguments', () => {
    let executionCount = 0;
    const execute = () => {
      executionCount++;
      return `Result #${executionCount}`;
    };

    const res1 = checkpoints.deduplicateToolCall('git_log', { limit: 5 }, execute);
    const res2 = checkpoints.deduplicateToolCall('git_log', { limit: 5 }, execute);
    const res3 = checkpoints.deduplicateToolCall('git_log', { limit: 10 }, execute);

    expect(res1).toBe('Result #1');
    expect(res2).toContain('cached tool output');
    expect(res3).toBe('Result #2'); // Different args re-executes
    expect(executionCount).toBe(2);
  });
});
