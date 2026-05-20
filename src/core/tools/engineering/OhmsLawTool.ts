export interface OhmsLawInput {
  query?: string;
  voltage?: number;
  current?: number;
  resistance?: number;
  power?: number;
}

export class OhmsLawTool {
  run(input: OhmsLawInput = {}) {
    const query = input.query || '';
    const voltage = input.voltage ?? this.extract(query, 'v');
    const current = input.current ?? this.extract(query, 'a');
    const resistance = input.resistance ?? this.extract(query, 'ohm');
    let computedVoltage = voltage;
    let computedCurrent = current;
    let computedResistance = resistance;

    if (computedVoltage === undefined && current !== undefined && resistance !== undefined) computedVoltage = current * resistance;
    if (computedCurrent === undefined && voltage !== undefined && resistance !== undefined) computedCurrent = voltage / resistance;
    if (computedResistance === undefined && voltage !== undefined && current !== undefined) computedResistance = voltage / current;

    const power = input.power ?? (computedVoltage !== undefined && computedCurrent !== undefined ? computedVoltage * computedCurrent : undefined);

    return {
      domain: 'engineering',
      tool: 'OhmsLawTool',
      formula: 'V = I * R, P = V * I',
      values: {
        voltageVolts: computedVoltage,
        currentAmps: computedCurrent,
        resistanceOhms: computedResistance,
        powerWatts: power
      },
      safety: [
        'Check component voltage/current/power ratings with margin.',
        'Use fuses/current limiting for power circuits.',
        'Mains voltage and high-current batteries require expert safety practices.'
      ]
    };
  }

  private extract(query: string, unit: 'v' | 'a' | 'ohm'): number | undefined {
    const patterns = {
      v: /\b(\d+(?:\.\d+)?)\s*(?:v|volt|volts)\b/i,
      a: /\b(\d+(?:\.\d+)?)\s*(?:a|amp|amps|ampere|amperes)\b/i,
      ohm: /\b(\d+(?:\.\d+)?)\s*(?:ohm|ohms|Ω)\b/i
    };
    const match = query.match(patterns[unit]);
    return match ? Number(match[1]) : undefined;
  }
}
