export class SixSigmaProjectCoach {
  createProject(input: string) {
    return {
      answerType: 'project_coaching',
      phase: 'Define',
      response: [
        'Draft project charter:',
        `Problem statement: ${this.problemStatement(input)}`,
        'Business case: Reduce defects, rework, cycle time, and customer dissatisfaction.',
        'Goal statement: Define a measurable defect or cycle-time reduction target after baseline data is collected.',
        'Scope: Start with one process, customer segment, or product family.',
        'CTQ: Translate Voice of Customer into measurable complaint rate, delivery timeliness, defect rate, or response-time metrics.',
        'SIPOC: Suppliers, Inputs, Process, Outputs, Customers should be mapped before detailed Measure work.',
        'Measure data needed: defect definitions, baseline volume, opportunities, timestamps, stratification factors, and measurement-system checks.',
        'Next action: collect current defect/cycle-time data and confirm sponsor/champion ownership.'
      ].join('\n')
    };
  }

  private problemStatement(input: string) {
    if (/complaints/i.test(input)) return 'Customer complaints are occurring at an unacceptable rate, but the baseline rate and CTQ impact still need confirmation.';
    if (/late deliver/i.test(input)) return 'Late deliveries are missing customer requirements and need baseline frequency, cycle-time, and root-cause stratification.';
    return 'The process outcome is not meeting customer or business requirements; quantify the baseline before Measure.';
  }
}
