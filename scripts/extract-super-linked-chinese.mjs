#!/usr/bin/env node
/**
 * Extract localizable literal fields from original Super Sudokoid linked SCL.
 * Does not treat Sudoku answers, geometry, triggers or puzzle IDs as prose.
 */
import LZString from 'lz-string';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const root=resolve('app/src/main/assets/offline');
const index=JSON.parse(await readFile(join(root,'index.json'),'utf8'));
const links=index.superSudokoidLinkedPuzzles||[];
if(links.length<22)throw new Error('Super Sudokoid linked puzzle capture incomplete');
const dest=join(root,'super-linked-chinese-candidates.json');
let prior={};try{
 prior=Object.fromEntries(JSON.parse(await readFile(dest,'utf8'))
   .flatMap(item=>Object.entries(item.fields).map(([field,obj])=>[
      item.id+':'+field,obj.zhHans||''])));
}catch{}
const result=[];
const unescape=s=>s.replace(/\\n/g,'\n').replace(/\\r/g,'\r')
  .replace(/\\'/g,"'").replace(/\\\\/g,'\\');
function compactFields(raw){
 const fields={};
 for(const match of raw.matchAll(/\b(title|rules|msgcorrect|author):'((?:\\.|[^'\\])*)'/g)){
   if(fields[match[1]]===undefined)fields[match[1]]=unescape(match[2]);
 }
 return fields;
}
for(const {url,gameId,kind} of links){
 const id=new URL(url).pathname.slice(1);
 const api='https://sudokupad.app/api/puzzle/'+id;
 const asset=index.assets[api];if(!asset)throw new Error('Missing SCL '+api);
 const blob=await readFile(join(root,asset.originalFile||asset.file),'utf8');
 const raw=LZString.decompressFromBase64(blob.slice(3).trim());
 if(!raw)throw new Error('Corrupt original puzzle '+id);
 let fields,format;
 if(raw.startsWith('{"')){
  format='json';
  const p=JSON.parse(raw);
  fields={};
  for(const key of ['title','rules','msgcorrect','author']){
   if(typeof p.metadata?.[key]==='string')fields[key]=p.metadata[key];
  }
  for(let i=0;i<(p.metadata?.grids||[]).length;i++)
   for(const field of ['title','rules','author'])
    if(typeof p.metadata.grids[i][field]==='string')
      fields['grids.'+i+'.'+field]=p.metadata.grids[i][field];
  for(const type of ['overlays','underlays'])
   for(let i=0;i<(p[type]||[]).length;i++)
    if(typeof p[type][i].text==='string' && /[A-Za-z]{3}/.test(p[type][i].text))
      fields[type+'.'+i+'.text']=p[type][i].text;
 }else if(raw.startsWith('{id:')){
  format='compact';fields=compactFields(raw);
 }else throw new Error('Unknown SCL encoding '+id);
 const output={};
 for(const [field,english] of Object.entries(fields)){
  if(typeof english!=='string'||!english.trim())continue;
  output[field]={english,zhHans:prior[id+':'+field]||''};
 }
 result.push({id,url,gameId,kind,format,fields:output});
 console.log(id,format,Object.fromEntries(Object.entries(output).map(([k,v])=>[k,v.english.length])));
}
await writeFile(dest,JSON.stringify(result,null,2)+'\n');
console.log('Extracted '+result.length+' Super Sudokoid linked puzzle translation candidates');
