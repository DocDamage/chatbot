import { Context7Adapter } from './Context7Adapter';
import { CodingToolError, codingToolConfig } from './CodingToolConfig';
import { withMcp } from './ToolProcess';
jest.mock('./ToolProcess', () => ({ withMcp: jest.fn() }));

describe('Context7 cold startup recovery', () => {
  beforeEach(() => jest.resetAllMocks());
  it('retries one failed initialization and reports the recovery', async () => {
    const connect = jest.mocked(withMcp);
    connect.mockRejectedValueOnce(new CodingToolError('MCP request timed out: initialize', 503, 'CODING_TOOL_UNAVAILABLE'));
    connect.mockResolvedValueOnce({ provider: 'Context7', content: 'documented API' });
    const result = await new Context7Adapter(codingToolConfig()).query('node:test usage', '/nodejs/node');
    expect(result.startupRetries).toBe(1);
    expect(connect).toHaveBeenCalledTimes(2);
  });
  it('does not retry tool errors or hide a second initialization failure', async () => {
    const connect = jest.mocked(withMcp);
    connect.mockRejectedValue(new CodingToolError('Service rate limited', 502));
    await expect(new Context7Adapter(codingToolConfig()).query('node:test', '/nodejs/node')).rejects.toThrow('rate limited');
    expect(connect).toHaveBeenCalledTimes(1);
    connect.mockClear();
    connect.mockRejectedValue(new CodingToolError('MCP request timed out: initialize', 503, 'CODING_TOOL_UNAVAILABLE'));
    await expect(new Context7Adapter(codingToolConfig()).query('node:test', '/nodejs/node')).rejects.toThrow('timed out');
    expect(connect).toHaveBeenCalledTimes(2);
  });
});
