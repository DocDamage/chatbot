import { afterEach, describe, expect, it, vi } from 'vitest';
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
