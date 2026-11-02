/**
 * Phase PX-16: Web Studio Integrated Orchestrator Service
 * PX16-T10
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  WebsiteProjectSchema,
  WebsiteBlockData,
  BlockType,
  InspectorSelection,
  VisualEditProposal,
  WebAuditReport,
  DesignTokens,
  ExportConfig
} from './WebsiteTypes';
import { WebsiteProjectModel, LegacyV1WebsiteProject } from './WebsiteProjectModel';
import { BlockEditorEngine } from './BlockEditorEngine';
import { ResponsivePreviewRenderer, RenderOptions } from './ResponsivePreviewRenderer';
import { WebsiteAssetManager, RegisterAssetInput } from './WebsiteAssetManager';
import { ElementInspectorService } from './ElementInspectorService';
import { SourceLinkInspectionService, DevServerConfig } from './SourceLinkInspectionService';
import { VisualEditProposalService } from './VisualEditProposalService';
import { WebsiteSandboxUndoManager } from './WebsiteSandboxUndoManager';
import { WebsiteImportExportService, ExportBundleResult, ValidationReport } from './WebsiteImportExportService';
import { WebAccessibilityAuditor } from './WebAccessibilityAuditor';

export class WebStudioService {
  private projectModel: WebsiteProjectModel;
  private editorEngine: BlockEditorEngine;
  private renderer = new ResponsivePreviewRenderer();
  private assetManager: WebsiteAssetManager;
  private inspector = new ElementInspectorService();
  private sourceLinker = new SourceLinkInspectionService();
  private proposalService = new VisualEditProposalService();
  private sandboxUndo: WebsiteSandboxUndoManager;
  private importExport = new WebsiteImportExportService();
  private a11yAuditor = new WebAccessibilityAuditor();
  private storagePath: string;

  constructor(workspaceRoot = process.cwd(), initialData?: Partial<WebsiteProjectSchema> | LegacyV1WebsiteProject) {
    const dataDir = path.join(workspaceRoot, 'data', 'website-workspace');
    fs.mkdirSync(dataDir, { recursive: true });
    this.storagePath = path.join(dataDir, 'project.json');

    if (!initialData && fs.existsSync(this.storagePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
        this.projectModel = new WebsiteProjectModel(raw);
      } catch {
        this.projectModel = new WebsiteProjectModel();
      }
    } else {
      this.projectModel = new WebsiteProjectModel(initialData);
    }

    this.editorEngine = new BlockEditorEngine(this.projectModel);
    this.assetManager = new WebsiteAssetManager(this.projectModel.getProject().assets);
    this.sandboxUndo = new WebsiteSandboxUndoManager(workspaceRoot);
  }

  public getProject(): WebsiteProjectSchema {
    return this.projectModel.getProject();
  }

  public saveProject(): { project: WebsiteProjectSchema; html: string } {
    const project = this.projectModel.getProject();
    fs.writeFileSync(this.storagePath, JSON.stringify(project, null, 2), 'utf8');
    const html = this.renderer.renderPageHtml(project, { slug: project.pages[0]?.slug });
    return { project, html };
  }

  public renderPreview(options: RenderOptions = {}): string {
    return this.renderer.renderPageHtml(this.projectModel.getProject(), options);
  }

  // Block Editing
  public addBlock(pageId: string, type: BlockType, targetIndex?: number): WebsiteBlockData {
    const block = this.editorEngine.addBlock(pageId, type, targetIndex);
    this.saveProject();
    return block;
  }

  public updateBlock(pageId: string, blockId: string, updates: Partial<WebsiteBlockData>): WebsiteBlockData {
    const block = this.editorEngine.updateBlock(pageId, blockId, updates);
    this.saveProject();
    return block;
  }

  public deleteBlock(pageId: string, blockId: string): boolean {
    const res = this.editorEngine.deleteBlock(pageId, blockId);
    if (res) this.saveProject();
    return res;
  }

  public duplicateBlock(pageId: string, blockId: string): WebsiteBlockData {
    const block = this.editorEngine.duplicateBlock(pageId, blockId);
    this.saveProject();
    return block;
  }

  public reorderBlock(pageId: string, blockId: string, newIndex: number): boolean {
    const res = this.editorEngine.reorderBlock(pageId, blockId, newIndex);
    if (res) this.saveProject();
    return res;
  }

  public undo(): WebsiteProjectSchema | null {
    const res = this.editorEngine.undo();
    if (res) {
      this.projectModel = this.editorEngine.getProjectModel();
      this.saveProject();
    }
    return res;
  }

  public redo(): WebsiteProjectSchema | null {
    const res = this.editorEngine.redo();
    if (res) {
      this.projectModel = this.editorEngine.getProjectModel();
      this.saveProject();
    }
    return res;
  }

  // Asset Management
  public registerAsset(input: RegisterAssetInput) {
    const asset = this.assetManager.registerAsset(input);
    const proj = this.projectModel.getProject();
    proj.assets.push(asset);
    this.saveProject();
    return asset;
  }

  public listAssets() {
    return this.assetManager.listAssets();
  }

  public detectUnusedAssets() {
    return this.assetManager.detectUnusedAssets(this.projectModel.getProject());
  }

  // Inspector & Source Link
  public inspectElement(pageId: string, blockId: string): InspectorSelection | null {
    return this.inspector.inspectBlock(this.projectModel.getProject(), pageId, blockId);
  }

  public configureDevServer(config: DevServerConfig): void {
    this.sourceLinker.configureDevServer(config);
  }

  public locateSource(elementSelector: { dataLoc?: string; componentName?: string; blockType?: string }) {
    return this.sourceLinker.locateSourceElement(elementSelector);
  }

  // Visual Edit Proposals
  public createEditProposal(input: {
    targetBlockId: string;
    targetElementId?: string;
    instruction: string;
    targetFiles: string[];
    diff: string;
    summary: string;
    blockMutation?: Partial<WebsiteBlockData>;
  }): VisualEditProposal {
    return this.proposalService.createProposal({
      projectId: this.projectModel.getId(),
      ...input
    });
  }

  public approveEditProposal(proposalId: string, digest: string): VisualEditProposal {
    return this.proposalService.approveProposal(proposalId, digest);
  }

  public applyEditProposal(proposalId: string): { proposal: VisualEditProposal; txId: string } {
    const proposal = this.proposalService.applyProposal(proposalId);

    // If block mutation is specified, apply to project model safely
    if (proposal.proposedPatch.blockMutation) {
      for (const page of this.projectModel.getPages()) {
        const found = page.blocks.find(b => b.id === proposal.targetBlockId);
        if (found) {
          this.editorEngine.updateBlock(page.id, found.id, proposal.proposedPatch.blockMutation);
          break;
        }
      }
    }

    const txId = this.sandboxUndo.beginTransaction(proposalId);
    this.saveProject();
    return { proposal, txId };
  }

  public rollbackTransaction(txId: string): boolean {
    return this.sandboxUndo.rollbackTransaction(txId);
  }

  // Import / Export / Audit
  public importHtml(html: string, name?: string): WebsiteProjectSchema {
    const imported = this.importExport.importFromHtml(html, name);
    this.projectModel = new WebsiteProjectModel(imported);
    this.editorEngine = new BlockEditorEngine(this.projectModel);
    this.saveProject();
    return this.projectModel.getProject();
  }

  public exportBundle(): ExportBundleResult {
    return this.importExport.exportMultiPageBundle(this.projectModel.getProject());
  }

  public validateLinksAndAssets(): ValidationReport {
    return this.importExport.validateProjectLinksAndAssets(this.projectModel.getProject());
  }

  public runAccessibilityAudit(): WebAuditReport {
    return this.a11yAuditor.auditProject(this.projectModel.getProject());
  }

  public getTemplates() {
    return this.editorEngine.getBlockTemplates();
  }
}
