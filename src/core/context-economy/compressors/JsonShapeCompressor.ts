/**
 * JSON Key/Shape & Sample Compressor (PX-03 / PX03-T03)
 * Reduces large JSON structures to schema shape, key paths, and representative samples
 * while preserving top-level array counts and data types.
 */

export class JsonShapeCompressor {
  public static compress(jsonString: string, maxArrayItems: number = 3): { compressed: string; omittedFieldsCount: number } {
    try {
      const parsed = JSON.parse(jsonString);
      let omitted = 0;

      const reduceObj = (val: any): any => {
        if (val === null || val === undefined) return val;
        if (Array.isArray(val)) {
          if (val.length <= maxArrayItems) {
            return val.map(reduceObj);
          }
          omitted += val.length - maxArrayItems;
          const sampled = val.slice(0, maxArrayItems).map(reduceObj);
          return [
            ...sampled,
            `... [${val.length - maxArrayItems} more items omitted (total: ${val.length})]`
          ];
        }
        if (typeof val === 'object') {
          const res: Record<string, any> = {};
          for (const [k, v] of Object.entries(val)) {
            res[k] = reduceObj(v);
          }
          return res;
        }
        if (typeof val === 'string' && val.length > 300) {
          omitted += 1;
          return `${val.substring(0, 150)}... [truncated string of ${val.length} chars]`;
        }
        return val;
      };

      const reduced = reduceObj(parsed);
      return {
        compressed: JSON.stringify(reduced, null, 2),
        omittedFieldsCount: omitted
      };
    } catch {
      // Fallback for non-JSON
      return { compressed: jsonString, omittedFieldsCount: 0 };
    }
  }
}
