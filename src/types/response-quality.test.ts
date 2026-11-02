/**
 * Unit Tests for Response Validation Schemas (CRK-P17-T01)
 */

import {
  responseValidationSchema,
  responseValidationContextSchema,
  ResponseValidation,
  validationIssueSchema,
} from './response-quality';

describe('Response Quality Schemas (CRK-P17-T01)', () => {
  it('validates a valid response validation record with info severity', () => {
    const raw: ResponseValidation = {
      valid: true,
      severity: 'info',
      codes: [],
      retryRecommended: false,
      remediationAction: 'none',
      issues: [],
    };

    const parsed = responseValidationSchema.parse(raw);
    expect(parsed.valid).toBe(true);
    expect(parsed.severity).toBe('info');
    expect(parsed.remediationAction).toBe('none');
  });

  it('validates a failed response validation record with error severity and issues', () => {
    const raw = {
      valid: false,
      severity: 'error',
      codes: ['UNSUPPORTED_TOOL_CLAIM', 'UNGROUNDED_CLAIM'],
      retryRecommended: false,
      remediationAction: 'remediate_tool',
      issues: [
        {
          code: 'UNSUPPORTED_TOOL_CLAIM',
          message: 'Claimed file was edited but no tool was executed',
          severity: 'error',
          field: 'response',
          suggestedFix: 'Remove assertion of file changes',
        },
      ],
      correctedResponse: 'I have analyzed the file but have not modified it.',
    };

    const parsed = responseValidationSchema.parse(raw);
    expect(parsed.valid).toBe(false);
    expect(parsed.severity).toBe('error');
    expect(parsed.codes).toContain('UNSUPPORTED_TOOL_CLAIM');
    expect(parsed.remediationAction).toBe('remediate_tool');
    expect(parsed.correctedResponse).toBeDefined();
    expect(parsed.issues).toHaveLength(1);
  });

  it('validates ResponseValidationContext with retrieved chunks and tool results', () => {
    const ctx = {
      requestId: 'req_123',
      response: 'Here is the answer based on documentation.',
      userMessage: 'How do I configure database?',
      requiresGrounding: true,
      citations: [
        {
          id: 'cit_1',
          sourceId: 'src_1',
          title: 'Database Config',
          chunkId: 'chk_1',
        },
      ],
      retrievedChunks: [
        {
          chunkId: 'chk_1',
          sourceId: 'src_1',
          title: 'Database Config',
          content: 'Set DB_HOST in config.',
          authority: 0.95,
        },
      ],
      toolResults: [
        {
          toolCallId: 'tc_1',
          toolName: 'read_config',
          status: 'success' as const,
        },
      ],
    };

    const parsed = responseValidationContextSchema.parse(ctx);
    expect(parsed.requestId).toBe('req_123');
    expect(parsed.citations).toHaveLength(1);
    expect(parsed.retrievedChunks).toHaveLength(1);
    expect(parsed.toolResults?.[0].status).toBe('success');
  });

  it('validates single ValidationIssue schema', () => {
    const issue = validationIssueSchema.parse({
      code: 'MALFORMED_OUTPUT',
      message: 'JSON response contains unclosed brackets',
      severity: 'error',
    });
    expect(issue.code).toBe('MALFORMED_OUTPUT');
    expect(issue.severity).toBe('error');
  });
});
