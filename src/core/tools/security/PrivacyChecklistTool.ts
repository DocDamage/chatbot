export class PrivacyChecklistTool {
  run(input: Record<string, any> = {}) {
    const feature = String(input.feature || input.query || 'feature');
    return {
      domain: 'security',
      tool: 'PrivacyChecklistTool',
      feature,
      checklist: [
        'Data minimization: collect only what the feature needs.',
        'Purpose limitation: state why each data field exists.',
        'Retention: define deletion/expiration for raw and derived data.',
        'Access: separate public, user, admin, and service visibility.',
        'Consent/notice: tell users when sensitive data is stored or reused.',
        'Export/delete: support user data access and deletion where applicable.',
        'Third parties: document vendors, regions, and data categories shared.'
      ],
      sensitiveDataFlags: [
        'health',
        'financial',
        'precise location',
        'biometric',
        'children',
        'credentials',
        'private communications'
      ]
    };
  }
}
