const path = require('node:path');
const { spawnSync } = require('node:child_process');
const python = process.env.CHATBOT_TEST_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
for (const script of ['test_run_sql.py', 'test_knowledge_sql.py']) {
  const result = spawnSync(python, [path.join(__dirname, script)], { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status === null ? 1 : result.status);
}
