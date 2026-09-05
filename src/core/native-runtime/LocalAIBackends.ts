import { OllamaAdapter } from '../providers/OllamaAdapter';
import { ClipboardActionRequest } from '../voice-companion/VoiceCompanionTypes';
import { AIWritingAction, ProcessingLocality } from '../writing/WritingTypes';

type TransformInput = ClipboardActionRequest | {
  mode: string;
  text: string;
  targetLanguage?: string;
  instructionPrompt?: string;
} | {
  text: string;
  action: AIWritingAction;
  instruction?: string;
  targetTone?: string;
  providerModel: string;
  locality: ProcessingLocality;
};

export class OllamaLocalAIBackend {
  private readonly adapter: OllamaAdapter;
  private readonly model: string;

  constructor(baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434', model = process.env.OLLAMA_MODEL || 'qwen3:8b') {
    this.model = model;
    this.adapter = new OllamaAdapter(baseUrl, model);
  }

  public async health(): Promise<{ available: boolean; models?: string[] }> {
    return this.adapter.checkAvailability();
  }

  public async translate(text: string, targetLanguage: string): Promise<string> {
    return this.generate(
      `Translate the following text into ${targetLanguage}. Preserve names, code, numbers, and formatting. Return only the translation.\n\n${text}`,
      'You are a precise translation engine. Do not add commentary.'
    );
  }

  public async transform(input: TransformInput): Promise<string> {
    if ('rawClipboardText' in input) return this.transformClipboard(input);
    if ('mode' in input) return this.transformDictation(input);
    return this.transformWriting(input);
  }

  private async transformClipboard(input: ClipboardActionRequest): Promise<string> {
    if (input.action === 'translate') return this.translate(input.rawClipboardText, input.targetLanguage || 'English');
    const instructions: Record<string, string> = {
      summarize: 'Summarize the text accurately and concisely.',
      explain: 'Explain the text clearly, preserving important technical details.',
      rewrite: 'Rewrite the text for clarity while preserving its meaning.',
      code_fix: 'Return a corrected version of the code. Preserve behavior except for necessary fixes.'
    };
    return this.generate(`${instructions[input.action] || 'Process the text.'}\nReturn only the result.\n\n${input.rawClipboardText}`);
  }

  private async transformDictation(input: { mode: string; text: string; targetLanguage?: string; instructionPrompt?: string }): Promise<string> {
    if (input.mode === 'translate') return this.translate(input.text, input.targetLanguage || 'English');
    const instruction = input.mode === 'code_draft'
      ? 'Convert this spoken request into production-ready code. Return only the code or patch requested.'
      : `Turn this dictation into a polished draft. ${input.instructionPrompt || ''}`;
    return this.generate(`${instruction}\n\nDictation:\n${input.text}`);
  }

  private async transformWriting(input: {
    text: string;
    action: AIWritingAction;
    instruction?: string;
    targetTone?: string;
  }): Promise<string> {
    const action = input.action.replace(/_/g, ' ');
    const instruction = [
      `Perform this writing operation: ${action}.`,
      input.targetTone ? `Target tone: ${input.targetTone}.` : '',
      input.instruction || '',
      'Preserve facts and source meaning. Return only the transformed text.'
    ].filter(Boolean).join(' ');
    return this.generate(`${instruction}\n\n${input.text}`);
  }

  private async generate(prompt: string, systemPrompt = 'You are a local, privacy-preserving assistant. Follow the requested transformation exactly.'): Promise<string> {
    const response = await this.adapter.generate({ prompt, systemPrompt, model: this.model, temperature: 0.2, maxTokens: 4096 });
    return response.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  }
}
