// Project-owned, fixed lint profile. Never loads or executes repository ESLint configuration.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const dependencies = createRequire(path.resolve(__dirname, '../../services/coding-tools/package.json'));
const { Linter } = dependencies('eslint');
const parser = dependencies('@typescript-eslint/parser');
const globals = dependencies('globals');
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!Array.isArray(input.files) || input.files.length > 12) throw new Error('Invalid lint snapshot');
const linter = new Linter();
const coreExports = new Map(['assert', 'assert/strict', 'path', 'fs', 'util', 'os'].map(name => [name, require(`node:${name}`)]));
const coreRule = { meta: { schema: [], messages: { missing: '{{name}} is not an exported member of {{module}}. Check the actual Node core import.' } },
  create(context) {
    const check = (module, name, node) => {
      const exported = coreExports.get(module.replace(/^node:/, ''));
      if (exported && !Object.prototype.hasOwnProperty.call(exported, name)) context.report({ node, messageId: 'missing', data: { name, module } });
    };
    return {
      VariableDeclarator(node) {
        const call = node.init;
        if (node.id.type !== 'ObjectPattern' || call?.type !== 'CallExpression' || call.callee.name !== 'require' || typeof call.arguments[0]?.value !== 'string') return;
        for (const property of node.id.properties) if (property.type === 'Property' && !property.computed) check(call.arguments[0].value, property.key.name || property.key.value, property);
      },
      ImportDeclaration(node) {
        if (node.importKind === 'type') return;
        for (const imported of node.specifiers) if (imported.type === 'ImportSpecifier' && imported.importKind !== 'type') check(node.source.value, imported.imported.name || imported.imported.value, imported);
      },
    };
  } };
function lint(file, content) {
  const typed = /\.[cm]?tsx?$/.test(file);
  const test = /(?:^|\/)(?:__tests__\/|[^/]*\.(?:test|spec)\.)/.test(file);
  const profile = { files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
    plugins: { chatbot: { rules: { 'node-core-exports': coreRule } } },
    languageOptions: { parser, ecmaVersion: 2022, sourceType: file.endsWith('.cjs') ? 'commonjs' : 'module',
      parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.node, ...globals.browser,
        ...(test ? { ...globals.jest, ...globals.mocha } : {}) } },
    rules: { 'chatbot/node-core-exports': 'error', 'no-undef': typed ? 'off' : 'error', 'no-unreachable': 'error', 'valid-typeof': 'error',
      'no-unsafe-finally': 'error', 'no-constant-binary-expression': 'error', 'no-duplicate-case': 'error',
      'constructor-super': 'error', 'no-class-assign': 'error', 'no-import-assign': 'error', 'no-unsafe-negation': 'error' } };
  return linter.verify(content, [profile], { filename: file, allowInlineConfig: false, disableFixes: true })
    .filter(item => item.severity === 2).map(item => ({ tool: 'eslint', file, line: item.line, column: item.column,
      code: item.ruleId || 'PARSE_ERROR', message: item.message.slice(0, 1800), anchor: content.split(/\r?\n/)[item.line - 1]?.trim().slice(0, 600) }));
}
const eligible = input.files.filter(file => /\.[cm]?[jt]sx?$/.test(file.path));
process.stdout.write(JSON.stringify({ version: Linter.version,
  before: eligible.flatMap(file => lint(file.path, file.before)), after: eligible.flatMap(file => lint(file.path, file.after)) }));
