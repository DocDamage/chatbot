import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { TaskArtifactStore } from '../../core/tasks/TaskArtifactStore';
import { createTaskArtifactsRouter } from './task-artifacts';

describe('task artifact route', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'task-artifact-route-'));
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('serves playable HTML with a restrictive artifact policy', async () => {
    const artifact = new TaskArtifactStore(workspaceRoot).write(
      'session-1',
      'game.html',
      '<!doctype html><title>Game</title>',
      'game',
      'text/html'
    );
    const app = express().use('/api/task-artifacts', createTaskArtifactsRouter(workspaceRoot));

    const response = await request(app).get(artifact.url);
    expect(response.status).toBe(200);
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.text).toContain('<title>Game</title>');
  });

  it('returns 404 for unknown artifacts', async () => {
    const app = express().use('/api/task-artifacts', createTaskArtifactsRouter(workspaceRoot));
    const response = await request(app).get('/api/task-artifacts/session-1/missing.csv');
    expect(response.status).toBe(404);
  });
});
