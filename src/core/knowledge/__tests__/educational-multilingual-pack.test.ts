import { FineWebEduSourcePolicy } from '../FineWebEduSourcePolicy';
import { EducationalWebPack } from '../EducationalWebPack';
import { MultilingualPack } from '../MultilingualPack';

describe('Phase 21: Educational Web & Multilingual Packs', () => {
  describe('FineWebEduSourcePolicy', () => {
    it('accepts high quality structured educational content', () => {
      const policy = new FineWebEduSourcePolicy(0.70);
      const res = policy.processCandidate({
        title: 'Introduction to Operating Systems',
        rawText: `
          # Introduction to Operating Systems
          An operating system is system software that manages computer hardware and software resources.
          For example, process management and memory allocation are primary roles.
          In summary, operating systems provide an abstraction layer between user applications and the physical CPU.
          Step 1 examines process scheduling algorithms. Step 2 looks at virtual memory management and page replacement.
        `,
      });

      expect(res.accepted).toBe(true);
      expect(res.document).toBeDefined();
      expect(res.document?.topic).toBe('software');
      expect(res.document?.qualityScore.score).toBeGreaterThanOrEqual(0.70);
    });

    it('rejects short text, prohibited spam, and off-topic text', () => {
      const policy = new FineWebEduSourcePolicy(0.70);

      const shortRes = policy.processCandidate({
        title: 'Short Note',
        rawText: 'Too short text.',
      });
      expect(shortRes.accepted).toBe(false);
      expect(shortRes.rejectionReason).toBe('TOO_SHORT_UNDER_150_CHARS');

      const spamRes = policy.processCandidate({
        title: 'Discount Code',
        rawText: 'Buy now and use this discount code at our online casino for amazing rewards and savings on software! We guarantee maximum payout and high adrenaline spins today only!',
      });
      expect(spamRes.accepted).toBe(false);
      expect(spamRes.rejectionReason).toBe('SAFETY_CONTENT_VIOLATION');

      const offTopic = policy.processCandidate({
        title: 'Random Ramblings',
        rawText: 'The weather was nice and the dog jumped over the fence while we went to the market to eat apples and oranges and bananas and pears and strawberries and blueberries.',
      });
      expect(offTopic.accepted).toBe(false);
      expect(offTopic.rejectionReason).toBe('TOPIC_NOT_EDUCATIONAL');
    });

    it('rejects duplicate text', () => {
      const policy = new FineWebEduSourcePolicy(0.60);
      const text = `
        # Science Primer
        Physics investigates the fundamental constituents of the universe.
        For example, gravitation governs planetary orbits, whereas electromagnetism drives chemical bonds.
        In summary, theoretical models must be verified through empirical experiment.
      `;
      const first = policy.processCandidate({ title: 'Physics 1', rawText: text });
      expect(first.accepted).toBe(true);

      const second = policy.processCandidate({ title: 'Physics 2', rawText: text });
      expect(second.accepted).toBe(false);
      expect(second.rejectionReason).toBe('EXACT_DUPLICATE_CONTENT');
    });
  });

  describe('EducationalWebPack', () => {
    it('manages staging index and promotes documents to live querying', () => {
      const pack = new EducationalWebPack(0.65);
      const text = `
        # Engineering Principles
        Robotics engineering combines mechanical, electrical, and software engineering.
        For example, robotic actuators require precise circuit control and sensor feedback loops.
        In summary, control theory guides stable robotic movement and automated manipulation.
      `;

      const staged = pack.ingestDocument({ title: 'Robotics', rawText: text }, true);
      expect(staged.success).toBe(true);
      expect(pack.getDocumentCount().staged).toBe(1);
      expect(pack.getDocumentCount().live).toBe(0);

      // Query yields nothing before promotion
      expect(pack.query('robotics engineering')).toHaveLength(0);

      // Promote to live
      const stagedDocId = Array.from((pack as any).stagingDocuments.keys())[0] as string;
      expect(pack.promoteStagedDocument(stagedDocId)).toBe(true);
      expect(pack.getDocumentCount().live).toBe(1);

      const results = pack.query('robotics engineering', 'engineering');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Robotics');
      expect(results[0].authority).toBe(0.70);
    });
  });

  describe('MultilingualPack', () => {
    it('installs by selected language and rejects uninstalled languages', () => {
      const pack = new MultilingualPack(['es', 'fr']);
      expect(pack.isLanguageInstalled('es')).toBe(true);
      expect(pack.isLanguageInstalled('fr')).toBe(true);
      expect(pack.isLanguageInstalled('de')).toBe(false);

      const docDe = {
        id: 'de-1',
        language: 'de' as const,
        title: 'Datenstrukturen',
        content: 'Eine Datenstruktur ist ein Objekt zur Speicherung von Daten.',
        domain: 'computer_science',
        nativeGlossaryTerms: ['Datenstruktur'],
        license: 'CC-BY-4.0',
      };
      const resDe = pack.ingest(docDe);
      expect(resDe.success).toBe(false);
      expect(resDe.reason).toContain('LANGUAGE_NOT_INSTALLED');

      const docEs = {
        id: 'es-1',
        language: 'es' as const,
        title: 'Estructuras de Datos',
        content: 'Una estructura de datos es una forma particular de organizar datos en una computadora.',
        domain: 'computer_science',
        nativeGlossaryTerms: ['estructura de datos'],
        license: 'CC-BY-4.0',
      };
      const resEs = pack.ingest(docEs);
      expect(resEs.success).toBe(true);

      const results = pack.query('datos', 'es');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Estructuras de Datos');
    });

    it('enforces embedding model compatibility for multilingual packs', () => {
      const pack = new MultilingualPack(['fr']);
      const badEmbedding = pack.configureEmbedding({
        packId: 'multilingual-fr',
        language: 'fr',
        modelName: 'text-embedding-ada-002',
        dimension: 1536,
        modelVersion: 'v1',
        isMultilingual: false,
        migrationRequired: false,
      });
      expect(badEmbedding.valid).toBe(false);
      expect(badEmbedding.reason).toContain('NOT_MULTILINGUAL');

      const goodEmbedding = pack.configureEmbedding({
        packId: 'multilingual-fr',
        language: 'fr',
        modelName: 'text-embedding-3-large',
        dimension: 3072,
        modelVersion: 'v1',
        isMultilingual: true,
        migrationRequired: false,
      });
      expect(goodEmbedding.valid).toBe(true);
    });
  });
});
