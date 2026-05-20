import { MathToolResult } from '../../tools/math/SymPyTool';

export class MathVerifier {
  fromToolResult(result: MathToolResult) {
    return {
      verified: result.verified,
      method: result.method,
      warnings: result.verified ? [] : [result.error || 'Math result was not tool-verified'],
      approximate: result.approximate
    };
  }
}
