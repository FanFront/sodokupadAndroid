#!/usr/bin/env node
/**
 * Personal-use SudokuPad offline snapshot generator.
 *
 * Fetches publicly served runtime responses with Playwright, without
 * assuming that the user has authorization to retain the captured files.
 * Unlike wget -r, this records dynamically loaded /api/puzzle requests.
 *
 * Usage: npm install && npx playwright install chromium
 *        node scripts/capture-offline.mjs
 */
import { chromium } from 'playwright';
import { unpackScl } from './decode-scl.mjs';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const ROOT = resolve('app/src/main/assets/offline');
const OUT = join(ROOT, 'files');
const SOURCES = JSON.parse(await readFile('app/src/main/assets/games.json','utf8')).games;
const MAX_PUZZLES = Math.max(2, Number(process.env.MAX_OFFLINE_PUZZLES || 96));
const WAIT_MS = Math.max(1500, Number(process.env.OFFLINE_SETTLE_MS || 4000));
const MAX_BYTES = 90 * 1024 * 1024; // Stay under GitHub's 100 MiB per-file limit.
const entries = new Map();
const candidates = new Set(SOURCES.map(g => g.url));
const processed = new Set();
const errors = [];
const writes = new Set();
const discovered = new Set();
const decodedStoryCandidates = {};

function key(url) {
  const u = new URL(url);
  u.hash = '';
  return u.href;
}
function allowedPuzzle(url) {
  try {
    const u = new URL(url);
    if (u.origin !== 'https://sudokupad.app') return false;
    const p = u.pathname;
    return p !== '/' && !p.startsWith('/api/') &&
      !/\.(?:js|css|png|jpg|jpeg|webp|svg|ico|woff2?|map|wasm|json|html|txt)$/i.test(p) &&
      !/^\/(?:settings|help|about|assets|static|images)\b/i.test(p);
  } catch { return false; }
}
function discover(string) {
  if (typeof string !== 'string' || string.length > MAX_BYTES) return;
  for (const match of string.matchAll(/https:\/\/sudokupad\.app\/[a-zA-Z0-9_\-/?=&.%+#]+/g)) {
    const maybe = match[0].replace(/[)>,;."']+$/, '');
    if (allowedPuzzle(maybe)) discovered.add(key(maybe));
  }
}
async function saveResponse(response) {
  const url = key(response.url());
  if (entries.has(url)) return;
  if (response.status() < 200 || response.status() >= 300) return;
  const header = (response.headers()['content-type'] || '').split(';')[0].trim();
  try {
    const body = await response.body();
    if (!body.length || body.length > MAX_BYTES) {
      errors.push('Invalid size: ' + url + ' (' + body.length + ')');
      return;
    }
    const sha = createHash('sha256').update(url).digest('hex');
    const mime = header || 'application/octet-stream';
    // Keep a real file extension so GitHub can display HTML, JS and CSS.
    const byMime = {
      'text/html':'html','text/css':'css','text/javascript':'js',
      'application/javascript':'js','application/json':'json',
      'application/wasm':'wasm','image/svg+xml':'svg',
      'image/png':'png','image/jpeg':'jpg','image/webp':'webp',
      'image/gif':'gif','font/woff':'woff','font/woff2':'woff2',
      'application/font-woff':'woff','text/plain':'txt'
    };
    const pathExtension = new URL(url).pathname.match(/\.([a-z0-9]{1,6})$/i)?.[1];
    const extension = byMime[mime] || pathExtension || 'bin';
    const file = 'files/' + sha + '.' + extension.toLowerCase();
    await writeFile(join(ROOT, file), body);
    entries.set(url, { file, mime, bytes: body.length });
    if (mime.includes('json') || mime.startsWith('text/')) {
      const decodedBody = body.toString('utf8');
      discover(decodedBody);
      if (decodedBody.startsWith('scl')) {
        try {
          // Sudokuvania's side quests and Boss Puzzle links are embedded in
          // compressed game metadata. Capturing only the HTML misses them.
          const puzzle = unpackScl(decodedBody);
          discover(JSON.stringify(puzzle));
        } catch (error) {
          errors.push('Cannot decompress discovered puzzle links: '+url);
        }
      }
    }
  } catch (error) {
    errors.push('Cannot capture ' + url + ': ' + error.message);
  }
}
function queueResponse(response) {
  const task = saveResponse(response);
  writes.add(task);
  task.finally(() => writes.delete(task));
}
async function visit(browser, url) {
  const page = await browser.newPage({
    viewport: {width:1440, height:900},
    serviceWorkers: 'block',
    acceptDownloads: false
  });
  // No game automation or solution entry; this only loads pages and buttons.
  page.on('response', queueResponse);
  page.on('requestfailed', r => errors.push('Network failure: ' + r.url() + ' ' + r.failure()?.errorText));
  try {
    console.log('Capturing:', url);
    const response = await page.goto(url, {waitUntil:'domcontentloaded', timeout:90000});
    if (!response || response.status() >= 400) throw new Error('HTTP '+response?.status());
    if (key(response.url()) !== key(url)) {
      await Promise.allSettled([...writes]);
      const finalResource = entries.get(key(response.url()));
      if (finalResource) entries.set(key(url), finalResource);
    }
    await page.waitForTimeout(WAIT_MS);
    const start = page.getByText(/Start Puzzle|Continue Puzzle/i).first();
    if (await start.count() && await start.isVisible()) {
      await start.click({timeout:4000}).catch(()=>{});
      await page.waitForTimeout(WAIT_MS);
    }
    for (const link of await page.locator('a[href]').evaluateAll(nodes => nodes.map(n=>n.href))) {
      if (allowedPuzzle(link)) discovered.add(key(link));
    }
    // SudokuPad may return a packed puzzle: collect already-decoded story and
    // rule strings from the game's in-memory source object for manual review.
    try {
      decodedStoryCandidates[url] = await page.evaluate(() => {
        const puzzle = window.Framework?.app?.sourcePuzzle;
        if (!puzzle) return [];
        const strings = new Set();
        const seen = new WeakSet();
        let visited = 0;
        function walk(value, depth) {
          if (++visited > 120000 || depth > 16) return;
          if (typeof value === 'string') {
            if (value.length >= 12 && value.length <= 3000 &&
                /[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(value)) strings.add(value);
          } else if (value && typeof value === 'object') {
            if (seen.has(value)) return;
            seen.add(value);
            if (Array.isArray(value)) {
              for (const v of value) walk(v, depth+1);
            } else {
              for (const [k,v] of Object.entries(value)) {
                if (!/^(solution|givens|history|undo|redo)$/i.test(k)) walk(v, depth+1);
              }
            }
          }
        }
        walk(puzzle, 0);
        return [...strings].slice(0, 15000);
      });
    } catch (error) {
      errors.push('Could not inspect decoded puzzle text: ' + url);
    }
  } catch (error) {
    errors.push('Page '+url+': '+error.message);
  } finally {
    await page.close();
  }
}
// Re-capture raw blobs, but preserve manually edited pages/*.html.
await rm(OUT, {recursive:true, force:true});
await mkdir(OUT, {recursive:true});
const browser = await chromium.launch({headless:true});
try {
  // Visit built-ins first; additional Sudokuvania-linked SudokuPad pages next.
  const queue = [...candidates];
  while (queue.length && processed.size < MAX_PUZZLES) {
    const url = queue.shift();
    if (processed.has(key(url))) continue;
    processed.add(key(url));
    await visit(browser, url);
    await Promise.allSettled([...writes]);
    for (const next of discovered) {
      if (!processed.has(next) && !queue.includes(next) &&
          queue.length + processed.size < MAX_PUZZLES) queue.push(next);
    }
  }
  await Promise.allSettled([...writes]);
} finally {
  await browser.close();
}
const manifest = {
  format: 1,
  capturedAt: new Date().toISOString(),
  entrypoints: SOURCES.map(g => ({id:g.id, url:g.url})),
  requestedPages: [...processed],
  assets: Object.fromEntries([...entries].sort(([a],[b])=>a.localeCompare(b)))
};
await writeFile(join(ROOT,'index.json'), JSON.stringify(manifest,null,2)+'\n');
await writeFile(join(ROOT,'decoded-game-text.json'),
  JSON.stringify(decodedStoryCandidates, null, 2)+'\n');
await writeFile(join(ROOT,'capture-report.json'), JSON.stringify({
  capturedResources:entries.size,
  capturedPages:processed.size,
  bytes:[...entries.values()].reduce((sum,e)=>sum+e.bytes,0),
  errors:[...new Set(errors)].slice(0,250),
  caveats:[
    'Only visited pages and requested resources are captured.',
    'Unrevealed boss puzzle links and conditional requests may need additional explicit URLs.',
    'Check copyright permission before distributing bundled third-party assets.'
  ]
},null,2)+'\n');
const missing = SOURCES.filter(g => !entries.has(key(g.url)));
console.log(JSON.stringify({captured:entries.size,pages:processed.size,missing:missing.map(g=>g.id),errors:errors.length},null,2));
if (missing.length || entries.size < 4) {
  throw new Error('Required game HTML or web resources were not captured');
}
