import { RepositoryFileMapAuditor, FileToCheck } from '../RepositoryFileMapAuditor';

describe('RepositoryFileMapAuditor (Section 41)', () => {
  let auditor: RepositoryFileMapAuditor;

  beforeEach(() => {
    auditor = new RepositoryFileMapAuditor();
  });

  it('correctly categorizes canonical paths', () => {
    expect(auditor.detectCategory('src/core/chat/ChatRuntime.ts')).toBe('chat');
    expect(auditor.detectCategory('src/types/chat-runtime.ts')).toBe('types');
    expect(auditor.detectCategory('client/src/components/SourcesDrawer.tsx')).toBe('client');
    expect(auditor.detectCategory('unknown/random/path.ts')).toBeNull();
  });

  it('detects violations when file exceeds maximum lines', () => {
    const file: FileToCheck = {
      filePath: 'src/core/chat/HugeChatService.ts',
      lineCount: 350,
    };
    const violations = auditor.auditFile(file);
    expect(violations.length).toBe(1);
    expect(violations[0].ruleViolated).toBe('MAX_FILE_LINES_EXCEEDED');
    expect(violations[0].severity).toBe('error');
  });

  it('detects forbidden boundary imports (e.g. types importing from core)', () => {
    const file: FileToCheck = {
      filePath: 'src/types/invalid-type.ts',
      lineCount: 50,
      importedModules: ['../core/chat/ChatRuntime'],
    };
    const violations = auditor.auditFile(file);
    expect(violations.length).toBe(1);
    expect(violations[0].ruleViolated).toBe('FORBIDDEN_IMPORT_BOUNDARY');
    expect(violations[0].severity).toBe('error');
  });

  it('audits a batch of files and produces a comprehensive report', () => {
    const files: FileToCheck[] = [
      { filePath: 'src/core/chat/ChatRuntime.ts', lineCount: 240 },
      { filePath: 'src/types/chat-runtime.ts', lineCount: 150 },
      { filePath: 'src/core/state/ConversationState.ts', lineCount: 120 },
      { filePath: 'random/dir/script.js', lineCount: 10 },
    ];

    const report = auditor.auditRepositoryFiles(files);
    expect(report.totalFilesChecked).toBe(4);
    expect(report.validFilesCount).toBe(3);
    expect(report.violations.length).toBe(1); // 1 warning for unmapped path
    expect(report.compliant).toBe(true); // compliant because warning is not error
  });
});
