/**
 * RAG Router
 * Auto-route between RAG (vector search) and SQL queries based on intent
 */

import { logger } from '../observability/logger';

export type QueryType = 'rag' | 'sql' | 'hybrid' | 'direct';

export interface RouterConfig {
    enableSQLRoute: boolean;
    enableHybridRoute: boolean;
    sqlTables?: string[];
    ragCollections?: string[];
}

export interface ClassificationResult {
    queryType: QueryType;
    confidence: number;
    reasoning: string;
    extractedInfo?: {
        table?: string;
        columns?: string[];
        filters?: Record<string, any>;
        keywords?: string[];
    };
}

export interface RouteResult {
    queryType: QueryType;
    result: any;
    sources?: string[];
    executionTime: number;
}

export class RAGRouter {
    private config: RouterConfig;
    private ragHandler: (query: string) => Promise<any>;
    private sqlHandler?: (query: string, params?: any[]) => Promise<any>;
    private llmClassifier?: (prompt: string) => Promise<string>;

    constructor(
        ragHandler: (query: string) => Promise<any>,
        sqlHandler?: (query: string, params?: any[]) => Promise<any>,
        llmClassifier?: (prompt: string) => Promise<string>,
        config?: Partial<RouterConfig>
    ) {
        this.ragHandler = ragHandler;
        this.sqlHandler = sqlHandler;
        this.llmClassifier = llmClassifier;
        this.config = {
            enableSQLRoute: !!sqlHandler,
            enableHybridRoute: true,
            sqlTables: [],
            ragCollections: [],
            ...config
        };
    }

    /**
     * Route query to appropriate handler
     */
    async route(query: string): Promise<RouteResult> {
        const startTime = Date.now();

        // Classify the query
        const classification = await this.classifyQuery(query);

        logger.info('Query classified', {
            query: query.substring(0, 50),
            type: classification.queryType,
            confidence: classification.confidence
        });

        // Execute based on classification
        let result: any;
        let sources: string[] = [];

        switch (classification.queryType) {
            case 'sql':
                if (!this.sqlHandler) {
                    result = await this.ragHandler(query);
                    sources = ['rag'];
                } else {
                    const sqlQuery = await this.generateSQL(query, classification);
                    result = await this.sqlHandler(sqlQuery);
                    sources = ['sql'];
                }
                break;

            case 'hybrid':
                const [ragResult, sqlResult] = await Promise.all([
                    this.ragHandler(query),
                    this.sqlHandler ? this.executeSQLQuery(query, classification) : null
                ]);
                result = this.mergeResults(ragResult, sqlResult);
                sources = ['rag', 'sql'];
                break;

            case 'direct':
                result = { answer: 'This question can be answered directly without database lookup.' };
                sources = ['direct'];
                break;

            case 'rag':
            default:
                result = await this.ragHandler(query);
                sources = ['rag'];
                break;
        }

        return {
            queryType: classification.queryType,
            result,
            sources,
            executionTime: Date.now() - startTime
        };
    }

    /**
     * Classify query intent
     */
    async classifyQuery(query: string): Promise<ClassificationResult> {
        // Rule-based classification first
        const ruleResult = this.classifyByRules(query);
        if (ruleResult.confidence > 0.8) {
            return ruleResult;
        }

        // Use LLM for complex classification if available
        if (this.llmClassifier) {
            const llmResult = await this.classifyWithLLM(query);
            if (llmResult.confidence > ruleResult.confidence) {
                return llmResult;
            }
        }

        return ruleResult;
    }

    /**
     * Rule-based query classification
     */
    private classifyByRules(query: string): ClassificationResult {
        const lowerQuery = query.toLowerCase();

        // SQL indicators
        const sqlPatterns = [
            /how many|count of|number of/i,
            /average|sum|total|max|min/i,
            /list all|show all|get all/i,
            /where .+ (is|equals|=)/i,
            /sorted by|order by|group by/i,
            /between .+ and/i,
            /greater than|less than|more than/i,
            /top \d+|first \d+|last \d+/i
        ];

        // RAG indicators
        const ragPatterns = [
            /what is|what are|explain/i,
            /how to|how do|how does/i,
            /why is|why does|why do/i,
            /describe|definition|meaning/i,
            /best practices|recommendations/i,
            /difference between/i
        ];

        // Direct answer indicators
        const directPatterns = [
            /what time is it/i,
            /what is today/i,
            /hello|hi|hey/i,
            /thank you|thanks/i
        ];

        // Check direct patterns
        for (const pattern of directPatterns) {
            if (pattern.test(lowerQuery)) {
                return {
                    queryType: 'direct',
                    confidence: 0.9,
                    reasoning: 'Query matches direct answer pattern'
                };
            }
        }

        // Count matches
        let sqlScore = 0;
        let ragScore = 0;
        const extractedInfo: ClassificationResult['extractedInfo'] = {};

        for (const pattern of sqlPatterns) {
            if (pattern.test(lowerQuery)) sqlScore++;
        }

        for (const pattern of ragPatterns) {
            if (pattern.test(lowerQuery)) ragScore++;
        }

        // Extract table references
        if (this.config.sqlTables) {
            for (const table of this.config.sqlTables) {
                if (lowerQuery.includes(table.toLowerCase())) {
                    sqlScore += 2;
                    extractedInfo.table = table;
                }
            }
        }

        // Determine query type
        let queryType: QueryType = 'rag';
        let confidence = 0.5;

        if (sqlScore > ragScore && sqlScore >= 2 && this.config.enableSQLRoute) {
            queryType = 'sql';
            confidence = Math.min(0.9, 0.5 + sqlScore * 0.1);
        } else if (ragScore > sqlScore && ragScore >= 1) {
            queryType = 'rag';
            confidence = Math.min(0.9, 0.5 + ragScore * 0.1);
        } else if (sqlScore > 0 && ragScore > 0 && this.config.enableHybridRoute) {
            queryType = 'hybrid';
            confidence = 0.6;
        }

        return {
            queryType,
            confidence,
            reasoning: `SQL patterns: ${sqlScore}, RAG patterns: ${ragScore}`,
            extractedInfo
        };
    }

    /**
     * LLM-based query classification
     */
    private async classifyWithLLM(query: string): Promise<ClassificationResult> {
        if (!this.llmClassifier) {
            return this.classifyByRules(query);
        }

        const prompt = `Classify this query into one of these categories:
- SQL: Needs structured database query (counting, filtering, aggregating data)
- RAG: Needs semantic search through documents (explanations, concepts, how-to)
- HYBRID: Needs both structured data AND contextual information
- DIRECT: Can be answered directly without database lookup

Query: "${query}"

Available SQL tables: ${this.config.sqlTables?.join(', ') || 'none'}

Respond with JSON:
{"type": "sql|rag|hybrid|direct", "confidence": 0.0-1.0, "reasoning": "explanation"}`;

        try {
            const response = await this.llmClassifier(prompt);
            const json = JSON.parse(response.match(/\{[\s\S]*\}/)?.[0] || '{}');

            return {
                queryType: json.type || 'rag',
                confidence: json.confidence || 0.5,
                reasoning: json.reasoning || 'LLM classification'
            };
        } catch (error) {
            logger.warn('LLM classification failed', { error });
            return this.classifyByRules(query);
        }
    }

    /**
     * Generate SQL query from natural language
     */
    private async generateSQL(
        query: string,
        classification: ClassificationResult
    ): Promise<string> {
        if (!this.llmClassifier) {
            // Simple fallback
            const table = classification.extractedInfo?.table || this.config.sqlTables?.[0];
            return `SELECT * FROM ${table || 'data'} LIMIT 10`;
        }

        const prompt = `Convert this natural language query to SQL.

Query: "${query}"

Available tables: ${this.config.sqlTables?.join(', ') || 'unknown'}

Rules:
- Use proper SQL syntax
- Add LIMIT if not specified
- Use parameterized queries for values

Return only the SQL query, no explanation.`;

        try {
            const response = await this.llmClassifier(prompt);
            // Extract SQL from response
            const sqlMatch = response.match(/```sql\n?([\s\S]+?)\n?```/) ||
                response.match(/SELECT[\s\S]+?;?/i);
            return sqlMatch?.[1] || sqlMatch?.[0] || `SELECT * FROM ${this.config.sqlTables?.[0]} LIMIT 10`;
        } catch (error) {
            logger.warn('SQL generation failed', { error });
            return `SELECT * FROM ${classification.extractedInfo?.table || 'data'} LIMIT 10`;
        }
    }

    /**
     * Execute SQL query
     */
    private async executeSQLQuery(
        query: string,
        classification: ClassificationResult
    ): Promise<any> {
        if (!this.sqlHandler) return null;

        try {
            const sqlQuery = await this.generateSQL(query, classification);
            return await this.sqlHandler(sqlQuery);
        } catch (error) {
            logger.warn('SQL execution failed', { error });
            return null;
        }
    }

    /**
     * Merge results from RAG and SQL
     */
    private mergeResults(ragResult: any, sqlResult: any): any {
        return {
            rag: ragResult,
            sql: sqlResult,
            merged: true
        };
    }

    /**
     * Add SQL table to router
     */
    addTable(tableName: string): void {
        if (!this.config.sqlTables) {
            this.config.sqlTables = [];
        }
        if (!this.config.sqlTables.includes(tableName)) {
            this.config.sqlTables.push(tableName);
        }
    }

    /**
     * Get router statistics
     */
    getStats(): {
        sqlTablesCount: number;
        ragCollectionsCount: number;
        routingEnabled: { sql: boolean; hybrid: boolean };
    } {
        return {
            sqlTablesCount: this.config.sqlTables?.length || 0,
            ragCollectionsCount: this.config.ragCollections?.length || 0,
            routingEnabled: {
                sql: this.config.enableSQLRoute,
                hybrid: this.config.enableHybridRoute
            }
        };
    }
}
