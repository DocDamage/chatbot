export type ClipboardCopyResult =
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
