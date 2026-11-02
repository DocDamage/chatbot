import {
  DocumentationCategorySchema,
  RequiredDocumentationPathSchema
} from './documentation-spec';

describe('documentation-spec types (§47)', () => {
  it('validates documentation categories', () => {
    expect(DocumentationCategorySchema.safeParse('architecture').success).toBe(true);
    expect(DocumentationCategorySchema.safeParse('guides').success).toBe(true);
    expect(DocumentationCategorySchema.safeParse('implementation').success).toBe(true);
    expect(DocumentationCategorySchema.safeParse('runbooks').success).toBe(true);
    expect(DocumentationCategorySchema.safeParse('invalid').success).toBe(false);
  });

  it('validates all 12 required documentation deliverables paths', () => {
    const requiredDocs = [
      'docs/architecture/CHAT_RUNTIME.md',
      'docs/architecture/KNOWLEDGE_PLATFORM.md',
      'docs/guides/KNOWLEDGE_PACKS.md',
      'docs/guides/CHAT_DIAGNOSTICS.md',
      'docs/guides/MODEL_POLICIES.md',
      'docs/implementation/RETRIEVAL_POLICY.md',
      'docs/implementation/DATASET_LICENSE_POLICY.md',
      'docs/implementation/EVALUATION_POLICY.md',
      'docs/implementation/DATASET_REFRESH_POLICY.md',
      'docs/runbooks/KNOWLEDGE_UPDATE_FAILURE.md',
      'docs/runbooks/RAG_DEGRADED.md',
      'docs/runbooks/MODEL_ROUTING_FAILURE.md'
    ];

    expect(requiredDocs.length).toBe(12);
    for (const doc of requiredDocs) {
      expect(RequiredDocumentationPathSchema.safeParse(doc).success).toBe(true);
    }
    expect(RequiredDocumentationPathSchema.safeParse('docs/invalid.md').success).toBe(false);
  });
});
