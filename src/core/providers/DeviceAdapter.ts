/**
 * Device Adapter - Device-adaptive model loading and memory management
 * Reference: universal-intelligence protocol patterns
 */

import * as os from 'os';
import { logger } from '../observability/logger';

export interface DeviceInfo {
    platform: string;
    arch: string;
    cpuCores: number;
    totalMemory: number; // bytes
    freeMemory: number; // bytes
    memoryUsagePercent: number;
    gpuAvailable: boolean;
    gpuMemory?: number;
    deviceClass: 'low' | 'medium' | 'high' | 'ultra';
}

export interface ModelRecommendation {
    quantization: '4bit' | '8bit' | '16bit' | 'full';
    maxContextLength: number;
    maxBatchSize: number;
    useGPU: boolean;
    useStreaming: boolean;
    memoryLimit: number;
    suggestedModels: string[];
}

export interface MemoryStatus {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    systemFree: number;
    systemTotal: number;
    usagePercent: number;
    status: 'healthy' | 'warning' | 'critical';
}

export class DeviceAdapter {
    private lastDeviceInfo: DeviceInfo | null = null;
    private memoryCheckInterval: NodeJS.Timer | null = null;
    private memoryWarningCallback?: (status: MemoryStatus) => void;
    private readonly MEMORY_WARNING_THRESHOLD = 80; // percent
    private readonly MEMORY_CRITICAL_THRESHOLD = 90; // percent

    /**
     * Get current device information
     */
    getDeviceInfo(): DeviceInfo {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;

        const deviceInfo: DeviceInfo = {
            platform: os.platform(),
            arch: os.arch(),
            cpuCores: os.cpus().length,
            totalMemory,
            freeMemory,
            memoryUsagePercent,
            gpuAvailable: this.checkGPUAvailability(),
            gpuMemory: this.getGPUMemory(),
            deviceClass: this.classifyDevice(totalMemory, os.cpus().length)
        };

        this.lastDeviceInfo = deviceInfo;
        return deviceInfo;
    }

    /**
     * Check if GPU is available (basic check)
     */
    private checkGPUAvailability(): boolean {
        // In Node.js, we can't directly check GPU availability
        // This would need native bindings like @nvidia/cuda or similar
        // For now, we check for environment hints
        return !!(
            process.env.CUDA_VISIBLE_DEVICES ||
            process.env.NVIDIA_VISIBLE_DEVICES ||
            process.env.GPU_AVAILABLE === 'true'
        );
    }

    /**
     * Get GPU memory (if available)
     */
    private getGPUMemory(): number | undefined {
        const gpuMem = process.env.GPU_MEMORY_MB;
        return gpuMem ? parseInt(gpuMem) * 1024 * 1024 : undefined;
    }

    /**
     * Classify device based on specs
     */
    private classifyDevice(totalMemory: number, cpuCores: number): 'low' | 'medium' | 'high' | 'ultra' {
        const memoryGB = totalMemory / (1024 ** 3);

        if (memoryGB >= 32 && cpuCores >= 16) return 'ultra';
        if (memoryGB >= 16 && cpuCores >= 8) return 'high';
        if (memoryGB >= 8 && cpuCores >= 4) return 'medium';
        return 'low';
    }

    /**
     * Get model recommendation based on device capabilities
     */
    getModelRecommendation(): ModelRecommendation {
        const device = this.getDeviceInfo();
        const memoryGB = device.totalMemory / (1024 ** 3);

        switch (device.deviceClass) {
            case 'ultra':
                return {
                    quantization: 'full',
                    maxContextLength: 128000,
                    maxBatchSize: 16,
                    useGPU: device.gpuAvailable,
                    useStreaming: true,
                    memoryLimit: device.totalMemory * 0.7,
                    suggestedModels: [
                        'gpt-4',
                        'claude-3-opus',
                        'llama-70b',
                        'mixtral-8x22b'
                    ]
                };

            case 'high':
                return {
                    quantization: '16bit',
                    maxContextLength: 32000,
                    maxBatchSize: 8,
                    useGPU: device.gpuAvailable,
                    useStreaming: true,
                    memoryLimit: device.totalMemory * 0.6,
                    suggestedModels: [
                        'gpt-4-turbo',
                        'claude-3-sonnet',
                        'llama-13b',
                        'mistral-7b'
                    ]
                };

            case 'medium':
                return {
                    quantization: '8bit',
                    maxContextLength: 8192,
                    maxBatchSize: 4,
                    useGPU: device.gpuAvailable,
                    useStreaming: true,
                    memoryLimit: device.totalMemory * 0.5,
                    suggestedModels: [
                        'gpt-3.5-turbo',
                        'claude-3-haiku',
                        'llama-7b-q8',
                        'phi-2'
                    ]
                };

            case 'low':
            default:
                return {
                    quantization: '4bit',
                    maxContextLength: 4096,
                    maxBatchSize: 1,
                    useGPU: false,
                    useStreaming: true,
                    memoryLimit: device.totalMemory * 0.4,
                    suggestedModels: [
                        'gpt-3.5-turbo',
                        'llama-7b-q4',
                        'tinyllama',
                        'phi-1.5'
                    ]
                };
        }
    }

    /**
     * Get current memory status
     */
    getMemoryStatus(): MemoryStatus {
        const memUsage = process.memoryUsage();
        const systemFree = os.freemem();
        const systemTotal = os.totalmem();
        const usagePercent = ((systemTotal - systemFree) / systemTotal) * 100;

        let status: 'healthy' | 'warning' | 'critical';
        if (usagePercent >= this.MEMORY_CRITICAL_THRESHOLD) {
            status = 'critical';
        } else if (usagePercent >= this.MEMORY_WARNING_THRESHOLD) {
            status = 'warning';
        } else {
            status = 'healthy';
        }

        return {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
            systemFree,
            systemTotal,
            usagePercent,
            status
        };
    }

    /**
     * Start memory monitoring
     */
    startMemoryMonitoring(
        intervalMs: number = 30000,
        onWarning?: (status: MemoryStatus) => void
    ): void {
        this.memoryWarningCallback = onWarning;

        this.memoryCheckInterval = setInterval(() => {
            const status = this.getMemoryStatus();

            if (status.status !== 'healthy') {
                logger.warn('Memory status alert', {
                    status: status.status,
                    usagePercent: status.usagePercent.toFixed(1)
                });

                if (this.memoryWarningCallback) {
                    this.memoryWarningCallback(status);
                }
            }
        }, intervalMs);

        logger.info('Memory monitoring started', { intervalMs });
    }

    /**
     * Stop memory monitoring
     */
    stopMemoryMonitoring(): void {
        if (this.memoryCheckInterval) {
            clearInterval(this.memoryCheckInterval);
            this.memoryCheckInterval = null;
            logger.info('Memory monitoring stopped');
        }
    }

    /**
     * Get optimal batch size for current memory state
     */
    getOptimalBatchSize(itemSizeBytes: number): number {
        const status = this.getMemoryStatus();
        const availableMemory = status.systemFree * 0.5; // Use 50% of free memory
        const maxItems = Math.floor(availableMemory / itemSizeBytes);

        return Math.max(1, Math.min(maxItems, 100)); // Between 1 and 100
    }

    /**
     * Check if operation is safe for current memory state
     */
    isSafeForOperation(requiredMemoryBytes: number): boolean {
        const status = this.getMemoryStatus();
        return status.systemFree > requiredMemoryBytes * 1.5; // 50% safety margin
    }

    /**
     * Force garbage collection if available
     */
    async requestGC(): Promise<void> {
        if (global.gc) {
            logger.info('Requesting garbage collection');
            global.gc();
        } else {
            logger.debug('GC not exposed - run with --expose-gc flag');
        }
    }

    /**
     * Get fallback model chain based on memory constraints
     */
    getFallbackChain(preferredModel: string): string[] {
        const recommendation = this.getModelRecommendation();
        const chains: Record<string, string[]> = {
            'gpt-4': ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
            'claude-3-opus': ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
            'llama-70b': ['llama-70b', 'llama-13b', 'llama-7b', 'tinyllama'],
            'mistral-large': ['mistral-large', 'mistral-medium', 'mistral-7b'],
            'default': recommendation.suggestedModels
        };

        return chains[preferredModel] || chains['default'];
    }

    /**
     * Get context length limit based on current memory
     */
    getContextLengthLimit(): number {
        const status = this.getMemoryStatus();
        const recommendation = this.getModelRecommendation();

        // Reduce context length under memory pressure
        if (status.status === 'critical') {
            return Math.floor(recommendation.maxContextLength * 0.25);
        }
        if (status.status === 'warning') {
            return Math.floor(recommendation.maxContextLength * 0.5);
        }

        return recommendation.maxContextLength;
    }

    /**
     * Format bytes to human-readable string
     */
    formatBytes(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let unitIndex = 0;
        let size = bytes;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * Get device summary for logging
     */
    getSummary(): string {
        const device = this.getDeviceInfo();
        const memory = this.getMemoryStatus();

        return `${device.platform}/${device.arch} | ${device.cpuCores} cores | ${this.formatBytes(device.totalMemory)} RAM | ${device.deviceClass.toUpperCase()} class | Memory: ${memory.usagePercent.toFixed(1)}% (${memory.status})`;
    }
}

// Singleton instance
let instance: DeviceAdapter | null = null;

export function getDeviceAdapter(): DeviceAdapter {
    if (!instance) {
        instance = new DeviceAdapter();
    }
    return instance;
}

export default DeviceAdapter;
