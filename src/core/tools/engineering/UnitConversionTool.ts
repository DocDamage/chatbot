export interface UnitConversionInput {
  query?: string;
}

export class UnitConversionTool {
  run(input: UnitConversionInput = {}) {
    const query = input.query || '';
    const conversions = this.convert(query);

    return {
      domain: 'engineering',
      tool: 'UnitConversionTool',
      conversions,
      note: conversions.length > 0 ? 'Detected and converted common engineering units.' : 'No supported unit conversion detected.'
    };
  }

  private convert(query: string): Array<Record<string, number | string>> {
    const results: Array<Record<string, number | string>> = [];
    const inches = query.match(/\b(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/i);
    if (inches) results.push({ from: `${inches[1]} in`, to: `${Number((Number(inches[1]) * 25.4).toFixed(3))} mm` });
    const pounds = query.match(/\b(\d+(?:\.\d+)?)\s*(?:lb|lbs|pound|pounds)\b/i);
    if (pounds) results.push({ from: `${pounds[1]} lb`, to: `${Number((Number(pounds[1]) * 4.44822).toFixed(3))} N` });
    const rpm = query.match(/\b(\d+(?:\.\d+)?)\s*rpm\b/i);
    if (rpm) results.push({ from: `${rpm[1]} rpm`, to: `${Number((Number(rpm[1]) * 0.10472).toFixed(3))} rad/s` });
    return results;
  }
}
