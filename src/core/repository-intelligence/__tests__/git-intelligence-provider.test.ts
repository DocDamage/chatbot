import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';
import { GitIntelligenceProvider } from '../git/GitIntelligenceProvider';

describe('B75-08: GitIntelligenceProvider Deep Matrix Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-intel-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('handles non-git repository paths gracefully', () => {
    const provider = new GitIntelligenceProvider(tempDir);
    const status = provider.getStatus();
    expect(status.currentBranch).toBe('unknown');
    expect(status.headCommit).toBe('0000000000000000000000000000000000000000');
    expect(status.isClean).toBe(true);

    const commits = provider.getRecentCommits(10);
    expect(commits).toEqual([]);

    const churn = provider.getFileChurn(10);
    expect(churn).toEqual([]);
  });

  it('analyzes status, commits, and file churn in real git repository', () => {
    // Initialize temporary git repo
    execSync('git init -b main', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test Author"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    // Commit 1: file1.txt
    const file1 = path.join(tempDir, 'file1.txt');
    fs.writeFileSync(file1, 'Initial line 1\nInitial line 2\n', 'utf8');
    execSync('git add file1.txt', { cwd: tempDir, stdio: 'ignore' });
    execSync('git commit -m "feat: initial commit"', { cwd: tempDir, stdio: 'ignore' });

    // Commit 2: update file1.txt and add file2.txt
    fs.writeFileSync(file1, 'Modified line 1\nAdded line 3\n', 'utf8');
    const file2 = path.join(tempDir, 'file2.txt');
    fs.writeFileSync(file2, 'File 2 content\n', 'utf8');
    execSync('git add file1.txt file2.txt', { cwd: tempDir, stdio: 'ignore' });
    execSync('git commit -m "fix: update file1 and create file2"', { cwd: tempDir, stdio: 'ignore' });

    // Create untracked, modified, staged files for status test
    const file3 = path.join(tempDir, 'file3.txt');
    fs.writeFileSync(file3, 'Untracked file\n', 'utf8');

    fs.writeFileSync(file1, 'Uncommitted edit in file1\n', 'utf8');

    fs.writeFileSync(file2, 'Staged modification\n', 'utf8');
    execSync('git add file2.txt', { cwd: tempDir, stdio: 'ignore' });

    const provider = new GitIntelligenceProvider(tempDir);

    // 1. Status
    const status = provider.getStatus();
    expect(status.currentBranch).toBe('main');
    expect(status.isClean).toBe(false);
    expect(status.untrackedFiles.length).toBeGreaterThan(0);
    expect(status.modifiedFiles.length).toBeGreaterThan(0);
    expect(status.stagedFiles.length).toBeGreaterThan(0);

    // 2. Recent commits
    const commits = provider.getRecentCommits(5);
    expect(commits.length).toBe(2);
    expect(commits[0].author).toBe('Test Author');
    expect(commits[0].message).toContain('update file1');

    // 3. File churn
    const churn = provider.getFileChurn(10);
    expect(churn.length).toBeGreaterThan(0);
    expect(churn[0].filePath).toBeDefined();
    expect(churn[0].churnScore).toBeGreaterThan(0);
  });
});
