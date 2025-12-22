/**
 * Agent Team - Multi-agent coordination for complex tasks
 * Reference: awesome-llm-apps multi-agent patterns
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../observability/logger';

export interface AgentConfig {
    id: string;
    name: string;
    role: string;
    capabilities: string[];
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
}

export interface Task {
    id: string;
    type: string;
    description: string;
    input: any;
    priority: number;
    dependencies: string[];
    assignedAgent?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    result?: any;
    error?: string;
}

export interface AgentMessage {
    from: string;
    to: string;
    type: 'request' | 'response' | 'broadcast' | 'error';
    content: any;
    timestamp: number;
}

export interface TeamResult {
    success: boolean;
    output: any;
    tasks: Task[];
    messages: AgentMessage[];
    duration: number;
}

export class Agent {
    public config: AgentConfig;
    private llmAdapter: any = null;
    private tools: Map<string, any> = new Map();

    constructor(config: AgentConfig) {
        this.config = config;
    }

    setLLMAdapter(adapter: any): void {
        this.llmAdapter = adapter;
    }

    addTool(name: string, tool: any): void {
        this.tools.set(name, tool);
    }

    async process(input: any, context?: any): Promise<any> {
        if (!this.llmAdapter) {
            throw new Error(`Agent ${this.config.name} has no LLM adapter configured`);
        }

        const messages = [
            {
                role: 'system',
                content: this.config.systemPrompt || `You are ${this.config.name}, a ${this.config.role}.
Your capabilities: ${this.config.capabilities.join(', ')}`
            },
            {
                role: 'user',
                content: typeof input === 'string' ? input : JSON.stringify(input)
            }
        ];

        if (context) {
            messages.splice(1, 0, {
                role: 'system',
                content: `Context: ${JSON.stringify(context)}`
            });
        }

        try {
            const response = await this.llmAdapter.process({
                messages,
                maxTokens: this.config.maxTokens || 1000,
                temperature: this.config.temperature || 0.7
            });

            return response.content;
        } catch (error: any) {
            logger.error(`Agent ${this.config.name} processing failed`, { error: error.message });
            throw error;
        }
    }

    canHandle(capabilities: string[]): boolean {
        return capabilities.some(cap =>
            this.config.capabilities.some(agentCap =>
                agentCap.toLowerCase().includes(cap.toLowerCase())
            )
        );
    }
}

export class AgentTeam {
    public name: string;
    private coordinator: Agent;
    private specialists: Map<string, Agent> = new Map();
    private sharedMemory: Map<string, any> = new Map();
    private messages: AgentMessage[] = [];
    private llmAdapter: any = null;

    constructor(name: string, coordinatorConfig?: Partial<AgentConfig>) {
        this.name = name;
        this.coordinator = new Agent({
            id: 'coordinator',
            name: 'Coordinator',
            role: 'Task coordinator and synthesizer',
            capabilities: ['planning', 'coordination', 'synthesis'],
            ...coordinatorConfig
        });
    }

    setLLMAdapter(adapter: any): void {
        this.llmAdapter = adapter;
        this.coordinator.setLLMAdapter(adapter);
        for (const agent of this.specialists.values()) {
            agent.setLLMAdapter(adapter);
        }
    }

    addSpecialist(agent: Agent): void {
        if (this.llmAdapter) {
            agent.setLLMAdapter(this.llmAdapter);
        }
        this.specialists.set(agent.config.id, agent);
        logger.info('Added specialist to team', {
            team: this.name,
            agent: agent.config.name,
            capabilities: agent.config.capabilities
        });
    }

    removeSpecialist(agentId: string): void {
        this.specialists.delete(agentId);
    }

    getSpecialist(agentId: string): Agent | undefined {
        return this.specialists.get(agentId);
    }

    /**
     * Execute a complex task using the agent team
     */
    async execute(taskDescription: string, input: any): Promise<TeamResult> {
        const startTime = Date.now();
        const tasks: Task[] = [];

        logger.info('Team execution started', {
            team: this.name,
            task: taskDescription.substring(0, 50)
        });

        try {
            // Step 1: Coordinator decomposes the task
            const subtasks = await this.decomposTask(taskDescription, input);
            tasks.push(...subtasks);

            // Step 2: Assign tasks to specialists
            const assignments = this.assignTasks(subtasks);

            // Step 3: Execute tasks in dependency order
            const results = await this.executeTasks(assignments);

            // Step 4: Coordinator synthesizes results
            const output = await this.synthesizeResults(taskDescription, results);

            return {
                success: true,
                output,
                tasks,
                messages: this.messages,
                duration: Date.now() - startTime
            };
        } catch (error: any) {
            logger.error('Team execution failed', {
                team: this.name,
                error: error.message
            });

            return {
                success: false,
                output: null,
                tasks,
                messages: this.messages,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Decompose a complex task into subtasks
     */
    private async decomposTask(description: string, input: any): Promise<Task[]> {
        const availableCapabilities = Array.from(this.specialists.values())
            .flatMap(a => a.config.capabilities);

        const prompt = `You are a task coordinator. Break down this task into subtasks that can be assigned to specialists.

Available specialist capabilities: ${[...new Set(availableCapabilities)].join(', ')}

Task: ${description}
Input: ${JSON.stringify(input)}

Respond with a JSON array of subtasks, each with:
- type: capability needed
- description: what to do
- priority: 1 (highest) to 5 (lowest)
- dependencies: array of task indices this depends on (empty if none)

Example:
[
  {"type": "research", "description": "Research topic X", "priority": 1, "dependencies": []},
  {"type": "analysis", "description": "Analyze research findings", "priority": 2, "dependencies": [0]}
]

Respond with ONLY the JSON array:`;

        try {
            const response = await this.coordinator.process(prompt);

            // Parse JSON from response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON array found in response');
            }

            const subtaskDefs = JSON.parse(jsonMatch[0]);

            return subtaskDefs.map((def: any, index: number) => ({
                id: `task-${index}`,
                type: def.type,
                description: def.description,
                input: input,
                priority: def.priority || 3,
                dependencies: (def.dependencies || []).map((d: number) => `task-${d}`),
                status: 'pending' as const
            }));
        } catch (error: any) {
            logger.warn('Task decomposition failed, using single task', { error: error.message });

            // Fallback: single task
            return [{
                id: 'task-0',
                type: 'general',
                description: description,
                input: input,
                priority: 1,
                dependencies: [],
                status: 'pending'
            }];
        }
    }

    /**
     * Assign tasks to appropriate specialists
     */
    private assignTasks(tasks: Task[]): Map<string, Task[]> {
        const assignments = new Map<string, Task[]>();

        for (const task of tasks) {
            // Find best matching specialist
            let bestAgent: Agent | null = null;
            let bestScore = 0;

            for (const agent of this.specialists.values()) {
                if (agent.canHandle([task.type])) {
                    const score = this.calculateAgentFit(agent, task);
                    if (score > bestScore) {
                        bestScore = score;
                        bestAgent = agent;
                    }
                }
            }

            // If no specialist found, assign to coordinator
            const agentId = bestAgent?.config.id || 'coordinator';
            task.assignedAgent = agentId;

            if (!assignments.has(agentId)) {
                assignments.set(agentId, []);
            }
            assignments.get(agentId)!.push(task);

            this.sendMessage('coordinator', agentId, 'request', {
                action: 'assign_task',
                task
            });
        }

        return assignments;
    }

    /**
     * Calculate how well an agent fits a task
     */
    private calculateAgentFit(agent: Agent, task: Task): number {
        const capMatch = agent.config.capabilities.filter(cap =>
            task.type.toLowerCase().includes(cap.toLowerCase()) ||
            task.description.toLowerCase().includes(cap.toLowerCase())
        ).length;

        return capMatch / (agent.config.capabilities.length || 1);
    }

    /**
     * Execute tasks respecting dependencies
     */
    private async executeTasks(assignments: Map<string, Task[]>): Promise<Map<string, any>> {
        const results = new Map<string, any>();
        const completed = new Set<string>();
        const allTasks = Array.from(assignments.values()).flat();

        // Sort by priority
        allTasks.sort((a, b) => a.priority - b.priority);

        while (completed.size < allTasks.length) {
            // Find tasks ready to execute (dependencies met)
            const ready = allTasks.filter(t =>
                !completed.has(t.id) &&
                t.dependencies.every(dep => completed.has(dep))
            );

            if (ready.length === 0 && completed.size < allTasks.length) {
                logger.error('Circular dependency detected');
                break;
            }

            // Execute ready tasks in parallel
            await Promise.all(ready.map(async task => {
                task.status = 'in_progress';

                try {
                    const agent = task.assignedAgent === 'coordinator'
                        ? this.coordinator
                        : this.specialists.get(task.assignedAgent!);

                    if (!agent) {
                        throw new Error(`No agent found for task ${task.id}`);
                    }

                    // Gather results from dependencies
                    const dependencyResults = task.dependencies.map(dep => ({
                        taskId: dep,
                        result: results.get(dep)
                    }));

                    // Execute task
                    const result = await agent.process(task.description, {
                        input: task.input,
                        dependencies: dependencyResults
                    });

                    task.result = result;
                    task.status = 'completed';
                    results.set(task.id, result);
                    completed.add(task.id);

                    this.sendMessage(agent.config.id, 'coordinator', 'response', {
                        taskId: task.id,
                        success: true,
                        result
                    });
                } catch (error: any) {
                    task.status = 'failed';
                    task.error = error.message;
                    completed.add(task.id);
                    results.set(task.id, { error: error.message });

                    this.sendMessage(task.assignedAgent || 'unknown', 'coordinator', 'error', {
                        taskId: task.id,
                        error: error.message
                    });
                }
            }));
        }

        return results;
    }

    /**
     * Synthesize results from all tasks
     */
    private async synthesizeResults(
        originalTask: string,
        results: Map<string, any>
    ): Promise<any> {
        const resultSummary = Array.from(results.entries())
            .map(([id, result]) => `${id}: ${typeof result === 'string' ? result.substring(0, 500) : JSON.stringify(result).substring(0, 500)}`)
            .join('\n\n');

        const prompt = `You are synthesizing results from multiple specialists to complete this task:

Original task: ${originalTask}

Results from specialists:
${resultSummary}

Synthesize these results into a coherent, comprehensive response:`;

        try {
            return await this.coordinator.process(prompt);
        } catch (error) {
            // Fallback: return raw results
            return Object.fromEntries(results);
        }
    }

    /**
     * Send a message between agents
     */
    private sendMessage(from: string, to: string, type: AgentMessage['type'], content: any): void {
        const message: AgentMessage = {
            from,
            to,
            type,
            content,
            timestamp: Date.now()
        };
        this.messages.push(message);
    }

    /**
     * Store data in shared memory
     */
    setSharedMemory(key: string, value: any): void {
        this.sharedMemory.set(key, value);
    }

    /**
     * Retrieve data from shared memory
     */
    getSharedMemory(key: string): any {
        return this.sharedMemory.get(key);
    }

    /**
     * Get team statistics
     */
    getStats(): {
        teamName: string;
        specialistCount: number;
        capabilities: string[];
    } {
        const allCapabilities = Array.from(this.specialists.values())
            .flatMap(a => a.config.capabilities);

        return {
            teamName: this.name,
            specialistCount: this.specialists.size,
            capabilities: [...new Set(allCapabilities)]
        };
    }
}

/**
 * Create a pre-configured agent team for specific domains
 */
export class TeamFactory {
    static createResearchTeam(llmAdapter?: any): AgentTeam {
        const team = new AgentTeam('Research Team');

        team.addSpecialist(new Agent({
            id: 'researcher',
            name: 'Researcher',
            role: 'Information gathering specialist',
            capabilities: ['research', 'search', 'fact-finding'],
            systemPrompt: 'You are an expert researcher. Find accurate, relevant information.'
        }));

        team.addSpecialist(new Agent({
            id: 'analyst',
            name: 'Analyst',
            role: 'Data analysis specialist',
            capabilities: ['analysis', 'comparison', 'evaluation'],
            systemPrompt: 'You are a data analyst. Analyze information objectively.'
        }));

        team.addSpecialist(new Agent({
            id: 'writer',
            name: 'Writer',
            role: 'Content creation specialist',
            capabilities: ['writing', 'summarization', 'documentation'],
            systemPrompt: 'You are a professional writer. Create clear, concise content.'
        }));

        if (llmAdapter) {
            team.setLLMAdapter(llmAdapter);
        }

        return team;
    }

    static createCodingTeam(llmAdapter?: any): AgentTeam {
        const team = new AgentTeam('Coding Team');

        team.addSpecialist(new Agent({
            id: 'architect',
            name: 'Architect',
            role: 'System design specialist',
            capabilities: ['architecture', 'design', 'planning'],
            systemPrompt: 'You are a software architect. Design scalable, maintainable systems.'
        }));

        team.addSpecialist(new Agent({
            id: 'developer',
            name: 'Developer',
            role: 'Implementation specialist',
            capabilities: ['coding', 'implementation', 'development'],
            systemPrompt: 'You are an expert developer. Write clean, efficient code.'
        }));

        team.addSpecialist(new Agent({
            id: 'reviewer',
            name: 'Reviewer',
            role: 'Code review specialist',
            capabilities: ['review', 'testing', 'quality'],
            systemPrompt: 'You are a code reviewer. Ensure quality and best practices.'
        }));

        if (llmAdapter) {
            team.setLLMAdapter(llmAdapter);
        }

        return team;
    }
}

export default AgentTeam;
