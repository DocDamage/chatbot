import { EngineeringGeniusAgent } from './EngineeringGeniusAgent';

describe('EngineeringGeniusAgent', () => {
  it('calculates Ohms law and returns circuit safety checks', async () => {
    const agent = new EngineeringGeniusAgent();

    const result = await agent.electronics('I have 12 V and 2 amps for an LED circuit.');

    expect(result.model).toBe('engineering-tools');
    expect(result.response).toContain('OhmsLawTool');
    expect(result.response).toContain('"powerWatts": 24');
    expect(result.response).toContain('CircuitChecklistTool');
  });

  it('sizes robot motors and estimates kinematics', async () => {
    const agent = new EngineeringGeniusAgent();

    const result = await agent.robotics('Size a motor for a 10 kg rover with wheel radius 0.05 m at 120 rpm.');

    expect(result.response).toContain('MotorSizingTool');
    expect(result.response).toContain('RoboticsKinematicsTool');
    expect(result.response).toContain('torque');
  });

  it('estimates simple beam loading with warnings', async () => {
    const agent = new EngineeringGeniusAgent();

    const result = await agent.mechanical('Beam load for 100 N over 2 m span.');

    expect(result.response).toContain('BeamLoadTool');
    expect(result.response).toContain('"maxMomentNewtonMeters": 50');
    expect(result.response).toContain('qualified engineer');
  });

  it('builds BOMs for prototypes', async () => {
    const agent = new EngineeringGeniusAgent();

    const result = await agent.bom('Make a BOM for a mobile robot prototype.');

    expect(result.response).toContain('BOMBuilderTool');
    expect(result.response).toContain('motor driver');
    expect(result.response).toContain('lead time');
  });
});
