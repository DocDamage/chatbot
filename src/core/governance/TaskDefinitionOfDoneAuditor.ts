import {
  TaskDoDChecklist,
  TaskDoDAuditResult,
} from '../../types/program-completion';

export class TaskDefinitionOfDoneAuditor {
  public auditTask(taskId: string, checklist: TaskDoDChecklist): TaskDoDAuditResult {
    const failedGates: string[] = [];

    // Implementation gates
    if (!checklist.completeBehavior) failedGates.push('implementation.completeBehavior');
    if (!checklist.noPlaceholderProductionPath) failedGates.push('implementation.noPlaceholderProductionPath');
    if (!checklist.noDuplicateCompetingBehavior) failedGates.push('implementation.noDuplicateCompetingBehavior');
    if (!checklist.sourceSizeRuleSatisfied) failedGates.push('implementation.sourceSizeRuleSatisfied');
    if (!checklist.configurationTyped) failedGates.push('implementation.configurationTyped');
    if (!checklist.databaseChangeHasMigration) failedGates.push('implementation.databaseChangeHasMigration');

    // Tests gates
    if (!checklist.focusedUnitTests) failedGates.push('tests.focusedUnitTests');
    if (!checklist.integrationTests) failedGates.push('tests.integrationTests');
    if (!checklist.securityTests) failedGates.push('tests.securityTests');
    if (!checklist.browserTests) failedGates.push('tests.browserTests');
    if (!checklist.evalCases) failedGates.push('tests.evalCases');
    if (!checklist.failureNegativeCases) failedGates.push('tests.failureNegativeCases');

    // Verification gates
    if (!checklist.typeCheckPass) failedGates.push('verification.typeCheckPass');
    if (!checklist.lintPass) failedGates.push('verification.lintPass');
    if (!checklist.affectedSuitesPass) failedGates.push('verification.affectedSuitesPass');
    if (!checklist.buildPass) failedGates.push('verification.buildPass');
    if (!checklist.runtimeQaPass) failedGates.push('verification.runtimeQaPass');
    if (!checklist.sqlitePostgresVerified) failedGates.push('verification.sqlitePostgresVerified');

    // Evidence gates
    if (!checklist.exactCommitShaRecorded) failedGates.push('evidence.exactCommitShaRecorded');
    if (!checklist.commandsExitCodesRecorded) failedGates.push('evidence.commandsExitCodesRecorded');
    if (!checklist.changedFilesRecorded) failedGates.push('evidence.changedFilesRecorded');
    if (!checklist.evidenceBundleCreated) failedGates.push('evidence.evidenceBundleCreated');
    if (!checklist.masterTrackerUpdated) failedGates.push('evidence.masterTrackerUpdated');
    if (!checklist.featureManifestUpdated) failedGates.push('evidence.featureManifestUpdated');
    if (!checklist.handoffUpdated) failedGates.push('evidence.handoffUpdated');

    return {
      taskId,
      isComplete: failedGates.length === 0,
      failedGates,
    };
  }

  public createDefaultPassingChecklist(): TaskDoDChecklist {
    return {
      completeBehavior: true,
      noPlaceholderProductionPath: true,
      noDuplicateCompetingBehavior: true,
      sourceSizeRuleSatisfied: true,
      configurationTyped: true,
      databaseChangeHasMigration: true,
      focusedUnitTests: true,
      integrationTests: true,
      securityTests: true,
      browserTests: true,
      evalCases: true,
      failureNegativeCases: true,
      typeCheckPass: true,
      lintPass: true,
      affectedSuitesPass: true,
      buildPass: true,
      runtimeQaPass: true,
      sqlitePostgresVerified: true,
      exactCommitShaRecorded: true,
      commandsExitCodesRecorded: true,
      changedFilesRecorded: true,
      evidenceBundleCreated: true,
      masterTrackerUpdated: true,
      featureManifestUpdated: true,
      handoffUpdated: true,
    };
  }
}
