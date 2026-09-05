import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import FileExplorerPanel from '../FileExplorerPanel';
import * as filesApi from '../../api/files';

describe('RT-COV-003 / RT-CLIENT-003: FileExplorerPanel Media, Search, and Select Workflows', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders tree, previews image files, and previews audio files', async () => {
    const mockTree = {
      name: 'workspace',
      path: '.',
      type: 'directory',
      children: [
        { name: 'logo.png', path: 'assets/logo.png', type: 'file' },
        { name: 'sound.wav', path: 'audio/sound.wav', type: 'file' },
        { name: 'doc.bin', path: 'data/doc.bin', type: 'file' }
      ]
    };

    vi.spyOn(filesApi, 'fetchFileTree').mockResolvedValue(mockTree);
    render(<FileExplorerPanel />);

    await waitFor(() => {
      expect(screen.getByText('logo.png')).toBeTruthy();
    });

    // 1. Click image file -> opens image preview
    fireEvent.click(screen.getByText('logo.png'));
    expect(screen.getByAltText('assets/logo.png')).toBeTruthy();

    // 2. Click audio file -> opens audio preview
    fireEvent.click(screen.getByText('sound.wav'));
    expect(screen.getByText('audio preview')).toBeTruthy();

    // 3. Click unsupported binary file -> shows preview not available notice
    fireEvent.click(screen.getByText('doc.bin'));
    expect(screen.getByText(/Preview is not available for .bin/)).toBeTruthy();
  });

  it('supports select mode with accept extension filter and onSelect callback', async () => {
    const mockTree = {
      name: 'root',
      path: '.',
      type: 'directory',
      children: [
        { name: 'main.ts', path: 'src/main.ts', type: 'file' },
        { name: 'data.csv', path: 'data.csv', type: 'file' }
      ]
    };

    vi.spyOn(filesApi, 'fetchFileTree').mockResolvedValue(mockTree);
    const onSelect = vi.fn();

    render(
      <FileExplorerPanel
        mode="select"
        accept={['.ts']}
        onSelect={onSelect}
        ariaLabel="Pick TypeScript source"
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Pick TypeScript source')).toBeTruthy();
    });

    // Click accepted .ts file -> calls onSelect
    fireEvent.click(screen.getByText('main.ts'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ path: 'src/main.ts' }));
  });

  it('performs file search with pagination via More results button', async () => {
    vi.spyOn(filesApi, 'fetchFileTree').mockResolvedValue({ name: '.', path: '.', type: 'directory', children: [] });
    const searchSpy = vi.spyOn(filesApi, 'searchFiles')
      .mockResolvedValueOnce({
        results: [{ path: 'src/App.tsx', match: 'name' }],
        nextOffset: 50
      })
      .mockResolvedValueOnce({
        results: [{ path: 'src/AssistantChat.tsx', match: 'content' }],
        nextOffset: undefined
      });

    render(<FileExplorerPanel />);

    const searchInput = screen.getByPlaceholderText('Search files');
    fireEvent.change(searchInput, { target: { value: 'App' } });

    await waitFor(() => {
      expect(screen.getByText('src/App.tsx')).toBeTruthy();
      expect(screen.getByText('More results')).toBeTruthy();
    });

    // Click More results -> fetches next offset
    fireEvent.click(screen.getByText('More results'));

    await waitFor(() => {
      expect(screen.getByText('src/AssistantChat.tsx')).toBeTruthy();
    });

    expect(searchSpy).toHaveBeenCalledTimes(2);
  });
});
