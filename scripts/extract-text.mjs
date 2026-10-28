#!/usr/bin/env node
/**
 * Extract REAL narrative, quests, and rules from captured compressed
 * SudokuPad puzzle API data, plus visible text from original HTML.
 * The English/Chinese review file is editable and preserved across rebuilds.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse } from 'parse5';
import { unpackScl } from './decode-scl.mjs';
import LZString from 'lz-string';

const root=resolve('app/src/main/assets/offline');
const index=JSON.parse(await readFile(join(root,'index.json'),'utf8'));
const games=JSON.parse(await readFile('app/src/main/assets/games.json','utf8')).games;
const target=join(root,'translation-candidates.json');
let prior={};
try {
  const old=JSON.parse(await readFile(target,'utf8'));
  prior=Object.fromEntries(old.filter(x=>typeof x.english==='string')
    .map(x=>[x.english,x.zhHans||'']));
} catch {}
const common=JSON.parse(await readFile('app/src/main/assets/i18n/zh-Hans.json','utf8'));
const perGame={};
for(const g of games) {
  perGame[g.id]=JSON.parse(await readFile(
    'app/src/main/assets/i18n/games/'+g.id+'.zh-Hans.json','utf8'));
}
const found=new Map();
function record(english,id,path){
  const s=(typeof english==='string'?english:'').trim();
  if(s.length<9||s.length>16000) return;
  if(!/[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(s) || /^[a-z0-9+/=-]{100,}$/i.test(s))return;
  const item=found.get(s)||{english:s,zhHans:'',gameIds:[],sourcePaths:[]};
  if(!item.gameIds.includes(id))item.gameIds.push(id);
  if(item.sourcePaths.length<12)item.sourcePaths.push(id+':'+path);
  item.zhHans ||= prior[s] || perGame[id][s] || common[s] || '';
  found.set(s,item);
}
function walk(value,id,path,depth=0) {
  if(depth>25)return;
  if(typeof value==='string')return record(value,id,path);
  if(Array.isArray(value))return value.forEach((v,i)=>walk(v,id,path+'['+i+']',depth+1));
  if(value && typeof value==='object') {
    for(const [key,v] of Object.entries(value)) {
      // Puzzle geometry, solver state and original answers are never localized.
      if(/^(?:solution|givens|cells|foglight|triggereffect)$/i.test(key))continue;
      walk(v,id,path+'.'+key,depth+1);
    }
  }
}
function walkVisible(node,id,path='html'){
  if(['script','style','noscript','svg','template'].includes(node.nodeName))return;
  if(node.nodeName==='#text')record(node.value,id,path);
  for(const child of node.childNodes||[])walkVisible(child,id,path+'/'+node.nodeName);
}
for(const g of games) {
  const original=join(root,'pages',g.id+'.html');
  try {
    walkVisible(parse(await readFile(original,'utf8')),g.id,'original-html');
  } catch(error) {
    console.warn('HTML not available:',g.id,error.message);
  }
  const api='https://sudokupad.app/api/puzzle'+new URL(g.url).pathname;
  const entry=index.assets[api];
  if(!entry) {
    console.warn('No captured game data:',api);
    continue;
  }
  try {
    const compressed=await readFile(join(root,entry.originalFile||entry.file),'utf8');
    try {
      const puzzle=unpackScl(compressed);
      walk(puzzle,g.id,'puzzle');
      console.log('Decoded:',g.id,Object.keys(puzzle));
    } catch (error) {
      const compact=compressed.startsWith('scl')
        ? LZString.decompressFromBase64(compressed.slice(3).trim()) : null;
      if (!g.id.startsWith('super-sudokoid-') || !compact?.startsWith('{id:'))
        throw error;
      // SudokuMaker compact literal: extract string fields without eval.
      const field=/\\b(title|rules|msgcorrect|author|text):'((?:\\\\.|[^'\\\\])*)'/g;
      let count=0;
      for (const match of compact.matchAll(field)) {
        const value=match[2].replace(/\\n/g,'\n').replace(/\\r/g,'\r')
          .replace(/\\'/g,"'").replace(/\\\\/g,'\\');
        record(value,g.id,'puzzle.compact.'+match[1]);
        count++;
      }
      console.log('Decoded compact text fields:',g.id,count);
    }
  } catch(error) {
    console.warn('Could not decode',g.id,error.message);
    process.exitCode=1;
  }
}
const prioritized=p=>p.sourcePaths.some(path=>/puzzle\.metadata\.(rules|msgcorrect)/.test(path))?0:1;
const candidates=[...found.values()].sort((a,b)=>
  prioritized(a)-prioritized(b)||a.gameIds[0].localeCompare(b.gameIds[0])||
  a.english.localeCompare(b.english));
await writeFile(target,JSON.stringify(candidates,null,2)+'\n');
console.log('Real game text candidates:',candidates.length,
  'with Chinese:',candidates.filter(x=>x.zhHans).length);
