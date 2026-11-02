/**
 * Section 47: Documentation Deliverables Compliance Auditor
 * Programmatically audits the presence and structure of all 12 required deliverables.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  DocumentationAuditResult,
  DocumentationDeliverablesReport,
  DocumentationRequirement,
  RequiredDocumentationPath
} from '../../types/documentation-spec';

export const REQUIRED_DOCUMENTATION_SPECS: DocumentationRequirement[] = [
  {
    path: 'docs/architecture/CHAT_RUNTIME.md',
    category: 'architecture',
    title: 'Canonical Chat Runtime Architecture',
    minWordCount: 50,
    requiredHeadings: ['Overview', 'Core Request Pipeline', 'Key Components']
  },
  {
    path: 'docs/architecture/KNOWLEDGE_PLATFORM.md',
    category: 'architecture',
    title: 'Knowledge Platform Architecture',
    minWordCount: 50,
    requiredHeadings: ['Overview', 'Platform Topology', 'Canonical Knowledge Packs']
  },
  {
    path: 'docs/guides/KNOWLEDGE_PACKS.md',
    category: 'guides',
    title: 'Knowledge Packs Guide',
    minWordCount: 50,
    requiredHeadings: ['Introduction', 'Installing a Knowledge Pack', 'Updating Knowledge Packs']
  },
  {
    path: 'docs/guides/CHAT_DIAGNOSTICS.md',
    category: 'guides',
    title: 'Chat Diagnostics Guide',
    minWordCount: 50,
    requiredHeadings: ['Overview', 'Normalized Failure Taxonomy', 'Privacy & Sanitization']
  },
  {
    path: 'docs/guides/MODEL_POLICIES.md',
    category: 'guides',
    title: 'Model Policies & Provider Routing Guide',
    minWordCount: 50,
    requiredHeadings: ['Overview', 'Model Capability Tiers', 'Provider Fallback & Circuit Breakers']
  },
  {
    path: 'docs/implementation/RETRIEVAL_POLICY.md',
    category: 'implementation',
    title: 'Knowledge Retrieval Policy Implementation',
    minWordCount: 50,
    requiredHeadings: ['Overview', '5-Factor Retrieval Scoring Formula', 'Explicit No-Retrieval Path']
  },
  {
    path: 'docs/implementation/DATASET_LICENSE_POLICY.md',
    category: 'implementation',
    title: 'Dataset License Policy Implementation',
    minWordCount: 50,
    requiredHeadings: ['Overview', 'Permitted Open Licenses', 'Forbidden Licenses & Content']
  },
  {
    path: 'docs/implementation/EVALUATION_POLICY.md',
    category: 'implementation',
    title: 'Evaluation Policy Implementation',
    minWordCount: 50,
    requiredHeadings: ['Overview', 'Evaluation Tiers', 'Release Threshold Invariants']
  },
  {
    path: 'docs/implementation/DATASET_REFRESH_POLICY.md',
    category: 'implementation',
    title: 'Dataset Refresh Policy Implementation',
    minWordCount: 50,
    requiredHeadings: ['Overview', 'Refresh Schedules by Pack Type', 'Incremental Update Pipeline']
  },
  {
    path: 'docs/runbooks/KNOWLEDGE_UPDATE_FAILURE.md',
    category: 'runbooks',
    title: 'Runbook: Knowledge Update Failure Triage & Recovery',
    minWordCount: 50,
    requiredHeadings: ['Severity & Impact', 'Detection & Alerts', 'Immediate Triage Steps', 'Recovery Procedures']
  },
  {
    path: 'docs/runbooks/RAG_DEGRADED.md',
    category: 'runbooks',
    title: 'Runbook: RAG Retrieval Degraded Triage & Remediation',
    minWordCount: 50,
    requiredHeadings: ['Severity & Impact', 'Detection & Symptoms', 'Remediation Steps']
  },
  {
    path: 'docs/runbooks/MODEL_ROUTING_FAILURE.md',
    category: 'runbooks',
    title: 'Runbook: Model Routing Failure & Provider Outage Triage',
    minWordCount: 50,
    requiredHeadings: ['Severity & Impact', 'Detection & Alerts', 'Remediation Steps']
  }
];

export class DocumentationDeliverablesAuditor {
  private baseDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
  }

  public auditSingle(req: DocumentationRequirement): DocumentationAuditResult {
    const fullPath = path.resolve(this.baseDir, req.path);

    if (!fs.existsSync(fullPath)) {
      return {
        path: req.path,
        exists: false,
        wordCount: 0,
        headingsFound: [],
        missingHeadings: req.requiredHeadings,
        compliant: false,
        error: `File not found at ${req.path}`
      };
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const words = content.trim().split(/\s+/).filter(Boolean);
      const headingsFound: string[] = [];

      for (const line of content.split('\n')) {
        const match = line.match(/^#+\s+(.+)$/);
        if (match) {
          headingsFound.push(match[1].trim());
        }
      }

      const missingHeadings = req.requiredHeadings.filter(
        (h) => !headingsFound.some((found) => found.toLowerCase().includes(h.toLowerCase()))
      );

      const compliant = words.length >= req.minWordCount && missingHeadings.length === 0;

      return {
        path: req.path,
        exists: true,
        wordCount: words.length,
        headingsFound,
        missingHeadings,
        compliant
      };
    } catch (err) {
      return {
        path: req.path,
        exists: true,
        wordCount: 0,
        headingsFound: [],
        missingHeadings: req.requiredHeadings,
        compliant: false,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  public auditAll(): DocumentationDeliverablesReport {
    const results = REQUIRED_DOCUMENTATION_SPECS.map((spec) => this.auditSingle(spec));
    const compliantCount = results.filter((r) => r.compliant).length;

    return {
      timestamp: new Date().toISOString(),
      totalRequired: REQUIRED_DOCUMENTATION_SPECS.length,
      compliantCount,
      results,
      allCompliant: compliantCount === REQUIRED_DOCUMENTATION_SPECS.length
    };
  }
}
