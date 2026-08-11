import { CodingAuthorization } from './CodingAuthorization';

describe('CodingAuthorization', () => {
  it('keeps plan read-only and requires approval for repair/application', () => {
    const authorization = new CodingAuthorization();
    expect(authorization.authorize({ mode: 'plan', action: 'apply_patch' }).approved).toBe(false);
    expect(authorization.authorize({ mode: 'debug', action: 'repair' }).approved).toBe(false);
    expect(authorization.authorize({ mode: 'debug', action: 'repair', explicitApproval: true }).approved).toBe(true);
    expect(authorization.authorize({ mode: 'implement', action: 'apply_patch', explicitApproval: true }).approved).toBe(true);
  });
});
