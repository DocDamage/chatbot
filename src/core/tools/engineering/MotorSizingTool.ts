export interface MotorSizingInput {
  query?: string;
  massKg?: number;
  wheelRadiusM?: number;
  accelerationMps2?: number;
  inclineDegrees?: number;
}

export class MotorSizingTool {
  run(input: MotorSizingInput = {}) {
    const query = input.query || '';
    const massKg = input.massKg ?? this.extract(query, 'kg') ?? 10;
    const wheelRadiusM = input.wheelRadiusM ?? this.extract(query, 'radius') ?? 0.05;
    const accelerationMps2 = input.accelerationMps2 ?? this.extract(query, 'accel') ?? 1;
    const inclineDegrees = input.inclineDegrees ?? this.extract(query, 'degree') ?? 0;
    const inclineForce = massKg * 9.81 * Math.sin((inclineDegrees * Math.PI) / 180);
    const accelerationForce = massKg * accelerationMps2;
    const forceNewtons = accelerationForce + inclineForce;
    const torqueNm = forceNewtons * wheelRadiusM;

    return {
      domain: 'engineering',
      tool: 'MotorSizingTool',
      assumptions: { massKg, wheelRadiusM, accelerationMps2, inclineDegrees },
      estimatedPerDriveTorqueNm: Number(torqueNm.toFixed(3)),
      recommendedMotorTorqueNm: Number((torqueNm * 2).toFixed(3)),
      notes: [
        'Includes simple acceleration and incline force only; rolling resistance, drivetrain losses, gearing, and peak loads need margin.',
        'Use at least 2x torque margin for prototypes, more for rough terrain or impacts.'
      ]
    };
  }

  private extract(query: string, type: 'kg' | 'radius' | 'accel' | 'degree'): number | undefined {
    const patterns = {
      kg: /\b(\d+(?:\.\d+)?)\s*kg\b/i,
      radius: /\b(?:radius|wheel)\s*(?:is|=)?\s*(\d+(?:\.\d+)?)\s*(?:m|meter|meters)\b/i,
      accel: /\b(\d+(?:\.\d+)?)\s*m\/s(?:\^2|2)?\b/i,
      degree: /\b(\d+(?:\.\d+)?)\s*(?:degree|degrees|deg)\b/i
    };
    const match = query.match(patterns[type]);
    return match ? Number(match[1]) : undefined;
  }
}
