/**
 * Profile Manager
 * Per-model configuration profiles with easy switching
 */

import { logger } from '../observability/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface ModelProfile {
    id: string;
    name: string;
    description?: string;
    model: string;
    provider: string;
    parameters: ModelParameters;
    createdAt: Date;
    updatedAt: Date;
}

export interface ModelParameters {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    reasoningLevel?: 'low' | 'medium' | 'high';
    stopSequences?: string[];
    systemPrompt?: string;
}

export interface ProfilePreset {
    name: string;
    description: string;
    parameters: Partial<ModelParameters>;
}

const BUILT_IN_PRESETS: ProfilePreset[] = [
    {
        name: 'fast',
        description: 'Quick responses with lower quality',
        parameters: {
            temperature: 0.3,
            maxTokens: 1024,
            reasoningLevel: 'low'
        }
    },
    {
        name: 'balanced',
        description: 'Good balance of speed and quality',
        parameters: {
            temperature: 0.7,
            maxTokens: 4096,
            reasoningLevel: 'medium'
        }
    },
    {
        name: 'quality',
        description: 'Best quality, slower responses',
        parameters: {
            temperature: 0.8,
            maxTokens: 8192,
            reasoningLevel: 'high'
        }
    },
    {
        name: 'creative',
        description: 'High creativity for writing tasks',
        parameters: {
            temperature: 0.9,
            maxTokens: 4096,
            topP: 0.95,
            frequencyPenalty: 0.3,
            presencePenalty: 0.3
        }
    },
    {
        name: 'precise',
        description: 'Low variance for coding tasks',
        parameters: {
            temperature: 0.2,
            maxTokens: 4096,
            topP: 0.9,
            frequencyPenalty: 0,
            presencePenalty: 0
        }
    }
];

export class ProfileManager {
    private profiles: Map<string, ModelProfile> = new Map();
    private activeProfileId: string | null = null;
    private configPath: string;

    constructor(configPath?: string) {
        this.configPath = configPath || path.join(process.cwd(), 'config/profiles.json');
    }

    /**
     * Initialize and load profiles
     */
    async initialize(): Promise<void> {
        await this.load();
        logger.info('Profile manager initialized', {
            profiles: this.profiles.size
        });
    }

    /**
     * Create a new profile
     */
    createProfile(
        name: string,
        model: string,
        provider: string,
        parameters: ModelParameters = {},
        description?: string
    ): ModelProfile {
        const id = this.generateId(name);

        if (this.profiles.has(id)) {
            throw new Error(`Profile with id '${id}' already exists`);
        }

        const profile: ModelProfile = {
            id,
            name,
            description,
            model,
            provider,
            parameters,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.profiles.set(id, profile);
        this.save();

        logger.info('Profile created', { id, name });
        return profile;
    }

    /**
     * Create profile from preset
     */
    createFromPreset(
        presetName: string,
        model: string,
        provider: string,
        profileName?: string
    ): ModelProfile {
        const preset = this.getPreset(presetName);
        if (!preset) {
            throw new Error(`Preset '${presetName}' not found`);
        }

        return this.createProfile(
            profileName || `${model}-${presetName}`,
            model,
            provider,
            preset.parameters as ModelParameters,
            `${preset.description} (from ${presetName} preset)`
        );
    }

    /**
     * Get profile by ID
     */
    getProfile(id: string): ModelProfile | undefined {
        return this.profiles.get(id);
    }

    /**
     * Get profile by name
     */
    getProfileByName(name: string): ModelProfile | undefined {
        for (const profile of this.profiles.values()) {
            if (profile.name.toLowerCase() === name.toLowerCase()) {
                return profile;
            }
        }
        return undefined;
    }

    /**
     * List all profiles
     */
    listProfiles(): ModelProfile[] {
        return Array.from(this.profiles.values());
    }

    /**
     * Update profile
     */
    updateProfile(
        id: string,
        updates: Partial<Omit<ModelProfile, 'id' | 'createdAt' | 'updatedAt'>>
    ): ModelProfile {
        const profile = this.profiles.get(id);
        if (!profile) {
            throw new Error(`Profile '${id}' not found`);
        }

        if (updates.name) profile.name = updates.name;
        if (updates.description !== undefined) profile.description = updates.description;
        if (updates.model) profile.model = updates.model;
        if (updates.provider) profile.provider = updates.provider;
        if (updates.parameters) {
            profile.parameters = { ...profile.parameters, ...updates.parameters };
        }

        profile.updatedAt = new Date();
        this.save();

        logger.info('Profile updated', { id });
        return profile;
    }

    /**
     * Delete profile
     */
    deleteProfile(id: string): boolean {
        const deleted = this.profiles.delete(id);

        if (deleted) {
            if (this.activeProfileId === id) {
                this.activeProfileId = null;
            }
            this.save();
            logger.info('Profile deleted', { id });
        }

        return deleted;
    }

    /**
     * Set active profile
     */
    setActiveProfile(id: string): ModelProfile {
        const profile = this.profiles.get(id);
        if (!profile) {
            throw new Error(`Profile '${id}' not found`);
        }

        this.activeProfileId = id;
        logger.info('Active profile set', { id, name: profile.name });

        return profile;
    }

    /**
     * Get active profile
     */
    getActiveProfile(): ModelProfile | null {
        if (!this.activeProfileId) return null;
        return this.profiles.get(this.activeProfileId) || null;
    }

    /**
     * Switch to next profile
     */
    switchProfile(): ModelProfile | null {
        const profiles = this.listProfiles();
        if (profiles.length === 0) return null;

        const currentIndex = this.activeProfileId
            ? profiles.findIndex(p => p.id === this.activeProfileId)
            : -1;

        const nextIndex = (currentIndex + 1) % profiles.length;
        return this.setActiveProfile(profiles[nextIndex].id);
    }

    /**
     * Get preset by name
     */
    getPreset(name: string): ProfilePreset | undefined {
        return BUILT_IN_PRESETS.find(p =>
            p.name.toLowerCase() === name.toLowerCase()
        );
    }

    /**
     * List all presets
     */
    listPresets(): ProfilePreset[] {
        return [...BUILT_IN_PRESETS];
    }

    /**
     * Apply preset to profile
     */
    applyPreset(profileId: string, presetName: string): ModelProfile {
        const preset = this.getPreset(presetName);
        if (!preset) {
            throw new Error(`Preset '${presetName}' not found`);
        }

        return this.updateProfile(profileId, {
            parameters: preset.parameters as ModelParameters
        });
    }

    /**
     * Clone profile
     */
    cloneProfile(id: string, newName: string): ModelProfile {
        const original = this.profiles.get(id);
        if (!original) {
            throw new Error(`Profile '${id}' not found`);
        }

        return this.createProfile(
            newName,
            original.model,
            original.provider,
            { ...original.parameters },
            `Clone of ${original.name}`
        );
    }

    /**
     * Export profiles
     */
    export(): string {
        const profiles = this.listProfiles();
        return JSON.stringify(profiles, null, 2);
    }

    /**
     * Import profiles
     */
    import(json: string, overwrite: boolean = false): number {
        const profiles: ModelProfile[] = JSON.parse(json);
        let imported = 0;

        for (const profile of profiles) {
            if (this.profiles.has(profile.id) && !overwrite) {
                continue;
            }

            profile.createdAt = new Date(profile.createdAt);
            profile.updatedAt = new Date(profile.updatedAt);
            this.profiles.set(profile.id, profile);
            imported++;
        }

        this.save();
        logger.info('Profiles imported', { count: imported });

        return imported;
    }

    /**
     * Save profiles to disk
     */
    private async save(): Promise<void> {
        try {
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const data = {
                activeProfileId: this.activeProfileId,
                profiles: Array.from(this.profiles.values())
            };

            fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
        } catch (error) {
            logger.warn('Failed to save profiles', { error });
        }
    }

    /**
     * Load profiles from disk
     */
    private async load(): Promise<void> {
        try {
            if (!fs.existsSync(this.configPath)) {
                return;
            }

            const content = fs.readFileSync(this.configPath, 'utf-8');
            const data = JSON.parse(content);

            this.activeProfileId = data.activeProfileId || null;

            for (const profile of data.profiles || []) {
                profile.createdAt = new Date(profile.createdAt);
                profile.updatedAt = new Date(profile.updatedAt);
                this.profiles.set(profile.id, profile);
            }
        } catch (error) {
            logger.warn('Failed to load profiles', { error });
        }
    }

    /**
     * Generate ID from name
     */
    private generateId(name: string): string {
        const base = name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        return `${base}-${Date.now().toString(36)}`;
    }

    /**
     * Get statistics
     */
    getStats(): {
        totalProfiles: number;
        activeProfile: string | null;
        profilesByProvider: Record<string, number>;
    } {
        const byProvider: Record<string, number> = {};

        for (const profile of this.profiles.values()) {
            byProvider[profile.provider] = (byProvider[profile.provider] || 0) + 1;
        }

        return {
            totalProfiles: this.profiles.size,
            activeProfile: this.activeProfileId,
            profilesByProvider: byProvider
        };
    }
}

// Default instance
export const profileManager = new ProfileManager();
