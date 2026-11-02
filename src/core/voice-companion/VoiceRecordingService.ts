/**
 * Voice Recording Service & Global Hotkeys (PX12-T04)
 *
 * Implements push-to-talk, tap-to-toggle state machine, hotkey configurations,
 * audio input device selection, maximum duration safeguards, and active state indicators.
 */

import {
  RecordingState,
  HotkeyConfig,
  AudioInputDevice
} from './VoiceCompanionTypes';

export interface AudioInputDeviceProvider {
  listInputDevices(): AudioInputDevice[];
}

export class VoiceRecordingService {
  private currentState: RecordingState = 'idle';
  private hotkeys: HotkeyConfig;
  private selectedDeviceId: string = 'default-mic';
  private maxRecordingDurationSec: number = 300; // 5 min default limit
  private recordingStartTime: number | null = null;
  private recordedChunks: Buffer[] = [];
  private readonly deviceProvider?: AudioInputDeviceProvider;

  constructor(customHotkeys?: Partial<HotkeyConfig>, deviceProvider?: AudioInputDeviceProvider) {
    this.deviceProvider = deviceProvider;
    this.hotkeys = {
      pushToTalkKey: 'Space+Alt',
      toggleRecordingKey: 'F8',
      summonPanelKey: 'Ctrl+Shift+Space',
      screenCaptureKey: 'Alt+Shift+S',
      clipboardActionKey: 'Ctrl+Shift+C',
      ...customHotkeys
    };
  }

  public getState(): RecordingState {
    return this.currentState;
  }

  public getHotkeys(): HotkeyConfig {
    return { ...this.hotkeys };
  }

  public setHotkeys(newHotkeys: Partial<HotkeyConfig>): { success: boolean; conflict?: string } {
    // Check for duplicate key assignments
    const keys = Object.values({ ...this.hotkeys, ...newHotkeys }).filter(Boolean);
    const seen = new Set<string>();
    for (const k of keys) {
      if (seen.has(k)) {
        return { success: false, conflict: `Hotkey conflict detected for key combination: ${k}` };
      }
      seen.add(k);
    }
    this.hotkeys = { ...this.hotkeys, ...newHotkeys };
    return { success: true };
  }

  public listInputDevices(): AudioInputDevice[] {
    return this.deviceProvider?.listInputDevices().map(device => ({ ...device })) || [];
  }

  public selectDevice(deviceId: string): void {
    const devices = this.listInputDevices();
    if (!devices.some(d => d.deviceId === deviceId)) {
      throw new Error(`Audio device ${deviceId} not found.`);
    }
    this.selectedDeviceId = deviceId;
  }

  public getSelectedDeviceId(): string {
    return this.selectedDeviceId;
  }

  /**
   * Start recording via Push-To-Talk
   */
  public startPushToTalk(): { state: RecordingState; message: string } {
    if (this.currentState !== 'idle') {
      throw new Error(`Cannot start push-to-talk in current state: ${this.currentState}`);
    }
    this.currentState = 'recording_ptt';
    this.recordingStartTime = Date.now();
    this.recordedChunks = [];
    return { state: this.currentState, message: 'Push-to-talk recording active.' };
  }

  /**
   * Release Push-To-Talk
   */
  public stopPushToTalk(): Buffer {
    if (this.currentState !== 'recording_ptt') {
      throw new Error('Not currently recording via push-to-talk.');
    }
    this.currentState = 'idle';
    const finalBuffer = Buffer.concat(this.recordedChunks);
    this.recordedChunks = [];
    this.recordingStartTime = null;
    return finalBuffer;
  }

  /**
   * Toggle recording state (tap-to-toggle)
   */
  public toggleRecording(): { state: RecordingState; recordedBuffer?: Buffer } {
    if (this.currentState === 'idle') {
      this.currentState = 'recording_toggle';
      this.recordingStartTime = Date.now();
      this.recordedChunks = [];
      return { state: this.currentState };
    } else if (this.currentState === 'recording_toggle') {
      this.currentState = 'idle';
      const buffer = Buffer.concat(this.recordedChunks);
      this.recordedChunks = [];
      this.recordingStartTime = null;
      return { state: 'idle', recordedBuffer: buffer };
    } else {
      throw new Error(`Cannot toggle recording from state: ${this.currentState}`);
    }
  }

  /**
   * Feed incoming PCM audio chunk
   */
  public feedAudioChunk(chunk: Buffer): void {
    if (this.currentState !== 'recording_ptt' && this.currentState !== 'recording_toggle') {
      return; // Ignore audio chunks if not actively recording
    }

    // Safeguard max duration
    if (this.recordingStartTime) {
      const elapsedSec = (Date.now() - this.recordingStartTime) / 1000;
      if (elapsedSec >= this.maxRecordingDurationSec) {
        this.currentState = 'idle';
        throw new Error(`Maximum recording duration of ${this.maxRecordingDurationSec}s exceeded.`);
      }
    }

    this.recordedChunks.push(chunk);
  }

  /**
   * Cancel and discard current recording
   */
  public cancelRecording(): void {
    this.currentState = 'idle';
    this.recordedChunks = [];
    this.recordingStartTime = null;
  }
}
