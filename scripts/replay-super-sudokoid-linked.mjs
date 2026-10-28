#!/usr/bin/env node
/** Offline phone-sized replay of EVERY Super Sudokoid linked side/boss puzzle. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve('app/src/main/assets/offline');
const index=JSON.parse(await readFile(join(root,'index.json'),'utf8'));
const linked=index.superSudokoidLinkedPuzzles||[];
if(!linked.length)throw new Error('Super Sudokoid side/boss capture not bundled');
const output=resolve('offline-debug');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const failures=[];
function lookup(raw){
  const url=new URL(raw);url.hash='';
  if(index.assets[url.href])return index.assets[url.href];
  if(url.origin!=='https://sudokupad.app'||url.pathname.startsWith('/api/'))return null;
  if(/^\/[a-z0-9-]{8,40}$/.test(url.pathname)||
     /\.(?:js|css|png|svg|jpg|jpeg|woff2?|wasm|ico)$/i.test(url.pathname)){
    url.search='';
    return index.assets[url.href]||null;
  }
  return null;
}
for(const item of linked){
  const page=await browser.newPage({viewport:{width:393,height:851},
    hasTouch:true,isMobile:true,deviceScaleFactor:2,serviceWorkers:'block'});
  const report={url:item.url,kind:item.kind,game:item.gameId,
    missing:[],pageErrors:[],passed:[]};
  page.on('pageerror',e=>report.pageErrors.push(e.message));
  await page.route('**/*',async route=>{
    const url=route.request().url();
    if(url.startsWith('https://api.sudokupad.com/counter/')){
      await route.fulfill({status:503,contentType:'text/plain',body:'Optional counter unavailable offline'});
      return;
    }
    const entry=lookup(url);
    if(!entry){
      report.missing.push(url);
      await route.fulfill({status:503,contentType:'text/plain',body:'Not bundled'});
      return;
    }
    try{
      const body=await readFile(join(root,entry.file));
      await route.fulfill({status:200,body,contentType:entry.mime,
        headers:{'access-control-allow-origin':'*'}});
    }catch(error){
      report.missing.push(url+' '+error.message);
      await route.fulfill({status:503,body:'Offline file missing'});
    }
  });
  try{
    const response=await page.goto(item.url,{waitUntil:'domcontentloaded',timeout:35000});
    assert.equal(response?.status(),200,'HTML entrypoint not available');
    await page.waitForSelector('#android-gamepad button[data-android-action="digit"]',
      {timeout:16000});
    report.passed.push('Android keypad loaded');
    const start=page.getByRole('button',{
      name:/Start Puzzle|Continue Puzzle|开始游戏|继续游戏/i
    }).first();
    if(await start.count()&&await start.isVisible())
      await start.click({timeout:6000}).catch(()=>{});
    await page.waitForFunction(()=>{
      const app=typeof Framework!=='undefined'?Framework.app:null;
      const svg=document.querySelector('#svgrenderer');
      return !!app?.puzzle?.currentPuzzle && app.puzzle.rows>=4 && app.puzzle.cols>=4 &&
        !!svg?.getAttribute('viewBox') && svg.querySelectorAll('rect,path,text').length>10;
    },null,{timeout:40000});
    report.passed.push('SCL decoded and board drawn');
    // SudokuPad can open a Rules/Start/completion dialog after the board
    // renders. A player must dismiss it before the fixed bottom keypad is
    // touchable. Never click Restart, Reset or View Solution in this test.
    async function dismissInitialDialogs() {
      for(let n=0;n<4;n++) {
        const overlay=page.locator('.dialog-overlay.centeroverboard:visible').last();
        if(!await overlay.count())return;
        const snapshot=await overlay.evaluate(node=>({
          text:node.innerText.slice(0,600),
          buttons:[...node.querySelectorAll('button')].map(b=>
            ({text:b.innerText.trim(),title:b.getAttribute('title')})).slice(0,15)
        }));
        (report.dialogs ||= []).push(snapshot);
        const button=overlay.getByRole('button',{
          name:/Return to Puzzle|Close|Dismiss|OK|Okay|Cancel|Back|Continue Puzzle|Skip|关闭|返回谜题|取消|继续游戏|确定/i
        }).first();
        if(await button.count()&&await button.isVisible()){
          await button.tap({timeout:2500});
        }else{
          const icon=overlay.locator('.close, .dialog-close, .btn-close, [data-action="close"]').first();
          if(await icon.count()&&await icon.isVisible())
            await icon.tap({timeout:2500});
          else await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(180);
      }
    }
    await dismissInitialDialogs();
    assert.match(await page.title(),/超级数独机器人/,'Linked page title not Chinese');
    const digit=page.locator('#android-gamepad button[data-android-action="digit"][data-value="1"]');
    const before=Number(await digit.getAttribute('data-android-tap-count')||0);
    await digit.tap({timeout:7000});
    assert.equal(Number(await digit.getAttribute('data-android-tap-count')),before+1,
      'Touch digit handler did not run');
    await dismissInitialDialogs();
    const undo=page.locator('#android-gamepad button[data-android-action="undo"]');
    await undo.tap({timeout:7000});
    report.passed.push('Digit and Undo accepted physical touches');
    assert.deepEqual(report.missing,[],'Missing offline gameplay resources');
    assert.deepEqual(report.pageErrors,[],'Uncaught JavaScript errors');
    report.status='pass';
  }catch(error){
    report.status='fail';
    report.error=error.stack||String(error);
    failures.push(item.url);
    try{await page.screenshot({
      path:join(output,'linked-'+new URL(item.url).pathname.slice(1)+'.png'),
      fullPage:true,timeout:12000
    });}catch{}
    console.error('LINKED REPLAY FAIL '+item.url+': '+JSON.stringify(report).slice(0,6000));
  }finally{
    await writeFile(join(output,'linked-'+new URL(item.url).pathname.slice(1)+'.json'),
      JSON.stringify(report,null,2)+'\n');
    await page.close();
  }
  if(report.status==='pass')console.log('Linked offline PASS '+item.url+' '+item.kind);
}
await browser.close();
console.log('Checked '+linked.length+' Super Sudokoid linked puzzles; failed '+failures.length);
if(failures.length)throw new Error('Linked offline replays failed: '+failures.join(', '));
