/**
 * Phase 17 Exit Gate Test Suite: Response Quality Gate (CRK-P17)
 *
 * Verifies all Phase 17 exit criteria (§2975-2981):
 * 1. Validation errors drive correct remediation stage (§2977).
 * 2. Tool/test claims cannot exceed evidence (§2978).
 * 3. Grounded answers use only selected evidence (§2979).
 * 4. Retry loops are bounded and reason-specific (§2980).
 */

import { ResponseQualityGate } from '../ResponseQualityGate';
import { ResponseValidationContext } from '../../../types/response-quality';

describe('ResponseQualityGate (CRK Phase 17 Exit Gate)', () => {
  const baseValidContext: ResponseValidationContext = {
    requestId: 'req_001',
    userMessage: 'How do I use React state?',
    response: 'Use the `useState` hook: `const [count, setCount] = useState(0);`.',
    requiresGrounding: false,
    requiresTools: false,
  };

  it('passes a well-formed, truthful response with no issues', () => {
    const result = ResponseQualityGate.validate(baseValidContext);
    expect(result.valid).toBe(true);
    expect(result.severity).toBe('info');
    expect(result.codes).toHaveLength(0);
    expect(result.retryRecommended).toBe(false);
    expect(result.remediationAction).toBe('none');
  });

  describe('Exit Gate Criterion 1: Validation errors drive correct remediation stage', () => {
    it('recommends retry_model when code block fences are unclosed', () => {
      const ctx: ResponseValidationContext = {
        ...baseValidContext,
        response: 'Here is the function:\n```typescript\nfunction test() { return true; }\n',
      };
      const result = ResponseQualityGate.validate(ctx, { currentAttempt: 0, maxModelRetries: 2 });
      expect(result.valid).toBe(false);
      expect(result.codes).toContain('MALFORMED_CODE_BLOCK');
      expect(result.retryRecommended).toBe(true);
      expect(result.remediationAction).toBe('retry_model');
    });

    it('recommends remediate_tool and NOT model retry when tool claims exceed evidence', () => {
      const ctx: ResponseValidationContext = {
        ...baseValidContext,
        response: 'I have edited the file src/index.ts to fix the bug.',
        toolResults: [],
      };
      const result = ResponseQualityGate.validate(ctx, { currentAttempt: 0, maxModelRetries: 2 });
      expect(result.valid).toBe(false);
      expect(result.codes).toContain('UNSUPPORTED_TOOL_CLAIM');
      expect(result.retryRecommended).toBe(false);
      expect(result.remediationAction).toBe('remediate_tool');
    });

    it('recommends broaden_retrieval when grounded query has zero retrieved chunks', () => {
      const ctx: ResponseValidationContext = {
        ...baseValidContext,
        requiresGrounding: true,
        retrievedChunks: [],
        response: 'Here is the definitive answer on our internal API.',
      };
      const result = ResponseQualityGate.validate(ctx);
      expect(result.valid).toBe(false);
      expect(result.codes).toContain('INSUFFICIENT_EVIDENCE');
      expect(result.retryRecommended).toBe(false);
      expect(result.remediationAction).toBe('broaden_retrieval');
    });
  });

  describe('Exit Gate Criterion 2: Tool/test claims cannot exceed evidence', () => {
    it('blocks claims that tests passed when tests were never executed', () => {
      const ctx: ResponseValidationContext = {
        ...baseValidContext,
        isCodingTask: true,
        response: 'I applied the change and all tests have passed successfully.',
        toolResults: [
          {
            toolCallId: 'tc_1',
            toolName: 'patch_file',
            status: 'success',
          },
        ],
      };
      const result = ResponseQualityGate.validate(ctx);
      expect(result.valid).toBe(false);
      expect(result.codes).toContain('UNSUPPORTED_TEST_CLAIM');
      expect(result.codes).toContain('OVERCLAIMED_VERIFICATION');
    });

    it('allows claims when tool results contain verified test passes', () => {
      const ctx: ResponseValidationContext = {
        ...baseValidContext,
        isCodingTask: true,
        response: 'I applied the fix and verified that the tests pass.',
        toolResults: [
          {
            toolCallId: 'tc_1',
            toolName: 'patch_file',
            status: 'success',
          },
          {
            toolCallId: 'tc_2',
            toolName: 'run_tests',
            status: 'success',
          },
        ],
      };
      const result = ResponseQualityGate.validate(ctx);
      expect(result.valid).toBe(true);
      expect(result.codes).not.toContain('UNSUPPORTED_TEST_CLAIM');
      expect(result.codes).not.toContain('OVERCLAIMED_VERIFICATION');
    });

    it('warns when tool execution failed but response fails to mention risks', () => {
      const ctx: ResponseValidationContext = {
        ...baseValidContext,
        isCodingTask: true,
        response: 'Everything is fine and ready to go.',
        toolResults: [
          {
            toolCallId: 'tc_err',
            toolName: 'deploy_step',
            status: 'failed',
          },
        ],
      };
      const result = ResponseQualityGate.validate(ctx);
      expect(result.codes).toContain('OMITTED_FAILURE_RISK');
      expect(result.severity).toBe('warning');
    });
  });

  describe('Exit Gate Criterion 3: Grounded answers use only selected evidence', () => {
    it('flags citations that reference unselected context chunks', () => {
      const ctx: ResponseValidationContext = {
        ...baseValidContext,
        requiresGrounding: true,
        retrievedChunks: [
          {
            chunkId: 'chunk_alpha',
            sourceId: 'doc_alpha',
            title: 'Alpha Docs',
            content: 'Alpha documentation on components.',
            authority: 0.95,
          },
        ],
        citations: [
          {
            id: 'cit_1',
            sourceId: 'doc_beta',
            chunkId: 'chunk_beta',
            title: 'Beta Docs',
          },
        ],
        response: 'According to Beta Docs, this is configured differently.',
      };
      const result = ResponseQualityGate.validate(ctx);
      expect(result.valid).toBe(false);
      expect(result.codes).toContain('UNSELECTED_CONTEXT_CITATION');
    });

    it('flags version mismatch when response claims an ungrounded major version', () => {
      const ctx: ResponseValidationContext = {
        ...baseValidContext,
        requiresGrounding: true,
        retrievedChunks: [
          {
            chunkId: 'chunk_1',
            sourceId: 'doc_1',
            title: 'Library v2 Guide',
            content: 'This guide covers version 2.4 and v2.5 features.',
            version: '2.5.0',
            authority: 0.9,
          },
        ],
        response: 'You should use version 5.0 of the library for this API.',
      };
      const result = ResponseQualityGate.validate(ctx);
      expect(result.codes).toContain('VERSION_MISMATCH_CLAIM');
    });
  });

  describe('Exit Gate Criterion 4: Retry loops are bounded and reason-specific', () => {
    it('terminates retry recommendation when maxModelRetries attempt count is reached', () => {
      const ctx: ResponseValidationContext = {
        ...baseValidContext,
        response: '```json\n{ "invalid": true \n',
        expectedFormat: 'json',
      };
      const result = ResponseQualityGate.validate(ctx, {
        currentAttempt: 2,
        maxModelRetries: 2,
      });
      expect(result.valid).toBe(false);
      expect(result.retryRecommended).toBe(false);
      expect(result.remediationAction).toBe('abstain');
    });

    it('provides corrected safe wording for overclaimed file changes', () => {
      const ctx: ResponseValidationContext = {
        ...baseValidContext,
        response: 'I have edited the file src/index.ts to fix the issue.',
        toolResults: [],
      };
      const result = ResponseQualityGate.validate(ctx);
      expect(result.correctedResponse).toBeDefined();
      expect(result.correctedResponse).toContain('Here is the proposed change for the file');
    });
  });
});
