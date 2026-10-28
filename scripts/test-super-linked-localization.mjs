#!/usr/bin/env node
/** Verify actual served Chinese SCL contents and immutable Sudoku data. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {unpackScl} from './decode-scl.mjs';
const root=resolve('app/src/main/assets/offline');
const index=JSON.parse(await readFile(join(root,'index.json'),'utf8'));
const catalog=JSON.parse(await readFile(join(root,'super-linked-chinese-candidates.json'),'utf8'));
const linked=index.superSudokoidLinkedPuzzles||[];
assert.equal(linked.length,22,'All linked puzzles must be present');
assert.equal(catalog.length,linked.length,'Complete Chinese catalog required');
for(const item of catalog){
  const api='https://sudokupad.app/api/puzzle/'+item.id;
  const entry=index.assets[api];
  assert.equal(entry?.file,'translated/super-linked-'+item.id+'.scl',
    item.id+' must route to Chinese SCL');
  const original=unpackScl(await readFile(join(root,entry.originalFile),'utf8'));
  const translated=unpackScl(await readFile(join(root,entry.file),'utf8'));
  const restored=JSON.parse(JSON.stringify(translated));
  for(const field of ['title','rules','msgcorrect']){
    const candidate=item.fields[field];
    assert.equal(original.metadata[field],candidate.english,item.id+' English source changed');
    assert.equal(translated.metadata[field],candidate.zhHans,item.id+' Chinese '+field);
    assert.match(translated.metadata[field],[\u3400-\u9fff]/u,item.id+' '+field);
    restored.metadata[field]=original.metadata[field];
  }
  assert.deepEqual(restored,original,item.id+' Sudoku geometry, logic or answer changed');
  const page=index.assets[item.url];
  assert.ok(page,'Missing linked puzzle HTML: '+item.id);
  const html=await readFile(join(root,page.file),'utf8');
  assert.ok(html.includes(item.fields.title.zhHans),
    item.id+' Chinese title missing from actual HTML');
  assert.ok(html.includes('/__android/android.js'),
    item.id+' mobile keypad script missing');
}
console.log('PASS: 22 Super Sudokoid Chinese titles, rules, endings, original puzzle data, Android controls.');
