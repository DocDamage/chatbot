import fs from 'fs';
import { managedPdfOcr } from '../ManagedPdfOcr';
import { runNativeCommand } from '../../../native-runtime/NativeCommandRunner';

jest.mock('../../../native-runtime/NativeCommandRunner', () => ({ runNativeCommand: jest.fn() }));
describe('managed OCR subprocess contract', () => {
  const run = jest.mocked(runNativeCommand);
  beforeEach(() => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    run.mockReset();
  });
  afterEach(() => jest.restoreAllMocks());
  it('returns real text, page counts and truncation warnings from a successful helper', async () => {
    run.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        text: 'Aurora opens Thursday.',
        pages: 1,
        totalPages: 3,
        warnings: ['Only first page processed.'],
      }),
      stderr: '',
      durationMs: 1,
    });
    expect(await managedPdfOcr('scan.pdf', 1, 180)).toMatchObject({
      text: 'Aurora opens Thursday.',
      pages: 1,
      totalPages: 3,
      warnings: ['Only first page processed.'],
    });
    expect(run).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['-m', 'dabook.ocr', '--max-pages', '1', '--dpi', '180']),
      expect.objectContaining({ timeoutMs: 120000 })
    );
  });
  it.each([
    { text: '', pages: 1, totalPages: 1, warnings: [] },
    { text: 'text', pages: 1, warnings: [] },
    { text: 'text', pages: 2, totalPages: 1, warnings: [] },
    { text: 'text', pages: 1, totalPages: 1, warnings: [123] },
  ])('rejects invalid recognition output %#', async (data) => {
    run.mockResolvedValue({ exitCode: 0, stdout: JSON.stringify(data), stderr: '', durationMs: 1 });
    await expect(managedPdfOcr('scan.pdf', 1, 180)).rejects.toThrow(/valid text/);
  });
  it('rejects invalid limits and absent interpreters before starting a process', async () => {
    await expect(managedPdfOcr('scan.pdf', NaN, 180)).rejects.toThrow(/integers/);
    jest.mocked(fs.existsSync).mockReturnValue(false);
    await expect(managedPdfOcr('scan.pdf', 1, 180)).rejects.toThrow(/Python unavailable/);
    expect(run).not.toHaveBeenCalled();
  });
  it('surfaces failed subprocesses and malformed JSON', async () => {
    run.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'OCR engine unavailable',
      durationMs: 1,
    });
    await expect(managedPdfOcr('scan.pdf', 1, 180)).rejects.toThrow(/engine unavailable/);
    run.mockResolvedValue({ exitCode: 0, stdout: '{invalid', stderr: '', durationMs: 1 });
    await expect(managedPdfOcr('scan.pdf', 1, 180)).rejects.toThrow();
  });
});
