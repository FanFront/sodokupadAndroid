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
}
let bytes=0;
for (const [url,info] of Object.entries(index.assets)) {
  if (!url.startsWith('https://')) throw new Error('Invalid URL: '+url);
  if (!/^(files\/[a-f0-9]{64}\.[a-z0-9]{1,8}|mobile\/android\.(?:css|js)|pages\/[a-z0-9-]+\.zh-Hans\.html)$/.test(info.file)) throw new Error('Invalid asset path: '+info.file);
  const st = await stat(join(root,info.file));
  if (!st.isFile() || st.size !== info.bytes) throw new Error('Size mismatch: '+url);
  bytes += st.size;
}
const types = new Set(Object.values(index.assets).map(x=>x.mime));
if (![...types].some(s=>s.includes('javascript'))) {
  console.warn('WARNING: no JavaScript MIME found. Offline game probably will not run.');
}
console.log('Snapshot checked:',keys.length,'resources,', (bytes / 1048576).toFixed(1),'MiB');
