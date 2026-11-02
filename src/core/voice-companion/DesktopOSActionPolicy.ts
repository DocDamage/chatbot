/**
 * Desktop OS Action Policy & Sandbox Guardrails (PX12-T10)
 *
 * Implements a strict default-deny gatekeeper for OS-level actions.
 * Only a narrow set of explicitly allowlisted actions (open chatbot, paste approved text,
 * show notification, open approved URL) are permitted.
 * Arbitrary process execution, file deletion, system shutdown, or power actions fail closed.
 */

import crypto from 'node:crypto';
import { DesktopOSAction } from './VoiceCompanionTypes';

export class DesktopOSActionPolicy {
  private allowedActionTypes = new Set([
    'open_chatbot',
    'paste_approved_text',
    'show_notification',
    'open_approved_url'
  ]);

  private approvedUrlSchemes = new Set(['http:', 'https:']);

  public validateAction(action: DesktopOSAction): { allowed: boolean; reason?: string } {
    if (!action || !action.type) {
      return { allowed: false, reason: 'Action definition is missing or invalid.' };
    }

    if (!this.allowedActionTypes.has(action.type)) {
      return {
        allowed: false,
        reason: `OS action "${action.type}" is not in the allowlist. Arbitrary system commands are strictly prohibited.`
      };
    }

    if (action.type === 'open_approved_url') {
      const urlStr = action.parameters?.url;
      if (!urlStr) {
        return { allowed: false, reason: 'URL parameter is missing.' };
      }
      try {
        const parsed = new URL(urlStr);
        if (!this.approvedUrlSchemes.has(parsed.protocol)) {
          return { allowed: false, reason: `URL protocol "${parsed.protocol}" is not permitted.` };
        }
      } catch {
        return { allowed: false, reason: 'Malformed URL provided.' };
      }
    }

    if (action.type === 'paste_approved_text') {
      const text = action.parameters?.text;
      if (text === undefined || text === null) {
        return { allowed: false, reason: 'Text parameter is required for paste action.' };
      }
    }

    // Verify cryptographic approval digest
    const expectedDigest = crypto
      .createHash('sha256')
      .update(`${action.actionId}:${action.type}:${JSON.stringify(action.parameters || {})}`)
      .digest('hex')
      .substring(0, 16);

    if (action.approvalDigest !== expectedDigest) {
      return {
        allowed: false,
        reason: 'Approval digest mismatch. Action parameters were tampered with after approval.'
      };
    }

    return { allowed: true };
  }

  public createAction(
    type: DesktopOSAction['type'],
    parameters: Record<string, any>
  ): DesktopOSAction {
    const actionId = `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const approvalDigest = crypto
      .createHash('sha256')
      .update(`${actionId}:${type}:${JSON.stringify(parameters || {})}`)
      .digest('hex')
      .substring(0, 16);

    return {
      actionId,
      type,
      parameters,
      approvalDigest
    };
  }
}
