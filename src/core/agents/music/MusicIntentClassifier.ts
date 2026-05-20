export type MusicIntent =
  | 'suno'
  | 'fl_studio'
  | 'pro_tools'
  | 'logic'
  | 'mix'
  | 'master'
  | 'arrangement'
  | 'daw_translate'
  | 'beat'
  | 'theory'
  | 'copyright'
  | 'general';

export class MusicIntentClassifier {
  classify(input: string): MusicIntent {
    const text = input.toLowerCase();
    if (/\b(suno|ai song|prompt for a song|style tag|section tag|hook prompt)\b/.test(text)) return 'suno';
    if (/\b(fl studio|channel rack|piano roll|gross beat|edison|fl mixer|playlist|pattern mode)\b/.test(text)) return 'fl_studio';
    if (/\b(pro tools|avid|playlist comp|clip gain|low latency monitoring|audio suite|aux send|adr)\b/.test(text)) return 'pro_tools';
    if (/\b(logic pro|logic|alchemy|flex pitch|flex time|session player|drummer|track stack|quick sampler)\b/.test(text)) return 'logic';
    if (/\b(translate.*daw|daw.*translate|fl.*logic|logic.*pro tools|suno.*daw|channel rack.*logic)\b/.test(text)) return 'daw_translate';
    if (/\b(master|mastering|lufs|true peak|limiter)\b/.test(text)) return 'master';
    if (/\b(mix|muddy|masking|sidechain|vocal chain|eq|compressor|reverb|delay|slap|knock|bang|boxy|harsh|buried|sitting|expensive|eating the kick|low end cooked)\b/.test(text)) return 'mix';
    if (/\b(arrangement|song structure|intro|verse|chorus|bridge|drop|hook)\b/.test(text)) return 'arrangement';
    if (/\b(808|drum|beat|hi-hat|kick|snare|pattern|bounce|pocket|cook up|lay down drums)\b/.test(text)) return 'beat';
    if (/\b(chord|progression|key|scale|harmony)\b/.test(text)) return 'theory';
    if (/\b(copyright|rights|ownership|licensing|living artist|copy lyrics|imitate)\b/.test(text)) return 'copyright';
    return 'general';
  }
}
