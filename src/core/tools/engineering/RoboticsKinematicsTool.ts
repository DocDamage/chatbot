export interface RoboticsKinematicsInput {
  query?: string;
  wheelRadiusM?: number;
  rpm?: number;
}

export class RoboticsKinematicsTool {
  run(input: RoboticsKinematicsInput = {}) {
    const query = input.query || '';
    const parsedWheelRadiusM = Number(query.match(/\b(?:radius|wheel)\s*(?:is|=)?\s*(\d+(?:\.\d+)?)\s*m\b/i)?.[1]);
    const parsedRpm = Number(query.match(/\b(\d+(?:\.\d+)?)\s*rpm\b/i)?.[1]);
    const wheelRadiusM = input.wheelRadiusM ?? (Number.isFinite(parsedWheelRadiusM) && parsedWheelRadiusM > 0 ? parsedWheelRadiusM : 0.05);
    const rpm = input.rpm ?? (Number.isFinite(parsedRpm) && parsedRpm > 0 ? parsedRpm : 120);
    const radPerSec = rpm * 0.10472;
    const linearSpeedMps = wheelRadiusM * radPerSec;

    return {
      domain: 'engineering',
      tool: 'RoboticsKinematicsTool',
      assumptions: { wheelRadiusM, rpm },
      estimatedLinearSpeedMps: Number(linearSpeedMps.toFixed(3)),
      estimatedLinearSpeedKph: Number((linearSpeedMps * 3.6).toFixed(3)),
      nextChecks: [
        'Account for gear ratio, wheel slip, encoder resolution, and battery voltage sag.',
        'For differential drive, calibrate left/right wheel radius and track width.',
        'Add emergency stop and safe test area for moving robots.'
      ]
    };
  }
}
