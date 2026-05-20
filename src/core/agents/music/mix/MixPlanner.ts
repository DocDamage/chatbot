import { MixMode } from './MixIntentClassifier';

export interface MixMove {
  id: string;
  target: string;
  action: string;
  amount?: string;
  reason: string;
  fl?: {
    tool: string;
    args: Record<string, any>;
  };
  requiresConfirmation?: boolean;
}

export class MixPlanner {
  plan(input: Record<string, any>, mode: MixMode, diagnostics: any): MixMove[] {
    const query = String(input.query || input.notes || '').toLowerCase();
    const preserve808 = /808|huge|bass/.test(query);
    const hasVocal = /vocal|rap|song|verse|hook/.test(query) || mode === 'vocal_mix';

    const moves: MixMove[] = [
      {
        id: 'gain-stage',
        target: 'All tracks',
        action: 'Gain-stage before EQ or limiting',
        amount: 'leave master peaks below -6 dB for premaster',
        reason: 'Prevents clipping and leaves room for clean loudness.'
      },
      {
        id: 'melody-low-mid',
        target: 'Melody Bus',
        action: 'Lower melody bus and clean low mids',
        amount: '-1.5 dB, high-pass around 100-140 Hz',
        reason: preserve808 ? 'Creates space for the 808 to stay huge.' : 'Reduces mud around the vocal and drums.',
        fl: { tool: 'fl_set_track_volume', args: { track: 13, dbChange: -1.5 } }
      },
      {
        id: 'kick-808-pocket',
        target: 'Kick / 808',
        action: preserve808 ? 'Let 808 own the sub and make kick punch above it' : 'Choose kick or bass as low-end anchor',
        amount: 'small EQ/envelope move, not a heavy master fix',
        reason: diagnostics.masking.priority
      },
      {
        id: 'mono-low-end',
        target: 'Low end',
        action: 'Keep low frequencies centered and mono-compatible',
        reason: 'Improves club, phone, and car translation.'
      }
    ];

    if (hasVocal) {
      moves.push({
        id: 'vocal-level',
        target: 'Vocal Bus',
        action: 'Bring lead vocal forward',
        amount: '+1.0 to +1.5 dB',
        reason: 'Keeps vocal intelligibility above the beat.',
        fl: { tool: 'fl_set_track_volume', args: { track: 14, dbChange: 1.2 } }
      });
      moves.push({
        id: 'vocal-space',
        target: 'Reverb / Delay Sends',
        action: 'Use sends for depth instead of wet inserts',
        amount: 'small send increase, automate throws',
        reason: 'Adds polish while preserving lead vocal clarity.'
      });
    }

    if (mode === 'loud_master' || mode === 'club_mix' || mode === 'streaming_mix') {
      moves.push({
        id: 'master-limiter',
        target: 'Master',
        action: 'Set final limiter target cautiously',
        amount: mode === 'club_mix' ? '-9 to -7 LUFS if mix supports it' : '-14 to -9 LUFS depending on release',
        reason: 'Loudness should happen after balance, clipping, and low-end control.',
        requiresConfirmation: true
      });
    }

    return moves;
  }
}
