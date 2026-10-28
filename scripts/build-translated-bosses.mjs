#!/usr/bin/env node
/**
 * Localize every imported boss, including the SudokuMaker compact-literal
 * payloads used by Sudokuvania 2. NEVER eval third-party puzzle data.
 * Repack only metadata titles/rules/victory prose, and prove that every
 * other byte of the decompressed puzzle is unchanged.
 */
import LZString from 'lz-string';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const root=resolve('app/src/main/assets/offline');
const indexPath=join(root,'index.json');
const index=JSON.parse(await readFile(indexPath,'utf8'));
const bosses=index.requiredBossPuzzles || [];
if (bosses.length < 20) throw new Error('Boss capture incomplete; run full offline capture first');
await mkdir(join(root,'translated'),{recursive:true});

const literal = field => new RegExp('([,{])'+field+":'((?:\\\\.|[^'\\\\])*)'");
const escapeLiteral = value => value.replace(/\\/g,'\\\\').replace(/'/g,"\\'")
  .replace(/\r/g,'\\r').replace(/\n/g,'\\n');
const readLiteral = (raw,field) => {
  const m=raw.match(literal(field));
  return m ? m[2].replace(/\\n/g,'\n').replace(/\\r/g,'\r').replace(/\\'/g,"'").replace(/\\\\/g,'\\') : undefined;
};
function editLiteral(raw,field,text) {
  const re=literal(field);
  if (!re.test(raw)) return {raw,edited:false};
  return {raw:raw.replace(re,(_full,prefix)=>prefix+field+":'"+escapeLiteral(text)+"'"),edited:true};
}
const links=text => [...String(text||'').matchAll(/https:\/\/sudokupad\.app\/[^\s)\]>]+/g)]
  .map(x=>x[0]).sort();
function checkText(original,translated,field,name) {
  if(typeof original!=='string'||typeof translated!=='string'||!(/[\u3400-\u9fff]/u.test(translated)))
    throw new Error('Missing Chinese translation: '+name+' '+field);
  if(original===translated)throw new Error('Untranslated boss '+name+' '+field);
  if(JSON.stringify(links(original))!==JSON.stringify(links(translated)))
    throw new Error('Boss links changed by translation: '+name+' '+field);
  const key=original.match(/\bEnter (\d) into this puzzle['’]s Boss (?:Cell|Digit)/i);
  if (key && !new RegExp('[^\\d]'+key[1]+'[^\\d]').test(translated))
    throw new Error('Boss answer digit absent from Chinese victory prose: '+name);
}
let count=0, compactCount=0;
for(const url of bosses) {
  if(!url.startsWith('https://sudokupad.app/'))throw new Error('Unsafe boss URL: '+url);
  const name=url.split('/').pop().split('?')[0];
  if(!/^[a-z0-9-]+$/.test(name))throw new Error('Unsafe boss name');
  const translation=JSON.parse(await readFile(join('app/src/main/assets/i18n/bosses',name+'.zh-Hans.json'),'utf8'));
  const api='https://sudokupad.app/api/puzzle'+new URL(url).pathname;
  const entry=index.assets[api];
  if(!entry)throw new Error('Missing boss API: '+url);
  const source=entry.originalFile || entry.file;
  if(!/^files\/[a-f0-9]{64}\.[a-z0-9]+$/.test(source))throw new Error('No pristine boss source: '+api);
  const packed=await readFile(join(root,source),'utf8');
  if(!packed.startsWith('scl'))throw new Error('Not an scl boss: '+api);
  const original=LZString.decompressFromBase64(packed.slice(3));
  if(!original)throw new Error('Cannot decode boss: '+api);
  let output=original,proof,format;
  if (original.startsWith('{"')) {
    format='json';
    const parsed=JSON.parse(original);
    if(!parsed.metadata)throw new Error('Missing JSON metadata: '+api);
    const localized=JSON.parse(original);
    for(const field of ['title','rules','msgcorrect']) {
      const before=parsed.metadata[field];
      if(before===undefined)continue;
      checkText(before,translation[field],field,name);
      localized.metadata[field]=translation[field];
    }
    output=JSON.stringify(localized);
    proof=JSON.parse(output);
    for(const field of ['title','rules','msgcorrect']) {
      if(Object.hasOwn(parsed.metadata,field)) proof.metadata[field]=parsed.metadata[field];
    }
    if(JSON.stringify(proof)!==JSON.stringify(parsed))
      throw new Error('Boss JSON geometry or answer modified: '+name);
  } else if (original.startsWith('{id:')) {
    format='compact';compactCount++;
    // The SudokuMaker compact format is NOT JSON; it contains unquoted keys,
    // single-quoted strings and special numeric/color tokens. Never parse or
    // eval it as JavaScript. Replace the original string token only.
    const changed=[];
    for(const field of ['title','rules','msgcorrect']) {
      const before=readLiteral(original,field);
      if(before===undefined)continue;
      checkText(before,translation[field],field,name);
      const patched=editLiteral(output,field,translation[field]);
      if(!patched.edited)throw new Error('Boss compact metadata missing: '+name+' '+field);
      output=patched.raw;changed.push({field,before});
    }
    proof=output;
    for(const {field,before} of changed)proof=editLiteral(proof,field,before).raw;
    if(proof!==original)throw new Error('Boss compact non-text bytes modified: '+name);
  } else throw new Error('Unknown boss scl format: '+name);
  const encoded='scl'+LZString.compressToBase64(output);
  if(LZString.decompressFromBase64(encoded.slice(3))!==output)
    throw new Error('Lossy boss compression: '+name);
  const dest='translated/boss-'+name+'.scl';
  await writeFile(join(root,dest),encoded,'utf8');
  index.assets[api]={...entry,file:dest,originalFile:source,mime:'text/plain',
    bytes:Buffer.byteLength(encoded)};
  count++;
  console.log('Localized',name,format);
}
await writeFile(indexPath,JSON.stringify(index,null,2)+'\n');
console.log('Boss localization complete:',count,'of',bosses.length,
  '(compact SudokuMaker:',compactCount,')');
