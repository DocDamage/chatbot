/**
 * Desktop Packaging & Installer Manifest (PX12-T12)
 *
 * Defines installer, update, rollback, and platform permission onboarding
 * specifications for the separate desktop voice companion application.
 */

export interface DesktopPlatformManifest {
  appId: string;
  appName: string;
  version: string;
  targetPlatform: 'windows_x64' | 'macos_universal' | 'linux_x64';
  executableName: string;
  installerType: 'nsis_exe' | 'msi' | 'dmg' | 'appimage';
  requiredPermissions: Array<{
    permission: 'microphone' | 'screen_capture' | 'clipboard' | 'notifications';
    description: string;
    isOptional: boolean;
    defaultState: boolean;
  }>;
  loopbackEndpoint: string;
  updateChannel: 'stable' | 'beta' | 'nightly';
  rollbackSupported: boolean;
  modelStorageDir: string;
}

export class DesktopPackagingManifest {
  public static getWindowsPackagingManifest(): DesktopPlatformManifest {
    return {
      appId: 'com.chatbot.desktop-voice-companion',
      appName: 'ChatBot Hub Desktop Voice Companion',
      version: '1.0.0',
      targetPlatform: 'windows_x64',
      executableName: 'chatbot-voice-companion.exe',
      installerType: 'nsis_exe',
      requiredPermissions: [
        {
          permission: 'microphone',
          description: 'Required for local voice recording, speech-to-text, and dictation.',
          isOptional: false,
          defaultState: true
        },
        {
          permission: 'notifications',
          description: 'Required for local daily briefings and reminder alerts.',
          isOptional: true,
          defaultState: true
        },
        {
          permission: 'clipboard',
          description: 'Used for explicit user-triggered clipboard summarize, translate, and paste actions.',
          isOptional: true,
          defaultState: true
        },
        {
          permission: 'screen_capture',
          description: 'Used only when the user explicitly triggers an on-demand screen region capture.',
          isOptional: true,
          defaultState: false
        }
      ],
      loopbackEndpoint: 'http://127.0.0.1:3000/api/desktop-companion',
      updateChannel: 'stable',
      rollbackSupported: true,
      modelStorageDir: '%LOCALAPPDATA%/ChatBotHub/models'
    };
  }
}
