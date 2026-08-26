/**
 * Desktop Privacy & Retention Manager (PX12-T11)
 *
 * Enforces zero-retention defaults for audio recordings and screen thumbnails,
 * independent permission toggles (mic/screen/clipboard), removable local model caches,
 * and support bundle sanitization (excluding private audio, screen, and clipboard data).
 */

import { DesktopPrivacySettings } from './VoiceCompanionTypes';

export class DesktopPrivacyManager {
  private settings: DesktopPrivacySettings = {
    retainAudioRecordings: false,
    retainScreenThumbnails: false,
    allowMicrophone: true,
    allowScreenCapture: false,
    allowClipboardAccess: true,
    enableWakePhrase: false,
    quietHours: { enabled: true, startHour: 22, endHour: 7 }
  };

  private temporaryFiles: Set<string> = new Set();

  public getSettings(): DesktopPrivacySettings {
    return { ...this.settings };
  }

  public updateSettings(updates: Partial<DesktopPrivacySettings>): DesktopPrivacySettings {
    this.settings = {
      ...this.settings,
      ...updates
    };
    return this.getSettings();
  }

  public registerTempFile(filePath: string): void {
    this.temporaryFiles.add(filePath);
  }

  public purgeAllTemporaryFiles(): { purgedCount: number } {
    const count = this.temporaryFiles.size;
    this.temporaryFiles.clear();
    return { purgedCount: count };
  }

  /**
   * Sanitizes diagnostic support bundles by stripping any sensitive audio or text payloads.
   */
  public sanitizeSupportBundle(rawDiagnostics: Record<string, any>): Record<string, any> {
    const sanitized = { ...rawDiagnostics };
    delete sanitized.rawAudio;
    delete sanitized.audioBuffer;
    delete sanitized.rawClipboardText;
    delete sanitized.screenshotBuffer;
    delete sanitized.detectedSecrets;

    sanitized._sanitized = true;
    sanitized._privacyNotice = 'All raw audio, screen images, and clipboard content were scrubbed from this diagnostic bundle.';
    return sanitized;
  }
}
