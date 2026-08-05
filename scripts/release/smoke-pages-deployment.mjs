const target = process.argv[2];
const marker = 'Static interface demo only';

if (!target) {
  throw new Error('Usage: node smoke-pages-deployment.mjs <page-url>');
}

const pageUrl = new URL(target.endsWith('/') ? target : `${target}/`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchWithRetry(url, attempts = 12) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'follow', cache: 'no-store' });
      if (response.ok) return response;
      lastError = new Error(`${url} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw lastError;
}

const pageResponse = await fetchWithRetry(pageUrl);
const html = await pageResponse.text();
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map(match => match[1])
  .filter(reference => reference.startsWith('/chatbot/'));

assert(references.length > 0, 'Deployed page has no repository-scoped assets.');

const scriptBodies = [];
for (const reference of references) {
  const assetUrl = new URL(reference, pageUrl.origin);
  const response = await fetchWithRetry(assetUrl);
  const body = await response.text();
  assert(body.length > 0, `Deployed asset is empty: ${assetUrl}`);
  if (reference.endsWith('.js')) scriptBodies.push(body);
}

assert(scriptBodies.join('\n').includes(marker), 'Deployed JavaScript lacks the static-demo limitation marker.');

console.log(JSON.stringify({
  status: 'passed',
  pageUrl: pageUrl.toString(),
  assetsChecked: references.length,
  marker
}, null, 2));
