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
    const page=await browser.newPage({serviceWorkers:'block', viewport:{width:393,height:851}, isMobile:true, hasTouch:true, deviceScaleFactor:2});
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
    try {
      await page.waitForSelector('#android-gamepad', {timeout:12000});
      // Regression for a real Android report: controls loaded correctly but
      // the puzzle was blank because the desktop #controls offset placed the
      // board offscreen. The numberpad alone is NOT a successful game load.
      await page.waitForFunction(() => {
        const a = window.Framework?.app;
        const board = document.querySelector('#board');
        const svg = document.querySelector('#svgrenderer');
        return !!a?.puzzle?.currentPuzzle && !!svg?.getAttribute('viewBox')
          && !!board && parseFloat(getComputedStyle(board).opacity) >= 0.99;
      }, null, {timeout:20000});
      const frame = await page.evaluate(() => {
        const board = document.querySelector('#board').getBoundingClientRect();
        const game = document.querySelector('.game').getBoundingClientRect();
        const feature = window.Framework?.features?.largepuzzle;
        return {
          board:{left:board.left,top:board.top,right:board.right,bottom:board.bottom,
            width:board.width,height:board.height},
          game:{left:game.left,top:game.top,right:game.right,bottom:game.bottom},
          viewBox:document.querySelector('#svgrenderer').getAttribute('viewBox'),
          scale:feature?.baseScale + feature?.zoomLevel - 1,
          gridRows:window.Framework?.app?.puzzle?.rows,
          gridCols:window.Framework?.app?.puzzle?.cols
        };
      });
      if(frame.board.width <= 10 || frame.board.height <= 10 ||
         frame.board.right < frame.game.left || frame.board.left > frame.game.right ||
         frame.board.bottom < frame.game.top || frame.board.top > frame.game.bottom) {
        problems.add('Rendered puzzle is outside mobile viewport: '+entry.id+
          ' '+JSON.stringify(frame));
      }
      if(frame.gridRows < 20 || frame.gridCols < 20) {
        problems.add('Wrong or empty offline puzzle package loaded: '+entry.id+
          ' '+JSON.stringify(frame));
      }
      if(frame.scale < 0.35) {
        problems.add('Puzzle is too small to play on phone: '+entry.id+
          ' scale '+frame.scale);
      }

      const buttonCount=await page.locator('#android-gamepad button[data-android-action="digit"]').count();
      if(buttonCount!==10)problems.add('Incomplete Android keypad: '+entry.id);
      const pan=page.locator('#android-gamepad button[data-android-action="pan"]');
      await pan.click();
      if(!await page.locator('html.android-pan').count())problems.add('Touch movement mode failed: '+entry.id);
      await pan.click();
      if(await page.locator('html.android-pan').count())problems.add('Touch input mode failed to restore: '+entry.id);
      if(await page.locator('.topbar').isVisible())problems.add('Desktop header still visible: '+entry.id);
    }catch(error){
      problems.add('Android controls missing or broken: '+entry.id+' '+error.message.slice(0,90));
    }
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
