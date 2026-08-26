import * as core from './index';
import * as capabilities from './capabilities';

describe('public core capability exports', () => {
  it('exposes the expanded capability families through the chatbot core entrypoint', () => {
    const requiredCoreExports = [
      'CapabilityRegistry',
      'CapabilityJobManager',
      'CapabilityEvaluationSuite',
      'CapabilityPromotionEngine',
      'ContextContentRouter',
      'RepositoryIntelligenceService',
      'ProjectMemoryStore',
      'WritingStudioService',
      'StudyStudioService',
      'WebStudioService',
      'DeveloperUtilityPackService'
    ];
    for (const exportName of requiredCoreExports) {
      expect(core).toHaveProperty(exportName);
    }

    const requiredCapabilityExports = [
      'CapabilityHealthDiagnostics',
      'CapabilityPermissionEngine',
      'CapabilityApprovalService',
      'CapabilityArtifactStore',
      'CapabilityMaintenanceScanner',
      'CrossCapabilityScenarioCertification',
      'ReleaseTrainManifestBuilder',
      'ControlledRolloutManager'
    ];
    for (const exportName of requiredCapabilityExports) {
      expect(capabilities).toHaveProperty(exportName);
    }
  });
});
