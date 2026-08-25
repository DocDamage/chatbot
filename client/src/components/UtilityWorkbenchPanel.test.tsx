import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UtilityWorkbenchPanel from './UtilityWorkbenchPanel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('UtilityWorkbenchPanel', () => {
  it('formats, minifies, and validates JSON', async () => {
    const user = userEvent.setup();
    render(<UtilityWorkbenchPanel />);
    const toggle = screen.getByRole('button', { name: /Curated utilities/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    const input = screen.getByPlaceholderText('{"name":"Chatbot"}');
    fireEvent.change(input, { target: { value: '{"name":"Chatbot"}' } });
    await user.click(screen.getByRole('button', { name: 'Format' }));
    expect(screen.getByText(/"name": "Chatbot"/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Minify' }));
    expect(document.querySelector('.workspace-result')?.textContent).toBe('{"name":"Chatbot"}');

    await user.clear(input);
    fireEvent.change(input, { target: { value: '{bad' } });
    await user.click(screen.getByRole('button', { name: 'Format' }));
    expect(document.querySelector('.workspace-error')?.textContent).toBeTruthy();

    vi.spyOn(JSON, 'parse').mockImplementationOnce(() => { throw 'non-error'; });
    await user.click(screen.getByRole('button', { name: 'Format' }));
    expect(screen.getByText('Could not process this input.')).toBeTruthy();
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('tests regular expressions and reports invalid patterns', async () => {
    const user = userEvent.setup();
    render(<UtilityWorkbenchPanel />);
    await user.click(screen.getByRole('button', { name: /Curated utilities/ }));
    await user.selectOptions(screen.getByRole('combobox'), 'regex');
    expect(screen.getByText('Test a regular expression against text.')).toBeTruthy();
    await user.type(screen.getByPlaceholderText('error|warning'), 'error');
    const flags = screen.getByLabelText('Flags');
    await user.clear(flags);
    await user.type(flags, 'gi');
    await user.type(screen.getByPlaceholderText('Paste text here...'), 'Error and error');
    await user.click(screen.getByRole('button', { name: 'Test matches' }));
    expect(screen.getByText(/"index": 0/)).toBeTruthy();

    const pattern = screen.getByPlaceholderText('error|warning');
    await user.clear(pattern);
    fireEvent.change(pattern, { target: { value: '[' } });
    await user.click(screen.getByRole('button', { name: 'Test matches' }));
    expect(document.querySelector('.workspace-error')?.textContent).toBeTruthy();
  });

  it('inspects empty and populated Markdown', async () => {
    const user = userEvent.setup();
    render(<UtilityWorkbenchPanel />);
    await user.click(screen.getByRole('button', { name: /Curated utilities/ }));
    await user.selectOptions(screen.getByRole('combobox'), 'markdown');
    const input = screen.getByPlaceholderText('Paste text here...');
    await user.click(screen.getByRole('button', { name: 'Inspect' }));
    expect(screen.getByText(/Words: 0/)).toBeTruthy();
    await user.type(input, '# Heading\nTwo words');
    await user.click(screen.getByRole('button', { name: 'Inspect' }));
    expect(document.querySelector('.workspace-result')?.textContent).toContain('Words: 4\nHeadings: 1');
  });

  it('encodes and decodes Base64 and URL text', async () => {
    const user = userEvent.setup();
    render(<UtilityWorkbenchPanel />);
    await user.click(screen.getByRole('button', { name: /Curated utilities/ }));
    await user.selectOptions(screen.getByRole('combobox'), 'encoding');
    const input = screen.getByPlaceholderText('Paste text here...');
    await user.type(input, 'hello world');
    await user.click(screen.getByRole('button', { name: 'Base64 encode' }));
    expect(screen.getByText('aGVsbG8gd29ybGQ=')).toBeTruthy();
    await user.clear(input);
    await user.type(input, 'aGVsbG8=');
    await user.click(screen.getByRole('button', { name: 'Base64 decode' }));
    expect(screen.getByText('hello')).toBeTruthy();
    await user.clear(input);
    await user.type(input, 'hello world');
    await user.click(screen.getByRole('button', { name: 'URL encode' }));
    expect(screen.getByText('hello%20world')).toBeTruthy();
    await user.clear(input);
    await user.type(input, 'hello%20world');
    await user.click(screen.getByRole('button', { name: 'URL decode' }));
    expect(screen.getByText('hello world')).toBeTruthy();
    await user.clear(input);
    await user.type(input, '%');
    await user.click(screen.getByRole('button', { name: 'URL decode' }));
    expect(document.querySelector('.workspace-error')?.textContent).toBeTruthy();
  });
});
