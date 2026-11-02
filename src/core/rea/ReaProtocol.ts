import fs from 'fs';
import path from 'path';
import { McpClientService } from '../mcp/McpClientService';
import { ReaConfig, ReaError, ReaOperation } from './ReaConfig';

export interface ReaStep { tool: string; evidenceId?: string; result: any }

function errorMessage(text: string): string {
  try {
    const error = JSON.parse(text).error;
    if (error?.message) return [error.message, ...(error.details?.issues || []).map((issue: any) => issue.message), error.remediation?.action].filter(Boolean).join(' ');
  } catch { /* Non-JSON provider messages remain readable. */ }
  return text;
}

export function selectOperation(target: string, requested: ReaOperation): Exclude<ReaOperation, 'auto'> {
  if (requested !== 'auto') return requested;
  if (fs.statSync(target).isDirectory() || /\.(?:[cm]?js|jsx|tsx?|asar)$/i.test(target)) return 'javascript';
  if (/\.(?:zip|apk|ipa|msix|appx|jar|nupkg|pck)$/i.test(target)) return 'archive';
  if (/\.(?:gguf|safetensors)$/i.test(target)) return 'model';
  if (/\.(?:exe|dll|sys)$/i.test(target)) return 'pe';
  return 'native';
}

/** Only these explicit static workflows are exposed, never arbitrary REA tool dispatch. */
export async function runRea(config: ReaConfig, target: string, operation: ReaOperation, root: string,
  onClient: (client: McpClientService) => void, createClient = () => new McpClientService(), procedure?: string): Promise<ReaStep[]> {
  const client = createClient();
  onClient(client);
  let opened = false;
  const steps: ReaStep[] = [];
  try {
    const connection = await client.connectServer({
      id: 'rea', command: config.node, args: [config.entry, 'mcp'], cwd: root, framing: 'jsonl',
      timeoutMs: config.timeoutMs, maxMessageBytes: 32 * 1024 * 1024,
      killProcessTree: true,
      env: { REA_MCP_INPUT_SCHEMA_PROFILE: 'compact', REA_MCP_OUTPUT_SCHEMA_PROFILE: 'off' },
    });
    if (!connection.connected) throw new ReaError(connection.message, 503, 'REA_UNAVAILABLE');
    const tools = new Set((await client.listTools()).map(tool => tool.name));
    const call = async (tool: string, args: Record<string, unknown>) => {
      if (!tools.has(tool)) throw new ReaError(`The installed REA server does not advertise ${tool}.`, 503, 'REA_TOOL_UNAVAILABLE');
      const response = await client.callTool(tool, args);
      if (!response.ok || response.dryRun || response.result?.isError) {
        const content = response.result?.content?.find((item: any) => item.type === 'text')?.text;
        throw new ReaError(errorMessage(response.error || content || `REA ${tool} failed.`), 502, 'REA_ANALYSIS_FAILED');
      }
      const result = response.result?.structuredContent || response.result;
      if (result?.error) throw new ReaError(JSON.stringify(result.error), 502, 'REA_ANALYSIS_FAILED');
      steps.push({ tool, evidenceId: result?.evidence_id, result: result?.evidence_id ? {
        normalized_result: result.normalized_result, confidence: result.confidence,
        authority: result.authority, limitations: result.limitations,
      } : result });
      return result;
    };
    const selected = selectOperation(target, operation);
    if (selected === 'javascript') {
      // REA accepts ASARs and directories. A standalone source file is already isolated in input/.
      const input = fs.statSync(target).isDirectory() || /\.asar$/i.test(target) ? target : path.dirname(target);
      await call('analyze_javascript_application', { input_path: input, detail: 'summary' });
    }
    else if (selected === 'managed') await call('inspect_managed_artifact', { path: target, detail: 'summary' });
    else if (selected === 'model') await call('inspect_model_artifact', { path: target, detail: 'summary' });
    else if (selected === 'pe') {
      await call('inspect_pe_imports', { path: target });
      await call('inspect_pe_resources', { path: target });
    } else {
      await call('open_binary', { path: target });
      opened = true;
      if (selected === 'archive') await call('inspect_artifact', { detail: 'summary' });
      else {
        await call('binary_overview', {});
        if (!procedure) await call('list_procedures', { detail: 'summary' });
        if (procedure) await call('analyze_function', { procedure, detail: 'summary' });
      }
    }
    await call('export_evidence_bundle', { path: path.join(root, 'evidence.json') });
    return steps;
  } catch (error: any) {
    // Preserve already-observed evidence even if a later requested analysis fails.
    if (steps.some(step => step.evidenceId) && client.healthCheck().connected) {
      const exported = await client.callTool('export_evidence_bundle', { path: path.join(root, 'evidence.json') });
      if (exported.ok && !exported.dryRun && !exported.result?.isError) error.steps = steps;
    }
    throw error;
  } finally {
    if (opened) await client.callTool('close_binary', {}).catch(() => undefined);
    client.disconnect();
  }
}
