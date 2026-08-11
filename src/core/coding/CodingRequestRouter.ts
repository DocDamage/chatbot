import { normalizeWorkMode, WorkMode } from '../modes/ExecutionModePolicy';
import { CodePlanner } from '../agents/CodePlanner';
import { CodingIntent, EngineeringTask } from './types';

export class CodingRequestRouter {
  private readonly planner = new CodePlanner();
  route(message: string, mode?: string): EngineeringTask {
    const intent = this.planner.classifyIntent(message) as CodingIntent;
    const normalizedMode = normalizeWorkMode(mode);
    const paths = [...message.matchAll(/(?:^|\s)([\w./\\-]+\.(?:ts|tsx|js|jsx|py|go|rs|cs|java|kt|swift|svelte|css|html|sql|sh|ps1|gd|glsl|hlsl|wgsl|json|ya?ml|toml|xml|md))\b/gi)].map(match => match[1].replace(/\\/g, '/'));
    const symbols = [...message.matchAll(/\b(?:class|function|method|symbol|type|interface)\s+([A-Za-z_$][\w$]*)/gi)].map(match => match[1]);
    const languages = [...new Set(paths.map(file => file.split('.').pop()).filter(Boolean) as string[])];
    return { taskId: `coding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, intent, languages, frameworks: [], projectRoots: [], affectedFiles: paths, affectedSymbols: symbols, manifests: [], relatedTests: [], constraints: ['Preserve unrelated working-tree changes', 'Use repository-local build and test conventions'], acceptanceCriteria: [message], mode: normalizedMode as WorkMode };
  }
}
