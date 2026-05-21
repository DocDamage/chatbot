import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/Database';
import { ensureExpansionDatabase, jsonParam } from '../database/ExpansionDatabase';

export interface EducationPlanInput {
  title: string;
  goal: string;
  level?: string;
  sources?: string[];
  milestones?: string[];
}

export class EducationService {
  constructor(private readonly database?: Database) {}

  async seedSources(): Promise<{ insertedOrUpdated: number }> {
    const database = await ensureExpansionDatabase(this.database);
    const sources = [
      ['khan-academy', 'Khan Academy', 'test_prep_general_learning', 'https://www.khanacademy.org', 'Free learning and test-prep resource.'],
      ['mit-opencourseware', 'MIT OpenCourseWare', 'university_courses', 'https://ocw.mit.edu', 'Free MIT course materials.'],
      ['freecodecamp', 'freeCodeCamp', 'coding_bootcamp_replacement', 'https://www.freecodecamp.org', 'Free coding curriculum.'],
      ['the-odin-project', 'The Odin Project', 'coding_bootcamp_replacement', 'https://www.theodinproject.com', 'Free full-stack web development curriculum.'],
      ['cs50', 'CS50', 'computer_science', 'https://cs50.harvard.edu', 'Computer science course resource.'],
      ['openstax', 'OpenStax', 'open_textbooks', 'https://openstax.org', 'Open textbooks and course materials.'],
      ['kaggle-learn', 'Kaggle Learn', 'data_science', 'https://www.kaggle.com/learn', 'Short practical data-science lessons.'],
      ['dds-certification', 'DDS / Certification Prep', 'certification_prep', '', 'User-provided DDS/certification materials and generated study aids.']
    ];

    for (const [slug, name, category, sourceUrl, description] of sources) {
      await database.query(
        `INSERT INTO education_sources (id, name, slug, category, source_url, description, metadata_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (slug) DO UPDATE SET
          name = excluded.name,
          category = excluded.category,
          source_url = excluded.source_url,
          description = excluded.description,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at`,
        [uuidv4(), name, slug, category, sourceUrl || null, description, jsonParam({ seeded: true })]
      );
    }

    return { insertedOrUpdated: sources.length };
  }

  async listSources(): Promise<any[]> {
    const database = await ensureExpansionDatabase(this.database);
    await this.seedSources();
    const result = await database.query('SELECT * FROM education_sources ORDER BY category, name');
    return result.rows;
  }

  async createPlan(input: EducationPlanInput): Promise<{ id: string; status: string }> {
    if (!input.title.trim() || !input.goal.trim()) {
      throw new Error('title and goal are required');
    }

    const database = await ensureExpansionDatabase(this.database);
    const id = uuidv4();
    await database.query(
      `INSERT INTO education_plans (
        id, title, goal, level, sources_json, milestones_json, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        input.title,
        input.goal,
        input.level || null,
        jsonParam(input.sources || []),
        jsonParam(input.milestones || []),
        'draft'
      ]
    );

    return { id, status: 'draft' };
  }

  async getStats(): Promise<{ sources: number; plans: number; flashcards: number; quizzes: number }> {
    const database = await ensureExpansionDatabase(this.database);
    const [sources, plans, flashcards, quizzes] = await Promise.all([
      database.query('SELECT COUNT(*) AS count FROM education_sources'),
      database.query('SELECT COUNT(*) AS count FROM education_plans'),
      database.query('SELECT COUNT(*) AS count FROM education_flashcards'),
      database.query('SELECT COUNT(*) AS count FROM education_quizzes')
    ]);
    return {
      sources: Number(sources.rows[0]?.count || 0),
      plans: Number(plans.rows[0]?.count || 0),
      flashcards: Number(flashcards.rows[0]?.count || 0),
      quizzes: Number(quizzes.rows[0]?.count || 0)
    };
  }
}
