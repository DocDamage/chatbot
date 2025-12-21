/**
 * Preference Learner - Learn from implicit/explicit feedback
 * Research: Stanford BookBuddy, MIT Personalization Lab
 */

import { UserProfiler, UserProfile } from './UserProfiler';
import { logger } from '../observability/logger';

export interface PreferenceSignal {
  type: 'explicit' | 'implicit';
  preference: string;
  value: any;
  confidence: number;
}

export class PreferenceLearner {
  private profiler: UserProfiler;
  private signals: Map<string, PreferenceSignal[]> = new Map();

  constructor(profiler: UserProfiler) {
    this.profiler = profiler;
  }

  /**
   * Learn from feedback
   */
  learn(userId: string, feedback: {
    explicit?: {
      rating?: number;
      preference?: string;
      value?: any;
    };
    implicit?: {
      action: string;
      context?: string;
    };
  }): void {
    const profile = this.profiler.getProfile(userId);

    // Explicit feedback
    if (feedback.explicit) {
      const signal: PreferenceSignal = {
        type: 'explicit',
        preference: feedback.explicit.preference || 'general',
        value: feedback.explicit.value || feedback.explicit.rating,
        confidence: 0.9
      };
      this.addSignal(userId, signal);
      this.applyPreference(profile, signal);
    }

    // Implicit feedback
    if (feedback.implicit) {
      const signal = this.inferPreference(feedback.implicit);
      if (signal) {
        this.addSignal(userId, signal);
        this.applyPreference(profile, signal);
      }
    }

    logger.debug('Preference learned', { userId, signalsCount: this.signals.get(userId)?.length || 0 });
  }

  /**
   * Infer preference from implicit behavior
   */
  private inferPreference(implicit: { action: string; context?: string }): PreferenceSignal | null {
    // Simple inference rules
    if (implicit.action === 'skip_response') {
      return {
        type: 'implicit',
        preference: 'response_length',
        value: 'shorter',
        confidence: 0.6
      };
    }
    if (implicit.action === 'ask_follow_up') {
      return {
        type: 'implicit',
        preference: 'response_detail',
        value: 'more_detail',
        confidence: 0.7
      };
    }
    return null;
  }

  /**
   * Apply learned preference to profile
   */
  private applyPreference(profile: UserProfile, signal: PreferenceSignal): void {
    switch (signal.preference) {
      case 'response_length':
        if (signal.value === 'shorter') {
          profile.preferences.responseLength = 'short';
        } else if (signal.value === 'longer') {
          profile.preferences.responseLength = 'long';
        }
        break;
      case 'communication_style':
        if (['formal', 'casual', 'technical', 'friendly'].includes(signal.value)) {
          profile.preferences.communicationStyle = signal.value;
        }
        break;
      // Add more preference mappings
    }
  }

  /**
   * Add preference signal
   */
  private addSignal(userId: string, signal: PreferenceSignal): void {
    if (!this.signals.has(userId)) {
      this.signals.set(userId, []);
    }
    this.signals.get(userId)!.push(signal);
  }

  /**
   * Get learned preferences for user
   */
  getPreferences(userId: string): PreferenceSignal[] {
    return this.signals.get(userId) || [];
  }
}

