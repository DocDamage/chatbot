import { StructuredEditEngine } from './editing/StructuredEditEngine';
import { ReviewPipeline, ReviewReport } from './review/ReviewPipeline';
import { VerificationOrchestrator, VerificationSummary } from './verification/VerificationOrchestrator';
import { RepairCallbacks, RepairRun } from './verification/RepairController';
import { CodingRequestRouter } from './CodingRequestRouter';
import { EditOperation, EngineeringTask, StructuredPatch } from './types';
import { ContextEvidence } from './types';
import { RepositoryIntelligence } from './repository/RepositoryIntelligence';
import { SymbolIndex } from './index/SymbolIndex';
import { StructuralRetriever, RetrievalRequest } from './retrieval/StructuralRetriever';

export interface CodingControllerResult { task: EngineeringTask; patch: StructuredPatch; review: ReviewReport; verification: VerificationSummary; stages: string[]; }

export class CodingController {
  private readonly router = new CodingRequestRouter();
  private readonly editor: StructuredEditEngine;
  private readonly reviewer = new ReviewPipeline();
  private readonly verifier: VerificationOrchestrator;
  constructor(private readonly workspaceRoot: string, private readonly maxIterations = 3) { this.editor = new StructuredEditEngine(workspaceRoot); this.verifier = new VerificationOrchestrator(workspaceRoot, maxIterations); }

  async inspectAndReport(message: string, options: { mode?: string; operations?: EditOperation[]; runVerification?: boolean } = {}): Promise<CodingControllerResult> {
    const task = this.router.route(message, options.mode);
    const patch = this.editor.createPatch(options.operations || []);
    const review = this.reviewer.review({ diff: patch.diff, task: message });
    const verification = await this.verifier.verify({ run: options.runVerification === true });
    return { task, patch, review, verification, stages: ['inspect', 'plan', 'edit', 'review', 'verify', 'report'] };
  }

  async repair(callbacks: Omit<RepairCallbacks, 'verify'>, maxIterations = this.maxIterations): Promise<RepairRun> {
    return this.verifier.verifyWithRepair(callbacks, { maxIterations });
  }

  async retrieveEvidence(request: RetrievalRequest): Promise<ContextEvidence[]> {
    const snapshot = new RepositoryIntelligence(this.workspaceRoot).snapshot();
    const index = new SymbolIndex(this.workspaceRoot);
    index.indexFiles(snapshot.files.filter(file => !file.binary).map(file => file.path));
    return new StructuralRetriever(this.workspaceRoot, snapshot, index).retrieve(request);
  }
}
