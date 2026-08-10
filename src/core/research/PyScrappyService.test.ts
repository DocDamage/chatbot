import { PyScrappyService } from './PyScrappyService';

describe('PyScrappyService', () => {
  it('rejects private and local targets before contacting MCP', async () => {
    const service = new PyScrappyService({ command: 'not-used' });

    await expect(service.scrapeUrl('http://127.0.0.1:3001/health')).resolves.toMatchObject({
      success: false,
      error: 'Private or local network URLs are not allowed.'
    });
  });

  it('reports a useful disabled result when no MCP server is configured', async () => {
    const service = new PyScrappyService();

    await expect(service.scrapeUrl('https://example.com')).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('PyScrappy is not configured')
    });
  });

  it('rejects unsupported URL schemes', async () => {
    const service = new PyScrappyService({ command: 'not-used' });

    await expect(service.scrapeUrl('file:///etc/passwd')).resolves.toMatchObject({
      success: false,
      error: 'Only HTTP(S) URLs are allowed.'
    });
  });
});
