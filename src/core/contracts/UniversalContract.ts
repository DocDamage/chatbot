/**
 * Universal Contract - Standardized interface for cross-platform AI component sharing
 * Reference: universal-intelligence protocol patterns
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../observability/logger';

/**
 * Universal specification for an AI component
 */
export interface UniversalSpec {
    id: string;
    name: string;
    version: string;
    type: 'model' | 'tool' | 'agent' | 'pipeline';
    description: string;
    inputs: IOSpec[];
    outputs: IOSpec[];
    config?: ConfigSpec[];
    metadata?: Record<string, any>;
}

export interface IOSpec {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
    description: string;
    required: boolean;
    default?: any;
    schema?: Record<string, any>;
}

export interface ConfigSpec {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object';
    description: string;
    default?: any;
    required: boolean;
    options?: any[];
}

/**
 * Universal component base interface
 */
export interface UniversalComponent<I = any, O = any> {
    spec: UniversalSpec;
    process(input: I): Promise<O>;
    validate(input: I): { valid: boolean; errors: string[] };
    getConfig(): Record<string, any>;
    setConfig(config: Record<string, any>): void;
}

/**
 * Universal Model interface
 */
export interface UniversalModel extends UniversalComponent<ModelInput, ModelOutput> {
    spec: UniversalSpec & { type: 'model' };
    supportedModalities: string[];
    maxTokens: number;
    contextWindow: number;
}

export interface ModelInput {
    messages: Array<{ role: string; content: string }>;
    options?: {
        maxTokens?: number;
        temperature?: number;
        topP?: number;
        stop?: string[];
    };
}

export interface ModelOutput {
    content: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    finishReason: 'stop' | 'length' | 'tool_call' | 'error';
    metadata?: Record<string, any>;
}

/**
 * Universal Tool interface
 */
export interface UniversalTool extends UniversalComponent<ToolInput, ToolOutput> {
    spec: UniversalSpec & { type: 'tool' };
    category: string;
}

export interface ToolInput {
    action: string;
    parameters: Record<string, any>;
}

export interface ToolOutput {
    success: boolean;
    result: any;
    error?: string;
    executionTime: number;
}

/**
 * Universal Agent interface
 */
export interface UniversalAgent extends UniversalComponent<AgentInput, AgentOutput> {
    spec: UniversalSpec & { type: 'agent' };
    model: UniversalModel;
    tools: UniversalTool[];
}

export interface AgentInput {
    task: string;
    context?: Record<string, any>;
    constraints?: {
        maxSteps?: number;
        timeout?: number;
    };
}

export interface AgentOutput {
    result: any;
    steps: AgentStep[];
    success: boolean;
    error?: string;
}

export interface AgentStep {
    type: 'thought' | 'action' | 'observation';
    content: string;
    timestamp: number;
    toolCall?: {
        tool: string;
        input: any;
        output: any;
    };
}

/**
 * Contract Registry - Central registry for universal components
 */
export class ContractRegistry {
    private components: Map<string, UniversalComponent> = new Map();
    private specs: Map<string, UniversalSpec> = new Map();

    /**
     * Register a component
     */
    register(component: UniversalComponent): void {
        const id = component.spec.id;
        this.components.set(id, component);
        this.specs.set(id, component.spec);

        logger.info('Component registered', {
            id,
            name: component.spec.name,
            type: component.spec.type
        });
    }

    /**
     * Get a component by ID
     */
    get<T extends UniversalComponent>(id: string): T | undefined {
        return this.components.get(id) as T | undefined;
    }

    /**
     * Get component spec
     */
    getSpec(id: string): UniversalSpec | undefined {
        return this.specs.get(id);
    }

    /**
     * List all components
     */
    list(type?: 'model' | 'tool' | 'agent' | 'pipeline'): UniversalSpec[] {
        const specs = Array.from(this.specs.values());
        if (type) {
            return specs.filter(s => s.type === type);
        }
        return specs;
    }

    /**
     * Unregister a component
     */
    unregister(id: string): boolean {
        const existed = this.components.has(id);
        this.components.delete(id);
        this.specs.delete(id);
        return existed;
    }

    /**
     * Clear all registrations
     */
    clear(): void {
        this.components.clear();
        this.specs.clear();
    }
}

/**
 * Create a universal spec
 */
export function createSpec(options: {
    name: string;
    type: UniversalSpec['type'];
    description: string;
    version?: string;
    inputs?: IOSpec[];
    outputs?: IOSpec[];
    config?: ConfigSpec[];
}): UniversalSpec {
    return {
        id: uuidv4(),
        name: options.name,
        version: options.version || '1.0.0',
        type: options.type,
        description: options.description,
        inputs: options.inputs || [],
        outputs: options.outputs || [],
        config: options.config
    };
}

/**
 * Base class for creating universal tools
 */
export abstract class BaseUniversalTool implements UniversalTool {
    abstract spec: UniversalSpec & { type: 'tool' };
    abstract category: string;
    protected config: Record<string, any> = {};

    abstract execute(parameters: Record<string, any>): Promise<any>;

    async process(input: ToolInput): Promise<ToolOutput> {
        const startTime = Date.now();

        try {
            const validation = this.validate(input);
            if (!validation.valid) {
                return {
                    success: false,
                    result: null,
                    error: validation.errors.join(', '),
                    executionTime: Date.now() - startTime
                };
            }

            const result = await this.execute(input.parameters);

            return {
                success: true,
                result,
                executionTime: Date.now() - startTime
            };
        } catch (error: any) {
            return {
                success: false,
                result: null,
                error: error.message,
                executionTime: Date.now() - startTime
            };
        }
    }

    validate(input: ToolInput): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check required inputs
        for (const inputSpec of this.spec.inputs) {
            if (inputSpec.required && !(inputSpec.name in input.parameters)) {
                errors.push(`Missing required parameter: ${inputSpec.name}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    getConfig(): Record<string, any> {
        return { ...this.config };
    }

    setConfig(config: Record<string, any>): void {
        this.config = { ...this.config, ...config };
    }
}

/**
 * Export spec as JSON for cross-platform sharing
 */
export function exportSpec(spec: UniversalSpec): string {
    return JSON.stringify(spec, null, 2);
}

/**
 * Import spec from JSON
 */
export function importSpec(json: string): UniversalSpec {
    return JSON.parse(json) as UniversalSpec;
}

// Singleton registry
let registry: ContractRegistry | null = null;

export function getContractRegistry(): ContractRegistry {
    if (!registry) {
        registry = new ContractRegistry();
    }
    return registry;
}

export default ContractRegistry;
