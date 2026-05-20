import { randomUUID } from 'crypto';
import { Database } from '../database/Database';

export interface EvidenceReport {
  id: string;
  request: string;
  answer: string;
  sources: string[];
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  score: number;
  createdAt: string;
}

export interface GoldenTask {
  id: string;
  query: string;
  mustContain: string[];
  mustNotContain?: string[];
}

export class GovernanceEvidenceService {
  constructor(private readonly database?: Database) {}

  async createReport(input: {
    request: string;
    answer: string;
    sources?: string[];
    checks?: Array<{ name: string; passed: boolean; detail: string }>;
  }): Promise<EvidenceReport> {
    const checks = input.checks || this.defaultChecks(input.answer, input.sources || []);
    const report: EvidenceReport = {
      id: randomUUID(),
      request: input.request,
      answer: input.answer,
      sources: input.sources || [],
      checks,
      score: checks.length === 0 ? 1 : checks.filter(check => check.passed).length / checks.length,
      createdAt: new Date().toISOString()
    };

    if (this.database) {
      const params = [report.id, report.request, report.answer, JSON.stringify(report.sources), JSON.stringify(report.checks), report.score];
      if (this.database.getType() === 'postgresql') {
        await this.database.query(
          `INSERT INTO governance_evidence_reports (id, request, answer, sources, checks, score)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          params
        );
      } else {
        await this.database.query(
          `INSERT INTO governance_evidence_reports (id, request, answer, sources, checks, score)
           VALUES (?, ?, ?, ?, ?, ?)`,
          params
        );
      }
    }

    return report;
  }

  runGoldenTask(task: GoldenTask, answer: string): EvidenceReport {
    const lower = answer.toLowerCase();
    const checks = [
      ...task.mustContain.map(term => ({
        name: `must_contain:${term}`,
        passed: lower.includes(term.toLowerCase()),
        detail: term
      })),
      ...(task.mustNotContain || []).map(term => ({
        name: `must_not_contain:${term}`,
        passed: !lower.includes(term.toLowerCase()),
        detail: term
      }))
    ];

    return {
      id: randomUUID(),
      request: task.query,
      answer,
      sources: [],
      checks,
      score: checks.length === 0 ? 1 : checks.filter(check => check.passed).length / checks.length,
      createdAt: new Date().toISOString()
    };
  }

  async listReports(limit: number = 20): Promise<EvidenceReport[]> {
    if (!this.database) return [];
    const result = await this.database.query(
      `SELECT * FROM governance_evidence_reports ORDER BY created_at DESC LIMIT ${this.database.getType() === 'postgresql' ? '$1' : '?'}`,
      [limit]
    );
    return result.rows.map(row => ({
      id: row.id,
      request: row.request,
      answer: row.answer,
      sources: typeof row.sources === 'string' ? JSON.parse(row.sources || '[]') : row.sources || [],
      checks: typeof row.checks === 'string' ? JSON.parse(row.checks || '[]') : row.checks || [],
      score: Number(row.score || 0),
      createdAt: row.created_at
    }));
  }

  async runGoldenTasks(tasks: GoldenTask[], answers: Record<string, string>): Promise<{
    total: number;
    passed: number;
    reports: EvidenceReport[];
  }> {
    const reports = tasks.map(task => this.runGoldenTask(task, answers[task.id] || ''));
    for (const report of reports) {
      if (this.database) {
        await this.createReport({
          request: report.request,
          answer: report.answer,
          sources: report.sources,
          checks: report.checks
        });
      }
    }
    return {
      total: reports.length,
      passed: reports.filter(report => report.score === 1).length,
      reports
    };
  }

  private defaultChecks(answer: string, sources: string[]): EvidenceReport['checks'] {
    return [
      { name: 'non_empty_answer', passed: answer.trim().length > 0, detail: 'Answer must not be empty' },
      { name: 'source_trace_available', passed: sources.length > 0, detail: 'At least one source should be attached for grounded answers' }
    ];
  }
}
