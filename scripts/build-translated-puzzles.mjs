#!/usr/bin/env node
/**
 * Generate translated SudokuPad scl puzzle packages FROM original offline
 * copies. Only reviewed metadata prose is modified; game data, IDs, scripts,
 * grid geometry and solved states stay byte-for-byte equivalent in JSON.
 * The original compressed files remain present in offline/files/.
 */
import LZString from 'lz-string';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { unpackScl } from './decode-scl.mjs';

const root=resolve('app/src/main/assets/offline');
const catalog=JSON.parse(await readFile('app/src/main/assets/games.json','utf8')).games;
const shared=JSON.parse(await readFile('app/src/main/assets/i18n/zh-Hans.json','utf8'));
const file=join(root,'index.json');
const manifest=JSON.parse(await readFile(file,'utf8'));
await mkdir(join(root,'translated'),{recursive:true});

for(const game of catalog){
  if(!/^[a-z0-9-]+$/.test(game.id))throw new Error('Unsafe game ID');
  const api='https://sudokupad.app/api/puzzle'+new URL(game.url).pathname;
  const entry=manifest.assets[api];
  if(!entry)throw new Error('Missing original SudokuPad puzzle package: '+api);
  const sourceFile=entry.originalFile||entry.file;
  if(!/^files\/[a-f0-9]{64}\.[a-z0-9]{1,8}$/.test(sourceFile)) {
    throw new Error('Refusing to alter unknown source file: '+sourceFile);
  }
  const original=unpackScl(await readFile(join(root,sourceFile),'utf8'));
  const translated=JSON.parse(JSON.stringify(original));
  const local=JSON.parse(await readFile(
    'app/src/main/assets/i18n/games/'+game.id+'.zh-Hans.json','utf8'));
  const words={...shared,...local};
  let changed=0;
  function localize(value) {
    if(typeof value!=='string' || !Object.prototype.hasOwnProperty.call(words,value)) return value;
    let out=words[value];
    if(typeof out!=='string'||!out.trim()||out===value)return value;
    // Some grids store literal backslash-n and the engine parses these later.
    // Preserve that representation instead of introducing raw newlines.
    if(value.includes('\\n') && !value.includes('\n')) {
      out=out.replace(/\n/g,'\\n');
    }
    changed++;
    return out;
  }
  if(translated.metadata) {
    for(const field of ['rules','msgcorrect']) {
      translated.metadata[field]=localize(translated.metadata[field]);
    }
    for(const grid of translated.metadata.grids||[]) {
      if(typeof grid.rules==='string') grid.rules=localize(grid.rules);
    }
  }
  // Verify that reverting ONLY the allowed metadata changes recreates the
  // original JSON. If not, do not overwrite the offline index.
  const proof=JSON.parse(JSON.stringify(translated));
  if(proof.metadata&&original.metadata){
    for(const field of ['rules','msgcorrect'])proof.metadata[field]=original.metadata[field];
    for(let n=0;n<(proof.metadata.grids||[]).length;n++){
      const a=proof.metadata.grids[n], b=original.metadata.grids[n];
      if(b&&Object.prototype.hasOwnProperty.call(b,'rules')) a.rules=b.rules;
    }
  }
  if(JSON.stringify(proof)!==JSON.stringify(original)){
    throw new Error('Puzzle data changed outside permitted metadata prose: '+game.id);
  }
  const compressed='scl'+LZString.compressToEncodedURIComponent(JSON.stringify(translated));
  const unpacked=unpackScl(compressed);
  if(JSON.stringify(unpacked)!==JSON.stringify(translated)){
    throw new Error('Lossy round-trip in Chinese SudokuPad package: '+game.id);
  }
  const target='translated/'+game.id+'.scl';
  await writeFile(join(root,target),compressed,'utf8');
  manifest.assets[api]={
    ...entry,file:target,mime:'text/plain',
    bytes:Buffer.byteLength(compressed,'utf8'),originalFile:sourceFile
  };
  console.log(game.id+': localized '+changed+' fields, original '+sourceFile);
}
await writeFile(file,JSON.stringify(manifest,null,2)+'\n');
