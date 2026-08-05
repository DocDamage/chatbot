type Restore = () => void;

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
