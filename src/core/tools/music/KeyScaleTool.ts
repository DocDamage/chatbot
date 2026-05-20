export class KeyScaleTool {
  run(input: Record<string, any> = {}) {
    const query = String(input.query || '');
    const key = input.key || query.match(/\b([A-G](?:#|b)?\s*(?:major|minor|maj|min|m))\b/i)?.[1] || 'A minor';
    const minor = /minor|min|\bm\b/i.test(String(key));
    return {
      domain: 'music',
      tool: 'KeyScaleTool',
      key,
      scale: minor ? ['1', '2', 'b3', '4', '5', 'b6', 'b7'] : ['1', '2', '3', '4', '5', '6', '7'],
      notes: [
        'Tune 808s and samples to the song key before writing bass lines.',
        'Use out-of-scale notes intentionally as passing tones or tension, not accidents.'
      ]
    };
  }
}
