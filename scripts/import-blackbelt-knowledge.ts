import fs from 'fs';
import path from 'path';

interface BlackbeltChunk {
  source: string;
  domain: 'sixsigma';
  category: string;
  topic: string;
  beltLevel: string;
  authority: 'canonical';
  content: string;
  lastUpdated?: string;
}

const sourceRoot = process.argv[2] || process.env.BLACKBELT_SOURCE_DIR || path.join(process.env.TEMP || '', 'blackbelt-source');
const outputDir = path.join(process.cwd(), 'knowledge-base-public', 'sixsigma', 'imported');
const sourceFiles = [
  'src/features/comprehensive-chatbot/ComprehensiveKnowledgeBase.ts',
  'src/features/comprehensive-chatbot/SixSigmaToolsKnowledge.ts',
  'src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts',
  'src/features/comprehensive-chatbot/SupplierCompliance.ts',
  'src/features/comprehensive-chatbot/SDSAndLabeling.ts',
  'src/features/comprehensive-chatbot/AuditChecklists.ts',
  'src/features/comprehensive-chatbot/CaseStudies.ts',
  'src/features/comprehensive-chatbot/ESGSustainability.ts',
  'src/features/comprehensive-chatbot/QualitySoftwareSystems.ts',
  'src/features/comprehensive-chatbot/AIQualityKnowledge.ts',
  'src/features/comprehensive-chatbot/IndustryPlaybooks.ts',
  'src/features/comprehensive-chatbot/Calculators.ts'
];

function extractChunks(filePath: string): BlackbeltChunk[] {
  if (!fs.existsSync(filePath)) return [];
  const relative = path.relative(sourceRoot, filePath).replace(/\\/g, '/');
  const text = fs.readFileSync(filePath, 'utf8');
  const objectMatches = text.match(/\{[\s\S]*?category:\s*['"`][\s\S]*?content:\s*`[\s\S]*?`[\s\S]*?\}/g) || [];

  return objectMatches.map((objectText, index) => {
    const category = matchField(objectText, 'category') || inferCategory(relative);
    const topic = matchField(objectText, 'topic') || matchField(objectText, 'title') || `${category} ${index + 1}`;
    const beltLevel = matchField(objectText, 'beltLevel') || 'All';
    const content = matchTemplateField(objectText, 'content') || stripTsNoise(objectText);
    return {
      source: relative,
      domain: 'sixsigma',
      category,
      topic,
      beltLevel,
      authority: 'canonical',
      content,
      lastUpdated: new Date().toISOString().slice(0, 10)
    };
  });
}

function matchField(objectText: string, field: string): string | undefined {
  return objectText.match(new RegExp(`${field}:\\s*['"\`]([^'"\`]+)['"\`]`))?.[1];
}

function matchTemplateField(objectText: string, field: string): string | undefined {
  return objectText.match(new RegExp(`${field}:\\s*\`([\\s\\S]*?)\``))?.[1]?.trim();
}

function inferCategory(relative: string): string {
  return path.basename(relative, '.ts').replace(/([a-z])([A-Z])/g, '$1 $2');
}

function stripTsNoise(objectText: string): string {
  return objectText
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function writeOutputs(chunks: BlackbeltChunk[]) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'blackbelt-knowledge-records.json'), `${JSON.stringify(chunks, null, 2)}\n`);
  const markdown = chunks.map(chunk => [
    `# ${chunk.topic}`,
    '',
    `Source: ${chunk.source}`,
    `Domain: ${chunk.domain}`,
    `Category: ${chunk.category}`,
    `Belt level: ${chunk.beltLevel}`,
    `Authority: ${chunk.authority}`,
    chunk.lastUpdated ? `Last updated: ${chunk.lastUpdated}` : '',
    '',
    chunk.content
  ].filter(Boolean).join('\n')).join('\n\n---\n\n');
  fs.writeFileSync(path.join(outputDir, 'blackbelt-knowledge-records.md'), `${markdown}\n`);
}

const chunks = sourceFiles.flatMap(relative => extractChunks(path.join(sourceRoot, relative)));
writeOutputs(chunks);
console.log(`Imported ${chunks.length} Blackbelt knowledge records into ${outputDir}`);
