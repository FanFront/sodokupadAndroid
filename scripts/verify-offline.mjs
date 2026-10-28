#!/usr/bin/env node
/**
 * Fail closed if the offline bundle is missing core entrypoints/assets.
 * This is structural validation, not a substitute for airplane-mode device QA.
 */
import { readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve('app/src/main/assets/offline');
const index = JSON.parse(await readFile(join(root,'index.json'),'utf8'));
const catalog = JSON.parse(await readFile('app/src/main/assets/games.json','utf8')).games;
const keys = Object.keys(index.assets || {});
if (index.format !== 1 || keys.length < 4) throw new Error('No usable capture');
for (const game of catalog) {
  if (!index.assets[game.url]) throw new Error('Missing game entrypoint: ' + game.url);
  if (!index.entrypoints.some(e=>e.id===game.id)) throw new Error('No catalog entry: ' + game.id);
  if (game.id.startsWith('super-sudokoid-')) {
    const page = index.assets[game.url];
    if (!page.file.endsWith('.zh-Hans.html')) throw new Error('Missing Chinese page: '+game.id);
    const html = await readFile(join(root,page.file),'utf8');
    if (!html.includes(game.title)) throw new Error('Unlocalized Super Sudokoid HTML title: '+game.id);
  }
}
let bytes=0;
for (const [url,info] of Object.entries(index.assets)) {
  if (!url.startsWith('https://')) throw new Error('Invalid URL: '+url);
  if (!/^(files\/[a-f0-9]{64}\.[a-z0-9]{1,8}|mobile\/android\.(?:css|js)|translated\/[a-z0-9-]+\.scl|pages\/[a-z0-9-]+\.zh-Hans\.html)$/.test(info.file)) throw new Error('Invalid asset path: '+info.file);
  const st = await stat(join(root,info.file));
  if (!st.isFile() || st.size !== info.bytes) throw new Error('Size mismatch: '+url);
  bytes += st.size;
}
// Every linked boss must have a navigable page, an API puzzle package and
// Android controls. Never silently release a capture with blank boss rooms.
const expectedBosses = index.requiredBossPuzzles || [];
if (!expectedBosses.length) {
  const message = 'Snapshot predates linked-boss capture; run the opt-in capture workflow.';
  if (process.env.OFFLINE_REQUIRE_BOSS_PUZZLES === '1') throw new Error(message);
  console.warn('WARNING:',message);
}
// Check against an independent source: the authored boss links already
// present in the translated main-map metadata, not just a generated count.
const candidates = JSON.parse(await readFile(join(root,'translation-candidates.json'),'utf8'));
const sourceBosses = new Set();
for (const item of candidates) {
  // Super Sudokoid bosses are intentionally outside the first main-map-only
  // capture. Do not turn its new discovery candidates into Sudokuvania bosses.
  if (!(item.gameIds || []).some(id =>
      id === 'digits-of-despair' || id === 'lineage-of-logic')) continue;
  for (const match of String(item.english || '').matchAll(/\[([^\]]+)\]\((https:\/\/sudokupad\.app\/[^)\s]+)\)/g)) {
    if (/boss|首领/i.test(match[1]) || /\/boss-/i.test(match[2])) sourceBosses.add(match[2]);
  }
}
if (expectedBosses.length) {
  for (const url of sourceBosses) {
    if (!expectedBosses.includes(url)) throw new Error('Boss absent from manifest: '+url);
  }
}
for (const url of expectedBosses) {
  if (!/^https:\/\/sudokupad\.app\//.test(url)) throw new Error('Unsafe boss URL: '+url);
  const page = index.assets[url];
  const api = 'https://sudokupad.app/api/puzzle' + new URL(url).pathname;
  const puzzle = index.assets[api];
  if (!page || !puzzle) throw new Error('Boss not bundled: '+url);
  if (!/^pages\/linked-[a-f0-9]{16}\.zh-Hans\.html$/.test(page.file)) {
    throw new Error('Boss is missing mobile HTML: '+url);
  }
  const html = await readFile(join(root,page.file),'utf8');
  if (!html.includes('/__android/android.js') || !html.includes('/__android/android.css')) {
    throw new Error('Boss HTML has no Android controls: '+url);
  }
  const bossName = new URL(url).pathname.split('/').pop();
  if (puzzle.file !== 'translated/boss-'+bossName+'.scl') {
    throw new Error('Missing Chinese boss puzzle package: '+url);
  }
  if (!/^files\/[a-f0-9]{64}\.[a-z0-9]+$/.test(puzzle.originalFile || '')) {
    throw new Error('Missing pristine original boss puzzle package: '+url);
  }
  await stat(join(root,puzzle.originalFile));
  const chineseScl = await readFile(join(root,puzzle.file),'utf8');
  if (!chineseScl.startsWith('scl')) {
    throw new Error('Invalid Chinese boss puzzle: '+url);
  }
}
if (expectedBosses.length) console.log('Verified',expectedBosses.length,'bosses with Android controls and puzzle data.');

const types = new Set(Object.values(index.assets).map(x=>x.mime));
if (![...types].some(s=>s.includes('javascript'))) {
  console.warn('WARNING: no JavaScript MIME found. Offline game probably will not run.');
}
console.log('Snapshot checked:',keys.length,'resources,', (bytes / 1048576).toFixed(1),'MiB');
