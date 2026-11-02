/**
 * Canonical Conversation Variable Extractor (CRK-P03-T03)
 *
 * Extracts structured conversation variables following strict priority order:
 * 1. Deterministic structured request fields
 * 2. Explicit user statements
 * 3. Project/repository facts from loaded files / tools
 * 4. High-confidence inference
 * 5. Leave unset if ambiguous
 *
 * High-confidence explicit values are assigned confidence 1.0 and must never be
 * overridden by low-confidence inference (§1041).
 */

import { NormalizedChatRequest } from '../../types/chat-runtime';
import { ConversationVariable, SupportedVariableKey } from '../../types/conversation-state';

export interface ExtractedVariablesResult {
  variables: Record<string, ConversationVariable>;
  ambiguities: string[];
}

export class ConversationVariableExtractor {
  public extract(request: NormalizedChatRequest): ExtractedVariablesResult {
    const extracted: Record<string, ConversationVariable> = {};
    const ambiguities: string[] = [];
    const now = new Date().toISOString();
    const turnId = request.requestId;

    const setVar = (key: SupportedVariableKey, value: unknown, confidence: number, source: 'explicit' | 'inferred' | 'tool' | 'project') => {
      const existing = extracted[key];
      if (!existing || existing.confidence <= confidence) {
        extracted[key] = {
          key,
          value,
          confidence,
          sourceTurnId: turnId,
          source,
          updatedAt: now,
        };
      }
    };

    // 1. Deterministic structured request fields
    if (request.mode) {
      setVar('selectedMode', request.mode, 1.0, 'explicit');
    }
    if (request.requestedModelPolicy) {
      setVar('selectedModelPolicy', request.requestedModelPolicy, 1.0, 'explicit');
    }
    if (request.activePlan?.id) {
      setVar('activePlanId', request.activePlan.id, 1.0, 'explicit');
    }
    if (request.metadata) {
      const meta = request.metadata;
      if (typeof meta.workspaceRoot === 'string' && meta.workspaceRoot) {
        setVar('workspaceRoot', meta.workspaceRoot, 1.0, 'project');
      }
      if (typeof meta.repository === 'string' && meta.repository) {
        setVar('repository', meta.repository, 1.0, 'project');
      }
      if (typeof meta.currentProject === 'string' && meta.currentProject) {
        setVar('currentProject', meta.currentProject, 1.0, 'project');
      }
      if (typeof meta.programmingLanguage === 'string' && meta.programmingLanguage) {
        setVar('programmingLanguage', meta.programmingLanguage, 1.0, 'explicit');
      }
    }

    // 2. Explicit user statements
    const msg = request.message;

    // Framework and version: e.g. "this is Godot 4.7", "using React 19", "I use Godot 4.3", "working on Godot 4.7"
    const frameworkVersionRegex = /\b(?:this\s+is|using|use|with|built\s+with|in|working\s+on|working\s+with|develop(?:ing)?\s+in)\s+(Godot|React|Vue|Angular|Next(?:\.js)?|Svelte|FastAPI|Django|Flask|Express)\s+([0-9]+(?:\.[0-9]+)*)\b/i;
    const fvMatch = msg.match(frameworkVersionRegex);
    if (fvMatch) {
      const name = this.normalizeFrameworkName(fvMatch[1]);
      setVar('framework', name, 1.0, 'explicit');
      setVar('frameworkVersion', fvMatch[2], 1.0, 'explicit');
    } else {
      // Framework only: "I use Godot", "we use React", "working on Godot"
      const frameworkOnlyRegex = /\b(?:this\s+is|using|use|with|built\s+with|in|working\s+on|working\s+with|develop(?:ing)?\s+in)\s+(Godot|React|Vue|Angular|Next(?:\.js)?|Svelte|FastAPI|Django|Flask|Express)\b/i;
      const fMatch = msg.match(frameworkOnlyRegex);
      if (fMatch) {
        setVar('framework', this.normalizeFrameworkName(fMatch[1]), 1.0, 'explicit');
      }
    }

    // Programming language: "programming in python", "language is TypeScript", "using Rust"
    const langRegex = /\b(?:language\s+is|programming\s+in|code\s+in|written\s+in)\s+([A-Za-z#+]+)\b/i;
    const lMatch = msg.match(langRegex);
    if (lMatch) {
      setVar('programmingLanguage', this.normalizeLanguageName(lMatch[1]), 1.0, 'explicit');
    }

    // Operating system: "operating system is Windows 11", "on Windows", "on macOS", "on Ubuntu"
    const osRegex = /\b(?:operating\s+system\s+is|on\s+)(Windows(?: 10| 11)?|macOS|Linux|Ubuntu)\b/i;
    const osMatch = msg.match(osRegex);
    if (osMatch) {
      setVar('operatingSystem', osMatch[1], 1.0, 'explicit');
    }

    // Target platform: "target platform is iOS", "targeting Android", "target: Web"
    const platformRegex = /\b(?:target(?:ing|\s+platform\s+is)?|deploy\s+to)\s+(iOS|Android|Web|Desktop|macOS|Windows|Linux)\b/i;
    const pMatch = msg.match(platformRegex);
    if (pMatch) {
      setVar('targetPlatform', pMatch[1], 1.0, 'explicit');
    }

    // Explicit repository: "repo is my-app", "switch to repo foo-backend", "repository: acme/engine"
    const repoRegex = /\b(?:repo(?:sitory)?(?:\s+is|:)?|\bswitch\s+to\s+repo)\s+([a-zA-Z0-9_\-./]+)\b/i;
    const rMatch = msg.match(repoRegex);
    if (rMatch && !rMatch[1].toLowerCase().includes('the') && !rMatch[1].toLowerCase().includes('other')) {
      setVar('repository', rMatch[1], 1.0, 'explicit');
    } else if (msg.match(/\bswitch\s+to\s+the\s+other\s+repo\b/i)) {
      // Ambiguous repository switch without explicit name
      ambiguities.push('Ambiguous repository switch: target repository name unspecified');
    }

    // User goal: "my goal is ...", "I want to ...", "I need to ..."
    const goalRegex = /\b(?:my\s+goal\s+is|i\s+want\s+to|i\s+need\s+to)\s+([^.!?\n]+)/i;
    const gMatch = msg.match(goalRegex);
    if (gMatch && !extracted.userGoal) {
      setVar('userGoal', gMatch[1].trim(), 0.95, 'explicit');
    }

    // Requested output: "in JSON", "as markdown table", "format: csv"
    const outputRegex = /\b(?:in|as|format:?)\s+(json|markdown|yaml|csv|xml|table)\b/i;
    const outMatch = msg.match(outputRegex);
    if (outMatch) {
      setVar('requestedOutput', outMatch[1].toLowerCase(), 0.9, 'explicit');
    }

    // 3. Project/repository facts from loaded files
    if (request.loadedFiles && request.loadedFiles.length > 0) {
      for (const file of request.loadedFiles) {
        const p = file.path.toLowerCase();
        if (p.endsWith('project.godot') || p.endsWith('godot.project')) {
          setVar('framework', 'Godot', 0.9, 'project');
        } else if (p.endsWith('package.json')) {
          setVar('runtimeVersion', 'node', 0.85, 'project');
        } else if (p.endsWith('cargo.toml')) {
          setVar('programmingLanguage', 'Rust', 0.9, 'project');
        }
      }
    }

    // 4. High-confidence inference from file extensions or GDScript mentions
    if (!extracted.programmingLanguage && request.loadedFiles) {
      for (const file of request.loadedFiles) {
        if (file.path.endsWith('.gd')) {
          setVar('programmingLanguage', 'GDScript', 0.75, 'inferred');
          setVar('framework', 'Godot', 0.75, 'inferred');
          break;
        } else if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
          setVar('programmingLanguage', 'TypeScript', 0.75, 'inferred');
          break;
        } else if (file.path.endsWith('.py')) {
          setVar('programmingLanguage', 'Python', 0.75, 'inferred');
          break;
        }
      }
    }

    return { variables: extracted, ambiguities };
  }

  private normalizeFrameworkName(raw: string): string {
    const l = raw.toLowerCase();
    if (l.includes('godot')) return 'Godot';
    if (l.includes('react')) return 'React';
    if (l.includes('vue')) return 'Vue';
    if (l.includes('next')) return 'Next.js';
    if (l.includes('angular')) return 'Angular';
    if (l.includes('svelte')) return 'Svelte';
    if (l.includes('django')) return 'Django';
    if (l.includes('flask')) return 'Flask';
    if (l.includes('fastapi')) return 'FastAPI';
    if (l.includes('express')) return 'Express';
    return raw;
  }

  private normalizeLanguageName(raw: string): string {
    const l = raw.toLowerCase();
    if (l === 'ts' || l === 'typescript') return 'TypeScript';
    if (l === 'js' || l === 'javascript') return 'JavaScript';
    if (l === 'py' || l === 'python') return 'Python';
    if (l === 'rs' || l === 'rust') return 'Rust';
    if (l === 'go' || l === 'golang') return 'Go';
    if (l === 'gdscript' || l === 'gd') return 'GDScript';
    if (l === 'cpp' || l === 'c++') return 'C++';
    if (l === 'cs' || l === 'c#' || l === 'csharp') return 'C#';
    return raw;
  }
}
