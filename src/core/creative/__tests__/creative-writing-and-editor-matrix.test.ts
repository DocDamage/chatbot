import { CreativeWritingAgent } from '../CreativeWritingAgent';
import { DocumentEditorEngine } from '../../writing/DocumentEditorEngine';

describe('B75-08: Creative Writing Agent and Document Editor Engine Matrix', () => {
  describe('CreativeWritingAgent Operations', () => {
    it('handles draftScene, revisePassage, buildCharacter, outlineNovel with quality and safety checks', async () => {
      const agent = new CreativeWritingAgent();

      // Draft scene
      const draftResult = await agent.draftScene({
        prompt: 'A detective investigates an abandoned observatory at midnight under heavy rain.',
        config: { tone: 'noir' }
      });

      expect(draftResult.domain).toBe('creative_writing');
      expect(draftResult.response).toBeDefined();

      // Revise passage
      const reviseResult = await agent.revisePassage({
        prompt: 'Make the tone more tense and emphasize shadows and echoes.',
        revisionOperation: 'increase_tension',
        config: { tone: 'suspense' }
      });
      expect(reviseResult.domain).toBe('creative_writing');

      // Build character
      const characterResult = await agent.buildCharacter({
        prompt: 'Create a veteran astronomer with a hidden past.',
        config: { tone: 'literary' }
      });
      expect(characterResult.domain).toBe('creative_writing');

      // Outline novel
      const outlineResult = await agent.outlineNovel({
        prompt: 'Sci-fi mystery set on a terraformed Mars colony.',
        config: { tone: 'cyberpunk' }
      });
      expect(outlineResult.domain).toBe('creative_writing');

      // Continue scene
      const contResult = await agent.continueScene({
        prompt: 'The footsteps grew louder outside the airlock.',
        qualityPass: true
      });
      expect(contResult.domain).toBe('creative_writing');
      expect(contResult.response).toContain('Quality review');

      // Build world
      const worldResult = await agent.buildWorld({
        prompt: 'Create a desert planet governed by spice merchant cartels.'
      });
      expect(worldResult.domain).toBe('creative_writing');

      // Roleplay turn
      const rpResult = await agent.roleplayTurn({
        prompt: 'The guild leader demands an explanation.',
        roleplayAction: 'scene'
      });
      expect(rpResult.domain).toBe('creative_writing');

      // Summarize continuity
      const summaryResult = await agent.summarizeContinuity({
        prompt: 'Summarize key plot points across chapters 1-3.'
      });
      expect(summaryResult.domain).toBe('creative_writing');

      // Export draft
      const exportResult = await agent.exportDraft({
        prompt: 'Compile full draft with title page and chapter markers.'
      });
      expect(exportResult.domain).toBe('creative_writing');

      // Ask helper
      const askResult = await agent.ask('Brainstorm magic system ideas based on resonance frequencies.');
      expect(askResult.domain).toBe('creative_writing');

      // Disallowed safety pattern rejection
      const unsafeResult = await agent.draftScene({
        prompt: 'minor child explicit erotic scene'
      });
      expect(unsafeResult.blocked).toBe(true);
    });
  });

  describe('DocumentEditorEngine Operations', () => {
    it('parses markdown text into AST, generates document outlines, and computes metrics', () => {
      const engine = new DocumentEditorEngine();

      const sampleDoc = `
# Chapter 1: The Signal

The observatory antenna hummed against the stormy sky.

## Sub-heading: Calibration

\`\`\`typescript
const frequency = 1420.405; // Hydrogen line
\`\`\`

> Important: Never ignore anomalies.

- [x] Check power grid
- [ ] Align secondary mirror
      `;

      const ast = engine.parseAST(sampleDoc);
      expect(ast.length).toBeGreaterThan(0);

      const outline = engine.generateOutline(sampleDoc);
      expect(outline.headings.length).toBe(2);
      expect(outline.headings[0].text).toContain('The Signal');
      expect(outline.headings[1].text).toContain('Calibration');
      expect(outline.totalWordCount).toBeGreaterThan(10);
      expect(outline.totalCharacterCount).toBeGreaterThan(50);
    });
  });
});
