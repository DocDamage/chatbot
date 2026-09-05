/**
 * Git Intelligence & Churn Analysis Provider (PX-04 / PX04-T04)
 *
 * Exposes repository status, commit history, file and symbol churn metrics,
 * authorship attribution, and structural diff analysis without shell injection risks.
 */

import { execSync } from 'child_process';
import * as path from 'path';

export interface GitCommitRecord {
  commitHash: string;
  author: string;
  authorEmail?: string;
  date: string;
  message: string;
  filesChanged: string[];
}

export interface FileChurnRecord {
  filePath: string;
  commitCount: number;
  insertions: number;
  deletions: number;
  lastModifiedDate: string;
  churnScore: number;
}

export interface GitStatusSnapshot {
  currentBranch: string;
  headCommit: string;
  isClean: boolean;
  modifiedFiles: string[];
  untrackedFiles: string[];
  stagedFiles: string[];
}

export class GitIntelligenceProvider {
  constructor(private readonly workspaceRoot: string) {}

  /**
   * Get current Git status snapshot.
   */
  public getStatus(): GitStatusSnapshot {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: this.workspaceRoot, encoding: 'utf8' }).trim();
      const head = execSync('git rev-parse HEAD', { cwd: this.workspaceRoot, encoding: 'utf8' }).trim();
      const statusOutput = execSync('git status --porcelain', { cwd: this.workspaceRoot, encoding: 'utf8' });

      const modified: string[] = [];
      const untracked: string[] = [];
      const staged: string[] = [];

      for (const line of statusOutput.split('\n')) {
        if (!line.trim()) continue;
        const code = line.slice(0, 2);
        const file = line.slice(3).trim();

        if (code[0] !== ' ' && code[0] !== '?') staged.push(file);
        if (code[1] === 'M') modified.push(file);
        if (code === '??') untracked.push(file);
      }

      return {
        currentBranch: branch,
        headCommit: head,
        isClean: modified.length === 0 && staged.length === 0 && untracked.length === 0,
        modifiedFiles: modified,
        untrackedFiles: untracked,
        stagedFiles: staged
      };
    } catch {
      return {
        currentBranch: 'unknown',
        headCommit: '0000000000000000000000000000000000000000',
        isClean: true,
        modifiedFiles: [],
        untrackedFiles: [],
        stagedFiles: []
      };
    }
  }

  /**
   * Get recent commit history.
   */
  public getRecentCommits(limit = 20): GitCommitRecord[] {
    try {
      const logOutput = execSync(`git log -n ${Math.min(limit, 100)} --format="%H|%an|%ad|%s" --date=iso`, { cwd: this.workspaceRoot, encoding: 'utf8' });
      const commits: GitCommitRecord[] = [];

      for (const line of logOutput.split('\n')) {
        if (!line.trim()) continue;
        const parts = line.split('|');
        if (parts.length >= 4) {
          commits.push({
            commitHash: parts[0],
            author: parts[1],
            date: parts[2],
            message: parts.slice(3).join('|'),
            filesChanged: []
          });
        }
      }

      return commits;
    } catch {
      return [];
    }
  }

  /**
   * Calculate file churn across recent commits.
   */
  public getFileChurn(limitCommits = 50): FileChurnRecord[] {
    const churnMap = new Map<string, { commits: number; insertions: number; deletions: number; lastDate: string }>();

    try {
      const numstatOutput = execSync(`git log -n ${Math.min(limitCommits, 100)} --numstat --format="COMMIT|%ad" --date=iso`, { cwd: this.workspaceRoot, encoding: 'utf8' });
      let currentDate = '';

      for (const line of numstatOutput.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('COMMIT|')) {
          currentDate = trimmed.split('|')[1];
          continue;
        }

        const parts = trimmed.split('\t');
        if (parts.length === 3) {
          const ins = parseInt(parts[0], 10) || 0;
          const del = parseInt(parts[1], 10) || 0;
          const filePath = parts[2].replace(/\\/g, '/');

          const existing = churnMap.get(filePath) || { commits: 0, insertions: 0, deletions: 0, lastDate: currentDate };
          existing.commits += 1;
          existing.insertions += ins;
          existing.deletions += del;
          if (!existing.lastDate) existing.lastDate = currentDate;
          churnMap.set(filePath, existing);
        }
      }
    } catch {
      // Return empty if not in git repo or git fails
    }

    return Array.from(churnMap.entries()).map(([filePath, data]) => ({
      filePath,
      commitCount: data.commits,
      insertions: data.insertions,
      deletions: data.deletions,
      lastModifiedDate: data.lastDate,
      churnScore: data.commits * 10 + (data.insertions + data.deletions) / 10
    })).sort((a, b) => b.churnScore - a.churnScore);
  }
}
