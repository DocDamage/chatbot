import { describe, expect, it, jest } from '@jest/globals';
import { Agent, AgentTeam, TeamFactory } from '../AgentTeam';

describe('RT-AGENT-001: Agent Team Coordination and Synthesis Suite', () => {
  it('initializes agent, handles tools, and processes requests via LLM adapter', async () => {
    const agent = new Agent({
      id: 'coder',
      name: 'Coder Agent',
      role: 'Software Engineer',
      capabilities: ['typescript', 'node']
    });

    expect(agent.canHandle(['typescript'])).toBe(true);
    expect(agent.canHandle(['python'])).toBe(false);

    // Throws if no adapter
    await expect(agent.process('Write code')).rejects.toThrow('no LLM adapter configured');

    // Add tool
    agent.addTool('calculator', { run: () => 42 });

    // Set adapter and process with context
    const mockAdapter = {
      process: (jest.fn() as any).mockResolvedValue({ content: 'Code written successfully' })
    };
    agent.setLLMAdapter(mockAdapter);

    const res = await agent.process({ task: 'build' }, { project: 'chatbot' });
    expect(res).toBe('Code written successfully');
    expect(mockAdapter.process).toHaveBeenCalledWith(expect.objectContaining({
      maxTokens: 1000,
      temperature: 0.7
    }));
  });

  it('coordinates task decomposition, specialist execution, and synthesis', async () => {
    const team = new AgentTeam('Test Dev Team');
    const mockAdapter = {
      process: (jest.fn() as any).mockImplementation(async (params: any) => {
        const userMsg = params.messages.find((m: any) => m.role === 'user')?.content || '';

        if (userMsg.includes('Break down this task')) {
          return {
            content: JSON.stringify([
              {
                type: 'architecture',
                description: 'Design architecture',
                priority: 1,
                dependencies: []
              },
              {
                type: 'coding',
                description: 'Write code',
                priority: 2,
                dependencies: [0]
              }
            ])
          };
        }

        if (userMsg.includes('synthesizing results')) {
          return { content: 'Final synthesized project report' };
        }

        if (userMsg.includes('Design architecture')) {
          return { content: 'Architecture designed' };
        }

        if (userMsg.includes('Write code')) {
          return { content: 'Code implemented' };
        }

        return { content: 'Generic result' };
      })
    };

    team.setLLMAdapter(mockAdapter);

    const architect = new Agent({
      id: 'architect',
      name: 'Architect',
      role: 'System Architect',
      capabilities: ['architecture']
    });
    const dev = new Agent({
      id: 'dev',
      name: 'Developer',
      role: 'Software Developer',
      capabilities: ['coding']
    });

    team.addSpecialist(architect);
    team.addSpecialist(dev);

    expect(team.getSpecialist('architect')).toBe(architect);
    expect(team.getStats().specialistCount).toBe(2);

    team.setSharedMemory('repo', 'chatbot');
    expect(team.getSharedMemory('repo')).toBe('chatbot');

    const result = await team.execute('Build full feature', { spec: 'v1' });
    expect(result.success).toBe(true);
    expect(result.tasks).toHaveLength(2);
    expect(result.output).toBe('Final synthesized project report');

    team.removeSpecialist('architect');
    expect(team.getSpecialist('architect')).toBeUndefined();
  });

  it('creates pre-configured research and coding teams via TeamFactory', () => {
    const mockAdapter = { process: jest.fn() };
    const researchTeam = TeamFactory.createResearchTeam(mockAdapter);
    expect(researchTeam.name).toBe('Research Team');
    expect(researchTeam.getStats().specialistCount).toBe(3);

    const codingTeam = TeamFactory.createCodingTeam(mockAdapter);
    expect(codingTeam.name).toBe('Coding Team');
    expect(codingTeam.getStats().specialistCount).toBe(3);
  });
});
