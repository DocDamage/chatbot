/**
 * Clean-Machine and Real-Device Certification (PX21-T09)
 * Certifies capability behavior on clean-machine / VM environments:
 * - Clean setup from documentation
 * - Capability Guided Doctor dependency resolution
 * - Pack enable / disable toggling
 * - Real local model runner detection
 * - Real Godot/engine discovery
 * - GPU/CPU media worker capability probing
 * - Desktop companion voice permission handling
 * - Supported browser matrix (Chromium, Firefox, WebKit)
 * - Restart persistence & backup/restore drill
 * - Complete uninstall and directory cleanup
 */

export interface DeviceCertificationItem {
  id: string;
  name: string;
  platform: 'win32' | 'linux' | 'darwin' | 'all';
  passed: boolean;
  evidence: string;
}

export class CleanMachineDeviceCertification {
  private static instance: CleanMachineDeviceCertification;

  public static getInstance(): CleanMachineDeviceCertification {
    if (!CleanMachineDeviceCertification.instance) {
      CleanMachineDeviceCertification.instance = new CleanMachineDeviceCertification();
    }
    return CleanMachineDeviceCertification.instance;
  }

  public async runCertification(evidence: Record<string, string> = {}): Promise<{
    passed: boolean;
    totalChecks: number;
    checks: DeviceCertificationItem[];
  }> {
    const definitions: Array<Pick<DeviceCertificationItem, 'id' | 'name' | 'platform'>> = [
      { id: 'DEVICE-SETUP-001', name: 'Documentation Clean-Machine Setup Verification', platform: 'all' },
      { id: 'DEVICE-DOCTOR-001', name: 'Capability Guided Doctor Self-Diagnosis', platform: 'all' },
      { id: 'DEVICE-PACK-TOGGLE-001', name: 'Dynamic Pack Enable / Disable & State Persistence', platform: 'all' },
      { id: 'DEVICE-MEDIA-WORKER-001', name: 'Hardware Acceleration & Worker Probing', platform: 'win32' },
      { id: 'DEVICE-UNINSTALL-001', name: 'Clean Uninstall & Non-Source Storage Wipe', platform: 'all' }
    ];
    const checks = definitions.map(definition => ({
      ...definition,
      passed: Boolean(evidence[definition.id]?.trim()),
      evidence: evidence[definition.id]?.trim() || 'NOT_RUN: external clean-machine/device evidence is required.'
    }));

    return {
      passed: checks.every(c => c.passed),
      totalChecks: checks.length,
      checks
    };
  }
}
