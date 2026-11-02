import { CodingToolConfig, CodingToolError } from './CodingToolConfig';
import { withMcp } from './ToolProcess';

export class Context7Adapter {
  constructor(private readonly config: CodingToolConfig) {}
  async query(query: string, library: string, signal?: AbortSignal) {
    if (!query.trim() || query.length > 1500 || !library.trim() || library.length > 160) throw new CodingToolError('Supply a library and a documentation question (up to 1,500 characters).');
    const env = process.env.CONTEXT7_API_KEY ? { CONTEXT7_API_KEY: process.env.CONTEXT7_API_KEY } : undefined;
    return withMcp({ command: this.config.node, args: [this.config.context7], timeoutMs: Math.min(this.config.timeoutMs, 60000), env }, async call => {
      if (!library.startsWith('/')) return { provider: 'Context7', ...(await call('resolve-library-id', { libraryName: library, query })), lookup: true };
      return { provider: 'Context7', ...(await call('query-docs', { libraryId: library, query })), lookup: false,
        limitations: ['Documentation comes from Context7; verify the returned version and citations against the project dependency version.'] };
    }, signal);
  }
}
