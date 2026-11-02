import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import LoadedFilesBar from '../LoadedFilesBar';

describe('RT-CHAT-003: LoadedFilesBar Component Suite', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when there are no files or audio', () => {
    const { container } = render(
      <LoadedFilesBar files={[]} audio={[]} onRemoveFile={vi.fn()} onRemoveAudio={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders loaded files and audio and triggers remove callbacks', () => {
    const onRemoveFile = vi.fn();
    const onRemoveAudio = vi.fn();

    render(
      <LoadedFilesBar
        files={[{
          path: 'src/index.ts',
          language: 'typescript',
          startLine: 1,
          endLine: 50,
          content: 'code',
          size: 50,
          checksum: 'def',
          modifiedTime: '2026-08-26T00:00:00Z'
        }]}
        audio={[{
          name: 'voice.wav',
          path: 'audio/voice.wav',
          extension: '.wav',
          size: 1024,
          modifiedTime: '2026-08-26T00:00:00Z',
          duration: 12
        }]}
        onRemoveFile={onRemoveFile}
        onRemoveAudio={onRemoveAudio}
      />
    );

    const fileBtn = screen.getByText('src/index.ts:1-50');
    expect(fileBtn).toBeTruthy();
    fireEvent.click(fileBtn);
    expect(onRemoveFile).toHaveBeenCalledWith('src/index.ts');

    const audioBtn = screen.getByText('voice.wav');
    expect(audioBtn).toBeTruthy();
    fireEvent.click(audioBtn);
    expect(onRemoveAudio).toHaveBeenCalledWith('audio/voice.wav');
  });
});
