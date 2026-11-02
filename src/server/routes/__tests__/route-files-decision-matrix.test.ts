import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { createFilesRouter } from '../files';

describe('HTTP route decision matrices - Files Router', () => {
  let tempDir: string;
  let app: express.Express;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'files-route-test-'));
    fs.mkdirSync(path.join(tempDir, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'sample.txt'), 'line 1\nline 2\nline 3\nline 4\n', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'test.mp3'), Buffer.from('fake mp3 audio data'));
    fs.writeFileSync(path.join(tempDir, 'test.wav'), Buffer.from('fake wav audio data'));
    fs.writeFileSync(path.join(tempDir, 'test.ogg'), Buffer.from('fake ogg audio data'));
    fs.writeFileSync(path.join(tempDir, 'test.flac'), Buffer.from('fake flac audio data'));
    fs.writeFileSync(path.join(tempDir, 'test.m4a'), Buffer.from('fake m4a audio data'));
    fs.writeFileSync(path.join(tempDir, 'test.png'), Buffer.from('fake png image data'));
    fs.writeFileSync(path.join(tempDir, 'test.jpg'), Buffer.from('fake jpg image data'));
    fs.writeFileSync(path.join(tempDir, 'test.jpeg'), Buffer.from('fake jpeg image data'));
    fs.writeFileSync(path.join(tempDir, 'test.gif'), Buffer.from('fake gif image data'));
    fs.writeFileSync(path.join(tempDir, 'test.webp'), Buffer.from('fake webp image data'));
    fs.writeFileSync(path.join(tempDir, 'unsupported.xyz'), Buffer.from('unknown data'));

    app = express();
    app.use(express.json());
    app.use(createFilesRouter(tempDir));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('GET /api/files/tree returns directory tree with default and custom params', async () => {
    const defaultRes = await request(app).get('/api/files/tree').expect(200);
    expect(defaultRes.body).toBeDefined();

    const customRes = await request(app).get('/api/files/tree?root=sub&maxDepth=2').expect(200);
    expect(customRes.body).toBeDefined();
  });

  it('GET /api/files/search validates query and respects search options', async () => {
    await request(app).get('/api/files/search').expect(400, { error: 'q is required' });
    await request(app).get('/api/files/search?q=%20%20').expect(400, { error: 'q is required' });

    const searchRes = await request(app)
      .get('/api/files/search?q=line&kind=both&limit=10&offset=0&maxFiles=50&maxContentBytes=1000')
      .expect(200);
    expect(searchRes.body).toBeDefined();

    const fileOnlyRes = await request(app)
      .get('/api/files/search?q=sample&kind=file')
      .expect(200);
    expect(fileOnlyRes.body).toBeDefined();
  });

  it('GET /api/files/read validates path and supports line slices', async () => {
    await request(app).get('/api/files/read').expect(400, { error: 'path is required' });
    await request(app).get('/api/files/read?path=%20%20').expect(400, { error: 'path is required' });

    const fullRead = await request(app).get('/api/files/read?path=sample.txt').expect(200);
    expect(fullRead.body.content).toContain('line 1');

    const sliceRead = await request(app).get('/api/files/read?path=sample.txt&startLine=2&endLine=3').expect(200);
    expect(sliceRead.body.content).toContain('line 2');
  });

  it('GET /api/files/preview/audio handles all content types and edge cases', async () => {
    await request(app).get('/api/files/preview/audio').expect(400, { error: 'path is required' });

    // Not a file (points to dir)
    await request(app).get('/api/files/preview/audio?path=sub').expect(400, { error: 'path must point to a file' });

    // Unsupported extension
    await request(app).get('/api/files/preview/audio?path=unsupported.xyz').expect(415, { error: 'Unsupported audio preview type' });

    // Path outside workspace
    await request(app).get('/api/files/preview/audio?path=../outside.mp3').expect(500);

    // Supported formats
    for (const ext of ['mp3', 'wav', 'ogg', 'flac', 'm4a']) {
      const res = await request(app).get(`/api/files/preview/audio?path=test.${ext}`).expect(200);
      expect(res.headers['content-type']).toMatch(/audio\//);
      expect(res.headers['accept-ranges']).toBe('bytes');
    }
  });

  it('GET /api/files/preview/image handles all content types and edge cases', async () => {
    await request(app).get('/api/files/preview/image').expect(400, { error: 'path is required' });

    // Not a file
    await request(app).get('/api/files/preview/image?path=sub').expect(400, { error: 'path must point to a file' });

    // Unsupported extension
    await request(app).get('/api/files/preview/image?path=unsupported.xyz').expect(415, { error: 'Unsupported image preview type' });

    // Supported formats
    for (const ext of ['png', 'jpg', 'jpeg', 'gif', 'webp']) {
      const res = await request(app).get(`/api/files/preview/image?path=test.${ext}`).expect(200);
      expect(res.headers['content-type']).toMatch(/image\//);
    }
  });

  it('GET /api/files/metadata validates path and returns file info', async () => {
    await request(app).get('/api/files/metadata').expect(400, { error: 'path is required' });

    const res = await request(app).get('/api/files/metadata?path=sample.txt').expect(200);
    expect(res.body).toHaveProperty('type', 'file');
    expect(res.body).toHaveProperty('previewable', true);
  });

  it('POST /api/files/load-into-chat loads files into chat', async () => {
    const arrayRes = await request(app)
      .post('/api/files/load-into-chat')
      .send({ files: [{ path: 'sample.txt' }] })
      .expect(200);
    expect(arrayRes.body).toHaveProperty('loadedFiles');
    expect(arrayRes.body.loadedFiles.length).toBe(1);

    const nonArrayRes = await request(app)
      .post('/api/files/load-into-chat')
      .send({})
      .expect(200);
    expect(nonArrayRes.body.loadedFiles).toEqual([]);
  });
});
