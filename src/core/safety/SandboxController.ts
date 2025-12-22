/**
 * Sandbox Controller
 * Workspace sandboxing for safe code execution
 */

import { logger } from '../observability/logger';
import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn, ChildProcess } from 'child_process';

export type SandboxMode = 'read-only' | 'workspace-write' | 'full-access';

export interface SandboxConfig {
    mode: SandboxMode;
    workspaceDir: string;
    allowedPaths: string[];
    blockedPaths: string[];
    allowedCommands: string[];
    blockedCommands: string[];
    timeout: number; // ms
    maxFileSize: number; // bytes
}

export interface ExecutionResult {
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    duration: number;
    timedOut: boolean;
}

export interface FileOperation {
    type: 'read' | 'write' | 'delete' | 'mkdir';
    path: string;
    allowed: boolean;
    reason?: string;
}

export class SandboxController {
    private config: SandboxConfig;
    private activeProcesses: Map<string, ChildProcess> = new Map();
    private operationLog: FileOperation[] = [];

    constructor(config?: Partial<SandboxConfig>) {
        this.config = {
            mode: 'workspace-write',
            workspaceDir: process.cwd(),
            allowedPaths: [],
            blockedPaths: [
                '/etc',
                '/usr',
                '/bin',
                '/sbin',
                'C:\\Windows',
                'C:\\Program Files'
            ],
            allowedCommands: [
                'node',
                'npm',
                'npx',
                'git',
                'python',
                'pip',
                'tsc',
                'jest'
            ],
            blockedCommands: [
                'rm -rf /',
                'sudo',
                'chmod 777',
                'curl | bash',
                'wget | bash'
            ],
            timeout: 30000,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            ...config
        };
    }

    /**
     * Set sandbox mode
     */
    setMode(mode: SandboxMode): void {
        this.config.mode = mode;
        logger.info('Sandbox mode set', { mode });
    }

    /**
     * Get current mode
     */
    getMode(): SandboxMode {
        return this.config.mode;
    }

    /**
     * Check if file operation is allowed
     */
    canAccessPath(filePath: string, operation: 'read' | 'write' | 'delete'): FileOperation {
        const absolutePath = path.resolve(filePath);
        const result: FileOperation = {
            type: operation,
            path: absolutePath,
            allowed: false
        };

        // Read-only mode
        if (this.config.mode === 'read-only' && operation !== 'read') {
            result.reason = 'Sandbox is in read-only mode';
            this.logOperation(result);
            return result;
        }

        // Check blocked paths
        for (const blocked of this.config.blockedPaths) {
            if (absolutePath.toLowerCase().startsWith(blocked.toLowerCase())) {
                result.reason = `Path is in blocked list: ${blocked}`;
                this.logOperation(result);
                return result;
            }
        }

        // Workspace-write mode: only allow writes in workspace
        if (this.config.mode === 'workspace-write' && operation !== 'read') {
            if (!absolutePath.startsWith(this.config.workspaceDir)) {
                result.reason = 'Writes only allowed in workspace directory';
                this.logOperation(result);
                return result;
            }
        }

        // Check allowed paths (if specified)
        if (this.config.allowedPaths.length > 0) {
            const isAllowed = this.config.allowedPaths.some(allowed =>
                absolutePath.startsWith(path.resolve(allowed))
            );
            if (!isAllowed) {
                result.reason = 'Path not in allowed list';
                this.logOperation(result);
                return result;
            }
        }

        result.allowed = true;
        this.logOperation(result);
        return result;
    }

    /**
     * Check if command is allowed
     */
    canExecuteCommand(command: string): { allowed: boolean; reason?: string } {
        const lowerCommand = command.toLowerCase().trim();

        // Check blocked commands
        for (const blocked of this.config.blockedCommands) {
            if (lowerCommand.includes(blocked.toLowerCase())) {
                return {
                    allowed: false,
                    reason: `Command matches blocked pattern: ${blocked}`
                };
            }
        }

        // In read-only mode, block most commands
        if (this.config.mode === 'read-only') {
            const readOnlySafe = ['cat', 'ls', 'dir', 'type', 'echo', 'pwd', 'git status', 'git log'];
            const isSafe = readOnlySafe.some(safe => lowerCommand.startsWith(safe));
            if (!isSafe) {
                return {
                    allowed: false,
                    reason: 'Only read-only commands allowed in current mode'
                };
            }
        }

        // Extract base command
        const baseCommand = lowerCommand.split(/\s+/)[0];

        // Check if base command is allowed
        if (this.config.allowedCommands.length > 0) {
            const isAllowed = this.config.allowedCommands.some(allowed =>
                baseCommand === allowed.toLowerCase() ||
                baseCommand.endsWith(allowed.toLowerCase())
            );
            if (!isAllowed) {
                return {
                    allowed: false,
                    reason: `Command '${baseCommand}' not in allowed list`
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Execute command in sandbox
     */
    async execute(command: string, cwd?: string): Promise<ExecutionResult> {
        const canExecute = this.canExecuteCommand(command);

        if (!canExecute.allowed) {
            return {
                success: false,
                stdout: '',
                stderr: canExecute.reason || 'Command not allowed',
                exitCode: 1,
                duration: 0,
                timedOut: false
            };
        }

        const startTime = Date.now();
        const workingDir = cwd || this.config.workspaceDir;

        logger.info('Executing command in sandbox', {
            command: command.substring(0, 100),
            cwd: workingDir
        });

        return new Promise((resolve) => {
            const processId = `proc_${Date.now()}`;
            let stdout = '';
            let stderr = '';
            let timedOut = false;

            const proc = spawn(command, {
                shell: true,
                cwd: workingDir,
                env: {
                    ...process.env,
                    NODE_ENV: 'sandbox'
                }
            });

            this.activeProcesses.set(processId, proc);

            const timeout = setTimeout(() => {
                timedOut = true;
                proc.kill('SIGTERM');
                setTimeout(() => {
                    if (!proc.killed) proc.kill('SIGKILL');
                }, 5000);
            }, this.config.timeout);

            proc.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (exitCode) => {
                clearTimeout(timeout);
                this.activeProcesses.delete(processId);

                resolve({
                    success: exitCode === 0,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    exitCode,
                    duration: Date.now() - startTime,
                    timedOut
                });
            });

            proc.on('error', (error) => {
                clearTimeout(timeout);
                this.activeProcesses.delete(processId);

                resolve({
                    success: false,
                    stdout: '',
                    stderr: error.message,
                    exitCode: 1,
                    duration: Date.now() - startTime,
                    timedOut: false
                });
            });
        });
    }

    /**
     * Safe file read
     */
    async readFile(filePath: string): Promise<{ content: string | null; error?: string }> {
        const check = this.canAccessPath(filePath, 'read');

        if (!check.allowed) {
            return { content: null, error: check.reason };
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return { content };
        } catch (error: any) {
            return { content: null, error: error.message };
        }
    }

    /**
     * Safe file write
     */
    async writeFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
        const check = this.canAccessPath(filePath, 'write');

        if (!check.allowed) {
            return { success: false, error: check.reason };
        }

        // Check file size
        if (Buffer.byteLength(content) > this.config.maxFileSize) {
            return {
                success: false,
                error: `File exceeds max size (${this.config.maxFileSize} bytes)`
            };
        }

        try {
            // Ensure directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                const dirCheck = this.canAccessPath(dir, 'write');
                if (!dirCheck.allowed) {
                    return { success: false, error: dirCheck.reason };
                }
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(filePath, content);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Safe file delete
     */
    async deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
        const check = this.canAccessPath(filePath, 'delete');

        if (!check.allowed) {
            return { success: false, error: check.reason };
        }

        try {
            fs.unlinkSync(filePath);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Kill all active processes
     */
    killAll(): number {
        let killed = 0;

        for (const [_id, proc] of this.activeProcesses) {
            try {
                proc.kill('SIGTERM');
                killed++;
            } catch {
                // Process may have already ended
            }
        }

        this.activeProcesses.clear();
        logger.info('Killed all sandbox processes', { count: killed });

        return killed;
    }

    /**
     * Log file operation
     */
    private logOperation(operation: FileOperation): void {
        this.operationLog.push(operation);

        // Keep only last 1000 operations
        if (this.operationLog.length > 1000) {
            this.operationLog = this.operationLog.slice(-1000);
        }
    }

    /**
     * Get operation log
     */
    getOperationLog(limit?: number): FileOperation[] {
        const log = [...this.operationLog].reverse();
        return limit ? log.slice(0, limit) : log;
    }

    /**
     * Get status
     */
    getStatus(): {
        mode: SandboxMode;
        activeProcesses: number;
        operationsLogged: number;
        workspaceDir: string;
    } {
        return {
            mode: this.config.mode,
            activeProcesses: this.activeProcesses.size,
            operationsLogged: this.operationLog.length,
            workspaceDir: this.config.workspaceDir
        };
    }

    /**
     * Add allowed path
     */
    addAllowedPath(pathToAllow: string): void {
        const absolute = path.resolve(pathToAllow);
        if (!this.config.allowedPaths.includes(absolute)) {
            this.config.allowedPaths.push(absolute);
        }
    }

    /**
     * Add blocked path
     */
    addBlockedPath(pathToBlock: string): void {
        const absolute = path.resolve(pathToBlock);
        if (!this.config.blockedPaths.includes(absolute)) {
            this.config.blockedPaths.push(absolute);
        }
    }
}

// Default instance
export const sandboxController = new SandboxController();
