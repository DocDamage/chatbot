export interface CodeReviewFinding {
  severity: 'low' | 'medium' | 'high' | 'critical';
  file?: string;
  issue: string;
  suggestedFix: string;
}

export interface CodeReviewResult {
  findings: CodeReviewFinding[];
  summary: string;
}

export class CodeReviewer {
  private readonly pipeline = new ReviewPipeline();

  review(diff: string, focus: string[] = []): CodeReviewResult {
    const report = this.pipeline.review({ diff, focus });
    const findings: CodeReviewFinding[] = report.findings.map(finding => ({
      severity: finding.severity,
      file: finding.file,
      issue: `${finding.issue} Consequence: ${finding.consequence}`,
      suggestedFix: finding.correction
    }));

    return {
      findings,
      summary: report.summary
    };
  }
}
import { ReviewPipeline } from '../coding/review/ReviewPipeline';
