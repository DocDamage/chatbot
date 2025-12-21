/**
 * Unit tests for ToolRegistry
 */

import { ToolRegistry } from '../../../core/tools/ToolRegistry';
import { Tool } from '../../../types/tools';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('should register a tool', () => {
    const tool: Tool = {
      id: 'test-tool',
      name: 'Test Tool',
      description: 'A test tool',
      category: 'utility',
      execute: jest.fn().mockResolvedValue({ success: true }),
    };

    registry.register(tool);
    const registered = registry.get('test-tool');
    expect(registered).toBe(tool);
  });

  it('should get all registered tools', () => {
    const tool1: Tool = {
      id: 'tool1',
      name: 'Tool 1',
      description: 'First tool',
      category: 'utility',
      execute: jest.fn(),
    };
    const tool2: Tool = {
      id: 'tool2',
      name: 'Tool 2',
      description: 'Second tool',
      category: 'utility',
      execute: jest.fn(),
    };

    registry.register(tool1);
    registry.register(tool2);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(tool1);
    expect(all).toContain(tool2);
  });

  it('should return undefined for non-existent tool', () => {
    const tool = registry.get('non-existent');
    expect(tool).toBeUndefined();
  });

  it('should provide statistics', () => {
    const tool: Tool = {
      id: 'test-tool',
      name: 'Test Tool',
      description: 'A test tool',
      category: 'utility',
      execute: jest.fn(),
    };

    registry.register(tool);
    const stats = registry.getStats();
    expect(stats.totalTools).toBe(1);
  });
});

