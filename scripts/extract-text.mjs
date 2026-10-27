#!/usr/bin/env node
/**
 * Generate a PRIVATE candidate phrase list from downloaded HTML/JSON.
 * Review and place approved Simplified Chinese translations in assets/i18n.
 * Do NOT commit output; it can contain unrevealed story spoilers.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const root=resolve('app/src/main/assets/offline');
const index=JSON.parse(await readFile(join(root,'index.json'),'utf8'));
const source=new Map();
function add(text,url){
  const s=text.replace(/\s+/g,' ').trim();
  if(s.length<12||s.length>2000||!/[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(s))return;
  if(/^[a-f0-9+/=]{100,}$/i.test(s))return;
  const found=source.get(s)||new Set();
  found.add(url);source.set(s,found);
}
function walk(v,url,depth=0){
  if(depth>16)return;
  if(typeof v==='string')add(v,url);
  else if(Array.isArray(v))v.forEach(x=>walk(x,url,depth+1));
  else if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){
    if(/^(?:solution|givens|answer|cells|lines|arrows|regions|constraints)$/i.test(k))continue;
    walk(x,url,depth+1);
  }
}
for(const [url,e] of Object.entries(index.assets)){
  if(!/json|html/.test(e.mime))continue;
  const data=(await readFile(join(root,e.file))).toString('utf8');
  if(e.mime.includes('json')){
    try{walk(JSON.parse(data),url);}catch{}
  }else{
    // Simple visible-text candidates, not a proof of complete game text coverage.
    for(const m of data.matchAll(/>([^<>]{12,600})</g))add(m[1],url);
  }
}
// SudokuPad can expose a decoded in-memory puzzle after loading.
try {
  const decoded=JSON.parse(await readFile(join(root,'decoded-game-text.json'),'utf8'));
  for(const [url,strings] of Object.entries(decoded)) {
    for(const value of strings) if(typeof value==='string') add(value,url);
  }
} catch (error) {
  console.warn('No decoded game-text inventory; only HTML/JSON scanned.');
}
// Also scan the original editable HTML, not only generated Chinese pages.
const games=JSON.parse(await readFile('app/src/main/assets/games.json','utf8')).games;
const dictionaries={};
for(const game of games) {
  dictionaries[game.id]=JSON.parse(await readFile(
    'app/src/main/assets/i18n/games/'+game.id+'.zh-Hans.json','utf8'));
  try {
    const html=await readFile(join(root,'pages/'+game.id+'.html'),'utf8');
    for(const m of html.matchAll(/>([^<>]{12,600})</g)) add(m[1],game.url);
  } catch{}
}
const shared=JSON.parse(await readFile('app/src/main/assets/i18n/zh-Hans.json','utf8'));
const sorted=[...source].map(([english,urls])=>{
  const foundIn=[...urls];
  const gameIds=games.filter(g=>foundIn.some(u=>u===g.url)).map(g=>g.id);
  const existing=gameIds.length===1
    ? dictionaries[gameIds[0]][english] || shared[english]
    : shared[english];
  return {english,zhHans:existing||'',gameIds,foundIn};
}).sort((a,b)=>a.english.localeCompare(b.english));
await writeFile(join(root,'translation-candidates.json'),JSON.stringify(sorted,null,2)+'\n');
console.log('Translation candidates:',sorted.length,'(private; review for spoilers and precision)');
