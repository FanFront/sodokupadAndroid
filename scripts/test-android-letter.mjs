#!/usr/bin/env node
/** Test the actual captured SudokuPad Letter Tool against Android touches. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';

const base='app/src/main/assets/offline';
const index=JSON.parse(await readFile(join(base,'index.json'),'utf8'));
const letterUrl=Object.keys(index.assets).find(url=>/\/tool-letter\.js\?/.test(url));
assert.ok(letterUrl,'Bundled SudokuPad Letter Tool missing');
const originalLetter=await readFile(join(base,index.assets[letterUrl].file),'utf8');
const androidJs=await readFile(join(base,'mobile/android.js'),'utf8');
const androidCss=await readFile(join(base,'mobile/android.css'),'utf8');
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({
    viewport:{width:393,height:851},isMobile:true,hasTouch:true,deviceScaleFactor:2
  });
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  const keys='1234567890'.split('').map(n=>
    '<button class="digit" data-control="value" data-key="'+n+
    '" data-value="'+n+'">'+n+'</button>').join('');
  await page.setContent('<!doctype html><html><head>'+
    '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
    '<body><main class="app"><div class="game"><div id="board"></div></div></main>'+
    '<div id="controls"><div class="controls-main"><div class="controls-buttons">'+
    '<div class="controls-input">'+keys+'</div>'+
    '<button data-control="delete">Delete</button></div></div></div></body></html>');
  await page.evaluate(()=>{
    window.__calls=[];
    window.__installedLetter=0;
    window.bindHandlers=()=>{};
    const app={
      tool:'normal',
      tools:{
        normal:{name:'normal',isTool:true},
        corner:{name:'corner',isTool:true},
        centre:{name:'centre',isTool:true},
        colour:{name:'colour',isTool:true},
        pen:{name:'pen',isTool:true}
      },
      puzzle:{selectedCells:[{}]},
      hasTool(name){return !!this.tools[name]?.isTool;},
      changeTool(name){this.tool=name;window.__calls.push(['tool',name]);},
      doPressDigit(value){window.__calls.push(['digit',value]);},
      resize(){},
      on(){},
      off(){},
      toolExecHandler(){},
      refreshControls(){}
    };
    const data={};
    const framework={
      app,features:{},settings:{toolletter:false},settingOptions:[],
      getApp(){return Promise.resolve(app);},
      addSettings(opts){this.settingOptions.push(...opts);},
      getSetting(name){return this.settings[name];},
      setSetting(name,value){
        const prior=this.settings[name];
        this.settings[name]=value;
        if(prior!==value)
          this.settingOptions.find(opt=>opt.name===name)?.onToggle?.(value,prior);
      },
      makeToolToggler(tool){return enabled=>enabled?this.addTool(tool):this.removeTool(tool);},
      addTool(tool){
        if(!app.tools[tool.tool.name]){
          app.tools[tool.tool.name]=tool.tool;
          window.__installedLetter++;
          tool.tool.init();
        }
      },
      removeTool(tool){
        const name=tool.tool.name;
        app.tools[name]?.done?.();
        delete app.tools[name];
      },
      getData(key){return data[key]??false;},
      setData(key,value){data[key]=value;},
      createElem(opts){
        const button=document.createElement(opts.tag||'button');
        Object.assign(button.dataset,opts.dataset||{});
        if(opts.title)button.title=opts.title;
        return button;
      }
    };
    window.Framework=framework;
  });
  await page.addScriptTag({content:originalLetter});
  await page.waitForFunction(()=>window.Framework.settingOptions.some(o=>o.name==='toolletter'));
  await page.addStyleTag({content:androidCss});
  await page.addScriptTag({content:androidJs});
  const letter=page.locator('#android-gamepad [data-android-action="letter"]');
  const first=page.locator('#android-gamepad [data-android-action="digit"][data-value="1"]');
  const zero=page.locator('#android-gamepad [data-android-action="digit"][data-value="0"]');
  const selected=()=>page.evaluate(()=>({
    tool:Framework.app.tool,
    installed:window.__installedLetter,
    hasTool:Framework.app.hasTool('letter'),
    hasAux:!!Framework.app.tools.letter,
    mode:document.querySelector('.controls-main').classList.contains('input-letter'),
    setting:Framework.getSetting('toolletter')
  }));
  assert.equal(await first.innerText(),'1');
  assert.equal(await letter.getAttribute('aria-pressed'),'false');
  await letter.tap();
  assert.equal((await selected()).installed,1,'Letter tool must be initialized exactly once');
  assert.equal((await selected()).hasTool,false,'Letter tool is auxiliary, not a writing mode');
  assert.equal((await selected()).hasAux,true,'Auxiliary tool was not installed');
  assert.equal((await selected()).setting,true,'Letter tool setting was not enabled');
  assert.equal((await selected()).mode,true,'Letter mode did not activate');
  assert.equal(await letter.getAttribute('aria-pressed'),'true');
  assert.equal(await letter.innerText(),'ABC');
  assert.equal(await first.innerText(),'A');
  assert.equal(await zero.innerText(),'O');
  await first.tap();
  assert.deepEqual((await page.evaluate(()=>window.__calls)).at(-1),['digit','A'],
    'Alphabet keypad must insert a letter, not number 1');

  await letter.tap();
  assert.equal((await selected()).mode,false);
  assert.equal(await letter.getAttribute('aria-pressed'),'false');
  assert.equal(await first.innerText(),'1');
  assert.equal(await zero.innerText(),'0');
  await first.tap();
  assert.deepEqual((await page.evaluate(()=>window.__calls)).at(-1),['digit','1']);
  assert.equal((await selected()).installed,1,'Switching back should not reinstall the tool');

  // Letter mode is disallowed by upstream in Colour/Pen: Android must switch
  // back to Digit first rather than silently ignoring the letter button.
  for(const tool of ['colour','pen']){
    await page.locator('#android-gamepad [data-android-action="tool"][data-value="'+tool+'"]').tap();
    assert.equal((await selected()).tool,tool);
    await letter.tap();
    assert.equal((await selected()).tool,'normal');
    assert.equal((await selected()).mode,true,tool+' must not block letter toggle');
    assert.equal((await selected()).installed,1);
    await letter.tap();
    assert.equal((await selected()).mode,false);
  }

  // Corner/Centre are compatible with alphabet input.
  for(const tool of ['corner','centre']){
    await page.locator('#android-gamepad [data-android-action="tool"][data-value="'+tool+'"]').tap();
    await letter.tap();
    assert.equal((await selected()).tool,tool);
    assert.equal((await selected()).mode,true);
    await first.tap();
    assert.deepEqual((await page.evaluate(()=>window.__calls)).at(-1),['digit','A']);
    await letter.tap();
  }

  // Navigation mode is not allowed to stay engaged after switching alphabet.
  await page.locator('#android-gamepad [data-android-action="pan"]').tap();
  assert.equal(await page.locator('html.android-pan').count(),1);
  await letter.tap();
  assert.equal(await page.locator('html.android-pan').count(),0);
  assert.equal((await selected()).mode,true);
  assert.deepEqual(errors,[]);
  console.log('PASS: Bundled SudokuPad Letter Tool activates and switches through Android touch.');
}finally{
  await browser.close();
}
