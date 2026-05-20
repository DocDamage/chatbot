export class SunoHookTool {
  run(input: Record<string, any> = {}) {
    const query = String(input.query || '');
    return {
      domain: 'music',
      tool: 'SunoHookTool',
      hookDirection: /dark|sad|minor/i.test(query)
        ? 'short haunting hook with a memorable minor-key phrase and space between lines'
        : 'clear, repeatable hook with strong rhythm and a simple melodic center',
      rules: ['original wording only', 'no copyrighted lyric continuation', 'focus on hook function rather than copying a melody']
    };
  }
}
