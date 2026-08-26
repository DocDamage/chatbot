import { PyScrappyService } from '../PyScrappyService';

describe('B75-08: PyScrappyService Deep Matrix and URL Boundary Suite', () => {
  it('instantiates from environment and handles unconfigured status', async () => {
    const service = new PyScrappyService();
    expect(service.isConfigured()).toBe(false);

    const status = await service.getStatus();
    expect(status.enabled).toBe(false);
    expect(status.connected).toBe(false);

    const tool = service.createTool();
    expect(tool.id).toBe('pyscrappy_scrape_url');

    service.close();
  });

  it('enforces URL safety boundaries against invalid, local, and private addresses', async () => {
    const service = new PyScrappyService({ command: 'pyscrappy' });

    // Invalid URL
    const res1 = await service.scrapeUrl('not-a-url');
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('valid HTTP(S) URL');

    // FTP protocol
    const res2 = await service.scrapeUrl('ftp://example.com/file');
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('Only HTTP(S) URLs');

    // Localhost
    const res3 = await service.scrapeUrl('http://localhost:8080/secret');
    expect(res3.success).toBe(false);
    expect(res3.error).toContain('Private or local network');

    // 127.0.0.1
    const res4 = await service.scrapeUrl('http://127.0.0.1/admin');
    expect(res4.success).toBe(false);
    expect(res4.error).toContain('Private or local network');

    // 10.0.0.1 private IP
    const res5 = await service.scrapeUrl('http://10.0.0.5/api');
    expect(res5.success).toBe(false);
    expect(res5.error).toContain('Private or local network');

    // 192.168.1.1 private IP
    const res6 = await service.scrapeUrl('http://192.168.1.1/router');
    expect(res6.success).toBe(false);
    expect(res6.error).toContain('Private or local network');

    // 172.16.0.1 private IP
    const res7 = await service.scrapeUrl('http://172.16.0.1/dashboard');
    expect(res7.success).toBe(false);
    expect(res7.error).toContain('Private or local network');

    // 169.254.169.254 cloud metadata
    const res8 = await service.scrapeUrl('http://169.254.169.254/latest/meta-data');
    expect(res8.success).toBe(false);
    expect(res8.error).toContain('Private or local network');
  });

  it('handles tool execution via createTool wrapper with css selectors and max pages', async () => {
    const service = new PyScrappyService();
    const tool = service.createTool();

    // Call with invalid URL through tool execute
    const toolRes = await tool.execute({ url: 'http://localhost:3000', css_selector: 'article' });
    expect(toolRes.success).toBe(false);
  });
});
