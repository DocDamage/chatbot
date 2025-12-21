/**
 * Reasoning Engine - Advanced reasoning capabilities
 */

import { LLMAdapter } from '../providers/LLMAdapter';
import { logger } from '../observability/logger';

export interface ReasoningStep {
  step: number;
  thought: string;
  action: string;
  result?: any;
}

export interface ReasoningResult {
  answer: string;
  steps: ReasoningStep[];
  confidence: number;
  reasoningType: 'chain_of_thought' | 'tree_of_thought' | 'multi_agent';
}

export class ReasoningEngine {
  private llmAdapter: LLMAdapter;

  constructor(llmAdapter: LLMAdapter) {
    this.llmAdapter = llmAdapter;
  }

  /**
   * Chain of Thought reasoning
   */
  async chainOfThought(
    question: string,
    context?: string,
    maxSteps: number = 5
  ): Promise<ReasoningResult> {
    logger.info('Starting chain-of-thought reasoning', { question });

    const steps: ReasoningStep[] = [];
    let currentContext = context || '';
    let stepNumber = 1;

    while (stepNumber <= maxSteps) {
      const prompt = `You are solving a problem step by step. Current step: ${stepNumber}/${maxSteps}

Question: ${question}

${currentContext ? `Context so far:\n${currentContext}\n\n` : ''}

Think step by step:
1. What do I know?
2. What do I need to figure out?
3. What's my next step?
4. Execute that step
5. What did I learn?

Provide your reasoning for this step:`;

      const response = await this.llmAdapter.generate({
        prompt,
        systemPrompt: 'You are a logical reasoning system. Think step by step and show your work.',
        maxTokens: 500,
        temperature: 0.7,
      });

      const thought = response.content;
      steps.push({
        step: stepNumber,
        thought,
        action: 'reasoning',
      });

      currentContext += `\nStep ${stepNumber}: ${thought}`;

      // Check if we have an answer
      if (thought.toLowerCase().includes('answer:') || thought.toLowerCase().includes('conclusion:')) {
        break;
      }

      stepNumber++;
    }

    // Extract final answer
    const finalPrompt = `Based on the following reasoning steps, provide a clear, final answer.

Question: ${question}

Reasoning Steps:
${steps.map(s => `Step ${s.step}: ${s.thought}`).join('\n\n')}

Final Answer:`;

    const finalResponse = await this.llmAdapter.generate({
      prompt: finalPrompt,
      systemPrompt: 'Provide a clear, concise answer based on the reasoning steps.',
      maxTokens: 300,
      temperature: 0.5,
    });

    return {
      answer: finalResponse.content,
      steps,
      confidence: this.calculateConfidence(steps),
      reasoningType: 'chain_of_thought',
    };
  }

  /**
   * Multi-step reasoning with tool use
   */
  async multiStepReasoning(
    question: string,
    availableTools: string[] = [],
    maxSteps: number = 5
  ): Promise<ReasoningResult> {
    logger.info('Starting multi-step reasoning', { question, tools: availableTools.length });

    const steps: ReasoningStep[] = [];
    let currentState = { question, knownFacts: [] as string[] };

    for (let step = 1; step <= maxSteps; step++) {
      const prompt = `You are solving a complex problem. Current step: ${step}/${maxSteps}

Question: ${question}

Known facts so far:
${currentState.knownFacts.length > 0 ? currentState.knownFacts.join('\n') : 'None yet'}

${availableTools.length > 0 ? `Available tools: ${availableTools.join(', ')}` : ''}

What should you do next?
1. Analyze what you know
2. Identify what you need to find out
3. Choose an action (reason, use a tool, or conclude)
4. Execute the action

Your reasoning and action:`;

      const response = await this.llmAdapter.generate({
        prompt,
        systemPrompt: 'You are a problem-solving system. Think carefully and take logical steps.',
        maxTokens: 400,
        temperature: 0.6,
      });

      const thought = response.content;
      const action = this.extractAction(thought, availableTools);

      steps.push({
        step,
        thought,
        action: action.type,
        result: action.result,
      });

      // Update state
      if (action.result) {
        currentState.knownFacts.push(action.result);
      }

      // Check for conclusion
      if (action.type === 'conclude' || thought.toLowerCase().includes('answer:')) {
        break;
      }
    }

    // Generate final answer
    const answer = await this.generateAnswer(question, steps);

    return {
      answer,
      steps,
      confidence: this.calculateConfidence(steps),
      reasoningType: 'multi_agent',
    };
  }

  /**
   * Extract action from reasoning text
   */
  private extractAction(thought: string, availableTools: string[]): { type: string; result?: string } {
    const lower = thought.toLowerCase();

    // Check for tool usage
    for (const tool of availableTools) {
      if (lower.includes(`use ${tool}`) || lower.includes(`call ${tool}`)) {
        return { type: `use_tool:${tool}`, result: 'Tool would be called here' };
      }
    }

    // Check for conclusion
    if (lower.includes('conclude') || lower.includes('answer:')) {
      return { type: 'conclude', result: thought };
    }

    return { type: 'reason', result: thought };
  }

  /**
   * Generate final answer from steps
   */
  private async generateAnswer(question: string, steps: ReasoningStep[]): Promise<string> {
    const reasoning = steps.map(s => `Step ${s.step}: ${s.thought}`).join('\n\n');

    const response = await this.llmAdapter.generate({
      prompt: `Question: ${question}\n\nReasoning:\n${reasoning}\n\nBased on this reasoning, provide a clear answer:`,
      systemPrompt: 'Provide a clear, accurate answer based on the reasoning steps.',
      maxTokens: 300,
      temperature: 0.5,
    });

    return response.content;
  }

  /**
   * Calculate confidence based on reasoning quality
   */
  private calculateConfidence(steps: ReasoningStep[]): number {
    if (steps.length === 0) return 0;

    // More steps = more thorough reasoning
    const stepScore = Math.min(steps.length / 5, 1.0);

    // Check for logical progression
    const hasProgression = steps.length > 1 ? 0.2 : 0;

    // Base confidence
    const baseConfidence = 0.5;

    return Math.min(baseConfidence + stepScore * 0.3 + hasProgression, 1.0);
  }
}

