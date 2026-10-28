#!/usr/bin/env node
/** Assert the APK actually serves Chinese boss rules AND victory stories. */
import assert from 'node:assert/strict';
import LZString from 'lz-string';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';

const root=resolve('app/src/main/assets/offline');
const idx=JSON.parse(await readFile(join(root,'index.json'),'utf8'));
const bosses=idx.requiredBossPuzzles||[];
assert.equal(bosses.length,20,'The full imported boss catalog must be present');
let compact=0,json=0;
function literal(s,key) {
  const m=s.match(new RegExp('([,{])'+key+":'((?:\\\\.|[^'\\\\])*)'"));
  return m?.[2];
}
const unescape=s=>s?.replace(/\\n/g,'\n').replace(/\\r/g,'\r')
  .replace(/\\'/g,"'").replace(/\\\\/g,'\\');
const escape=s=>s.replace(/\\/g,'\\\\').replace(/'/g,"\\'")
  .replace(/\r/g,'\\r').replace(/\n/g,'\\n');
for (const url of bosses) {
  const name=new URL(url).pathname.split('/').pop();
  const api='https://sudokupad.app/api/puzzle'+new URL(url).pathname;
  const item=idx.assets[api],page=idx.assets[url];
  assert.ok(item && page, name+' missing');
  assert.equal(item.file,'translated/boss-'+name+'.scl');
  const zh=JSON.parse(await readFile(join('app/src/main/assets/i18n/bosses',name+'.zh-Hans.json'),'utf8'));
  const decode=async file => {
    const blob=await readFile(join(root,file),'utf8');
    assert.ok(blob.startsWith('scl'),name+' non-scl');
    return LZString.decompressFromBase64(blob.slice(3));
  };
  const before=await decode(item.originalFile);
  const after=await decode(item.file);
  assert.ok(before && after && before!==after, name+' untranslated or corrupt');
  if (before.startsWith('{"')) {
    json++;
    const original=JSON.parse(before),localized=JSON.parse(after),restored=JSON.parse(after);
    for(const k of ['title','rules','msgcorrect']) {
      if (typeof original.metadata[k] !== 'string') continue;
      assert.equal(localized.metadata[k],zh[k],name+' '+k);
      restored.metadata[k]=original.metadata[k];
    }
    assert.equal(JSON.stringify(restored),JSON.stringify(original),
      name+' puzzle geometry, constraints or solution mutated');
  } else {
    compact++;
    let restored=after;
    for(const k of ['rules','msgcorrect']) {
      assert.equal(unescape(literal(after,k)),zh[k],name+' '+k);
      const translatedToken=escape(zh[k]);
      const beforeToken=literal(before,k);
      assert.ok(beforeToken,name+' missing original field '+k);
      const from=k+":'"+translatedToken+"'";
      assert.ok(restored.includes(from),name+' missing localized token '+k);
      restored=restored.replace(from,k+":'"+beforeToken+"'");
    }
    assert.equal(restored,before,name+' compact puzzle non-prose bytes changed');
  }
  for(const k of ['rules','msgcorrect']) {
    assert.match(zh[k],/[\u3400-\u9fff]/u,name+' missing Chinese '+k);
  }
  const html=await readFile(join(root,page.file),'utf8');
  assert.ok(html.includes(zh.title+' — SudokuPad'),name+' page title not Chinese');
  assert.ok(html.includes('/__android/android.js'),name+' no mobile control UI');
}
assert.ok(json>0 && compact>0,'Missing a boss puzzle encoding family');
console.log('PASS: Chinese titles, rules, victory stories and unchanged puzzle data for',
  bosses.length,'bosses ('+json+' JSON, '+compact+' compact).');
