import { CodingKnowledgeAuthority } from './CodingKnowledgeAuthority';

describe('CodingKnowledgeAuthority', () => {
  it('keeps learned snippets unverified until promotion evidence exists', () => {
    const authority = new CodingKnowledgeAuthority();
    authority.add({ id: 'learned-1', title: 'fix', content: 'use a bounded retry', authority: 'learned', tags: ['retry'], verificationStatus: 'unverified', provenance: ['interaction'] });
    expect(() => authority.promote('learned-1', {})).toThrow(/cannot be promoted/);
    expect(authority.promote('learned-1', { userApproved: true }).verificationStatus).toBe('promoted');
  });
});
