import { ChatRequestDto } from '../../types/chat';
import { ReaService } from './ReaService';
import { ReaJob } from './ReaJobs';

export const isReaCommand = (message: string) => /^\/rea(?:\s|$)/i.test(message.trimStart());

export function formatReaJob(job: ReaJob): string {
  const lines = [`REA analysis ${job.id}: ${job.status}.`, `Target: ${job.target}. Operation: ${job.operation}.`];
  if (job.error) lines.push(job.error);
  if (job.status === 'completed') {
    for (const step of job.steps || []) {
      if (!step.evidenceId) continue;
      lines.push(`Evidence ${step.evidenceId} (${step.tool}):`,
        JSON.stringify(step.result, null, 2).slice(0, 6000));
    }
    lines.push('Download the complete evidence bundle from the REA panel. Static observations do not establish runtime behavior or safety.');
  } else if (['queued', 'running'].includes(job.status)) lines.push(`Use /rea result ${job.id} to check the result, or open the REA panel.`);
  if (job.input?.limitations.length) lines.push(...job.input.limitations);
  return lines.join('\n\n');
}

/** Deterministic commands keep local analysis independent of a model's tool-calling support. */
export async function handleReaChat(service: ReaService, request: ChatRequestDto): Promise<any | undefined> {
  if (!isReaCommand(request.message)) return undefined;
  const command = request.message.trimStart().replace(/^\/rea\s*/i, '').trim();
  let response: string;
  try {
    if (!request.userId) throw new Error('Sign in locally before using REA.');
    if (command === 'status') response = JSON.stringify(service.status(), null, 2);
    else if (/^result\s+/i.test(command)) response = formatReaJob(service.get(command.replace(/^result\s+/i, '').trim(), request.userId));
    else if (/^cancel\s+/i.test(command)) response = formatReaJob(service.cancel(command.replace(/^cancel\s+/i, '').trim(), request.userId));
    else if (/^(?:analyze|inspect)\s+/i.test(command)) {
      const target = command.replace(/^(?:analyze|inspect)\s+/i, '').replace(/^"([\s\S]*)"$/, '$1');
      response = formatReaJob(service.start(request.userId, target));
    } else response = 'REA commands: /rea status; /rea analyze "local path"; /rea result <analysis-id>; /rea cancel <analysis-id>. Open the REA panel to upload an artifact or select an analysis type.';
  } catch (error: any) { response = `REA: ${error.message}`; }
  return { response, model: 'rea-local', confidence: 1, toolsUsed: ['rea'], sourcesDrawerData: [], warnings: [] };
}
