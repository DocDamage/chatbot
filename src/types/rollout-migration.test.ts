import {
  RolloutStageSchema,
  RolloutStage,
} from './rollout-migration';

describe('Rollout and Migration Types', () => {
  it('validates all 8 sequential migration stages', () => {
    const stages: RolloutStage[] = [
      '1_instrumentation',
      '2_build_flag',
      '3_shadow_planner',
      '4_internal_canary',
      '5_default_local_beta',
      '6_production_preview',
      '7_default',
      '8_legacy_removal',
    ];

    for (const stage of stages) {
      expect(RolloutStageSchema.safeParse(stage).success).toBe(true);
    }
    expect(RolloutStageSchema.safeParse('9_invalid_stage').success).toBe(false);
  });
});
