/**
 * Phase PX-17: Safe OpenAPI & Schema Importer
 * PX17-T04
 */

import crypto from 'node:crypto';
import {
  CollectionSchema,
  FieldDefinition,
  FieldType,
  OpenApiImportResult
} from './DeveloperTypes';

export class OpenApiSchemaImporter {
  private readonly maxRefDepth = 5;
  private readonly maxSchemaSizeBytes = 500000; // 500KB cap

  public parseOpenApiSpec(rawSpec: string | object): OpenApiImportResult {
    const rawString = typeof rawSpec === 'string' ? rawSpec : JSON.stringify(rawSpec);
    if (Buffer.byteLength(rawString, 'utf8') > this.maxSchemaSizeBytes) {
      throw new Error(`OpenAPI spec size exceeds maximum allowed limit of ${this.maxSchemaSizeBytes} bytes.`);
    }

    // Block remote references by default
    if (/\$ref["']?\s*:\s*["']?https?:\/\//i.test(rawString)) {
      throw new Error(`Remote references ($ref to external URLs) are blocked for safety.`);
    }

    let spec: any;
    try {
      spec = typeof rawSpec === 'string' ? JSON.parse(rawSpec) : rawSpec;
    } catch {
      throw new Error('Failed to parse OpenAPI specification. Input must be valid JSON.');
    }

    const title = spec.info?.title || 'Imported API';
    const version = spec.info?.version || '1.0.0';
    const warnings: string[] = [];

    // Extract schemas from components.schemas or definitions
    const schemasObj = spec.components?.schemas || spec.definitions || {};
    const collections: CollectionSchema[] = [];

    for (const [schemaName, schemaVal] of Object.entries<any>(schemasObj)) {
      const collection = this.convertJsonSchemaToCollection(schemaName, schemaVal, schemasObj, 0);
      if (collection) {
        collections.push(collection);
      }
    }

    // Extract routes from paths
    const generatedRoutes: OpenApiImportResult['generatedRoutes'] = [];
    const paths = spec.paths || {};

    for (const [routePath, methods] of Object.entries<any>(paths)) {
      for (const [method, op] of Object.entries<any>(methods)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
          const colName = this.inferCollectionNameFromPath(routePath);
          generatedRoutes.push({
            method: method.toUpperCase(),
            path: routePath,
            summary: op.summary || op.operationId || `${method.toUpperCase()} ${routePath}`,
            collectionName: colName
          });
        }
      }
    }

    const sourceDigest = crypto.createHash('sha256').update(rawString).digest('hex');

    return {
      title,
      version,
      collections,
      generatedRoutes,
      sourceDigest,
      warnings
    };
  }

  private convertJsonSchemaToCollection(
    name: string,
    schema: any,
    allSchemas: any,
    depth: number
  ): CollectionSchema | null {
    if (depth > this.maxRefDepth) {
      return null;
    }

    const properties = schema.properties || {};
    const requiredList = Array.isArray(schema.required) ? schema.required : [];
    const fields: FieldDefinition[] = [];

    for (const [propName, propVal] of Object.entries<any>(properties)) {
      let resolvedProp = propVal;
      if (propVal.$ref) {
        const refName = propVal.$ref.split('/').pop();
        if (refName && allSchemas[refName]) {
          resolvedProp = allSchemas[refName];
        }
      }

      const fieldType = this.mapJsonSchemaType(resolvedProp);
      const isRequired = requiredList.includes(propName) || propName === 'id';

      fields.push({
        name: propName,
        type: fieldType,
        required: isRequired,
        enumValues: Array.isArray(resolvedProp.enum) ? resolvedProp.enum.map(String) : undefined
      });
    }

    const hasId = fields.some(f => f.name === 'id');
    if (!hasId) {
      fields.unshift({
        name: 'id',
        type: 'string',
        required: true
      });
    }

    return {
      name: name.toLowerCase(),
      displayName: name,
      description: schema.description,
      primaryKey: 'id',
      fields,
      seedCount: 5
    };
  }

  private mapJsonSchemaType(prop: any): FieldType {
    if (prop.enum) return 'enum';
    if (prop.format === 'email') return 'email';
    if (prop.format === 'uuid') return 'uuid';
    if (prop.format === 'date' || prop.format === 'date-time') return 'date';

    switch (prop.type) {
      case 'integer':
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'array';
      case 'object':
        return 'object';
      default:
        return 'string';
    }
  }

  private inferCollectionNameFromPath(routePath: string): string {
    const segments = routePath.split('/').filter(s => s && !s.startsWith('{'));
    return segments[segments.length - 1]?.toLowerCase() || 'items';
  }
}
