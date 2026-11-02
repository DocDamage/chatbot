import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProfileManager } from '../ProfileManager';

describe('RT-PLAT-001 / RT-CONF-003: ProfileManager Lifecycle, Presets, and Persistence Suite', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-mgr-test-'));
    configPath = path.join(tempDir, 'profiles.json');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('creates, retrieves, updates, clones, and deletes profiles with persistence', async () => {
    const manager = new ProfileManager(configPath);
    await manager.initialize();

    expect(manager.listProfiles()).toEqual([]);
    expect(manager.getActiveProfile()).toBeNull();

    // 1. Create Profile
    const p1 = manager.createProfile('Code Expert', 'qwen2.5-coder', 'ollama', { temperature: 0.2, maxTokens: 4096 }, 'Specialized coder');
    expect(p1.id).toBeDefined();
    expect(p1.name).toBe('Code Expert');

    // 2. Duplicate profile throws when id collides
    const spy = jest.spyOn(manager as any, 'generateId').mockReturnValue(p1.id);
    expect(() => {
      manager.createProfile('Code Expert', 'qwen2.5-coder', 'ollama');
    }).toThrow('already exists');
    spy.mockRestore();

    // 3. Set active
    manager.setActiveProfile(p1.id);
    expect(manager.getActiveProfile()?.id).toBe(p1.id);

    // 4. Update Profile
    const updated = manager.updateProfile(p1.id, {
      name: 'Code Expert Updated',
      description: 'Updated description',
      model: 'qwen2.5-coder:32b',
      provider: 'ollama',
      parameters: { topP: 0.95 }
    });
    expect(updated.name).toBe('Code Expert Updated');
    expect(updated.description).toBe('Updated description');
    expect(updated.model).toBe('qwen2.5-coder:32b');
    expect(updated.parameters.topP).toBe(0.95);
    expect(updated.parameters.temperature).toBe(0.2);

    // 5. Clone Profile
    const clone = manager.cloneProfile(p1.id, 'Code Expert v2');
    expect(clone.name).toBe('Code Expert v2');
    expect(clone.parameters.temperature).toBe(0.2);

    // 6. Get by name
    const found = manager.getProfileByName('code expert v2');
    expect(found?.id).toBe(clone.id);
    expect(manager.getProfileByName('non-existent')).toBeUndefined();

    // 7. Delete non-active clone profile
    const deletedClone = manager.deleteProfile(clone.id);
    expect(deletedClone).toBe(true);

    // 8. Delete active profile
    const deleted = manager.deleteProfile(p1.id);
    expect(deleted).toBe(true);
    expect(manager.getActiveProfile()).toBeNull();
    expect(manager.getProfile(p1.id)).toBeUndefined();

    // 9. Delete non-existent profile
    expect(manager.deleteProfile('non-existent-id')).toBe(false);
  });

  it('manages presets, applies presets, switches profiles, and generates stats', async () => {
    const manager = new ProfileManager(configPath);
    expect(manager.listPresets().length).toBeGreaterThanOrEqual(5);
    expect(manager.getPreset('fast')?.name).toBe('fast');
    expect(manager.getPreset('FAST')?.name).toBe('fast');
    expect(manager.getPreset('non-existent')).toBeUndefined();

    // 0. Switch profile on empty manager returns null
    expect(manager.switchProfile()).toBeNull();

    // 1. Create from preset
    const creative = manager.createFromPreset('creative', 'llama-3.3-70b', 'groq', 'Writer');
    expect(creative.parameters.temperature).toBe(0.9);

    // 2. Apply preset to profile
    const fastProfile = manager.applyPreset(creative.id, 'fast');
    expect(fastProfile.parameters.temperature).toBe(0.3);

    // 3. Error on missing preset or profile
    expect(() => manager.createFromPreset('invalid-preset', 'm', 'p')).toThrow('not found');
    expect(() => manager.applyPreset(creative.id, 'invalid-preset')).toThrow('not found');
    expect(() => manager.updateProfile('fake-id', {})).toThrow('not found');
    expect(() => manager.setActiveProfile('fake-id')).toThrow('not found');
    expect(() => manager.cloneProfile('fake-id', 'new-name')).toThrow('not found');

    // 4. Profile switching when active is null
    const switchedFirst = manager.switchProfile();
    expect(switchedFirst?.id).toBe(creative.id);

    // 5. Profile switching between multiple
    const p2 = manager.createProfile('Assistant', 'llama-3.1-8b', 'groq');
    manager.setActiveProfile(creative.id);
    const switched = manager.switchProfile();
    expect(switched?.id).toBe(p2.id);

    // 6. Stats
    const stats = manager.getStats();
    expect(stats.totalProfiles).toBe(2);
    expect(stats.profilesByProvider['groq']).toBe(2);
    expect(stats.activeProfile).toBe(p2.id);
  });

  it('exports and imports profiles with overwrite controls and handles corrupt storage', async () => {
    const manager1 = new ProfileManager(configPath);
    manager1.createProfile('P1', 'm1', 'provider1');
    manager1.createProfile('P2', 'm2', 'provider2');

    const exported = manager1.export();
    expect(exported).toContain('P1');
    expect(exported).toContain('P2');

    const manager2 = new ProfileManager(path.join(tempDir, 'new_profiles.json'));
    await manager2.initialize();
    const importedCount = manager2.import(exported);
    expect(importedCount).toBe(2);
    expect(manager2.listProfiles().length).toBe(2);

    // Re-import without overwrite skips
    const skipped = manager2.import(exported, false);
    expect(skipped).toBe(0);

    // Re-import with overwrite updates
    const overwritten = manager2.import(exported, true);
    expect(overwritten).toBe(2);

    // Corrupt JSON load recovery
    const corruptPath = path.join(tempDir, 'corrupt.json');
    fs.writeFileSync(corruptPath, '{ corrupt json');
    const corruptManager = new ProfileManager(corruptPath);
    await corruptManager.initialize();
    expect(corruptManager.listProfiles()).toEqual([]);

    // Default constructor and createFromPreset default profileName
    const defaultManager = new ProfileManager();
    const presetCreated = defaultManager.createFromPreset('fast', 'gpt-4o', 'openai');
    expect(presetCreated.name).toBe('gpt-4o-fast');

    // getActiveProfile with orphaned activeProfileId
    (defaultManager as any).activeProfileId = 'orphaned-id';
    expect(defaultManager.getActiveProfile()).toBeNull();

    // save error handling
    const failingDirManager = new ProfileManager(path.join(tempDir, 'read-only-file', 'profiles.json'));
    fs.writeFileSync(path.join(tempDir, 'read-only-file'), 'a-file-not-dir');
    (failingDirManager as any).save(); // should catch and warn safely
  });
});
