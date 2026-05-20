export class UnitEconomicsTool {
  run(input: Record<string, any> = {}) {
    const arpu = Number(input.arpu || input.price || 0);
    const grossMargin = Number(input.grossMargin ?? 0.8);
    const churn = Number(input.monthlyChurn || input.churn || 0);
    const cac = Number(input.cac || 0);
    const contributionMargin = arpu * grossMargin;
    const ltv = churn > 0 ? contributionMargin / churn : undefined;
    const paybackMonths = contributionMargin > 0 && cac > 0 ? cac / contributionMargin : undefined;

    return {
      domain: 'business',
      tool: 'UnitEconomicsTool',
      inputs: { arpu, grossMargin, monthlyChurn: churn, cac },
      metrics: {
        contributionMargin,
        ltv,
        paybackMonths,
        ltvToCac: ltv && cac > 0 ? ltv / cac : undefined
      },
      interpretation: [
        'Contribution margin must cover acquisition, support, and product reinvestment.',
        'Payback under 12 months is often healthier for early SaaS, but context matters.',
        'LTV is fragile when churn is estimated; use cohorts when possible.'
      ],
      missingData: [
        !arpu ? 'ARPU/price' : undefined,
        !churn ? 'monthly churn' : undefined,
        !cac ? 'CAC' : undefined
      ].filter(Boolean)
    };
  }
}
