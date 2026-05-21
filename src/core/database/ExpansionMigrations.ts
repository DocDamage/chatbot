import type { DatabaseConfig } from './Database';

export function getExpansionMigrations(type: DatabaseConfig['type']): string[] {
  const isPostgres = type === 'postgresql';
  const jsonType = isPostgres ? 'JSONB' : 'TEXT';
  const timestampType = isPostgres ? 'TIMESTAMPTZ' : 'DATETIME';
  const timestampDefault = isPostgres ? 'CURRENT_TIMESTAMP' : 'CURRENT_TIMESTAMP';
  const boolType = isPostgres ? 'BOOLEAN' : 'INTEGER';

  return [
    ...toolCatalogMigrations(jsonType, timestampType, timestampDefault, boolType),
    ...localToolMigrations(jsonType, timestampType, timestampDefault, boolType),
    ...secMigrations(jsonType, timestampType, timestampDefault),
    ...educationMigrations(jsonType, timestampType, timestampDefault),
  ];
}

function toolCatalogMigrations(jsonType: string, timestampType: string, timestampDefault: string, boolType: string): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS tool_catalog (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      subcategory TEXT,
      description TEXT,
      replaces_paid_tools_json ${jsonType},
      comparable_tools_json ${jsonType},
      open_source_status TEXT,
      license TEXT,
      license_url TEXT,
      cost_model TEXT,
      platforms_json ${jsonType},
      official_url TEXT,
      source_url TEXT,
      install_methods_json ${jsonType},
      executable_names_json ${jsonType},
      cli_support ${boolType} DEFAULT 0,
      api_support ${boolType} DEFAULT 0,
      best_for_json ${jsonType},
      not_good_for_json ${jsonType},
      difficulty_level TEXT,
      integration_status TEXT NOT NULL DEFAULT 'cataloged',
      integration_module TEXT,
      trust_level TEXT NOT NULL DEFAULT 'standard',
      last_verified_at ${timestampType},
      metadata_json ${jsonType},
      created_at ${timestampType} DEFAULT ${timestampDefault},
      updated_at ${timestampType} DEFAULT ${timestampDefault}
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tool_catalog_category ON tool_catalog (category, subcategory)`,
    `CREATE INDEX IF NOT EXISTS idx_tool_catalog_integration_status ON tool_catalog (integration_status)`,
    `CREATE TABLE IF NOT EXISTS tool_capabilities (
      id TEXT PRIMARY KEY,
      tool_id TEXT NOT NULL,
      capability_key TEXT NOT NULL,
      capability_name TEXT NOT NULL,
      description TEXT,
      input_types_json ${jsonType},
      output_types_json ${jsonType},
      requires_executable ${boolType} DEFAULT 0,
      requires_network ${boolType} DEFAULT 0,
      risk_level TEXT NOT NULL DEFAULT 'low',
      created_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (tool_id) REFERENCES tool_catalog(id) ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_tool_capabilities_tool_key ON tool_capabilities (tool_id, capability_key)`,
    `CREATE TABLE IF NOT EXISTS tool_replacement_maps (
      id TEXT PRIMARY KEY,
      paid_tool_name TEXT NOT NULL,
      paid_tool_category TEXT,
      free_tool_id TEXT NOT NULL,
      fit_score REAL DEFAULT 0,
      replacement_type TEXT,
      tradeoffs_json ${jsonType},
      notes TEXT,
      created_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (free_tool_id) REFERENCES tool_catalog(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tool_replacement_maps_paid_tool ON tool_replacement_maps (paid_tool_name)`,
    `CREATE TABLE IF NOT EXISTS tool_install_profiles (
      id TEXT PRIMARY KEY,
      tool_id TEXT NOT NULL,
      os TEXT NOT NULL,
      package_manager TEXT,
      install_command TEXT,
      detection_paths_json ${jsonType},
      env_vars_json ${jsonType},
      verification_command TEXT,
      created_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (tool_id) REFERENCES tool_catalog(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tool_install_profiles_tool_os ON tool_install_profiles (tool_id, os)`,
    `CREATE TABLE IF NOT EXISTS tool_user_overrides (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      tool_id TEXT NOT NULL,
      executable_path TEXT,
      enabled ${boolType} DEFAULT 1,
      trust_level TEXT NOT NULL DEFAULT 'standard',
      approval_policy TEXT NOT NULL DEFAULT 'ask_each_run',
      notes TEXT,
      created_at ${timestampType} DEFAULT ${timestampDefault},
      updated_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (tool_id) REFERENCES tool_catalog(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tool_user_overrides_user_tool ON tool_user_overrides (user_id, tool_id)`,
  ];
}

function localToolMigrations(jsonType: string, timestampType: string, timestampDefault: string, boolType: string): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS local_executables (
      id TEXT PRIMARY KEY,
      tool_id TEXT,
      name TEXT NOT NULL,
      executable_path TEXT NOT NULL,
      executable_version TEXT,
      os TEXT NOT NULL,
      detected ${boolType} DEFAULT 0,
      detection_method TEXT,
      enabled ${boolType} DEFAULT 0,
      trust_level TEXT NOT NULL DEFAULT 'untrusted',
      approval_policy TEXT NOT NULL DEFAULT 'ask_each_run',
      last_checked_at ${timestampType},
      metadata_json ${jsonType},
      created_at ${timestampType} DEFAULT ${timestampDefault},
      updated_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (tool_id) REFERENCES tool_catalog(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_local_executables_name_enabled ON local_executables (name, enabled)`,
    `CREATE TABLE IF NOT EXISTS local_tool_runs (
      id TEXT PRIMARY KEY,
      tool_id TEXT,
      executable_id TEXT,
      user_id TEXT,
      command_template TEXT NOT NULL,
      resolved_command_json ${jsonType},
      cwd TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      exit_code INTEGER,
      stdout_path TEXT,
      stderr_path TEXT,
      output_files_json ${jsonType},
      started_at ${timestampType},
      completed_at ${timestampType},
      duration_ms INTEGER,
      risk_level TEXT NOT NULL DEFAULT 'low',
      approved_by_user ${boolType} DEFAULT 0,
      metadata_json ${jsonType},
      created_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (tool_id) REFERENCES tool_catalog(id),
      FOREIGN KEY (executable_id) REFERENCES local_executables(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_local_tool_runs_status_created ON local_tool_runs (status, created_at)`,
    `CREATE TABLE IF NOT EXISTS local_tool_approval_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      tool_id TEXT,
      executable_id TEXT,
      approval_scope TEXT NOT NULL,
      expires_at ${timestampType},
      metadata_json ${jsonType},
      created_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (tool_id) REFERENCES tool_catalog(id),
      FOREIGN KEY (executable_id) REFERENCES local_executables(id)
    )`,
  ];
}

function secMigrations(jsonType: string, timestampType: string, timestampDefault: string): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS sec_companies (
      id TEXT PRIMARY KEY,
      cik TEXT NOT NULL UNIQUE,
      cik_padded TEXT NOT NULL,
      ticker TEXT,
      name TEXT NOT NULL,
      legal_name TEXT,
      former_names_json ${jsonType},
      sic TEXT,
      sic_description TEXT,
      exchange TEXT,
      fiscal_year_end TEXT,
      entity_type TEXT,
      metadata_json ${jsonType},
      created_at ${timestampType} DEFAULT ${timestampDefault},
      updated_at ${timestampType} DEFAULT ${timestampDefault}
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sec_companies_ticker ON sec_companies (ticker)`,
    `CREATE INDEX IF NOT EXISTS idx_sec_companies_name ON sec_companies (name)`,
    `CREATE TABLE IF NOT EXISTS sec_filings (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      cik TEXT NOT NULL,
      accession_number TEXT NOT NULL UNIQUE,
      form_type TEXT NOT NULL,
      filing_date TEXT,
      report_date TEXT,
      acceptance_datetime TEXT,
      act TEXT,
      file_number TEXT,
      film_number TEXT,
      primary_document TEXT,
      primary_document_url TEXT,
      filing_detail_url TEXT,
      local_raw_path TEXT,
      local_html_path TEXT,
      local_text_path TEXT,
      local_xbrl_path TEXT,
      content_hash TEXT,
      ingest_status TEXT NOT NULL DEFAULT 'metadata_only',
      metadata_json ${jsonType},
      created_at ${timestampType} DEFAULT ${timestampDefault},
      updated_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (company_id) REFERENCES sec_companies(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sec_filings_company_form_date ON sec_filings (company_id, form_type, filing_date)`,
    `CREATE INDEX IF NOT EXISTS idx_sec_filings_cik_form ON sec_filings (cik, form_type)`,
    `CREATE TABLE IF NOT EXISTS sec_filing_documents (
      id TEXT PRIMARY KEY,
      filing_id TEXT NOT NULL,
      sequence INTEGER,
      filename TEXT NOT NULL,
      description TEXT,
      document_type TEXT,
      url TEXT,
      local_path TEXT,
      content_type TEXT,
      content_hash TEXT,
      size_bytes INTEGER,
      created_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (filing_id) REFERENCES sec_filings(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sec_filing_documents_filing ON sec_filing_documents (filing_id, sequence)`,
    `CREATE TABLE IF NOT EXISTS sec_filing_sections (
      id TEXT PRIMARY KEY,
      filing_id TEXT NOT NULL,
      item_code TEXT,
      item_title TEXT,
      section_order INTEGER,
      section_text TEXT,
      start_offset INTEGER,
      end_offset INTEGER,
      confidence REAL DEFAULT 0,
      parser_version TEXT,
      created_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (filing_id) REFERENCES sec_filings(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sec_filing_sections_filing_item ON sec_filing_sections (filing_id, item_code)`,
    `CREATE TABLE IF NOT EXISTS sec_filing_chunks (
      id TEXT PRIMARY KEY,
      filing_id TEXT NOT NULL,
      section_id TEXT,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      token_count INTEGER,
      metadata_json ${jsonType},
      created_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (filing_id) REFERENCES sec_filings(id) ON DELETE CASCADE,
      FOREIGN KEY (section_id) REFERENCES sec_filing_sections(id) ON DELETE SET NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sec_filing_chunks_filing_section ON sec_filing_chunks (filing_id, section_id, chunk_index)`,
    `CREATE TABLE IF NOT EXISTS sec_xbrl_facts (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      filing_id TEXT,
      accession_number TEXT,
      taxonomy TEXT,
      concept TEXT NOT NULL,
      label TEXT,
      description TEXT,
      unit TEXT,
      value_numeric REAL,
      value_text TEXT,
      period_start TEXT,
      period_end TEXT,
      fiscal_year INTEGER,
      fiscal_period TEXT,
      form_type TEXT,
      frame TEXT,
      filed_date TEXT,
      metadata_json ${jsonType},
      created_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (company_id) REFERENCES sec_companies(id),
      FOREIGN KEY (filing_id) REFERENCES sec_filings(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sec_xbrl_facts_company_concept ON sec_xbrl_facts (company_id, concept, fiscal_year)`,
    `CREATE TABLE IF NOT EXISTS sec_watchlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at ${timestampType} DEFAULT ${timestampDefault},
      updated_at ${timestampType} DEFAULT ${timestampDefault}
    )`,
    `CREATE TABLE IF NOT EXISTS sec_watchlist_companies (
      watchlist_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      created_at ${timestampType} DEFAULT ${timestampDefault},
      PRIMARY KEY (watchlist_id, company_id),
      FOREIGN KEY (watchlist_id) REFERENCES sec_watchlists(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES sec_companies(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS sec_ingestion_runs (
      id TEXT PRIMARY KEY,
      run_type TEXT NOT NULL,
      scope TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      started_at ${timestampType},
      completed_at ${timestampType},
      files_seen INTEGER DEFAULT 0,
      files_downloaded INTEGER DEFAULT 0,
      filings_parsed INTEGER DEFAULT 0,
      chunks_created INTEGER DEFAULT 0,
      facts_created INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      errors_json ${jsonType},
      metadata_json ${jsonType}
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sec_ingestion_runs_status ON sec_ingestion_runs (status, started_at)`,
    `CREATE TABLE IF NOT EXISTS sec_source_citations (
      id TEXT PRIMARY KEY,
      filing_id TEXT,
      chunk_id TEXT,
      company_id TEXT,
      citation_label TEXT NOT NULL,
      source_url TEXT,
      local_path TEXT,
      quoted_text TEXT,
      metadata_json ${jsonType},
      created_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (filing_id) REFERENCES sec_filings(id),
      FOREIGN KEY (chunk_id) REFERENCES sec_filing_chunks(id),
      FOREIGN KEY (company_id) REFERENCES sec_companies(id)
    )`,
  ];
}

function educationMigrations(jsonType: string, timestampType: string, timestampDefault: string): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS education_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      source_url TEXT,
      description TEXT,
      metadata_json ${jsonType},
      created_at ${timestampType} DEFAULT ${timestampDefault},
      updated_at ${timestampType} DEFAULT ${timestampDefault}
    )`,
    `CREATE TABLE IF NOT EXISTS education_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      goal TEXT NOT NULL,
      level TEXT,
      sources_json ${jsonType},
      milestones_json ${jsonType},
      status TEXT NOT NULL DEFAULT 'draft',
      created_at ${timestampType} DEFAULT ${timestampDefault},
      updated_at ${timestampType} DEFAULT ${timestampDefault}
    )`,
    `CREATE TABLE IF NOT EXISTS education_flashcards (
      id TEXT PRIMARY KEY,
      plan_id TEXT,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      tags_json ${jsonType},
      created_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (plan_id) REFERENCES education_plans(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS education_quizzes (
      id TEXT PRIMARY KEY,
      plan_id TEXT,
      title TEXT NOT NULL,
      questions_json ${jsonType} NOT NULL,
      created_at ${timestampType} DEFAULT ${timestampDefault},
      FOREIGN KEY (plan_id) REFERENCES education_plans(id) ON DELETE CASCADE
    )`,
  ];
}
