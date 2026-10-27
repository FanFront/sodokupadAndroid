#!/usr/bin/env node
/**
 * Airplane-mode equivalent: all Playwright requests are answered only from
 * APK-bound response files. Fails on uncaptured game-origin dependencies.
 */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root=resolve('app/src/main/assets/offline');
const snapshot=JSON.parse(await readFile(join(root,'index.json'),'utf8'));
const problems=new Set();
const browser=await chromium.launch({headless:true});
try {
  for(const entry of snapshot.entrypoints) {
    const page=await browser.newPage({serviceWorkers:'block'});
    await page.route('**/*',async route=>{
      const source=new URL(route.request().url());
      source.hash='';
      const url=source.href;
      const cached=snapshot.assets[url];
      if(cached) {
        try {
          const body=await readFile(join(root,cached.file));
          await route.fulfill({
            status:200, body, contentType:cached.mime,
            headers:{'access-control-allow-origin':'*'}
          });
        } catch(error) {
          problems.add('Unreadable local '+url);
          await route.fulfill({status:503,body:'offline snapshot corrupted'});
        }
      } else {
        if(source.origin==='https://sudokupad.app') problems.add(url);
        await route.fulfill({status:503,body:'offline asset missing'});
      }
    });
    const response=await page.goto(entry.url,{waitUntil:'domcontentloaded',timeout:40000});
    if(!response||response.status()>=400)problems.add('Cannot load '+entry.url);
    await page.waitForTimeout(2200);
    const start=page.getByText(/Start Puzzle|Continue Puzzle/i).first();
    if(await start.count()&&await start.isVisible()){
      await start.click({timeout:3500}).catch(()=>{});
      await page.waitForTimeout(2400);
    }
    await page.close();
  }
}finally{await browser.close();}
console.log('Replayed '+snapshot.entrypoints.length+' games without network.');
if(problems.size) {
  console.error('Resources missing from offline snapshot:\n'+[...problems].slice(0,80).join('\n'));
  process.exitCode=1;
}
