import { StructuredNotesEngine } from '../StructuredNotesEngine';
import { FlashcardEngine } from '../FlashcardEngine';
import { StudyCollection, SourceChunk } from '../StudyTypes';

describe('RT-STUDY-001 — Study Studio Grounding, Scoring, and Note Generation Suite', () => {
  const mockCollection: StudyCollection = {
    id: 'col-1',
    ownerId: 'user-1',
    title: 'Machine Learning Basics',
    subject: 'Machine Learning',
    targetLevel: 'intermediate',
    learningGoals: ['Understand supervised learning'],
    sources: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0',
  };

  const sampleChunks: SourceChunk[] = [
    {
      chunkId: 'chunk-1',
      sourceId: 'doc-1',
      sourceTitle: 'Introduction to ML',
      chapterTitle: 'Supervised Learning',
      text: 'Supervised learning trains models on labeled input and output datasets.',
      startOffset: 0,
      endOffset: 72,
      anchor: {
        sourceId: 'doc-1',
        sourceTitle: 'Introduction to ML',
        sectionTitle: 'Supervised Learning',
        pageNumber: 10,
        startOffset: 0,
        endOffset: 72,
        citationText: 'Chapter 1, page 10',
      },
    },
  ];

  describe('StructuredNotesEngine', () => {
    it('generates structured outline and study takeaways with source anchors', () => {
      const engine = new StructuredNotesEngine();
      const note = engine.generateNote(mockCollection, sampleChunks, 'outline');

      expect(note.id).toBeDefined();
      expect(note.title).toContain('Machine Learning');
      expect(note.contentMarkdown).toContain('Supervised learning');
      expect(note.sourceAnchors.length).toBe(1);
    });
  });

  describe('FlashcardEngine', () => {
    it('generates flashcards anchored to key concepts with spaced repetition state', () => {
      const engine = new FlashcardEngine();
      const cards = engine.generateCardsFromChunks(mockCollection, sampleChunks);

      expect(cards.length).toBe(1);
      expect(cards[0].frontPrompt).toContain('Supervised Learning');
      expect(cards[0].backAnswer).toContain('Supervised learning trains');
      expect(cards[0].repetitionState.easeFactor).toBe(2.5);
    });
  });
});
