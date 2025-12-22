/**
 * Project Context
 * AGENTS.md-style project context for cross-session project awareness
 * Inspired by just-every/code's project memory system
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../observability/logger';

export interface ProjectInfo {
    name: string;
    description: string;
    type: ProjectType;
    language: string[];
    frameworks: string[];
    structure: DirectoryNode;
    keyFiles: KeyFile[];
    conventions: string[];
    loadedAt: Date;
}

export interface DirectoryNode {
    name: string;
    type: 'file' | 'directory';
    path: string;
    children?: DirectoryNode[];
}

export interface KeyFile {
    path: string;
    description: string;
    category: 'config' | 'entry' | 'api' | 'model' | 'component' | 'test' | 'docs';
}

export type ProjectType =
    | 'nodejs'
    | 'react'
    | 'nextjs'
    | 'python'
    | 'django'
    | 'fastapi'
    | 'typescript'
    | 'unknown';

export interface ProjectContextConfig {
    contextFiles: string[];
    maxDepth: number;
    excludeDirs: string[];
    includeExtensions: string[];
}

const DEFAULT_CONFIG: ProjectContextConfig = {
    contextFiles: [
        'AGENTS.md',
        'CLAUDE.md',
        'AI.md',
        '.ai/context.md',
        '.cursor/context.md',
        'CONTEXT.md'
    ],
    maxDepth: 4,
    excludeDirs: [
        'node_modules',
        '.git',
        'dist',
        'build',
        '__pycache__',
        '.next',
        'coverage',
        '.pytest_cache'
    ],
    includeExtensions: [
        '.ts', '.tsx', '.js', '.jsx', '.py', '.json', '.md',
        '.yaml', '.yml', '.toml', '.ini', '.env.example'
    ]
};

export class ProjectContext {
    private config: ProjectContextConfig;
    private projectRoot: string;
    private context: ProjectInfo | null = null;
    private customContext: string = '';

    constructor(projectRoot?: string, config?: Partial<ProjectContextConfig>) {
        this.projectRoot = projectRoot || process.cwd();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Load project context from project root
     */
    async load(): Promise<ProjectInfo> {
        logger.info('Loading project context', { root: this.projectRoot });

        // Try to load explicit context file
        this.customContext = await this.loadContextFile();

        // Detect project info
        const projectInfo: ProjectInfo = {
            name: path.basename(this.projectRoot),
            description: '',
            type: await this.detectProjectType(),
            language: await this.detectLanguages(),
            frameworks: await this.detectFrameworks(),
            structure: await this.scanStructure(this.projectRoot, 0),
            keyFiles: await this.identifyKeyFiles(),
            conventions: await this.extractConventions(),
            loadedAt: new Date()
        };

        // Extract description from readme or package.json
        projectInfo.description = await this.extractDescription();

        this.context = projectInfo;

        logger.info('Project context loaded', {
            name: projectInfo.name,
            type: projectInfo.type,
            languages: projectInfo.language,
            frameworks: projectInfo.frameworks,
            keyFiles: projectInfo.keyFiles.length
        });

        return projectInfo;
    }

    /**
     * Get loaded context
     */
    getContext(): ProjectInfo | null {
        return this.context;
    }

    /**
     * Get custom context from AGENTS.md or similar
     */
    getCustomContext(): string {
        return this.customContext;
    }

    /**
     * Build context prompt for AI
     */
    buildContextPrompt(): string {
        if (!this.context) {
            return 'No project context loaded.';
        }

        const parts: string[] = [];

        // Project overview
        parts.push(`# Project: ${this.context.name}`);
        if (this.context.description) {
            parts.push(this.context.description);
        }

        // Tech stack
        parts.push(`\n## Tech Stack`);
        parts.push(`- Type: ${this.context.type}`);
        parts.push(`- Languages: ${this.context.language.join(', ')}`);
        if (this.context.frameworks.length > 0) {
            parts.push(`- Frameworks: ${this.context.frameworks.join(', ')}`);
        }

        // Key files
        if (this.context.keyFiles.length > 0) {
            parts.push(`\n## Key Files`);
            for (const file of this.context.keyFiles.slice(0, 15)) {
                parts.push(`- \`${file.path}\`: ${file.description}`);
            }
        }

        // Conventions
        if (this.context.conventions.length > 0) {
            parts.push(`\n## Conventions`);
            for (const conv of this.context.conventions) {
                parts.push(`- ${conv}`);
            }
        }

        // Custom context
        if (this.customContext) {
            parts.push(`\n## Project Notes`);
            parts.push(this.customContext);
        }

        return parts.join('\n');
    }

    /**
     * Load context from AGENTS.md or similar file
     */
    private async loadContextFile(): Promise<string> {
        for (const filename of this.config.contextFiles) {
            const filePath = path.join(this.projectRoot, filename);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                logger.info('Loaded context file', { file: filename });
                return content;
            }
        }
        return '';
    }

    /**
     * Detect project type
     */
    private async detectProjectType(): Promise<ProjectType> {
        const hasFile = (name: string) =>
            fs.existsSync(path.join(this.projectRoot, name));

        if (hasFile('next.config.js') || hasFile('next.config.ts')) {
            return 'nextjs';
        }
        if (hasFile('package.json')) {
            const pkg = this.readJson('package.json');
            if (pkg?.dependencies?.react || pkg?.dependencies?.['react-dom']) {
                return 'react';
            }
            if (pkg?.devDependencies?.typescript) {
                return 'typescript';
            }
            return 'nodejs';
        }
        if (hasFile('requirements.txt') || hasFile('pyproject.toml')) {
            if (hasFile('manage.py')) return 'django';
            if (this.fileContains('requirements.txt', 'fastapi')) return 'fastapi';
            return 'python';
        }

        return 'unknown';
    }

    /**
     * Detect programming languages
     */
    private async detectLanguages(): Promise<string[]> {
        const languages = new Set<string>();
        const extensions: Record<string, string> = {
            '.ts': 'TypeScript',
            '.tsx': 'TypeScript',
            '.js': 'JavaScript',
            '.jsx': 'JavaScript',
            '.py': 'Python',
            '.rs': 'Rust',
            '.go': 'Go',
            '.java': 'Java',
            '.cs': 'C#',
            '.rb': 'Ruby'
        };

        const files = this.walkDir(this.projectRoot, 2);
        for (const file of files) {
            const ext = path.extname(file);
            if (extensions[ext]) {
                languages.add(extensions[ext]);
            }
        }

        return Array.from(languages);
    }

    /**
     * Detect frameworks
     */
    private async detectFrameworks(): Promise<string[]> {
        const frameworks: string[] = [];

        // Node.js frameworks
        const pkg = this.readJson('package.json');
        if (pkg?.dependencies) {
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };

            if (deps['express']) frameworks.push('Express');
            if (deps['fastify']) frameworks.push('Fastify');
            if (deps['next']) frameworks.push('Next.js');
            if (deps['react']) frameworks.push('React');
            if (deps['vue']) frameworks.push('Vue');
            if (deps['angular']) frameworks.push('Angular');
            if (deps['tailwindcss']) frameworks.push('Tailwind CSS');
            if (deps['prisma']) frameworks.push('Prisma');
            if (deps['jest']) frameworks.push('Jest');
        }

        // Python frameworks
        const requirements = this.readFile('requirements.txt');
        if (requirements) {
            if (requirements.includes('django')) frameworks.push('Django');
            if (requirements.includes('fastapi')) frameworks.push('FastAPI');
            if (requirements.includes('flask')) frameworks.push('Flask');
            if (requirements.includes('pytest')) frameworks.push('pytest');
        }

        return frameworks;
    }

    /**
     * Scan project structure
     */
    private async scanStructure(dir: string, depth: number): Promise<DirectoryNode> {
        const name = path.basename(dir);

        if (depth > this.config.maxDepth) {
            return { name, type: 'directory', path: dir };
        }

        const node: DirectoryNode = {
            name,
            type: 'directory',
            path: dir,
            children: []
        };

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (this.config.excludeDirs.includes(entry.name)) continue;
                if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;

                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    const child = await this.scanStructure(fullPath, depth + 1);
                    node.children!.push(child);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (this.config.includeExtensions.includes(ext) ||
                        ['package.json', 'tsconfig.json', 'README.md'].includes(entry.name)) {
                        node.children!.push({
                            name: entry.name,
                            type: 'file',
                            path: fullPath
                        });
                    }
                }
            }
        } catch (error) {
            logger.debug('Error scanning directory', { dir, error });
        }

        return node;
    }

    /**
     * Identify key files
     */
    private async identifyKeyFiles(): Promise<KeyFile[]> {
        const keyFiles: KeyFile[] = [];

        const patterns: { pattern: string; description: string; category: KeyFile['category'] }[] = [
            { pattern: 'package.json', description: 'Node.js package configuration', category: 'config' },
            { pattern: 'tsconfig.json', description: 'TypeScript configuration', category: 'config' },
            { pattern: '.env.example', description: 'Environment variables template', category: 'config' },
            { pattern: 'README.md', description: 'Project documentation', category: 'docs' },
            { pattern: 'src/index.ts', description: 'Application entry point', category: 'entry' },
            { pattern: 'src/server/index.ts', description: 'Server entry point', category: 'entry' },
            { pattern: 'src/App.tsx', description: 'React application root', category: 'entry' },
            { pattern: 'manage.py', description: 'Django management script', category: 'entry' },
            { pattern: 'main.py', description: 'Python entry point', category: 'entry' },
            { pattern: 'src/core/index.ts', description: 'Core module exports', category: 'api' },
            { pattern: 'src/types', description: 'TypeScript type definitions', category: 'model' },
            { pattern: 'src/models', description: 'Data models', category: 'model' },
            { pattern: 'src/components', description: 'UI components', category: 'component' },
            { pattern: 'src/__tests__', description: 'Test files', category: 'test' },
            { pattern: 'tests', description: 'Test files', category: 'test' }
        ];

        for (const { pattern, description, category } of patterns) {
            const fullPath = path.join(this.projectRoot, pattern);
            if (fs.existsSync(fullPath)) {
                keyFiles.push({ path: pattern, description, category });
            }
        }

        return keyFiles;
    }

    /**
     * Extract conventions from project
     */
    private async extractConventions(): Promise<string[]> {
        const conventions: string[] = [];

        // Check for TypeScript
        if (fs.existsSync(path.join(this.projectRoot, 'tsconfig.json'))) {
            conventions.push('Use TypeScript for type safety');
        }

        // Check for ESLint
        if (fs.existsSync(path.join(this.projectRoot, '.eslintrc.js')) ||
            fs.existsSync(path.join(this.projectRoot, '.eslintrc.json'))) {
            conventions.push('Follow ESLint code style rules');
        }

        // Check for Prettier
        if (fs.existsSync(path.join(this.projectRoot, '.prettierrc')) ||
            fs.existsSync(path.join(this.projectRoot, '.prettierrc.json'))) {
            conventions.push('Use Prettier for code formatting');
        }

        // Check for Jest
        const pkg = this.readJson('package.json');
        if (pkg?.scripts?.test?.includes('jest')) {
            conventions.push('Use Jest for testing');
        }

        return conventions;
    }

    /**
     * Extract project description
     */
    private async extractDescription(): Promise<string> {
        // Try package.json
        const pkg = this.readJson('package.json');
        if (pkg?.description) {
            return pkg.description;
        }

        // Try README
        const readme = this.readFile('README.md');
        if (readme) {
            const firstParagraph = readme.split('\n\n')[1]?.trim();
            if (firstParagraph && firstParagraph.length < 500) {
                return firstParagraph;
            }
        }

        return '';
    }

    /**
     * Read JSON file
     */
    private readJson(filename: string): any {
        const filePath = path.join(this.projectRoot, filename);
        try {
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }
        } catch {
            return null;
        }
        return null;
    }

    /**
     * Read file as string
     */
    private readFile(filename: string): string | null {
        const filePath = path.join(this.projectRoot, filename);
        try {
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, 'utf-8');
            }
        } catch {
            return null;
        }
        return null;
    }

    /**
     * Check if file contains text
     */
    private fileContains(filename: string, text: string): boolean {
        const content = this.readFile(filename);
        return content ? content.toLowerCase().includes(text.toLowerCase()) : false;
    }

    /**
     * Walk directory and return file paths
     */
    private walkDir(dir: string, maxDepth: number, depth: number = 0): string[] {
        if (depth > maxDepth) return [];

        const files: string[] = [];

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (this.config.excludeDirs.includes(entry.name)) continue;
                if (entry.name.startsWith('.')) continue;

                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    files.push(...this.walkDir(fullPath, maxDepth, depth + 1));
                } else {
                    files.push(fullPath);
                }
            }
        } catch {
            // Ignore errors
        }

        return files;
    }

    /**
     * Create AGENTS.md template
     */
    static createTemplate(projectRoot: string): void {
        const template = `# Project Context

## Overview
Brief description of your project.

## Tech Stack
- Language: TypeScript/JavaScript
- Framework: Express/React/Next.js
- Database: PostgreSQL/MongoDB
- Testing: Jest

## Key Files
- \`/src/index.ts\` - Application entry point
- \`/src/api/\` - API endpoints
- \`/src/services/\` - Business logic

## Conventions
- Use async/await for async operations
- Follow ESLint rules
- Write tests for new features

## Important Notes
Add any project-specific context that the AI should know.
`;

        const filePath = path.join(projectRoot, 'AGENTS.md');
        fs.writeFileSync(filePath, template);
        logger.info('Created AGENTS.md template', { path: filePath });
    }
}
