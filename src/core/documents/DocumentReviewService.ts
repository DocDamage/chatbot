import { createHash, randomUUID } from 'node:crypto';

export interface DocumentReviewFinding {
  id: string;
  severity: 'info' | 'warning';
  line?: number;
  message: string;
  suggestion: string;
}

export interface DocumentReview {
  token: string;
  title: string;
  contentHash: string;
  findings: DocumentReviewFinding[];
  reviewedAt: string;
}

export class DocumentReviewService {
  private readonly reviews = new Map<string, DocumentReview>();

  review(title: string, content: string): DocumentReview {
    const normalizedTitle = title.trim() || 'Untitled document';
    const normalizedContent = content.trim();
    if (!normalizedContent) throw new Error('content is required');
    const findings = this.findings(normalizedContent);
    const review: DocumentReview = {
      token: randomUUID(),
      title: normalizedTitle,
      contentHash: this.hash(normalizedContent),
      findings,
      reviewedAt: new Date().toISOString()
    };
    this.reviews.set(review.token, review);
    return review;
  }

  verify(token: string, title: string, content: string): DocumentReview {
    const review = this.reviews.get(token);
    if (!review) throw new Error('review token is missing or expired');
    if (review.title !== (title.trim() || 'Untitled document') || review.contentHash !== this.hash(content.trim())) {
      throw new Error('document changed after review; review it again before saving');
    }
    return review;
  }

  consume(token: string): void {
    this.reviews.delete(token);
  }

  transform(action: string, content: string): { action: string; content: string } {
    const normalized = content.trim();
    if (!normalized) throw new Error('content is required');
    switch (action) {
      case 'concise':
        return { action, content: normalized.replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1') };
      case 'bullet-list':
        return { action, content: normalized.split(/\r?\n+/).map(line => line.trim()).filter(Boolean).map(line => line.startsWith('- ') ? line : `- ${line}`).join('\n') };
      case 'professional':
        return { action, content: normalized.replace(/\b(can't|won't|don't)\b/gi, match => ({ "can't": 'cannot', "won't": 'will not', "don't": 'do not' }[match.toLowerCase()] || match)) };
      default:
        throw new Error(`unsupported transform: ${action}`);
    }
  }

  private findings(content: string): DocumentReviewFinding[] {
    const findings: DocumentReviewFinding[] = [];
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.length > 180) findings.push({ id: `long-${index + 1}`, severity: 'warning', line: index + 1, message: 'This line is difficult to scan.', suggestion: 'Split it into shorter sentences or bullets.' });
      if (/\b(TODO|TBD|FIXME)\b/i.test(line)) findings.push({ id: `todo-${index + 1}`, severity: 'warning', line: index + 1, message: 'This draft contains an unresolved placeholder.', suggestion: 'Resolve it or mark it explicitly as follow-up work.' });
    });
    if (!/^#\s+\S+/m.test(content)) findings.push({ id: 'title', severity: 'info', message: 'The document has no Markdown title heading.', suggestion: 'Add a single # heading so it is easy to identify in the knowledge base.' });
    if (/\n{3,}/.test(content)) findings.push({ id: 'spacing', severity: 'info', message: 'The document contains large blank-space gaps.', suggestion: 'Use one blank line between sections.' });
    if (findings.length === 0) findings.push({ id: 'clean', severity: 'info', message: 'No obvious structural issues were detected.', suggestion: 'Confirm the sources, category, and wording before saving.' });
    return findings;
  }

  private hash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}
