#!/usr/bin/env node
/** Smoke-test real Android touch events without waiting for a 50x50 puzzle. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const css=await readFile('app/src/main/assets/offline/mobile/android.css','utf8');
const js=await readFile('app/src/main/assets/offline/mobile/android.js','utf8');
const browser=await chromium.launch({headless:true});
try {
  const ctx=await browser.newContext({
    viewport:{width:393,height:851},isMobile:true,hasTouch:true,deviceScaleFactor:2
  });
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<!DOCTYPE html><html><head>'+
    '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
    '<body><main class="app"><section class="game">'+
    '<div id="board"><svg id="svgrenderer" viewBox="0 0 900 900"></svg></div>'+
    '</section></main><div id="controls">'+
    '<button data-control="rules">Rules</button></div></body></html>');
  await page.evaluate(()=>{
    window.__calls=[];
    window.Framework={
      app:{
        puzzle:{selectedCells:[{}]},tool:'normal',
        hasTool(){return true;},
        changeTool(value){this.tool=value;window.__calls.push(['tool',value]);},
        doPressDigit(value){window.__calls.push(['digit',value]);},
        act(action){window.__calls.push(['act',action.type]);},
        undo(){window.__calls.push(['undo']);},
        redo(){window.__calls.push(['redo']);},
        check(){window.__calls.push(['check']);},
        handleButton(){window.__calls.push(['rules']);},
        resize(){}
      },features:{}
    };
    // Emulate the original engine cancelling synthesized clicks.
    window.addEventListener('touchstart',event=>{
      if(event.target.closest?.('#android-gamepad'))event.preventDefault();
    },{capture:true,passive:false});
  });
  await page.addStyleTag({content:css});
  await page.addScriptTag({content:js});
  const count=async element=>Number(await element.getAttribute('data-android-tap-count')||0);
  const action=id=>page.locator('#android-gamepad button[data-android-action="'+id+'"]');
  const pan=action('pan');
  await pan.tap();
  assert.equal(await page.locator('html.android-pan').count(),1);
  assert.equal(await count(pan),1);
  await pan.tap();
  assert.equal(await page.locator('html.android-pan').count(),0);
  assert.equal(await count(pan),2);

  const digit=page.locator('#android-gamepad button[data-android-action="digit"][data-value="1"]');
  await digit.tap(); await digit.tap();
  assert.equal(await count(digit),2,'Both fast touches must fire exactly once');
  const undo=action('undo');
  await undo.tap();
  assert.equal(await count(undo),1);
  const corner=page.locator('#android-gamepad button[data-android-action="tool"][data-value="corner"]');
  await corner.tap();
  assert.equal(await count(corner),1);
  const calls=await page.evaluate(()=>window.__calls);
  assert.equal(calls.filter(c=>c[0]==='digit'&&c[1]==='1').length,2);
  assert.equal(calls.filter(c=>c[0]==='undo').length,1);
  assert.equal(calls.filter(c=>c[0]==='tool'&&c[1]==='corner').length,1);
  await page.evaluate(()=>{window.Framework.app.puzzle.selectedCells=[];});
  await digit.tap();
  assert.match(await page.locator('#android-status').innerText(),/请先轻触棋盘格子/);
  assert.equal((await page.evaluate(()=>window.__calls)).filter(c=>c[0]==='digit').length,2,
    'No selection should not write a digit to the puzzle');

  // Verify touch coordinates can bypass an unrelated transparent overlay.
  await page.evaluate(()=>{
    const block=document.createElement('div');
    block.id='legacy-hitbox';
    block.style.cssText='position:fixed;z-index:28000;left:0;bottom:0;width:100vw;height:120px;background:transparent';
    document.body.appendChild(block);
  });
  const redo=action('redo');
  const rect=await redo.boundingBox();
  assert.ok(rect);
  await page.touchscreen.tap(rect.x+rect.width/2,rect.y+rect.height/2);
  assert.equal(await count(redo),1,'Tap was intercepted by old layout');
  await page.locator('#legacy-hitbox').evaluate(node=>node.remove());
  const previous=await count(undo);
  await undo.click();
  assert.equal(await count(undo),previous+1,'Desktop click fallback failed');
  assert.deepEqual(errors,[]);
  console.log('PASS: Android touch, rapid digits, actions, overlay hitbox and mouse fallback.');
  await ctx.close();
}finally{await browser.close();}
