import fs from 'fs';
import path from 'path';

interface WikiSummaryRecord {
  title: string;
  source: string;
  url: string;
  extract: string;
  events?: string[];
  lastUpdated: string;
}

const outputDir = path.join(process.cwd(), 'knowledge-base-public', 'general', 'wikipedia-summaries');
const apiBase = process.env.WIKIPEDIA_API_BASE || 'https://en.wikipedia.org/api/rest_v1/page/summary';
const maxTopics = Number(process.env.GENERAL_CORPUS_LIMIT || '0');
const delayMs = Number(process.env.GENERAL_CORPUS_DELAY_MS || '350');
const retryDelayMs = Number(process.env.GENERAL_CORPUS_RETRY_DELAY_MS || '2500');
const maxRetries = Number(process.env.GENERAL_CORPUS_RETRIES || '3');
const maxYearEvents = Number(process.env.GENERAL_CORPUS_YEAR_EVENTS || '120');
const requestedTopics = process.env.GENERAL_CORPUS_TOPICS
  ?.split(',')
  .map(topic => topic.trim())
  .filter(Boolean);

const yearTopics = Array.from({ length: 2026 - 1900 + 1 }, (_, index) => String(1900 + index));
const coreTopics = [
  'Barack Obama',
  'George W. Bush',
  'Bill Clinton',
  'Donald Trump',
  'Joe Biden',
  'President of the United States',
  'United States',
  'World War I',
  'World War II',
  'Cold War',
  'American Civil War',
  'French Revolution',
  'Industrial Revolution',
  'Ancient Egypt',
  'Roman Empire',
  'Ancient Greece',
  'Mesopotamia',
  'Renaissance',
  'Middle Ages',
  'Bronze Age',
  'Stone Age',
  'History of the Internet',
  'Internet',
  'World Wide Web',
  'Artificial intelligence',
  'Computer',
  'Smartphone',
  'Electricity',
  'Light bulb',
  'Telephone',
  'Automobile',
  'Airplane',
  'Printing press',
  'Wheel',
  'Agriculture',
  'Writing system',
  'Evolution',
  'DNA',
  'Genome',
  'Physics',
  'Chemistry',
  'Biology',
  'Mathematics',
  'Calculus',
  'Statistics',
  'Probability',
  'Climate change',
  'Solar System',
  'Moon landing',
  'Space exploration',
  'COVID-19 pandemic',
  'September 11 attacks',
  'Hip hop music',
  'Rock music',
  'Pop music',
  'Jazz',
  'Cinema',
  'Television',
  'Video game',
  'Nintendo 64',
  'PlayStation',
  'Toy Story',
  'Tupac Shakur',
  'The Beatles',
  'Michael Jackson',
  'Taylor Swift',
  'Beyoncé',
  'Marvel Cinematic Universe',
  'Star Wars',
  'Harry Potter',
  'Super Bowl',
  'Olympic Games',
  'Six Sigma',
  'Lean manufacturing',
  'Process capability',
  'Standard deviation',
  'Normal distribution',
  'Regression analysis',
  'ANOVA',
  'Control chart'
];

const topics = requestedTopics?.length
  ? Array.from(new Set(requestedTopics))
  : Array.from(new Set([...yearTopics, ...coreTopics])).slice(0, maxTopics > 0 ? maxTopics : undefined);

async function fetchSummary(topic: string): Promise<WikiSummaryRecord | undefined> {
  if (/^\d{4}$/.test(topic)) {
    const yearRecord = await fetchYearRecord(topic);
    if (yearRecord) return yearRecord;
  }

  const url = `${apiBase}/${encodeURIComponent(topic)}`;
  let response: Response | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'ChatBotLocalKnowledgeImporter/1.0 (offline corpus bootstrap)'
      }
    });

    if (response.status !== 429) {
      break;
    }

    await sleep(retryDelayMs * (attempt + 1));
  }

  if (!response?.ok) {
    console.warn(`Skipped ${topic}: HTTP ${response.status}`);
    return undefined;
  }

  const data: any = await response.json();
  if (!data.extract || data.type === 'disambiguation') {
    console.warn(`Skipped ${topic}: no usable extract`);
    return undefined;
  }

  return {
    title: data.title || topic,
    source: 'Wikipedia summary API',
    url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/\s+/g, '_'))}`,
    extract: data.extract,
    lastUpdated: new Date().toISOString().slice(0, 10)
  };
}

async function fetchYearRecord(year: string): Promise<WikiSummaryRecord | undefined> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: '1',
    titles: year,
    format: 'json',
    redirects: '1'
  });
  const url = `https://en.wikipedia.org/w/api.php?${params.toString()}`;
  let response: Response | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'ChatBotLocalKnowledgeImporter/1.0 (offline corpus bootstrap)'
      }
    });

    if (response.status !== 429) {
      break;
    }

    await sleep(retryDelayMs * (attempt + 1));
  }

  if (!response?.ok) {
    console.warn(`Skipped ${year}: HTTP ${response?.status}`);
    return undefined;
  }

  const data: any = await response.json();
  const page = Object.values(data.query?.pages || {})[0] as any;
  const extract = page?.extract;
  if (!extract) {
    console.warn(`Skipped ${year}: no usable extract`);
    return undefined;
  }

  const summary = extract.split(/\n==\s*Events\s*==/)[0]?.trim() || `${year} historical record.`;
  const events = extractYearEvents(extract).slice(0, maxYearEvents);
  return {
    title: year,
    source: 'Wikipedia full extract API',
    url: `https://en.wikipedia.org/wiki/${year}`,
    extract: summary,
    events,
    lastUpdated: new Date().toISOString().slice(0, 10)
  };
}

function extractYearEvents(extract: string): string[] {
  const eventsSection = extract.match(/==\s*Events\s*==([\s\S]*?)(?:\n==\s*(?:Births|Deaths|Nobel|References|Further reading|External links)\s*==|$)/i)?.[1] || '';
  return eventsSection
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !/^=+/.test(line))
    .map(line => line.replace(/^\*+\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(line => /[–-]/.test(line) || /January|February|March|April|May|June|July|August|September|October|November|December/.test(line));
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function writeRecord(record: WikiSummaryRecord) {
  const slug = slugify(record.title);
  const markdown = [
    `# ${record.title}`,
    '',
    'Domain: general',
    `Topic: ${record.title}`,
    'Authority: reference',
    'Trust score: 0.72',
    `Source: ${record.source}`,
    `Source URL: ${record.url}`,
    `Last updated: ${record.lastUpdated}`,
    '',
    '## Summary',
    '',
    record.extract,
    ...(record.events?.length
      ? [
          '',
          '## Events',
          '',
          ...record.events.map(event => `- ${event}`)
        ]
      : [])
  ].join('\n');

  fs.writeFileSync(path.join(outputDir, `${slug}.md`), `${markdown}\n`);
  return {
    ...record,
    file: `knowledge-base-public/general/wikipedia-summaries/${slug}.md`
  };
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const records = [];
  for (const topic of topics) {
    const expectedSlug = slugify(topic);
    const existingFile = path.join(outputDir, `${expectedSlug}.md`);
    const existingNeedsYearEvents = /^\d{4}$/.test(topic) &&
      fs.existsSync(existingFile) &&
      !fs.readFileSync(existingFile, 'utf8').includes('## Events');
    if (fs.existsSync(existingFile) && !existingNeedsYearEvents) {
      continue;
    }

    const record = await fetchSummary(topic);
    if (record) {
      records.push(writeRecord(record));
    }
    await sleep(delayMs);
  }

  const existingRecords = fs.readdirSync(outputDir)
    .filter(file => file.endsWith('.md'))
    .map(file => ({ file: `knowledge-base-public/general/wikipedia-summaries/${file}` }));
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(existingRecords, null, 2)}\n`);
  console.log(`Imported ${records.length} new general knowledge records; corpus now has ${existingRecords.length} markdown records in ${outputDir}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
