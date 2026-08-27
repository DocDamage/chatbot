import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRegisterPath = path.join(root, 'docs/implementation/CAPABILITY_SOURCE_REGISTER.md');
const outputPath = path.join(root, 'THIRD_PARTY_NOTICES.md');

function clean(value) {
  return value.trim().replace(/^`|`$/g, '');
}

function parseSourceRegister() {
  if (!fs.existsSync(sourceRegisterPath)) {
    throw new Error(`Missing source register: ${sourceRegisterPath}`);
  }
  const content = fs.readFileSync(sourceRegisterPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const sources = [];

  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const cols = line.split('|').slice(1, -1).map(clean);
    if (cols.length < 8) continue;
    if (cols[0].includes('---') || cols[0].toLowerCase().includes('source')) continue;

    sources.push({
      name: cols[0].replace(/\*\*/g, ''),
      upstream: cols[1],
      revision: cols[2],
      license: cols[3],
      notices: cols[4],
      mode: cols[5],
      boundary: cols[6],
      status: cols[7],
    });
  }
  return sources;
}

export function generateNotices() {
  const sources = parseSourceRegister();
  const date = execFileSync('git', ['log', '-1', '--format=%cs', '--', sourceRegisterPath], {
    cwd: root,
    encoding: 'utf8',
  }).trim();

  let output = `# Third-Party Software Notices and Attribution\n\n`;
  output += `**Generated:** ${date}\n\n`;
  output += `**Governing Document:** [CAPABILITY_SOURCE_REGISTER.md](docs/implementation/CAPABILITY_SOURCE_REGISTER.md)\n\n`;
  output += `This document lists external software, reference algorithms, and capability pack sources utilized, adapted, or referenced by AI Chatbot Hub.\n\n`;
  output += `All native adaptations retain upstream copyright and license notices in accordance with their respective permissive licenses (MIT, Apache-2.0, BSD).\n\n`;
  output += `---\n\n`;
  output += `## 1. Capability Source Register Inventory\n\n`;
  output += `| Source Name | Upstream Repository | License | Integration Mode | Attribution Notice |\n`;
  output += `|---|---|---|---|---|\n`;

  for (const s of sources) {
    output += `| ${s.name} | \`${s.upstream}\` | ${s.license} | \`${s.mode}\` | ${s.notices} |\n`;
  }

  output += `\n---\n\n`;
  output += `## 2. Standard Upstream License Texts\n\n`;
  output += `### 2.1 The MIT License\n\n`;
  output += `\`\`\`text\n`;
  output += `Permission is hereby granted, free of charge, to any person obtaining a copy\n`;
  output += `of this software and associated documentation files (the "Software"), to deal\n`;
  output += `in the Software without restriction, including without limitation the rights\n`;
  output += `to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n`;
  output += `copies of the Software, and to permit persons to whom the Software is\n`;
  output += `furnished to do so, subject to the following conditions:\n\n`;
  output += `The above copyright notice and this permission notice shall be included in all\n`;
  output += `copies or substantial portions of the Software.\n\n`;
  output += `THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n`;
  output += `IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n`;
  output += `FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n`;
  output += `AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n`;
  output += `LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n`;
  output += `OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\n`;
  output += `SOFTWARE.\n`;
  output += `\`\`\`\n\n`;
  output += `### 2.2 Apache License, Version 2.0\n\n`;
  output += `\`\`\`text\n`;
  output += `Licensed under the Apache License, Version 2.0 (the "License");\n`;
  output += `you may not use this file except in compliance with the License.\n`;
  output += `You may obtain a copy of the License at\n\n`;
  output += `    http://www.apache.org/licenses/LICENSE-2.0\n\n`;
  output += `Unless required by applicable law or agreed to in writing, software\n`;
  output += `distributed under the License is distributed on an "AS IS" BASIS,\n`;
  output += `WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n`;
  output += `See the License for the specific language governing permissions and\n`;
  output += `limitations under the License.\n`;
  output += `\`\`\`\n`;

  fs.writeFileSync(outputPath, output, 'utf8');
  console.log(`Generated ${outputPath} with ${sources.length} capability source notices.`);
  return sources.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes('--check')) {
    const sources = parseSourceRegister();
    if (sources.length === 0) {
      console.error('Error: No sources found in register.');
      process.exit(1);
    }
    console.log(`Verified ${sources.length} capability sources in register.`);
  } else {
    generateNotices();
  }
}
