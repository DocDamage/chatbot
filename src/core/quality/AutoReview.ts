/**
 * Auto Review
 * Background code review watcher for quality validation
 */

import { logger } from '../observability/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface ReviewResult {
    id: string;
    filepath: string;
    issues: ReviewIssue[];
    suggestions: ReviewSuggestion[];
    score: number; // 0-100
    reviewedAt: Date;
    duration: number;
}

export interface ReviewIssue {
    type: 'error' | 'warning' | 'info';
    line?: number;
    column?: number;
    message: string;
    rule?: string;
}

export interface ReviewSuggestion {
    line?: number;
    original?: string;
    suggested: string;
    reason: string;
}

export interface AutoReviewConfig {
    enabled: boolean;
    watchPaths: string[];
    ignorePatterns: string[];
    reviewModel: string;
    maxFileSize: number;
    debounceMs: number;
}

export class AutoReview {
    private config: AutoReviewConfig;
    private llmHandler: (prompt: string) => Promise<string>;
    private watchedFiles: Map<string, fs.FSWatcher> = new Map();
    private pendingReviews: Map<string, NodeJS.Timeout> = new Map();
    private reviewHistory: ReviewResult[] = [];

    constructor(
        llmHandler: (prompt: string) => Promise<string>,
        config?: Partial<AutoReviewConfig>
    ) {
        this.llmHandler = llmHandler;
        this.config = {
            enabled: true,
            watchPaths: ['src'],
            ignorePatterns: ['node_modules', 'dist', '.git', '*.test.ts'],
            reviewModel: 'default',
            maxFileSize: 100 * 1024, // 100KB
            debounceMs: 2000,
            ...config
        };
    }

    /**
     * Start watching for file changes
     */
    startWatching(): void {
        if (!this.config.enabled) {
            logger.info('Auto review is disabled');
            return;
        }

        for (const watchPath of this.config.watchPaths) {
            const absolutePath = path.resolve(watchPath);

            if (!fs.existsSync(absolutePath)) {
                logger.warn('Watch path does not exist', { path: absolutePath });
                continue;
            }

            this.watchDirectory(absolutePath);
        }

        logger.info('Auto review started', {
            paths: this.config.watchPaths
        });
    }

    /**
     * Stop watching
     */
    stopWatching(): void {
        for (const [filepath, watcher] of this.watchedFiles) {
            watcher.close();
        }
        this.watchedFiles.clear();

        for (const timeout of this.pendingReviews.values()) {
            clearTimeout(timeout);
        }
        this.pendingReviews.clear();

        logger.info('Auto review stopped');
    }

    /**
     * Review a single file
     */
    async reviewFile(filepath: string): Promise<ReviewResult> {
        const startTime = Date.now();
        const absolutePath = path.resolve(filepath);

        logger.info('Reviewing file', { filepath: absolutePath });

        // Check file exists and size
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`File not found: ${absolutePath}`);
        }

        const stats = fs.statSync(absolutePath);
        if (stats.size > this.config.maxFileSize) {
            throw new Error(`File too large: ${stats.size} bytes`);
        }

        // Read file content
        const content = fs.readFileSync(absolutePath, 'utf-8');
        const extension = path.extname(filepath);

        // Build review prompt
        const prompt = this.buildReviewPrompt(content, filepath, extension);

        // Get LLM review
        const response = await this.llmHandler(prompt);

        // Parse review results
        const result = this.parseReviewResponse(response, absolutePath);
        result.duration = Date.now() - startTime;

        // Store in history
        this.reviewHistory.push(result);
        if (this.reviewHistory.length > 100) {
            this.reviewHistory = this.reviewHistory.slice(-100);
        }

        logger.info('File reviewed', {
            filepath,
            issues: result.issues.length,
            score: result.score
        });

        return result;
    }

    /**
     * Review multiple files
     */
    async reviewFiles(filepaths: string[]): Promise<ReviewResult[]> {
        const results: ReviewResult[] = [];

        for (const filepath of filepaths) {
            try {
                const result = await this.reviewFile(filepath);
                results.push(result);
            } catch (error) {
                logger.warn('Failed to review file', { filepath, error });
            }
        }

        return results;
    }

    /**
     * Get review history
     */
    getHistory(limit?: number): ReviewResult[] {
        const history = [...this.reviewHistory].reverse();
        return limit ? history.slice(0, limit) : history;
    }

    /**
     * Get files currently being watched
     */
    getWatchedFiles(): string[] {
        return Array.from(this.watchedFiles.keys());
    }

    /**
     * Build review prompt for LLM
     */
    private buildReviewPrompt(content: string, filepath: string, extension: string): string {
        const language = this.getLanguage(extension);

        return `Review this ${language} code file for issues and suggest improvements.

File: ${filepath}

\`\`\`${language}
${content}
\`\`\`

Analyze for:
1. Bugs and potential errors
2. Security vulnerabilities
3. Performance issues
4. Code style and best practices
5. Maintainability concerns

Return your review in this JSON format:
{
    "score": 0-100,
    "issues": [
        {"type": "error|warning|info", "line": number, "message": "description", "rule": "optional rule name"}
    ],
    "suggestions": [
        {"line": number, "original": "old code", "suggested": "new code", "reason": "why"}
    ],
    "summary": "brief overall assessment"
}`;
    }

    /**
     * Parse review response from LLM
     */
    private parseReviewResponse(response: string, filepath: string): ReviewResult {
        const result: ReviewResult = {
            id: this.generateId(),
            filepath,
            issues: [],
            suggestions: [],
            score: 70,
            reviewedAt: new Date(),
            duration: 0
        };

        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);

                result.score = parsed.score || 70;
                result.issues = (parsed.issues || []).map((i: any) => ({
                    type: i.type || 'info',
                    line: i.line,
                    column: i.column,
                    message: i.message || '',
                    rule: i.rule
                }));
                result.suggestions = (parsed.suggestions || []).map((s: any) => ({
                    line: s.line,
                    original: s.original,
                    suggested: s.suggested || '',
                    reason: s.reason || ''
                }));
            }
        } catch (error) {
            logger.warn('Failed to parse review response', { error });

            // Fallback: create issue from raw response
            result.issues.push({
                type: 'info',
                message: response.substring(0, 500)
            });
        }

        return result;
    }

    /**
     * Watch a directory for changes
     */
    private watchDirectory(dirPath: string): void {
        try {
            const watcher = fs.watch(dirPath, { recursive: true }, (event, filename) => {
                if (!filename) return;

                const filepath = path.join(dirPath, filename);

                if (this.shouldIgnore(filepath)) return;
                if (!this.isCodeFile(filepath)) return;

                this.queueReview(filepath);
            });

            this.watchedFiles.set(dirPath, watcher);
        } catch (error) {
            logger.warn('Failed to watch directory', { dirPath, error });
        }
    }

    /**
     * Queue a file for review with debouncing
     */
    private queueReview(filepath: string): void {
        // Clear existing timeout
        const existing = this.pendingReviews.get(filepath);
        if (existing) {
            clearTimeout(existing);
        }

        // Set new timeout
        const timeout = setTimeout(async () => {
            this.pendingReviews.delete(filepath);

            try {
                await this.reviewFile(filepath);
            } catch (error) {
                logger.warn('Queued review failed', { filepath, error });
            }
        }, this.config.debounceMs);

        this.pendingReviews.set(filepath, timeout);
    }

    /**
     * Check if file should be ignored
     */
    private shouldIgnore(filepath: string): boolean {
        const normalized = filepath.replace(/\\/g, '/');

        for (const pattern of this.config.ignorePatterns) {
            if (pattern.startsWith('*')) {
                if (normalized.endsWith(pattern.substring(1))) return true;
            } else {
                if (normalized.includes(pattern)) return true;
            }
        }

        return false;
    }

    /**
     * Check if file is a code file
     */
    private isCodeFile(filepath: string): boolean {
        const codeExtensions = [
            '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs',
            '.go', '.rs', '.rb', '.php', '.swift', '.kt'
        ];
        const ext = path.extname(filepath);
        return codeExtensions.includes(ext);
    }

    /**
     * Get language from extension
     */
    private getLanguage(extension: string): string {
        const langMap: Record<string, string> = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python',
            '.java': 'java',
            '.cs': 'csharp',
            '.go': 'go',
            '.rs': 'rust',
            '.rb': 'ruby',
            '.php': 'php'
        };
        return langMap[extension] || 'text';
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get statistics
     */
    getStats(): {
        enabled: boolean;
        watchedPaths: number;
        pendingReviews: number;
        totalReviews: number;
        avgScore: number;
    } {
        const scores = this.reviewHistory.map(r => r.score);
        const avgScore = scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : 0;

        return {
            enabled: this.config.enabled,
            watchedPaths: this.watchedFiles.size,
            pendingReviews: this.pendingReviews.size,
            totalReviews: this.reviewHistory.length,
            avgScore: Math.round(avgScore)
        };
    }
}
