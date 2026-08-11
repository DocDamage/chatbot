import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type ProjectMemoryCategory = 'decision' | 'changelog' | 'gotcha' | 'note' | 'context';

export interface ProjectMemoryEntry {
  id: string;
  content: string;
  category: ProjectMemoryCategory | string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export class ProjectMemoryService {
  private readonly root: string;
  private readonly entriesDir: string;

  constructor(workspaceRoot = process.cwd()) {
    this.root = path.join(workspaceRoot, '.remembrandt');
    this.entriesDir = path.join(this.root, 'entries');
    fs.mkdirSync(this.entriesDir, { recursive: true });
  }

  remember(input: { content: string; category?: string; tags?: string[] }): ProjectMemoryEntry {
    const content = input.content.trim();
    if (!content) throw new Error('content is required');
    const now = new Date().toISOString();
    const entry: ProjectMemoryEntry = {
      id: randomUUID(),
      content,
      category: input.category?.trim() || 'note',
      tags: (input.tags || []).map(tag => tag.trim()).filter(Boolean).slice(0, 20),
      createdAt: now,
      updatedAt: now
    };
    this.write(entry);
    this.resume();
    return entry;
  }

  list(query?: string, category?: string, limit = 100): ProjectMemoryEntry[] {
    const normalized = query?.trim().toLowerCase();
    return this.readAll()
      .filter(entry => !category || entry.category === category)
      .filter(entry => !normalized || `${entry.content} ${entry.category} ${entry.tags.join(' ')}`.toLowerCase().includes(normalized))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, Math.min(Math.max(limit, 1), 500));
  }

  resume(): { path: string; entries: number } {
    const entries = this.readAll().sort((a, b) => a.category.localeCompare(b.category) || a.createdAt.localeCompare(b.createdAt));
    const sections = new Map<string, ProjectMemoryEntry[]>();
    for (const entry of entries) sections.set(entry.category, [...(sections.get(entry.category) || []), entry]);
    const lines = ['# Project Memory', '', '_Generated from `.remembrandt/entries`; edit entries through the chatbot or directly as JSON._', ''];
    for (const [category, categoryEntries] of sections) {
      lines.push(`## ${category[0].toUpperCase()}${category.slice(1)}`, '');
      for (const entry of categoryEntries) lines.push(`- **${entry.id}** [${entry.createdAt.slice(0, 10)}] ${entry.content}${entry.tags.length ? ` _#${entry.tags.join(' #')}_` : ''}`);
      lines.push('');
    }
    const memoryPath = path.join(this.root, 'MEMORY.md');
    fs.writeFileSync(memoryPath, `${lines.join('\n').trimEnd()}\n`, 'utf8');
    return { path: '.remembrandt/MEMORY.md', entries: entries.length };
  }

  status(): { entries: number; categories: Record<string, number>; memoryPath: string } {
    const entries = this.readAll();
    const categories: Record<string, number> = {};
    for (const entry of entries) categories[entry.category] = (categories[entry.category] || 0) + 1;
    return { entries: entries.length, categories, memoryPath: '.remembrandt/MEMORY.md' };
  }

  private readAll(): ProjectMemoryEntry[] {
    return fs.readdirSync(this.entriesDir).filter(file => file.endsWith('.json')).flatMap(file => {
      try {
        const entry = JSON.parse(fs.readFileSync(path.join(this.entriesDir, file), 'utf8')) as ProjectMemoryEntry;
        return entry?.id && entry?.content ? [entry] : [];
      } catch {
        return [];
      }
    });
  }

  private write(entry: ProjectMemoryEntry): void {
    fs.writeFileSync(path.join(this.entriesDir, `${entry.id}.json`), `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
  }
}
