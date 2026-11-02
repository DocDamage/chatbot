/**
 * Phase PX-17: Developer Utility Pack Orchestrator Service
 * PX17-T08
 */

import { MockApiEngine, QueryOptions, PaginatedResult } from './MockApiEngine';
import { MockChaosSimulator } from './MockChaosSimulator';
import { OpenApiSchemaImporter } from './OpenApiSchemaImporter';
import { SourcePreservingSkillExporter, ExportSkillInput } from './SourcePreservingSkillExporter';
import { CapabilityPackScaffolder, GeneratedPackSkeleton } from './CapabilityPackScaffolder';
import { ProjectDoctorService } from './ProjectDoctorService';
import {
  CollectionSchema,
  ChaosSimulationConfig,
  ScenarioPreset,
  OpenApiImportResult,
  SkillExportBundle,
  PackScaffoldOptions,
  ProjectDoctorReport
} from './DeveloperTypes';

export class DeveloperUtilityPackService {
  private mockApi: MockApiEngine;
  private chaos: MockChaosSimulator;
  private openApiImporter: OpenApiSchemaImporter;
  private skillExporter: SourcePreservingSkillExporter;
  private scaffolder: CapabilityPackScaffolder;
  private doctor: ProjectDoctorService;

  constructor(workspaceRoot = process.cwd(), options?: { projectId?: string; initialSeed?: number }) {
    this.mockApi = new MockApiEngine({ workspaceRoot, projectId: options?.projectId, initialSeed: options?.initialSeed });
    this.chaos = new MockChaosSimulator();
    this.openApiImporter = new OpenApiSchemaImporter();
    this.skillExporter = new SourcePreservingSkillExporter();
    this.scaffolder = new CapabilityPackScaffolder();
    this.doctor = new ProjectDoctorService(workspaceRoot);
  }

  // Mock API operations
  public getCollections(): CollectionSchema[] {
    return this.mockApi.getCollections();
  }

  public createCollection(schema: CollectionSchema) {
    return this.mockApi.createCollection(schema);
  }

  public importMockData(input: { name: string; format: 'json' | 'csv'; content: string }) {
    return this.mockApi.importFromText(input);
  }

  public listRecords(collectionName: string, query?: QueryOptions) {
    return this.mockApi.listRecords(collectionName, query);
  }

  public getRecordById(collectionName: string, id: any, includeRelations = false) {
    return this.mockApi.getRecordById(collectionName, id, includeRelations);
  }

  public insertRecord(collectionName: string, data: Record<string, any>) {
    return this.mockApi.insertRecord(collectionName, data);
  }

  public updateRecord(collectionName: string, id: any, patch: Record<string, any>) {
    return this.mockApi.updateRecord(collectionName, id, patch);
  }

  public deleteRecord(collectionName: string, id: any) {
    return this.mockApi.deleteRecord(collectionName, id);
  }

  public resetMockData(seed?: number) {
    this.mockApi.resetToSeed(seed);
  }

  // Chaos & Fault Injection
  public getChaosConfig(): ChaosSimulationConfig {
    return this.chaos.getConfig();
  }

  public setChaosConfig(config: Partial<ChaosSimulationConfig>) {
    this.chaos.setConfig(config);
  }

  public applyChaosPreset(preset: ScenarioPreset) {
    this.chaos.applyPreset(preset);
  }

  public evaluateRequest(method: string, path: string, seed?: number) {
    return this.chaos.evaluateRequest(method, path, seed);
  }

  public getChaosAuditHistory() {
    return this.chaos.getAuditHistory();
  }

  // OpenAPI Importer
  public importOpenApiSpec(rawSpec: string | object): OpenApiImportResult {
    const result = this.openApiImporter.parseOpenApiSpec(rawSpec);
    // Optionally create collections automatically
    for (const col of result.collections) {
      if (!this.mockApi.getCollection(col.name)) {
        this.mockApi.createCollection(col);
      }
    }
    return result;
  }

  // Skill Exporter
  public exportSkillBundle(input: ExportSkillInput): SkillExportBundle {
    return this.skillExporter.generateSkillBundle(input);
  }

  // Pack Scaffolder
  public scaffoldCapabilityPack(options: PackScaffoldOptions): GeneratedPackSkeleton {
    return this.scaffolder.scaffoldPack(options);
  }

  // Project Doctor
  public runProjectDoctor(): ProjectDoctorReport {
    return this.doctor.runDiagnostics();
  }
}
