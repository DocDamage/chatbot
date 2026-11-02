import { LogEventCompressor } from '../compressors/LogEventCompressor';
import { RepoTreeCompressor } from '../compressors/RepoTreeCompressor';
import { TableSampleCompressor } from '../compressors/TableSampleCompressor';
import { ConversationTurnSelector, ChatTurn } from '../compressors/ConversationTurnSelector';
import { ExactEvidenceSelector } from '../compressors/ExactEvidenceSelector';

describe('RT-CTX-001..002 — Deterministic Compressor & Context Economy Suite', () => {
  describe('LogEventCompressor', () => {
    it('collapses repeated heartbeat lines and preserves unique anomalies', () => {
      const logs = [
        '2026-08-25T12:00:00Z INFO Heartbeat ok ping 1',
        '2026-08-25T12:00:01Z INFO Heartbeat ok ping 2',
        '2026-08-25T12:00:02Z INFO Heartbeat ok ping 3',
        '2026-08-25T12:00:03Z ERROR Fatal database connection failure at host db.local',
        '2026-08-25T12:00:04Z INFO Heartbeat ok ping 4',
      ].join('\n');

      const result = LogEventCompressor.compress(logs);
      expect(result.collapsedLinesCount).toBeGreaterThan(0);
      expect(result.compressed).toContain('repeated');
      expect(result.compressed).toContain('Fatal database connection failure');
    });
  });

  describe('RepoTreeCompressor', () => {
    it('summarizes directory structure without losing essential layout', () => {
      const treeText = [
        'src',
        '  core',
        '    auth.ts',
        '    utils.ts',
        '  server',
        '    index.ts',
        'package.json',
        'README.md',
      ].join('\n');

      const result = RepoTreeCompressor.compress(treeText);
      expect(result.compressed).toContain('src');
      expect(result.compressed).toContain('package.json');
    });
  });

  describe('TableSampleCompressor', () => {
    it('retains header and head/tail rows while summarizing massive tables', () => {
      const rows = [
        '| id | name | score |',
        '| --- | --- | --- |',
        ...Array.from({ length: 50 }, (_, i) => `| ${i + 1} | User_${i + 1} | ${100 + i} |`),
      ].join('\n');

      const result = TableSampleCompressor.compress(rows, 5);
      expect(result.omittedRowsCount).toBeGreaterThan(0);
      expect(result.compressed).toContain('rows omitted');
    });
  });

  describe('ConversationTurnSelector', () => {
    it('selects salient recent turns within token limits', () => {
      const turns: ChatTurn[] = Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message content turn ${i + 1}`,
      }));

      const result = ConversationTurnSelector.select(turns, 4);
      expect(result.selectedTurns.length).toBeLessThanOrEqual(7);
      expect(result.omittedTurnsCount).toBeGreaterThan(0);
    });
  });

  describe('ExactEvidenceSelector', () => {
    it('extracts exact matching lines and preserves line numbers', () => {
      const source = 'line 1\nline 2 target match\nline 3\nline 4 another target match\nline 5';
      const evidence = ExactEvidenceSelector.extractSlice(source, 'src/test.ts', 2, 4, 1);

      expect(evidence.filePath).toBe('src/test.ts');
      expect(evidence.startLine).toBeGreaterThanOrEqual(1);
      expect(evidence.content).toContain('line 2 target match');
    });
  });
});
