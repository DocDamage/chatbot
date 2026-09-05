import {
  RollbackDomainSchema,
  PreservationInvariantsSchema,
} from './rollback-recovery';

describe('Rollback and Recovery Types', () => {
  it('validates rollback domains', () => {
    expect(RollbackDomainSchema.safeParse('runtime').success).toBe(true);
    expect(RollbackDomainSchema.safeParse('dataset').success).toBe(true);
    expect(RollbackDomainSchema.safeParse('retrieval_policy').success).toBe(true);
    expect(RollbackDomainSchema.safeParse('model_policy').success).toBe(true);
    expect(RollbackDomainSchema.safeParse('all').success).toBe(true);
    expect(RollbackDomainSchema.safeParse('database_drop').success).toBe(false);
  });

  it('validates 6 mandatory preservation invariants', () => {
    const validInvariants = {
      conversationDataPreserved: true,
      ragDataPreserved: true,
      datasetMetadataPreserved: true,
      botProfilesPreserved: true,
      feedbackPreserved: true,
      activeKnowledgeVersionPreserved: true,
    };
    expect(PreservationInvariantsSchema.safeParse(validInvariants).success).toBe(true);
  });
});
