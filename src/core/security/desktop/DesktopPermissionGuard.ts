export type DesktopMicroPermission = 'microphone.capture' | 'screen.capture' | 'clipboard.read' | 'clipboard.write' | 'global.hotkey';

export interface DesktopConsentRecord {
  permission: DesktopMicroPermission;
  grantedAt: string;
  expiresAt: string;
  isActive: boolean;
  granteePurpose: string;
}

export class DesktopPermissionGuard {
  private activeConsents = new Map<DesktopMicroPermission, DesktopConsentRecord>();

  private static readonly CLIPBOARD_SECRET_PATTERNS = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /ghp_[a-zA-Z0-9]{36}/,
    /sk-[a-zA-Z0-9]{20,}/,
    /ey[a-zA-Z0-9_-]{20,}\.ey[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/ // JWT
  ];

  public requestPermission(
    permission: DesktopMicroPermission,
    purpose: string,
    ttlMinutes: number = 30
  ): DesktopConsentRecord {
    const record: DesktopConsentRecord = {
      permission,
      grantedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlMinutes * 60000).toISOString(),
      isActive: true,
      granteePurpose: purpose
    };
    this.activeConsents.set(permission, record);
    return record;
  }

  public revokePermission(permission: DesktopMicroPermission): boolean {
    const record = this.activeConsents.get(permission);
    if (!record) return false;
    record.isActive = false;
    this.activeConsents.delete(permission);
    return true;
  }

  public isPermissionActive(permission: DesktopMicroPermission): boolean {
    const record = this.activeConsents.get(permission);
    if (!record || !record.isActive) return false;
    if (Date.now() > new Date(record.expiresAt).getTime()) {
      record.isActive = false;
      this.activeConsents.delete(permission);
      return false;
    }
    return true;
  }

  public inspectClipboardContent(content: string): { containsSecret: boolean; warning?: string } {
    for (const pattern of DesktopPermissionGuard.CLIPBOARD_SECRET_PATTERNS) {
      if (pattern.test(content)) {
        return {
          containsSecret: true,
          warning: 'Warning: Clipboard appears to contain a cryptographic private key, access token, or API secret. Automatic ingestion is blocked.'
        };
      }
    }
    return { containsSecret: false };
  }
}
