import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import FilePreviewPane from '../FilePreviewPane';

describe('RT-FILES-002: FilePreviewPane Component Suite', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders empty placeholder when no file is provided', () => {
    const onLoad = vi.fn();
    render(<FilePreviewPane onLoad={onLoad} />);

    expect(screen.getByText('Select a file to preview it.')).toBeTruthy();
  });

  it('renders file preview and triggers onLoad when load button clicked', () => {
    const onLoad = vi.fn();
    const mockFile = {
      path: 'src/main.ts',
      language: 'typescript',
      startLine: 1,
      endLine: 20,
      content: 'console.log("Hello world");',
      size: 100,
      checksum: 'abc',
      modifiedTime: '2026-08-26T00:00:00Z'
    };

    render(<FilePreviewPane file={mockFile} onLoad={onLoad} />);

    expect(screen.getByText('src/main.ts')).toBeTruthy();
    expect(screen.getByText(/typescript · 1-20/)).toBeTruthy();
    expect(screen.getByText('console.log("Hello world");')).toBeTruthy();

    const loadBtn = screen.getByRole('button', { name: /load/i });
    fireEvent.click(loadBtn);
    expect(onLoad).toHaveBeenCalledWith(mockFile);
  });
});
