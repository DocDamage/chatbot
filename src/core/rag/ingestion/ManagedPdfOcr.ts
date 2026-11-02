import fs from 'fs';
import path from 'path';
import { runNativeCommand } from '../../native-runtime/NativeCommandRunner';

export async function managedPdfOcr(file: string, maxPages: number, dpi: number) {
  if (
    !Number.isSafeInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > 500 ||
    !Number.isSafeInteger(dpi) ||
    dpi < 72 ||
    dpi > 600
  )
    throw new Error('OCR limits must be integers: 1..500 pages and 72..600 DPI.');
  const root = path.resolve(__dirname, '../../../..');
  const python =
    process.env.DABOOK_PYTHON ||
    path.join(
      root,
      'services/dabook/.venv',
      process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
    );
  if (!fs.existsSync(python))
    throw new Error('Managed DABOOK Python unavailable; run npm run setup:dabook.');
  const result = await runNativeCommand(
    python,
    [
      '-m',
      'dabook.ocr',
      path.resolve(file),
      '--max-pages',
      String(Math.min(500, maxPages)),
      '--dpi',
      String(Math.min(600, Math.max(72, dpi))),
    ],
    {
      cwd: root,
      timeoutMs: 120000,
      env: {
        ...process.env,
        PYTHONPATH: path.join(root, 'services/dabook/src'),
        PYTHONIOENCODING: 'utf-8',
      },
    }
  );
  if (result.exitCode !== 0)
    throw new Error(result.stderr.slice(-1000) || `OCR exited ${result.exitCode}`);
  const data = JSON.parse(result.stdout.trim());
  if (
    typeof data.text !== 'string' ||
    !data.text.trim() ||
    !Number.isInteger(data.pages) ||
    data.pages <= 0 ||
    !Number.isInteger(data.totalPages) ||
    data.totalPages < data.pages ||
    data.pages > maxPages ||
    !Array.isArray(data.warnings) ||
    data.warnings.some((warning: unknown) => typeof warning !== 'string')
  )
    throw new Error('Managed OCR produced no valid text.');
  return {
    text: data.text as string,
    pages: data.pages as number,
    totalPages: data.totalPages as number,
    warnings: data.warnings as string[],
  };
}
