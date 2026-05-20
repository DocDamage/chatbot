export class BpmKeyDetectorTool {
  run(input: Record<string, any> = {}) {
    const text = String(input.text || input.query || '');
    const bpm = text.match(/\b([6-9]\d|1[0-9]{2}|2[0-2]\d)\s*bpm\b/i)?.[1];
    const key = text.match(/\b([A-G](?:#|b)?\s*(?:major|minor|min|maj|m)?)\b/i)?.[1];
    return {
      domain: 'music',
      tool: 'BpmKeyDetectorTool',
      bpm: bpm ? Number(bpm) : undefined,
      key: key ? key.replace(/\s+/g, ' ').trim() : undefined,
      confidence: bpm || key ? 0.85 : 0.35,
      note: bpm || key ? 'Detected from text prompt.' : 'No audio analysis provided; pass BPM/key text or audio metadata.'
    };
  }
}
