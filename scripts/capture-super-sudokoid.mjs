#!/usr/bin/env node
/**
 * Incremental capture of the two Super Sudokoid MAIN maps only.
 * Preserve existing Sudokuvania resources, translations, boss files and saves.
 * Do not crawl the maps' spoiler/side-puzzle links in this first phase.
 */
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';

const root=resolve('app/src/main/assets/offline');
const indexPath=join(root,'index.json');
const index=JSON.parse(await readFile(indexPath,'utf8'));
const games=JSON.parse(await readFile('app/src/main/assets/games.json','utf8')).games
  .filter(g=>g.id.startsWith('super-sudokoid-'));
if(games.length!==2)throw new Error('Expected two Super Sudokoid main puzzles');
await mkdir(join(root,'files'),{recursive:true});
const pending=new Set();
const failures=[];
const captured=[];
const maxBytes=90*1024*1024;
const extByMime={
  'text/html':'html','text/plain':'txt','text/css':'css',
  'application/javascript':'js','text/javascript':'js',
  'application/json':'json','application/wasm':'wasm',
  'image/png':'png','image/jpeg':'jpg','image/svg+xml':'svg',
  'image/webp':'webp','image/gif':'gif','font/woff':'woff','font/woff2':'woff2'
};
function key(raw) {
  const url=new URL(raw); url.hash='';
  return url.href;
}
async function saved(response) {
  const url=key(response.url());
  if(!url.startsWith('https://sudokupad.app/'))return;
  if(response.status()<200||response.status()>=300)return;
  if(index.assets[url]) {
    try {await stat(join(root,index.assets[url].file));return;}catch {}
  }
  try {
    const body=await response.body();
    if(!body.length||body.length>maxBytes)throw new Error('Invalid body size '+body.length);
    const type=(response.headers()['content-type']||'').split(';')[0].trim();
    const api=new URL(url).pathname.startsWith('/api/puzzle/');
    const mime=api && body.toString('utf8',0,3)==='scl' ? 'text/plain' :
      (type||'application/octet-stream');
    const suffix=extByMime[mime]||
      new URL(url).pathname.match(/\.([a-z0-9]{1,6})$/i)?.[1]||'bin';
    const file='files/'+createHash('sha256').update(url).digest('hex')+
      '.'+suffix.toLowerCase();
    await writeFile(join(root,file),body);
    index.assets[url]={file,mime,bytes:body.length};
    captured.push(url);
  } catch(error) {
    failures.push('Failed '+url+': '+error.message);
  }
}
function enqueue(response) {
  const job=saved(response);
  pending.add(job);
  job.finally(()=>pending.delete(job));
}
const browser=await chromium.launch({headless:true});
try {
  for(const game of games) {
    const page=await browser.newPage({
      viewport:{width:1440,height:900},serviceWorkers:'block'
    });
    page.on('response',enqueue);
    try {
      console.log('Capturing main puzzle:',game.id,game.url);
      const response=await page.goto(game.url,{
        waitUntil:'domcontentloaded',timeout:90000
      });
      if(!response||response.status()>=400)
        throw new Error('Page HTTP '+response?.status());
      await page.waitForTimeout(6500);
      const start=page.getByText(/Start Puzzle|Continue Puzzle/i).first();
      if(await start.count()&&await start.isVisible()) {
        await start.click({timeout:4000}).catch(()=>{});
        await page.waitForTimeout(3000);
      }
      await Promise.allSettled([...pending]);
      // If the page's client deferred loading, fetch its standard puzzle API.
      const api='https://sudokupad.app/api/puzzle'+new URL(game.url).pathname;
      if(!index.assets[api]) {
        const apiResponse=await page.request.get(api,{timeout:90000});
        await saved(apiResponse);
      }
      const landed=key(page.url());
      if(!index.assets[game.url]&&index.assets[landed])
        index.assets[game.url]={...index.assets[landed]};
      if(!index.assets[game.url]||!index.assets[api])
        throw new Error('Main HTML or API SCL missing for '+game.id);
      const blob=await readFile(join(root,index.assets[api].file),'utf8');
      if(!/^scl[A-Za-z0-9+/=]+$/.test(blob.trim()))
        throw new Error('Main puzzle is not a valid-looking SCL: '+game.id);
      console.log('Main page and compressed puzzle saved:',game.id);
    } catch(error) {
      failures.push(game.id+': '+error.message);
    } finally {
      await page.close();
    }
  }
  await Promise.allSettled([...pending]);
} finally {
  await browser.close();
}
if(failures.length)throw new Error(failures.join('\n'));
for(const game of games) {
  if(!index.entrypoints.some(e=>e.id===game.id))
    index.entrypoints.push({id:game.id,url:game.url});
  if(!index.requestedPages.includes(game.url))
    index.requestedPages.push(game.url);
}
index.superSudokoidMainCapture={
  capturedAt:new Date().toISOString(),
  ids:games.map(g=>g.id),
  scope:'main puzzles only; side puzzles not yet discovered',
  newlySaved:captured.length
};
await writeFile(indexPath,JSON.stringify(index,null,2)+'\n');
console.log('Two Super Sudokoid main puzzles captured; existing offline snapshot preserved.');