import { GISPrivacy } from '../GISPrivacy';

describe('GISPrivacy', () => {
  it('redacts common exact address and coordinate patterns', () => {
    const redacted = GISPrivacy.redactText('Route 123 Main Street, 06516 to 41.270500,-72.947000');
    expect(redacted).toContain('[REDACTED_ADDRESS]');
    expect(redacted).toContain('[REDACTED_ZIP]');
    expect(redacted).toContain('[REDACTED_COORDINATE]');
  });

  it('creates stable request hashes', () => {
    expect(GISPrivacy.requestHash({ q: 'same' })).toBe(GISPrivacy.requestHash({ q: 'same' }));
    expect(GISPrivacy.requestHash({ q: 'same' })).not.toBe(GISPrivacy.requestHash({ q: 'different' }));
  });
});
