#!/usr/bin/env node
/**
 * Incrementally capture all linked Super Sudokoid bonus/side/boss puzzles.
 * Keep existing Sudokuvania and Super Sudokoid main-map offline assets.
 */
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import LZString from 'lz-string';
import {unpackScl} from './decode-scl.mjs';

const root=resolve('app/src/main/assets/offline');
const indexPath=join(root,'index.json');
const index=JSON.parse(await readFile(indexPath,'utf8'));
const games=JSON.parse(await readFile('app/src/main/assets/games.json','utf8')).games
  .filter(g=>g.id.startsWith('super-sudokoid-'));
const candidates=JSON.parse(await readFile(join(root,'translation-candidates.json'),'utf8'));
if(games.length!==2)throw new Error('Missing Super Sudokoid main puzzles');
const records=new Map(),queue=[],errors=[],newFiles=new Set();
const MAIN=new Set(games.map(g=>new URL(g.url).pathname));
const MAX_PUZZLES=96, MAX_BYTES=90*1024*1024;
const extensions={
  'text/html':'html','text/plain':'txt','text/css':'css',
  'application/javascript':'js','text/javascript':'js',
  'application/json':'json','application/wasm':'wasm',
  'image/png':'png','image/jpeg':'jpg','image/svg+xml':'svg',
  'image/webp':'webp','image/gif':'gif','font/woff':'woff','font/woff2':'woff2'
};
function key(raw){const url=new URL(raw);url.hash='';return url.href;}
function valid(raw){
  try{
    const u=new URL(raw);
    return u.origin==='https://sudokupad.app' &&
      /^\/[a-z0-9-]{8,40}$/.test(u.pathname) && !MAIN.has(u.pathname);
  }catch{return false;}
}
function scan(text,gameId,defaultKind='linked'){
  if(typeof text!=='string')return;
  const source=text.replace(/\\\//g,'/').replace(/&amp;/g,'&');
  for(const match of source.matchAll(/https:\/\/sudokupad\.app\/[a-z0-9-]{8,40}(?:\?[a-zA-Z0-9=&%._-]+)?/g)){
    const url=key(match[0]);
    if(!valid(url))continue;
    const context=source.slice(Math.max(0,match.index-75),match.index+match[0].length+45);
    const kind=/bonus|side|extra|支线|奖励/i.test(context)?'side':
      /boss|首领/i.test(context)?'boss':defaultKind;
    if(!records.has(url)){
      if(records.size>=MAX_PUZZLES)throw new Error('More than '+MAX_PUZZLES+' linked puzzles; inspect source');
      records.set(url,{url,gameId,kind});
      queue.push(url);
    }else if(records.get(url).kind==='linked'&&kind!=='linked'){
      records.get(url).kind=kind;
    }
  }
}
function walk(value,gameId,depth=0){
  if(depth>25)return;
  if(typeof value==='string')return scan(value,gameId);
  if(Array.isArray(value)){for(const child of value)walk(child,gameId,depth+1);return;}
  if(value&&typeof value==='object')for(const child of Object.values(value))
    walk(child,gameId,depth+1);
}
function decode(packed,label){
  try{return unpackScl(packed);}
  catch(error){
    const compact=packed.startsWith('scl')?
      LZString.decompressFromBase64(packed.slice(3).trim()):null;
    if(!compact?.startsWith('{id:'))throw new Error('Cannot unpack '+label+': '+error.message);
    return compact;
  }
}
for(const game of games){
  const api='https://sudokupad.app/api/puzzle'+new URL(game.url).pathname;
  const resource=index.assets[api];
  if(!resource)throw new Error('Main puzzle missing: '+game.id);
  const raw=await readFile(join(root,resource.originalFile||resource.file),'utf8');
  walk(decode(raw,game.id),game.id);
  // Double check against extracted map text, independently maintained.
  for(const item of candidates)if((item.gameIds||[]).includes(game.id))
    scan(item.english,game.id);
}
for(const game of games){
  const count=[...records.values()].filter(v=>v.gameId===game.id).length;
  if(count<(game.id.endsWith('-1')?12:9))
    throw new Error('Incomplete authored puzzle links for '+game.id+': '+count);
  console.log(game.id+': '+count+' direct linked puzzles');
}
await mkdir(join(root,'files'),{recursive:true});
const pending=new Set();
async function save(response){
  const url=key(response.url());
  if(!url.startsWith('https://sudokupad.app/') ||
     response.status()<200||response.status()>=300)return;
  const existing=index.assets[url];
  if(existing){
    try{await stat(join(root,existing.originalFile||existing.file));return;}
    catch{/* Missing resource, fetch again. */}
  }
  try{
    const body=await response.body();
    if(!body.length||body.length>MAX_BYTES)throw new Error('Invalid size '+body.length);
    const type=(response.headers()['content-type']||'').split(';')[0].trim();
    const isPuzzle=new URL(url).pathname.startsWith('/api/puzzle/');
    const mime=isPuzzle&&body.toString('utf8',0,3)==='scl'?'text/plain':
      (type||'application/octet-stream');
    const extension=extensions[mime]||
      new URL(url).pathname.match(/\.([a-z0-9]{1,6})$/i)?.[1]||'bin';
    const file='files/'+createHash('sha256').update(url).digest('hex')+'.'+extension.toLowerCase();
    await writeFile(join(root,file),body);
    index.assets[url]={file,mime,bytes:body.length};
    newFiles.add(url);
  }catch(error){errors.push('Resource '+url+': '+error.message);}
}
function recordResponse(response){
  const task=save(response);
  pending.add(task);
  task.finally(()=>pending.delete(task));
}
const browser=await chromium.launch({headless:true});
const visited=new Set();
try{
  while(queue.length){
    const url=queue.shift();
    if(visited.has(url))continue;
    visited.add(url);
    const linked=records.get(url);
    const page=await browser.newPage({
      viewport:{width:1440,height:900},serviceWorkers:'block',acceptDownloads:false
    });
    page.on('response',recordResponse);
    try{
      console.log('Capturing ['+visited.size+'/'+MAX_PUZZLES+'] '+url+' '+linked.kind);
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:65000});
      if(!response||response.status()>=400)throw new Error('Page HTTP '+response?.status());
      await page.waitForTimeout(1700);
      const start=page.getByText(/Start Puzzle|Continue Puzzle/i).first();
      if(await start.count()&&await start.isVisible())
        await start.click({timeout:3000}).catch(()=>{});
      await Promise.allSettled([...pending]);
      const landed=key(page.url());
      if(!index.assets[url]&&index.assets[landed])
        index.assets[url]={...index.assets[landed]};
      const api='https://sudokupad.app/api/puzzle'+new URL(url).pathname;
      if(!index.assets[api]){
        const response=await page.request.get(api,{timeout:65000});
        await save(response);
      }
      if(!index.assets[url]||index.assets[url].mime!=='text/html'||!index.assets[api])
        throw new Error('Page HTML or puzzle API missing');
      const resource=index.assets[api];
      const raw=await readFile(join(root,resource.originalFile||resource.file),'utf8');
      if(!/^scl[A-Za-z0-9+/=]+$/.test(raw.trim()))
        throw new Error('Unexpected puzzle API encoding');
      walk(decode(raw,linked.gameId),linked.gameId);
    }catch(error){errors.push(url+': '+error.message);}
    finally{await page.close();}
  }
  await Promise.allSettled([...pending]);
}finally{await browser.close();}

const links=[...records.values()].sort((a,b)=>a.gameId.localeCompare(b.gameId)||
  a.url.localeCompare(b.url));
const missing=links.filter(({url})=>{
  const api='https://sudokupad.app/api/puzzle'+new URL(url).pathname;
  return !index.assets[url]||!index.assets[api];
});
await writeFile(join(root,'super-sudokoid-linked-report.json'),JSON.stringify({
  capturedAt:new Date().toISOString(),linked:links.length,
  byGame:Object.fromEntries(games.map(g=>[g.id,links.filter(l=>l.gameId===g.id).length])),
  missing:missing.map(x=>x.url),errors,items:links
},null,2)+'\n');
if(errors.length||missing.length)
  throw new Error('Linked capture incomplete: '+JSON.stringify({missing,errors}).slice(0,7000));
index.superSudokoidLinkedPuzzles=links;
index.superSudokoidLinkedCapture={
  capturedAt:new Date().toISOString(),count:links.length,newFiles:newFiles.size,
  scope:'authored side and boss links and linked SCL metadata'
};
await writeFile(indexPath,JSON.stringify(index,null,2)+'\n');
console.log('Bundled '+links.length+' Super Sudokoid side and boss puzzles.');
