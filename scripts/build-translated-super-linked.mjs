#!/usr/bin/env node
/**
 * Bake reviewed Simplified Chinese into all 22 original Super Sudokoid
 * side/boss SCL files. Original packages, constraints and solve data are
 * immutable. Never translate creator names or non-prose puzzle fields.
 */
import assert from 'node:assert/strict';
import LZString from 'lz-string';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {unpackScl} from './decode-scl.mjs';
const root=resolve('app/src/main/assets/offline');
const indexFile=join(root,'index.json');
const index=JSON.parse(await readFile(indexFile,'utf8'));
const catalog=JSON.parse(await readFile(join(root,'super-linked-chinese-candidates.json'),'utf8'));
const linked=index.superSudokoidLinkedPuzzles||[];
if(linked.length<22||catalog.length!==linked.length)
  throw new Error('Incomplete Super Sudokoid linked translation catalog');
const records=new Map(catalog.map(x=>[x.id,x]));
const urls=s=>[...String(s||'').matchAll(/https:\/\/sudokupad\.app\/[^\s)>\]]+/g)]
  .map(m=>m[0]).sort();
const DIGIT=/\b(?:enter|insert|place)\s+\*?([1-9])\*?\s+(?:into|in)\s+the\s+boss\s+cell/i;
await mkdir(join(root,'translated'),{recursive:true});
let count=0;
for(const link of linked){
  const id=new URL(link.url).pathname.slice(1);
  if(!/^[a-z0-9-]{8,40}$/.test(id))throw new Error('Unsafe linked puzzle id '+id);
  const translation=records.get(id);
  if(!translation||translation.url!==link.url)
    throw new Error('Chinese translation record missing '+id);
  const api='https://sudokupad.app/api/puzzle/'+id;
  const entry=index.assets[api];
  if(!entry)throw new Error('Missing SCL '+api);
  const source=entry.originalFile||entry.file;
  if(!/^files\/[a-f0-9]{64}\.[a-z0-9]{1,8}$/.test(source))
    throw new Error('Pristine SCL not available '+id);
  const original=unpackScl(await readFile(join(root,source),'utf8'));
  if(!original.metadata)throw new Error('No puzzle metadata '+id);
  const localized=JSON.parse(JSON.stringify(original));
  const fields=['title','rules','msgcorrect'];
  for(const field of fields){
    const candidate=translation.fields[field];
    const english=original.metadata[field];
    if(typeof english!=='string'||!candidate||candidate.english!==english)
      throw new Error('Original linked metadata changed: '+id+' '+field);
    const zh=candidate.zhHans;
    if(typeof zh!=='string'||!(/[\u3400-\u9fff]/u.test(zh))||zh===english)
      throw new Error('Missing Chinese linked puzzle prose: '+id+' '+field);
    assert.deepEqual(urls(english),urls(zh),
      'Puzzle navigation URLs changed: '+id+' '+field);
    const m=english.match(DIGIT);
    if(m&&!new RegExp('(?:^|\\D)'+m[1]+'(?:\\D|$)').test(zh))
      throw new Error('Reward digit missing: '+id+' '+field+' '+m[1]);
    localized.metadata[field]=zh;
  }
  const restored=JSON.parse(JSON.stringify(localized));
  for(const field of fields)restored.metadata[field]=original.metadata[field];
  assert.deepEqual(restored,original,'Non-text puzzle contents changed: '+id);
  const packed='scl'+LZString.compressToBase64(JSON.stringify(localized));
  assert.deepEqual(unpackScl(packed),localized,'SCL compression invalid: '+id);
  const target='translated/super-linked-'+id+'.scl';
  await writeFile(join(root,target),packed,'utf8');
  index.assets[api]={...entry,file:target,originalFile:source,
    mime:'text/plain',bytes:Buffer.byteLength(packed)};
  count++;
  console.log('Localized Super Sudokoid linked puzzle',id);
}
await writeFile(indexFile,JSON.stringify(index,null,2)+'\n');
console.log('Localized',count,'Super Sudokoid linked SCL puzzle packages.');
