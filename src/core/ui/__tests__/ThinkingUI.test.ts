import { ThinkingUI } from '../ThinkingUI';

describe('RT-THINK-001: ThinkingUI Chain-of-Thought & Reasoning Display Suite', () => {
  let ui: ThinkingUI;

  beforeEach(() => {
    ui = new ThinkingUI({
      enabled: true,
      maxSteps: 5,
      autoCollapse: true,
      collapseDelay: 100
    });
  });

  it('manages sessions, step addition, callbacks, durations, and auto-collapse', async () => {
    const callbackMock = jest.fn();
    ui.onThinking(callbackMock);

    const sessionId = ui.startSession('How does gradient descent work?');
    expect(ui.getCurrentSession()?.id).toBe(sessionId);

    // Add steps
    const step1 = ui.addStep('I see the mathematical definition of convex functions', 'observation');
    expect(step1.type).toBe('observation');

    const step2 = ui.addStep('Calculating partial derivatives across weights', 'reasoning');
    expect(step2.type).toBe('reasoning');
    expect(ui.getSession(sessionId)?.steps[0].duration).toBeDefined();

    const step3 = ui.addStep('Therefore we conclude update rule W = W - lr * dW', 'decision');
    expect(step3.type).toBe('decision');

    const step4 = ui.addStep('Let me run convergence checks on sample mini-batch', 'action');
    expect(step4.type).toBe('action');

    expect(callbackMock).toHaveBeenCalledTimes(4);

    // Complete session
    ui.completeSession('Gradient descent updates parameters in the direction of steepest descent.');
    expect(ui.getCurrentSession()).toBeNull();

    // Toggle visibility
    const visible1 = ui.toggleVisibility(sessionId);
    expect(typeof visible1).toBe('boolean');

    const missingToggle = ui.toggleVisibility('nonexistent');
    expect(missingToggle).toBe(false);

    // Format for display
    const session = ui.getSession(sessionId)!;
    const formatted = ui.formatForDisplay(session);
    expect(formatted).toContain('Thinking Process');
    expect(formatted).toContain('Answer');

    // Remove callback
    ui.offThinking(callbackMock);
  });

  it('parses thinking across XML tags, DeepSeek markers, and Claude blocks', () => {
    // 1. XML <thinking> format
    const xml = '<thinking>First assess risk\nSecond compute bounds</thinking><answer>Result is 42</answer>';
    const parsedXml = ui.parseThinking(xml);
    expect(parsedXml.thinking).toContain('First assess risk');
    expect(parsedXml.answer).toBe('Result is 42');

    // 2. DeepSeek format
    const deepseek = '[Thinking]Let us analyze step by step[Answer]Final verdict is approved';
    const parsedDs = ui.parseThinking(deepseek);
    expect(parsedDs.thinking).toContain('step by step');
    expect(parsedDs.answer).toBe('Final verdict is approved');

    // 3. Claude extended format
    const claudeThinking = 'This is a long chain of thought where we explore multiple candidate hypotheses and evaluate the empirical trade-offs thoroughly.'.repeat(2);
    const claude = `${claudeThinking}\n\n---\n\nHere is the final answer for the user.`;
    const parsedClaude = ui.parseThinking(claude);
    expect(parsedClaude.thinking.length).toBeGreaterThan(100);
    expect(parsedClaude.answer).toContain('Here is the final answer');

    // 4. Plain response without thinking
    const plain = 'Simple direct response';
    const parsedPlain = ui.parseThinking(plain);
    expect(parsedPlain.thinking).toBe('');
    expect(parsedPlain.answer).toBe('Simple direct response');
  });

  it('extracts structured steps from raw thinking text and classifies types', () => {
    // Numbered pattern
    const rawNumbered = `
      1. I see that the matrix is non-singular.
      2. Notice the eigenvalues are strictly positive.
      3. Therefore we decide to apply Cholesky factorization.
      4. We will compute the lower triangular factor L.
    `;
    const numberedSteps = ui.extractSteps(rawNumbered);
    expect(numberedSteps.length).toBe(4);
    expect(numberedSteps[0].type).toBe('observation');
    expect(numberedSteps[2].type).toBe('decision');
    expect(numberedSteps[3].type).toBe('action');

    // Sentence splitting fallback
    const rawSentences = 'We observe the convergence rate is linear. We should compute more iterations. Therefore we finish now.';
    const sentenceSteps = ui.extractSteps(rawSentences);
    expect(sentenceSteps.length).toBeGreaterThanOrEqual(2);
  });

  it('enforces maxSteps capacity, handles missing session errors, and clears old sessions', () => {
    const sessionId = ui.startSession('Load test');
    for (let i = 0; i < 10; i++) {
      ui.addStep(`Step ${i}`);
    }
    expect(ui.getSession(sessionId)?.steps.length).toBe(5); // capped at maxSteps=5

    // Error on no active session
    ui.completeSession('done');
    expect(() => ui.addStep('Orphan step')).toThrow('No active thinking session');

    // Stats
    const stats = ui.getStats();
    expect(stats.activeSessions).toBe(1);
    expect(stats.totalSteps).toBe(5);

    // Clear old sessions
    const cleared = ui.clearOldSessions(0); // 0 maxAge clears all past sessions
    expect(cleared).toBe(1);
  });
});
