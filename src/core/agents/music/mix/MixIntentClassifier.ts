export type MixMode =
  | 'rough_mix'
  | 'clean_mix'
  | 'vocal_mix'
  | 'beat_mix'
  | 'premaster'
  | 'loud_master'
  | 'reference_match'
  | 'club_mix'
  | 'streaming_mix'
  | 'phone_check';

export class MixIntentClassifier {
  classify(input: string): MixMode {
    const text = input.toLowerCase();
    if (/vocal|lead|adlib|de-ess|reverb|delay/.test(text)) return 'vocal_mix';
    if (/beat|808|kick|snare|hat|drum|melody/.test(text)) return 'beat_mix';
    if (/premaster|headroom|master.ready/.test(text)) return 'premaster';
    if (/loud master|make.*loud|limiter|club/.test(text)) return text.includes('club') ? 'club_mix' : 'loud_master';
    if (/reference|match/.test(text)) return 'reference_match';
    if (/phone|speaker|translation/.test(text)) return 'phone_check';
    if (/clean|mud|mask|clear/.test(text)) return 'clean_mix';
    return 'rough_mix';
  }
}
