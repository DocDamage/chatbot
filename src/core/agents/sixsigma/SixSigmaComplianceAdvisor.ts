export class SixSigmaComplianceAdvisor {
  advise(input: string) {
    const regulation = this.detectRegulation(input);
    return {
      answerType: 'compliance',
      regulation,
      jurisdiction: regulation === 'Prop 65' ? 'California, United States' : regulation.startsWith('EU') || ['REACH', 'RoHS'].includes(regulation) ? 'European Union' : 'Jurisdiction depends on product and market',
      appliesTo: 'Products, materials, suppliers, labels, and evidence packages in scope for the named regulation.',
      requirements: ['Identify regulated substances', 'Collect supplier declarations', 'Retain test/certification evidence', 'Maintain change-control records'],
      documentationNeeded: ['BOM/material declaration', 'supplier compliance certificate', 'test reports', 'SDS/label files', 'audit checklist'],
      testingCertificationNeeded: 'Risk-based testing may be needed for high-risk materials or incomplete supplier evidence.',
      supplierEvidence: ['signed declaration', 'full material disclosure', 'current test report', 'change notification commitment'],
      riskLevel: 'Medium until product composition, market, and supplier evidence are verified.',
      nextAction: 'Build a compliance matrix by material, supplier, jurisdiction, evidence owner, and last-updated date.',
      disclaimer: 'Compliance guidance, not legal advice.',
      lastUpdated: new Date().toISOString().slice(0, 10)
    };
  }

  private detectRegulation(input: string) {
    const text = input.toLowerCase();
    if (text.includes('rohs')) return 'RoHS';
    if (text.includes('prop 65')) return 'Prop 65';
    if (text.includes('tsca')) return 'TSCA';
    if (text.includes('sds')) return 'SDS/labeling';
    return 'REACH';
  }
}
