import crypto from 'crypto';

const STREET_PATTERN = /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct|circle|cir|place|pl|way|parkway|pkwy)\b/gi;
const ZIP_PATTERN = /\b\d{5}(?:-\d{4})?\b/g;
const COORDINATE_PATTERN = /\b-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}\b/g;

export class GISPrivacy {
  static redactText(value: string): string {
    return value
      .replace(STREET_PATTERN, '[REDACTED_ADDRESS]')
      .replace(COORDINATE_PATTERN, '[REDACTED_COORDINATE]')
      .replace(ZIP_PATTERN, '[REDACTED_ZIP]');
  }

  static redactObject<T>(value: T): T {
    if (typeof value === 'string') {
      return this.redactText(value) as T;
    }

    if (Array.isArray(value)) {
      return value.map(item => this.redactObject(item)) as T;
    }

    if (value && typeof value === 'object') {
      const redacted: Record<string, unknown> = {};
      for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        redacted[key] = /address|query|location|coordinate/i.test(key)
          ? this.redactObject(nestedValue)
          : nestedValue;
      }
      return redacted as T;
    }

    return value;
  }

  static requestHash(value: unknown): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(value))
      .digest('hex');
  }

  static shouldPersistExactAddress(explicitOptIn?: boolean): boolean {
    if (explicitOptIn === true) return true;
    return process.env.GIS_REDACT_EXACT_ADDRESSES === 'false';
  }
}
