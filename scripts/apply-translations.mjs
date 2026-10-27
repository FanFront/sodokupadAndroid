#!/usr/bin/env node
/**
 * Import human-reviewed Simplified Chinese from translation-candidates.json.
 * Only non-empty entries are used. Puzzle logic and source files are untouched.
 *
 * Usage: edit each item's zhHans field, then npm run apply-translations.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const project=resolve('.');
const translated=JSON.parse(await readFile(
  join(project,'app/src/main/assets/offline/translation-candidates.json'),'utf8'));
const directory=join(project,'app/src/main/assets/i18n');
const catalog=JSON.parse(await readFile(join(project,'app/src/main/assets/games.json'),'utf8')).games;
const shared=JSON.parse(await readFile(join(directory,'zh-Hans.json'),'utf8'));
const specific={};
for(const game of catalog) {
  specific[game.id]=JSON.parse(await readFile(
    join(directory,'games',game.id+'.zh-Hans.json'),'utf8'));
}
let count=0;
for(const item of translated) {
  if (!item || typeof item.english!=='string' || typeof item.zhHans!=='string') continue;
  const en=item.english.trim();
  const zh=item.zhHans.trim();
  if (!en || !zh || en===zh) continue;
  const ids=(item.gameIds||[]).filter(id=>Object.prototype.hasOwnProperty.call(specific,id));
  if (ids.length===1) specific[ids[0]][en]=zh;
  else shared[en]=zh;
  count++;
}
await writeFile(join(directory,'zh-Hans.json'),JSON.stringify(shared,null,2)+'\n');
for(const game of catalog) {
  await writeFile(join(directory,'games',game.id+'.zh-Hans.json'),
    JSON.stringify(specific[game.id],null,2)+'\n');
}
console.log('Imported',count,'reviewed Chinese entries into local dictionaries.');
console.log('Run npm run build-html to generate the Chinese HTML pages.');
