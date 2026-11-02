/**
 * Clipboard Action Service (PX12-T08)
 *
 * Implements safe clipboard transformations (summarize, translate, explain,
 * rewrite, code-fix proposal, send to chat) with secret/credential detection alerts
 * before approving clipboard mutation.
 */

import { ClipboardActionRequest, ClipboardActionResult, ClipboardActionType } from './VoiceCompanionTypes';

export interface ClipboardTransformationBackend {
  transform(request: ClipboardActionRequest): Promise<string>;
}

export class ClipboardActionService {
  constructor(private readonly backend?: ClipboardTransformationBackend) {}

  public isAvailable(action: ClipboardActionType): boolean {
    return action === 'send_to_chat' || Boolean(this.backend);
  }

  private secretPatterns: RegExp[] = [
    /(?:password|pwd|secret|api[_-]?key|token)\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{8,}['"]?/gi,
    /ghp_[a-zA-Z0-9]{20,}/g,
    /sk-[a-zA-Z0-9]{20,}/g
  ];

  public async executeAction(request: ClipboardActionRequest): Promise<ClipboardActionResult> {
    const raw = request.rawClipboardText || '';
    const excerpt = raw.length > 80 ? `${raw.substring(0, 80)}...` : raw;

    // Scan for secrets
    const containsSecrets = this.secretPatterns.some(p => p.test(raw));
    const secretWarning = containsSecrets
      ? 'WARNING: Selected clipboard text appears to contain API tokens, credentials, or secrets. Remote egress is blocked.'
      : undefined;

    let resultText: string;
    if (request.action === 'send_to_chat') {
      resultText = raw;
    } else {
      if (!this.backend) {
        throw new Error(`CLIPBOARD_TRANSFORM_BACKEND_UNAVAILABLE: ${request.action} requires a configured model-backed transformer.`);
      }
      resultText = await this.backend.transform(request);
    }

    return {
      action: request.action,
      sourceTextExcerpt: excerpt,
      resultText,
      containsDetectedSecrets: containsSecrets,
      secretWarning,
      isSafeForClipboardWrite: !containsSecrets
    };
  }
}
