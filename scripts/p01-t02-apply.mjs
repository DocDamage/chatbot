import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function filePath(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(filePath(relativePath), 'utf8');
}

function write(relativePath, content) {
  const target = filePath(relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

function replaceExact(relativePath, search, replacement, expectedCount = 1) {
  const content = read(relativePath);
  const count = content.split(search).length - 1;
  if (count !== expectedCount) {
    throw new Error(`${relativePath}: expected ${expectedCount} occurrence(s), found ${count}`);
  }
  write(relativePath, content.replace(search, replacement));
}

const globalFiles = [
  'client/src/api/code.test.ts',
  'client/src/api/conversations.test.ts',
  'client/src/components/AssistantChatPanelScope.test.tsx',
  'client/src/components/CodeWorkflowPanel.test.tsx',
  'client/src/components/ConversationToolsPanel.test.tsx',
  'client/src/components/FLStudioControlPanel.test.tsx',
  'client/src/components/KnowledgeOnlinePanel.test.tsx',
  'client/src/components/LocalRunApprovalPanel.test.tsx',
  'client/src/components/SpriteLabPanel.test.tsx'
];

let replacedGlobals = 0;
for (const relativePath of globalFiles) {
  const content = read(relativePath);
  const matches = content.match(/\bglobal\.fetch/g) || [];
  replacedGlobals += matches.length;
  write(relativePath, content.replace(/\bglobal\.fetch/g, 'globalThis.fetch'));
}

if (replacedGlobals !== 14) {
  throw new Error(`Expected to replace 14 global.fetch references, replaced ${replacedGlobals}`);
}

write('client/src/clipboard.ts', `export type ClipboardCopyResult =
  | { ok: true; method: 'clipboard' | 'fallback' }
  | { ok: false; reason: 'empty' | 'unavailable' | 'rejected' };

export async function copyTextToClipboard(value: string): Promise<ClipboardCopyResult> {
  if (!value.trim()) return { ok: false, reason: 'empty' };

  const clipboard = globalThis.navigator?.clipboard;
  if (clipboard && typeof clipboard.writeText === 'function') {
    try {
      await clipboard.writeText(value);
      return { ok: true, method: 'clipboard' };
    } catch {
      if (copyWithBrowserFallback(value)) {
        return { ok: true, method: 'fallback' };
      }
      return { ok: false, reason: 'rejected' };
    }
  }

  if (copyWithBrowserFallback(value)) {
    return { ok: true, method: 'fallback' };
  }

  return { ok: false, reason: 'unavailable' };
}

function copyWithBrowserFallback(value: string): boolean {
  const documentRef = globalThis.document;
  if (!documentRef?.body || typeof documentRef.execCommand !== 'function') {
    return false;
  }

  const activeElement = documentRef.activeElement instanceof HTMLElement
    ? documentRef.activeElement
    : null;
  const selection = documentRef.getSelection();
  const ranges: Range[] = [];

  if (selection) {
    for (let index = 0; index < selection.rangeCount; index += 1) {
      ranges.push(selection.getRangeAt(index).cloneRange());
    }
  }

  const textarea = documentRef.createElement('textarea');
  textarea.value = value;
  textarea.readOnly = true;
  textarea.dataset.clipboardFallback = 'true';
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  documentRef.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);

  try {
    return documentRef.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (selection) {
      selection.removeAllRanges();
      ranges.forEach(range => selection.addRange(range));
    }
    activeElement?.focus();
  }
}
`);

write('client/src/test/browserTestUtils.ts', `type Restore = () => void;

const restorers: Restore[] = [];

export function stubClipboard(writeText?: (value: string) => Promise<void>): void {
  rememberProperty(globalThis.navigator, 'clipboard');
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined
  });
}

export function stubExecCommand(
  implementation?: (commandId: string, showUI?: boolean, value?: string) => boolean
): void {
  rememberProperty(globalThis.document, 'execCommand');
  Object.defineProperty(globalThis.document, 'execCommand', {
    configurable: true,
    value: implementation
  });
}

export function restoreBrowserTestGlobals(): void {
  while (restorers.length > 0) {
    restorers.pop()?.();
  }
}

function rememberProperty(target: object, key: PropertyKey): void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  restorers.push(() => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
      return;
    }
    Reflect.deleteProperty(target, key);
  });
}
`);

write('client/src/clipboard.test.ts', `import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from './clipboard';
import {
  restoreBrowserTestGlobals,
  stubClipboard,
  stubExecCommand
} from './test/browserTestUtils';

afterEach(() => {
  restoreBrowserTestGlobals();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('copyTextToClipboard', () => {
  it('uses the Clipboard API when writeText succeeds', async () => {
    const writeText = vi.fn(async (_value: string) => undefined);
    const execCommand = vi.fn(() => true);
    stubClipboard(writeText);
    stubExecCommand(execCommand);

    await expect(copyTextToClipboard('node script.js')).resolves.toEqual({
      ok: true,
      method: 'clipboard'
    });
    expect(writeText).toHaveBeenCalledWith('node script.js');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('uses the browser fallback when the Clipboard API is unavailable', async () => {
    const execCommand = vi.fn(() => true);
    stubClipboard(undefined);
    stubExecCommand(execCommand);

    await expect(copyTextToClipboard('fallback text')).resolves.toEqual({
      ok: true,
      method: 'fallback'
    });
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('[data-clipboard-fallback]')).toBeNull();
  });

  it('uses the browser fallback when Clipboard API permission is rejected', async () => {
    const writeText = vi.fn(async (_value: string) => {
      throw new DOMException('Permission denied', 'NotAllowedError');
    });
    const execCommand = vi.fn(() => true);
    stubClipboard(writeText);
    stubExecCommand(execCommand);

    await expect(copyTextToClipboard('recovered text')).resolves.toEqual({
      ok: true,
      method: 'fallback'
    });
    expect(writeText).toHaveBeenCalledWith('recovered text');
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('reports rejection when both Clipboard API and fallback fail', async () => {
    const writeText = vi.fn(async (_value: string) => {
      throw new DOMException('Permission denied', 'NotAllowedError');
    });
    stubClipboard(writeText);
    stubExecCommand(() => false);

    await expect(copyTextToClipboard('blocked text')).resolves.toEqual({
      ok: false,
      reason: 'rejected'
    });
  });

  it('reports unavailable when neither Clipboard API nor fallback exists', async () => {
    stubClipboard(undefined);
    stubExecCommand(undefined);

    await expect(copyTextToClipboard('manual text')).resolves.toEqual({
      ok: false,
      reason: 'unavailable'
    });
  });
});
`);

replaceExact(
  'client/src/components/LocalRunApprovalPanel.tsx',
  "} from '../api/localRunApprovals';\n",
  "} from '../api/localRunApprovals';\nimport { copyTextToClipboard } from '../clipboard';\n"
);
replaceExact(
  'client/src/components/LocalRunApprovalPanel.tsx',
  "  const [error, setError] = useState('');\n",
  "  const [error, setError] = useState('');\n  const [clipboardStatus, setClipboardStatus] = useState('');\n  const [clipboardError, setClipboardError] = useState('');\n"
);
replaceExact(
  'client/src/components/LocalRunApprovalPanel.tsx',
  `  const copy = async (value: string) => {
    if (!value.trim()) return;
    await navigator.clipboard?.writeText(value);
  };
`,
  `  const copy = async (value: string) => {
    if (!value.trim()) return;
    const result = await copyTextToClipboard(value);
    if (result.ok) {
      setClipboardError('');
      setClipboardStatus(result.method === 'fallback'
        ? 'Copied using the browser fallback.'
        : 'Copied to clipboard.');
      return;
    }
    setClipboardStatus('');
    setClipboardError('Clipboard access is unavailable. Select the text and copy it manually.');
  };
`
);
replaceExact(
  'client/src/components/LocalRunApprovalPanel.tsx',
  `      {error && <div className="assistant-error-bar" role="alert">{error}</div>}
`,
  `      {error && <div className="assistant-error-bar" role="alert">{error}</div>}
      {clipboardError && <div className="assistant-error-bar" role="alert">{clipboardError}</div>}
      {clipboardStatus && <div className="assistant-muted" role="status" aria-live="polite">{clipboardStatus}</div>}
`
);

replaceExact(
  'client/src/components/SpriteLabPanel.tsx',
  "import { LocalRunOutputFile } from '../api/localRunApprovals';\n",
  "import { LocalRunOutputFile } from '../api/localRunApprovals';\nimport { copyTextToClipboard } from '../clipboard';\n"
);
replaceExact(
  'client/src/components/SpriteLabPanel.tsx',
  "  const [error, setError] = useState('');\n",
  "  const [error, setError] = useState('');\n  const [clipboardStatus, setClipboardStatus] = useState('');\n  const [clipboardError, setClipboardError] = useState('');\n"
);
replaceExact(
  'client/src/components/SpriteLabPanel.tsx',
  `  const copy = async (value: string) => {
    if (!value.trim()) return;
    await navigator.clipboard?.writeText(value);
  };
`,
  `  const copy = async (value: string) => {
    if (!value.trim()) return;
    const result = await copyTextToClipboard(value);
    if (result.ok) {
      setClipboardError('');
      setClipboardStatus(result.method === 'fallback'
        ? 'Copied using the browser fallback.'
        : 'Copied to clipboard.');
      return;
    }
    setClipboardStatus('');
    setClipboardError('Clipboard access is unavailable. Select the text and copy it manually.');
  };
`
);
replaceExact(
  'client/src/components/SpriteLabPanel.tsx',
  `      {error && <div className="assistant-error-bar" role="alert">{error}</div>}
`,
  `      {error && <div className="assistant-error-bar" role="alert">{error}</div>}
      {clipboardError && <div className="assistant-error-bar" role="alert">{clipboardError}</div>}
      {clipboardStatus && <div className="assistant-muted" role="status" aria-live="polite">{clipboardStatus}</div>}
`
);

replaceExact(
  'client/src/components/LocalRunApprovalPanel.test.tsx',
  "import LocalRunApprovalPanel from './LocalRunApprovalPanel';\n",
  `import LocalRunApprovalPanel from './LocalRunApprovalPanel';
import {
  restoreBrowserTestGlobals,
  stubClipboard,
  stubExecCommand
} from '../test/browserTestUtils';
`
);
replaceExact(
  'client/src/components/LocalRunApprovalPanel.test.tsx',
  `afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
`,
  `afterEach(() => {
  cleanup();
  restoreBrowserTestGlobals();
  vi.restoreAllMocks();
});
`
);
replaceExact(
  'client/src/components/LocalRunApprovalPanel.test.tsx',
  `    const clipboardWriteText = vi
      .spyOn(window.navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);
`,
  `    const clipboardWriteText = vi.fn(async (_value: string) => undefined);
    stubClipboard(clipboardWriteText);
`
);
replaceExact(
  'client/src/components/LocalRunApprovalPanel.test.tsx',
  `    expect(clipboardWriteText).toHaveBeenCalledWith('node script.js');
  });

  it('starts approved runs from the UI', async () => {
`,
  `    expect(clipboardWriteText).toHaveBeenCalledWith('node script.js');
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/copied to clipboard/i));
  });

  it('reports clipboard rejection without breaking the run controls', async () => {
    const user = userEvent.setup();
    stubClipboard(vi.fn(async (_value: string) => {
      throw new DOMException('Permission denied', 'NotAllowedError');
    }));
    stubExecCommand(() => false);
    render(<LocalRunApprovalPanel />);

    await waitFor(() => expect(screen.getByText('node script.js')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: /copy command/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/clipboard access is unavailable/i);
    });
    expect(screen.getByRole('button', { name: /^start$/i }).hasAttribute('disabled')).toBe(false);
  });

  it('starts approved runs from the UI', async () => {
`
);

replaceExact(
  'client/src/components/SpriteLabPanel.test.tsx',
  "import SpriteLabPanel from './SpriteLabPanel';\n",
  `import SpriteLabPanel from './SpriteLabPanel';
import {
  restoreBrowserTestGlobals,
  stubClipboard,
  stubExecCommand
} from '../test/browserTestUtils';
`
);
replaceExact(
  'client/src/components/SpriteLabPanel.test.tsx',
  `afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
`,
  `afterEach(() => {
  cleanup();
  restoreBrowserTestGlobals();
  vi.restoreAllMocks();
});
`
);
replaceExact(
  'client/src/components/SpriteLabPanel.test.tsx',
  `    const clipboardWriteText = vi
      .spyOn(window.navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);
`,
  `    const clipboardWriteText = vi.fn(async (_value: string) => undefined);
    stubClipboard(clipboardWriteText);
`
);
replaceExact(
  'client/src/components/SpriteLabPanel.test.tsx',
  `    expect(clipboardWriteText).toHaveBeenCalledWith('aseprite -b assets/hero.aseprite --sheet out.png');
  });
});
`,
  `    expect(clipboardWriteText).toHaveBeenCalledWith('aseprite -b assets/hero.aseprite --sheet out.png');
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/copied to clipboard/i));
  });

  it('uses the browser fallback when the Clipboard API is unavailable', async () => {
    const user = userEvent.setup();
    const execCommand = vi.fn(() => true);
    stubClipboard(undefined);
    stubExecCommand(execCommand);
    render(<SpriteLabPanel />);

    await waitFor(() => expect(screen.getByText('Aseprite')).toBeTruthy());
    await user.click(screen.getByText('Pick sprite'));
    await user.click(screen.getByRole('button', { name: /plan external cli/i }));
    await waitFor(() => expect(screen.getByText('External run')).toBeTruthy());

    await user.click(screen.getByRole('button', { name: /copy command/i }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/browser fallback/i));
    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});
`
);

const remainingGlobals = globalFiles.flatMap(relativePath => {
  const content = read(relativePath);
  return content.match(/\bglobal\./g) || [];
}).length;

if (remainingGlobals !== 0) {
  throw new Error(`Browser tests still contain ${remainingGlobals} Node global reference(s)`);
}

const tsconfig = read('client/tsconfig.json');
if (!tsconfig.includes('"include": ["src"]')) {
  throw new Error('Client TypeScript configuration no longer includes test files under src');
}

console.log(`P01-T02 repair staged: ${replacedGlobals} Node global references removed.`);
