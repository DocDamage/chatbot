import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import jwt from 'jsonwebtoken';

const workspace = path.resolve(import.meta.dirname, '..', '..');
const composeFile = path.join(workspace, 'deploy', 'certification', 'docker-compose.production-like.yml');
const runId = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const project = `chatbot-cert-${runId}`;
const appPort = Number(process.env.CERT_APP_PORT || 4301);
const baseUrl = `http://127.0.0.1:${appPort}`;
const backupDir = path.join(workspace, 'data', 'certification', runId).replaceAll('\\', '/');
const keep = process.argv.includes('--keep');
const env = {
  ...process.env,
  CERT_APP_PORT: String(appPort),
  CERT_APP_IMAGE: `${project}-app:${runId}`,
  CERT_BACKUP_DIR: backupDir,
  CERT_DB_PASSWORD: crypto.randomBytes(24).toString('base64url'),
  CERT_JWT_SECRET: crypto.randomBytes(48).toString('base64url'),
  CERT_CSRF_TOKEN: crypto.randomBytes(32).toString('base64url'),
  CERT_API_ENCRYPTION_SECRET: crypto.randomBytes(48).toString('base64url')
};
const composeArgs = ['compose', '--project-name', project, '--file', composeFile];
const evidence = {
  runId,
  project,
  target: 'isolated local Linux OCI production-like target',
  startedAt: new Date().toISOString(),
  checks: {},
  commands: []
};

fs.mkdirSync(backupDir, { recursive: true });

function run(command, args, options = {}) {
  const printable = [command, ...args].join(' ')
    .replaceAll(env.CERT_DB_PASSWORD, '[REDACTED]')
    .replaceAll(env.CERT_JWT_SECRET, '[REDACTED]')
    .replaceAll(env.CERT_CSRF_TOKEN, '[REDACTED]')
    .replaceAll(env.CERT_API_ENCRYPTION_SECRET, '[REDACTED]');
  evidence.commands.push(printable);
  const result = spawnSync(command, args, {
    cwd: workspace,
    env,
    encoding: 'utf8',
    windowsHide: true,
    stdio: options.inherit ? 'inherit' : 'pipe',
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr || result.stdout || `exit ${result.status}`;
    throw new Error(`${printable} failed: ${String(detail).trim()}`);
  }
  return String(result.stdout || '').trim();
}

function compose(...args) {
  return run('docker', [...composeArgs, ...args]);
}

async function request(relativePath, expectedStatus, headers = {}) {
  const response = await fetch(`${baseUrl}${relativePath}`, { headers, signal: AbortSignal.timeout(10_000) });
  const body = await response.text();
  if (response.status !== expectedStatus) {
    throw new Error(`${relativePath} returned ${response.status}; expected ${expectedStatus}: ${body.slice(0, 500)}`);
  }
  return { status: response.status, headers: Object.fromEntries(response.headers), body };
}

async function waitReady(timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await request('/health/ready', 200);
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 2_000));
    }
  }
  throw new Error(`Application did not become ready: ${lastError?.message || 'timeout'}`);
}

function psql(sql) {
  return compose('exec', '-T', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'chatbot', '-d', 'chatbot', '-Atc', sql);
}

function redis(...args) {
  return compose('exec', '-T', 'redis', 'redis-cli', '--raw', ...args);
}

function assertEqual(actual, expected, label) {
  if (actual.trim() !== expected) throw new Error(`${label}: expected ${expected}, received ${actual.trim()}`);
}

try {
  run('docker', ['version', '--format', '{{.Server.Version}}']);
  compose('build', '--pull', 'app');
  compose('up', '-d', '--wait');
  await waitReady();

  const live = await request('/health/live', 200);
  const ready = await request('/health/ready', 200);
  const home = await request('/', 200);
  const unauthorized = await request('/api/admin/users', 401);
  const userToken = jwt.sign({ id: 'cert-user', email: 'cert@example.invalid', roles: ['user'] }, env.CERT_JWT_SECRET, { expiresIn: '5m' });
  const forbidden = await request('/api/admin/users', 403, { Authorization: `Bearer ${userToken}` });
  const localOnly = await request('/api/game-studio/projects', 404);
  evidence.checks.http = {
    live: live.status,
    ready: ready.status,
    client: home.status,
    unauthorized: unauthorized.status,
    forbidden: forbidden.status,
    hostedLocalOnlyRoute: localOnly.status,
    securityHeaders: {
      contentSecurityPolicy: Boolean(home.headers['content-security-policy']),
      frameProtection: home.headers['x-frame-options'] || null,
      contentTypeProtection: home.headers['x-content-type-options'] || null
    }
  };
  if (!evidence.checks.http.securityHeaders.contentSecurityPolicy || !evidence.checks.http.securityHeaders.contentTypeProtection) {
    throw new Error('Required browser security headers were absent.');
  }

  const marker = `marker-${runId}`;
  psql("CREATE TABLE IF NOT EXISTS certification_probe (id text PRIMARY KEY, value text NOT NULL); DELETE FROM certification_probe; INSERT INTO certification_probe VALUES ('deployment', '" + marker + "');");
  redis('SET', 'certification:probe', marker);
  compose('restart', 'app');
  await waitReady();
  assertEqual(psql("SELECT value FROM certification_probe WHERE id='deployment';"), marker, 'PostgreSQL restart persistence');
  assertEqual(redis('GET', 'certification:probe'), marker, 'Redis restart persistence');
  evidence.checks.restartPersistence = { postgres: true, redis: true, appReady: true };

  compose('exec', '-T', 'postgres', 'pg_dump', '-U', 'chatbot', '-d', 'chatbot', '-Fc', '-t', 'public.certification_probe', '-f', '/backups/postgres-certification.dump');
  redis('SAVE');
  compose('exec', '-T', 'redis', 'sh', '-c', "redis-cli BGREWRITEAOF >/dev/null && while redis-cli INFO persistence | grep -q 'aof_rewrite_in_progress:1'; do sleep 1; done && redis-cli INFO persistence | grep -q 'aof_last_bgrewrite_status:ok'");
  compose('exec', '-T', 'redis', 'sh', '-c', 'tar -C /data -cf /backups/redis-certification.tar appendonlydir dump.rdb');
  psql('DROP TABLE certification_probe;');
  redis('DEL', 'certification:probe');
  compose('exec', '-T', 'postgres', 'pg_restore', '-U', 'chatbot', '-d', 'chatbot', '--clean', '--if-exists', '/backups/postgres-certification.dump');
  compose('stop', 'redis');
  compose('run', '--rm', '--no-deps', 'redis', 'sh', '-c', 'rm -rf /data/appendonlydir /data/dump.rdb && tar -C /data -xf /backups/redis-certification.tar');
  compose('up', '-d', '--wait', 'redis');
  assertEqual(psql("SELECT value FROM certification_probe WHERE id='deployment';"), marker, 'PostgreSQL restore');
  assertEqual(redis('GET', 'certification:probe'), marker, 'Redis restore');
  evidence.checks.backupRestore = {
    postgres: true,
    redis: true,
    postgresArtifactBytes: fs.statSync(path.join(backupDir, 'postgres-certification.dump')).size,
    redisArtifactBytes: fs.statSync(path.join(backupDir, 'redis-certification.tar')).size
  };

  const loadOutput = run(process.execPath, [path.join(workspace, 'scripts', 'certification', 'http-load.mjs'), '--url', `${baseUrl}/health/ready`, '--duration-ms', '15000', '--concurrency', '20', '--p95-limit-ms', '500']);
  evidence.checks.load = JSON.parse(loadOutput);

  const appContainerId = compose('ps', '-q', 'app');
  const inspect = JSON.parse(run('docker', ['inspect', appContainerId]))[0];
  evidence.checks.hardening = {
    image: env.CERT_APP_IMAGE,
    imageId: inspect.Image,
    user: inspect.Config.User,
    readOnlyRootFilesystem: inspect.HostConfig.ReadonlyRootfs,
    droppedCapabilities: inspect.HostConfig.CapDrop,
    securityOptions: inspect.HostConfig.SecurityOpt,
    publishedAppPort: appPort,
    postgresPublishedPorts: JSON.parse(run('docker', ['inspect', compose('ps', '-q', 'postgres')]))[0].NetworkSettings.Ports['5432/tcp'] || null,
    redisPublishedPorts: JSON.parse(run('docker', ['inspect', compose('ps', '-q', 'redis')]))[0].NetworkSettings.Ports['6379/tcp'] || null
  };
  if (evidence.checks.hardening.user === '0' || !evidence.checks.hardening.readOnlyRootFilesystem) {
    throw new Error('Container hardening check failed.');
  }

  const rollbackTag = `${project}-app:rollback`;
  run('docker', ['image', 'tag', env.CERT_APP_IMAGE, rollbackTag]);
  const rollbackEnv = { ...env, CERT_APP_IMAGE: rollbackTag };
  const rollback = spawnSync('docker', [...composeArgs, 'up', '-d', '--no-build', '--force-recreate', 'app'], {
    cwd: workspace, env: rollbackEnv, encoding: 'utf8', windowsHide: true
  });
  if (rollback.error || rollback.status !== 0) throw new Error(`Rollback rehearsal failed: ${rollback.error?.message || rollback.stderr}`);
  await waitReady();
  evidence.checks.rollbackRehearsal = { passed: true, image: rollbackTag, readiness: 200 };

  evidence.completedAt = new Date().toISOString();
  evidence.passed = true;
  const evidencePath = path.join(backupDir, 'production-like-certification.json');
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ passed: true, evidencePath, checks: evidence.checks }, null, 2)}\n`);
} catch (error) {
  evidence.completedAt = new Date().toISOString();
  evidence.passed = false;
  evidence.error = error instanceof Error ? error.message : String(error);
  const evidencePath = path.join(backupDir, 'production-like-certification.json');
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  try { process.stderr.write(`${compose('logs', '--no-color', '--tail', '200')}\n`); } catch {}
  process.stderr.write(`${JSON.stringify({ passed: false, evidencePath, error: evidence.error }, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  if (!keep) {
    try { compose('down', '--volumes', '--remove-orphans'); } catch {}
  }
}
