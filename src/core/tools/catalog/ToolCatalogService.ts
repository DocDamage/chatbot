import { v4 as uuidv4 } from 'uuid';
import { Database } from '../../database/Database';
import { boolParam, ensureExpansionDatabase, jsonParam } from '../../database/ExpansionDatabase';

export interface ToolCatalogRecord {
  id?: string;
  name: string;
  slug: string;
  category: string;
  subcategory?: string;
  description?: string;
  replacesPaidTools?: string[];
  comparableTools?: string[];
  openSourceStatus?: string;
  license?: string;
  licenseUrl?: string;
  costModel?: string;
  platforms?: string[];
  officialUrl?: string;
  sourceUrl?: string;
  installMethods?: string[];
  executableNames?: string[];
  cliSupport?: boolean;
  apiSupport?: boolean;
  bestFor?: string[];
  notGoodFor?: string[];
  difficultyLevel?: string;
  integrationStatus?: string;
  integrationModule?: string;
  trustLevel?: string;
  metadata?: Record<string, unknown>;
}

const initialCatalog: ToolCatalogRecord[] = [
  {
    name: 'Python',
    slug: 'python',
    category: 'data_science',
    subcategory: 'numerical_computing',
    description: 'General-purpose language used for automation, data science, SEC analysis, image/audio helpers, and local scripting.',
    replacesPaidTools: ['MATLAB scripting workflows', 'SAS scripting workflows'],
    openSourceStatus: 'open_source',
    license: 'Python Software Foundation License',
    costModel: 'free',
    platforms: ['windows', 'macos', 'linux'],
    installMethods: ['python.org installer', 'winget', 'chocolatey', 'brew', 'apt'],
    executableNames: ['python', 'python3'],
    cliSupport: true,
    apiSupport: true,
    bestFor: ['automation', 'data analysis', 'SEC analysis', 'image processing', 'audio metadata helpers'],
    integrationStatus: 'required_bridge',
    integrationModule: 'python_runner',
    trustLevel: 'standard'
  },
  {
    name: 'R',
    slug: 'r',
    category: 'data_science',
    subcategory: 'statistics',
    description: 'Statistical computing environment for regression, ANOVA, reports, and CSV analysis.',
    replacesPaidTools: ['SPSS', 'SAS', 'Stata'],
    openSourceStatus: 'open_source',
    license: 'GPL',
    costModel: 'free',
    platforms: ['windows', 'macos', 'linux'],
    executableNames: ['Rscript', 'R'],
    cliSupport: true,
    bestFor: ['statistics', 'regression', 'ANOVA', 'CSV analysis'],
    integrationStatus: 'required_bridge',
    integrationModule: 'r_runner',
    trustLevel: 'standard'
  },
  {
    name: 'GNU Octave',
    slug: 'gnu-octave',
    category: 'engineering',
    subcategory: 'numerical_computing',
    description: 'MATLAB-like numerical computing environment for matrix and engineering calculations.',
    replacesPaidTools: ['MATLAB'],
    openSourceStatus: 'open_source',
    license: 'GPL',
    costModel: 'free',
    platforms: ['windows', 'macos', 'linux'],
    executableNames: ['octave'],
    cliSupport: true,
    bestFor: ['matrix calculations', 'engineering math', 'MATLAB-style scripts'],
    integrationStatus: 'required_bridge',
    integrationModule: 'octave_runner',
    trustLevel: 'standard'
  },
  {
    name: 'Aseprite',
    slug: 'aseprite',
    category: 'creative',
    subcategory: 'pixel_art',
    description: 'Primary sprite and pixel-art workflow tool for .ase/.aseprite inspection, spritesheet export, animation tags, and palette workflows.',
    replacesPaidTools: ['Photoshop pixel workflows', 'Pyxel Edit'],
    comparableTools: ['LibreSprite', 'Pixelorama', 'Piskel'],
    openSourceStatus: 'source_available_private_build',
    license: 'Aseprite EULA',
    costModel: 'paid_prebuilt_private_source_build_supported',
    platforms: ['windows', 'macos', 'linux'],
    executableNames: ['aseprite', 'aseprite.exe'],
    cliSupport: true,
    bestFor: ['sprite sheets', 'animation tags', 'pixel art', 'palettes'],
    notGoodFor: ['public redistribution of compiled binaries without license clearance'],
    integrationStatus: 'required_bridge',
    integrationModule: 'sprite_lab_aseprite',
    trustLevel: 'standard',
    metadata: { fallbackOrder: ['aseprite', 'libresprite', 'pixelorama', 'internal_sharp', 'internal_python'] }
  },
  {
    name: 'LibreSprite',
    slug: 'libresprite',
    category: 'creative',
    subcategory: 'pixel_art',
    description: 'Open-source sprite editor used as an Aseprite fallback where compatible.',
    comparableTools: ['Aseprite', 'Pixelorama'],
    openSourceStatus: 'open_source',
    license: 'GPL',
    costModel: 'free',
    platforms: ['windows', 'macos', 'linux'],
    executableNames: ['libresprite', 'libresprite.exe'],
    cliSupport: true,
    integrationStatus: 'required_fallback',
    integrationModule: 'sprite_lab_libresprite',
    trustLevel: 'standard'
  },
  {
    name: 'Pixelorama',
    slug: 'pixelorama',
    category: 'creative',
    subcategory: 'pixel_art',
    description: 'Open-source pixel-art editor used as a fallback for sprite workflows.',
    comparableTools: ['Aseprite', 'LibreSprite'],
    openSourceStatus: 'open_source',
    license: 'MIT',
    costModel: 'free',
    platforms: ['windows', 'macos', 'linux'],
    executableNames: ['pixelorama', 'pixelorama.exe'],
    cliSupport: false,
    integrationStatus: 'required_fallback',
    integrationModule: 'sprite_lab_pixelorama',
    trustLevel: 'standard'
  },
  {
    name: 'Blender',
    slug: 'blender',
    category: 'creative',
    subcategory: '3d_asset_pipeline',
    description: '3D modeling, rendering, conversion, thumbnail, and asset validation bridge.',
    replacesPaidTools: ['Maya', '3ds Max', 'Cinema 4D'],
    openSourceStatus: 'open_source',
    license: 'GPL',
    costModel: 'free',
    platforms: ['windows', 'macos', 'linux'],
    executableNames: ['blender', 'blender.exe'],
    cliSupport: true,
    bestFor: ['GLB/GLTF workflows', 'renders', 'asset validation', 'batch conversion'],
    integrationStatus: 'required_bridge',
    integrationModule: 'blender_bridge',
    trustLevel: 'standard'
  },
  {
    name: 'Godot',
    slug: 'godot',
    category: 'gamedev',
    subcategory: 'game_engine',
    description: 'Free/open-source 2D and 3D game engine bridge for project templates, scripts, and validation.',
    replacesPaidTools: ['Unity indie workflows', 'Unreal indie workflows'],
    openSourceStatus: 'open_source',
    license: 'MIT',
    costModel: 'free',
    platforms: ['windows', 'macos', 'linux'],
    executableNames: ['godot', 'godot.exe'],
    cliSupport: true,
    integrationStatus: 'required_bridge',
    integrationModule: 'godot_bridge',
    trustLevel: 'standard'
  },
  {
    name: 'FreeCAD',
    slug: 'freecad',
    category: 'engineering',
    subcategory: 'cad',
    description: 'Open-source parametric CAD bridge for macros, measurements, and export workflows.',
    replacesPaidTools: ['AutoCAD', 'SolidWorks', 'Fusion 360'],
    openSourceStatus: 'open_source',
    license: 'LGPL',
    costModel: 'free',
    platforms: ['windows', 'macos', 'linux'],
    executableNames: ['FreeCAD', 'FreeCAD.exe', 'freecad'],
    cliSupport: true,
    integrationStatus: 'required_bridge',
    integrationModule: 'freecad_bridge',
    trustLevel: 'standard'
  },
  {
    name: 'KiCad',
    slug: 'kicad',
    category: 'engineering',
    subcategory: 'electronics_pcb',
    description: 'Open-source electronics and PCB design bridge for project inspection, BOMs, and fabrication reports.',
    replacesPaidTools: ['Altium Designer', 'EAGLE paid workflows'],
    openSourceStatus: 'open_source',
    license: 'GPL',
    costModel: 'free',
    platforms: ['windows', 'macos', 'linux'],
    executableNames: ['kicad-cli', 'kicad-cli.exe', 'kicad'],
    cliSupport: true,
    integrationStatus: 'required_bridge',
    integrationModule: 'kicad_bridge',
    trustLevel: 'standard'
  },
  {
    name: 'MIT OpenCourseWare',
    slug: 'mit-opencourseware',
    category: 'education',
    subcategory: 'university_courses',
    description: 'Free university course materials for study paths and curriculum planning.',
    openSourceStatus: 'open_education_resource',
    costModel: 'free',
    platforms: ['web'],
    officialUrl: 'https://ocw.mit.edu',
    cliSupport: false,
    apiSupport: false,
    bestFor: ['university-level learning', 'self-study', 'course planning'],
    integrationStatus: 'cataloged',
    integrationModule: 'education_builder',
    trustLevel: 'standard'
  },
  {
    name: 'freeCodeCamp',
    slug: 'freecodecamp',
    category: 'education',
    subcategory: 'coding_bootcamp_replacement',
    description: 'Free coding curriculum source for learning paths and coding practice.',
    openSourceStatus: 'open_education_resource',
    costModel: 'free',
    platforms: ['web'],
    officialUrl: 'https://www.freecodecamp.org',
    cliSupport: false,
    bestFor: ['coding bootcamp replacement', 'web development learning'],
    integrationStatus: 'cataloged',
    integrationModule: 'education_builder',
    trustLevel: 'standard'
  }
];

export class ToolCatalogService {
  private seeded = false;

  constructor(private readonly database?: Database) {}

  async seedInitialCatalog(): Promise<{ insertedOrUpdated: number }> {
    const database = await ensureExpansionDatabase(this.database);
    let insertedOrUpdated = 0;
    for (const record of initialCatalog) {
      await this.upsertTool(record, database);
      insertedOrUpdated += 1;
    }
    this.seeded = true;
    return { insertedOrUpdated };
  }

  async listTools(filters: { category?: string; q?: string; limit?: number } = {}): Promise<ToolCatalogRecord[]> {
    const database = await this.readyDatabase();
    const params: any[] = [];
    const where: string[] = [];

    if (filters.category) {
      where.push('category = ?');
      params.push(filters.category);
    }

    if (filters.q) {
      where.push('(LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(slug) LIKE ?)');
      const term = `%${filters.q.toLowerCase()}%`;
      params.push(term, term, term);
    }

    const limit = Math.min(Math.max(filters.limit || 100, 1), 500);
    const result = await database.query(
      `SELECT * FROM tool_catalog ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY category, name LIMIT ?`,
      [...params, limit]
    );

    return result.rows.map(row => this.mapRow(row));
  }

  async getStats(): Promise<{ total: number; byCategory: Record<string, number> }> {
    const database = await this.readyDatabase();
    const total = await database.query('SELECT COUNT(*) AS count FROM tool_catalog');
    const byCategoryRows = await database.query('SELECT category, COUNT(*) AS count FROM tool_catalog GROUP BY category ORDER BY category');
    const byCategory: Record<string, number> = {};
    for (const row of byCategoryRows.rows) {
      byCategory[row.category] = Number(row.count);
    }
    return { total: Number(total.rows[0]?.count || 0), byCategory };
  }

  private async readyDatabase(): Promise<Database> {
    const database = await ensureExpansionDatabase(this.database);
    if (!this.seeded) {
      await this.seedInitialCatalog();
    }
    return database;
  }

  private async upsertTool(record: ToolCatalogRecord, database: Database): Promise<void> {
    const id = record.id || uuidv4();
    await database.query(
      `INSERT INTO tool_catalog (
        id, name, slug, category, subcategory, description,
        replaces_paid_tools_json, comparable_tools_json, open_source_status, license, license_url,
        cost_model, platforms_json, official_url, source_url, install_methods_json,
        executable_names_json, cli_support, api_support, best_for_json, not_good_for_json,
        difficulty_level, integration_status, integration_module, trust_level, metadata_json, last_verified_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (slug) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        subcategory = excluded.subcategory,
        description = excluded.description,
        replaces_paid_tools_json = excluded.replaces_paid_tools_json,
        comparable_tools_json = excluded.comparable_tools_json,
        open_source_status = excluded.open_source_status,
        license = excluded.license,
        license_url = excluded.license_url,
        cost_model = excluded.cost_model,
        platforms_json = excluded.platforms_json,
        official_url = excluded.official_url,
        source_url = excluded.source_url,
        install_methods_json = excluded.install_methods_json,
        executable_names_json = excluded.executable_names_json,
        cli_support = excluded.cli_support,
        api_support = excluded.api_support,
        best_for_json = excluded.best_for_json,
        not_good_for_json = excluded.not_good_for_json,
        difficulty_level = excluded.difficulty_level,
        integration_status = excluded.integration_status,
        integration_module = excluded.integration_module,
        trust_level = excluded.trust_level,
        metadata_json = excluded.metadata_json,
        last_verified_at = excluded.last_verified_at,
        updated_at = excluded.updated_at`,
      [
        id,
        record.name,
        record.slug,
        record.category,
        record.subcategory || null,
        record.description || null,
        jsonParam(record.replacesPaidTools || []),
        jsonParam(record.comparableTools || []),
        record.openSourceStatus || null,
        record.license || null,
        record.licenseUrl || null,
        record.costModel || null,
        jsonParam(record.platforms || []),
        record.officialUrl || null,
        record.sourceUrl || null,
        jsonParam(record.installMethods || []),
        jsonParam(record.executableNames || []),
        boolParam(database, record.cliSupport === true),
        boolParam(database, record.apiSupport === true),
        jsonParam(record.bestFor || []),
        jsonParam(record.notGoodFor || []),
        record.difficultyLevel || null,
        record.integrationStatus || 'cataloged',
        record.integrationModule || null,
        record.trustLevel || 'standard',
        jsonParam(record.metadata || {})
      ]
    );
  }

  private mapRow(row: any): ToolCatalogRecord {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      category: row.category,
      subcategory: row.subcategory || undefined,
      description: row.description || undefined,
      openSourceStatus: row.open_source_status || undefined,
      license: row.license || undefined,
      licenseUrl: row.license_url || undefined,
      costModel: row.cost_model || undefined,
      officialUrl: row.official_url || undefined,
      sourceUrl: row.source_url || undefined,
      cliSupport: Boolean(row.cli_support),
      apiSupport: Boolean(row.api_support),
      difficultyLevel: row.difficulty_level || undefined,
      integrationStatus: row.integration_status || undefined,
      integrationModule: row.integration_module || undefined,
      trustLevel: row.trust_level || undefined,
      replacesPaidTools: this.parseJson(row.replaces_paid_tools_json, []),
      comparableTools: this.parseJson(row.comparable_tools_json, []),
      platforms: this.parseJson(row.platforms_json, []),
      installMethods: this.parseJson(row.install_methods_json, []),
      executableNames: this.parseJson(row.executable_names_json, []),
      bestFor: this.parseJson(row.best_for_json, []),
      notGoodFor: this.parseJson(row.not_good_for_json, []),
      metadata: this.parseJson(row.metadata_json, {})
    };
  }

  private parseJson<T>(value: unknown, fallback: T): T {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value as T;
    try {
      return JSON.parse(String(value)) as T;
    } catch {
      return fallback;
    }
  }
}
