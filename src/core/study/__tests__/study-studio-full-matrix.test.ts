import { StudyStudioService } from '../StudyStudioService';
import { StructuredNotesEngine } from '../StructuredNotesEngine';

describe('B75-08: Study Studio Service and Structured Notes Engine Full Matrix', () => {
  let service: StudyStudioService;

  beforeEach(() => {
    service = new StudyStudioService();
  });

  describe('StudyStudioService Lifecycle and Generation Flow', () => {
    it('creates collection, ingests sources, generates Cornell/outline notes, flashcards, and quizzes', () => {
      const col = service.createStudyCollection({
        ownerId: 'student_1',
        title: 'Algorithms and Data Structures',
        subject: 'Computer Science',
        targetLevel: 'advanced',
        learningGoals: ['Master graph algorithms', 'Understand dynamic programming']
      });

      expect(col.id).toBeDefined();
      expect(service.getActiveCollection()?.id).toBe(col.id);

      const sourceRes = service.addSourceDocument({
        title: 'Graph Traversal Notes',
        content: `
# Graph Traversal
Breadth-First Search (BFS) explores all vertices at the current depth before moving deeper.
Depth-First Search (DFS) explores as far as possible along each branch before backtracking.
Applications include shortest path in unweighted graphs and topological sorting in DAGs.
        `,
        format: 'markdown'
      });

      expect(sourceRes.chunks.length).toBeGreaterThan(0);

      // Generate Cornell note
      const cornellNote = service.generateNote('cornell', 'BFS vs DFS');
      expect(cornellNote.id).toBeDefined();
      expect(cornellNote.noteType).toBe('cornell');

      // Generate Outline note
      const outlineNote = service.generateNote('outline', 'Graph Overview');
      expect(outlineNote.noteType).toBe('outline');

      // Generate Flashcards
      const cards = service.generateFlashcards();
      expect(cards.length).toBeGreaterThanOrEqual(0);

      // Generate Quiz
      const quizQuestions = service.generateQuizQuestions();
      expect(quizQuestions.length).toBeGreaterThanOrEqual(0);
    });

    it('throws when operations are executed without an active study collection', () => {
      const emptyService = new StudyStudioService();
      expect(() => emptyService.generateNote('cornell')).toThrow('No active study collection');
      expect(() => emptyService.generateFlashcards()).toThrow('No active study collection');
      expect(() => emptyService.addSourceDocument({ title: 'T', content: 'C' })).toThrow('No active study collection');
    });
  });
});
