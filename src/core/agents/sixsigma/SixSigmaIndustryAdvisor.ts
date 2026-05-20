export class SixSigmaIndustryAdvisor {
  advise(input: string) {
    const text = input.toLowerCase();
    const industry = text.includes('game') || text.includes('software') ? 'it_software' : text.includes('health') ? 'healthcare' : text.includes('finance') ? 'finance' : 'manufacturing';
    return {
      answerType: 'industry_playbook',
      industry,
      metrics: industry === 'it_software' ? ['defect escape rate', 'MTTR', 'deployment frequency', 'reopen rate'] : ['DPMO', 'Cpk', 'cycle time', 'first-pass yield'],
      dmaicExample: 'Use Define to charter the defect problem, Measure baseline defects, Analyze root causes, Improve prevention/detection, and Control with SPC or operational dashboards.',
      controlMetrics: industry === 'it_software' ? ['escaped bugs per release', 'mean time to repair', 'incident recurrence'] : ['process capability', 'scrap rate', 'customer complaints']
    };
  }
}
