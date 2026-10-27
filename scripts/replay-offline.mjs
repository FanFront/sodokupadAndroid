#!/usr/bin/env node
/**
 * Strict offline smoke test, with actionable failure diagnostics.
 *
 * A keypad that renders without a puzzle is NOT a passing test. On failure
 * upload offline-debug/ from CI: it contains a screenshot and the browser's
 * console, JS errors, requests, and puzzle/board state. Retest against the
 * unchanged English SCL package if localized SCL initialization fails.
 */
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve('app/src/main/assets/offline');
const snapshot = JSON.parse(await readFile(join(root, 'index.json'), 'utf8'));
const diagnosticsDir = resolve('offline-debug');
await mkdir(diagnosticsDir, {recursive: true});
const failures = [];
const browser = await chromium.launch({headless: true});

function canonical(value) {
  const u = new URL(value);
  u.hash = '';
  return u.href;
}
const runtimeStatus = () => {
  const app = (typeof Framework === 'undefined' ? null : Framework)?.app;
  const board = document.getElementById('board');
  const svg = document.getElementById('svgrenderer');
  const game = document.querySelector('.game');
  const rect = elem => {
    if (!elem) return null;
    const b = elem.getBoundingClientRect();
    return {left:b.left, top:b.top, width:b.width, height:b.height,
      right:b.right, bottom:b.bottom};
  };
  const feature = (typeof Framework === 'undefined' ? null : Framework)?.features?.largepuzzle;
  return {
    readyState:document.readyState,
    href:location.href,
    framework:(typeof Framework !== 'undefined'),
    app:!!app,
    currentPuzzle:!!app?.puzzle?.currentPuzzle,
    gameRows:app?.puzzle?.rows,
    gameCols:app?.puzzle?.cols,
    puzzleId:app?.puzzle?.puzzleId,
    pageTitle:document.title,
    bodyText:document.body?.innerText?.slice(0,900),
    viewBox:svg?.getAttribute('viewBox'),
    svgGroups:svg?.querySelectorAll('g').length,
    drawnElements:svg?.querySelectorAll('rect,path,text,line,circle').length,
    boardStyle:board ? {opacity:getComputedStyle(board).opacity,
      display:getComputedStyle(board).display, transform:getComputedStyle(board).transform,
      inlineWidth:board.style.width, inlineHeight:board.style.height} : null,
    board:rect(board),game:rect(game),
    featureEnabled:feature?.featureEnabled||false,
    featureScale:feature ? (feature.baseScale + feature.zoomLevel - 1) : null,
    controlCount:document.querySelectorAll('#android-gamepad button').length,
    visibleDialog:document.querySelector('.dialog')?.innerText?.slice(0,800)
  };
};

async function replay(entry, original = false) {
  const label = entry.id + (original ? '-original' : '-translated');
  const report = {entry:entry.url, original, errors:[], missing:[], console:[],
    navigation:[], status:null, diagnostic:null, passes:[]};
  const page = await browser.newPage({
    serviceWorkers:'block',
    viewport:{width:393,height:851},
    isMobile:true,
    hasTouch:true,
    deviceScaleFactor:2
  });
  page.on('pageerror', error => {
    if(report.errors.length < 35) report.errors.push(error.stack || error.message);
  });
  page.on('console', message => {
    if(['warning','error'].includes(message.type()) && report.console.length < 45) {
      report.console.push(message.type() + ': ' + message.text());
    }
  });
  page.on('requestfailed', request => {
    if(report.errors.length < 35) {
      report.errors.push('REQUEST FAILED ' + request.url() + ': ' +
        (request.failure()?.errorText || '?'));
    }
  });
  await page.route('**/*', async route => {
    const url = canonical(route.request().url());
    const resource = snapshot.assets[url];
    if (!resource) {
      if(report.missing.length < 75) report.missing.push(url);
      await route.fulfill({status:503, contentType:'text/plain', body:'Offline asset not captured'});
      return;
    }
    try {
      const path = original && resource.originalFile ? resource.originalFile : resource.file;
      const body = await readFile(join(root,path));
      await route.fulfill({
        status:200,
        body,
        contentType:resource.mime,
        headers:{'access-control-allow-origin':'*'}
      });
    } catch (error) {
      if(report.missing.length < 75) report.missing.push(url + ' FILE ERROR: ' + error.message);
      await route.fulfill({status:503, contentType:'text/plain', body:'Offline asset corrupt'});
    }
  });

  try {
    const response = await page.goto(entry.url, {waitUntil:'domcontentloaded',timeout:40000});
    report.navigation.push('initial page HTTP ' + response?.status());
    await page.waitForSelector('#android-gamepad', {timeout:12000});
    report.passes.push('Android touch dock loaded');

    // A fresh SudokuPad session may display a Start/Continue dialog before
    // the puzzle begins. Never press Restart; that could erase saved data.
    // The actual SudokuPad button contains a ▶ icon, so its accessible
    // name is NOT exactly "Start Puzzle". Do not anchor to a full match.
    const start = page.getByRole('button', {
      name:/Start Puzzle|Continue Puzzle|开始游戏|继续游戏/i
    }).first();
    if(await start.count() && await start.isVisible()) {
      await start.click({timeout:6000});
      report.passes.push('Start/Continue puzzle dialog dismissed');
    }
    await page.waitForFunction(() => {
      const app = (typeof Framework === 'undefined' ? null : Framework)?.app;
      return !!app?.puzzle?.currentPuzzle && app.puzzle.rows >= 20 &&
        app.puzzle.cols >= 20 && !!document.querySelector('#svgrenderer')?.getAttribute('viewBox');
    }, null, {timeout:60000});
    report.passes.push('Puzzle data and SVG viewBox loaded');

    // Focus logic is intentionally asynchronous. Verify that a substantial
    // part of the puzzle actually intersects the phone viewport.
    await page.waitForFunction(() => {
      const game = document.querySelector('.game');
      const board = document.getElementById('board');
      const feature = (typeof Framework === 'undefined' ? null : Framework)?.features?.largepuzzle;
      if (!board || !game) return false;
      const b = board.getBoundingClientRect();
      const g = game.getBoundingClientRect();
      const overlap = Math.max(0, Math.min(b.right,g.right)-Math.max(b.left,g.left)) *
        Math.max(0, Math.min(b.bottom,g.bottom)-Math.max(b.top,g.top));
      const painted = document.querySelectorAll('#svgrenderer rect,#svgrenderer path,#svgrenderer text').length;
      return overlap > 600 && painted > 15 &&
        parseFloat(getComputedStyle(board).opacity) > .9 &&
        !!feature?.featureEnabled;
    }, null, {timeout:20000});
    report.passes.push('Painted puzzle board visible on phone');

    const keypad = await page.locator('#android-gamepad button[data-android-action="digit"]').count();
    if(keypad !== 10) throw new Error('Expected 10 number keys, saw '+keypad);
    const pan = page.locator('#android-gamepad button[data-android-action="pan"]');
    await pan.click();
    if(!await page.locator('html.android-pan').count()) throw new Error('Pan mode did not enable');
    await pan.click();
    if(await page.locator('html.android-pan').count()) throw new Error('Pan mode did not disable');
    if(await page.locator('.topbar').isVisible()) throw new Error('Desktop header is still visible');
    report.passes.push('Number keys, pan toggle, hidden desktop header');
    if(report.missing.length) throw new Error('Missing '+report.missing.length+' offline resources');
    report.status = 'pass';
  } catch(error) {
    report.status = 'fail';
    report.errors.push(error.stack || error.message);
    try {
      report.diagnostic = await page.evaluate(runtimeStatus);
    } catch(error) {
      report.errors.push('Diagnostics failed: ' + error.message);
    }
    try {
      await page.screenshot({path:join(diagnosticsDir,label+'.png'), fullPage:true,timeout:12000});
    } catch(error) {
      report.errors.push('Screenshot failed: '+error.message);
    }
    console.error('OFFLINE REPLAY FAILURE ('+label+'):\n'+
      JSON.stringify(report,null,2).slice(0,16000));
  } finally {
    await writeFile(join(diagnosticsDir,label+'.json'), JSON.stringify(report,null,2)+'\n');
    await page.close();
  }
  return report;
}

try {
  for(const entry of snapshot.entrypoints) {
    console.log('Checking '+entry.id+' offline at Android phone size');
    const result = await replay(entry);
    if(result.status !== 'pass') {
      failures.push(entry.id);
      const api = 'https://sudokupad.app/api/puzzle' + new URL(entry.url).pathname;
      if(snapshot.assets[api]?.originalFile) {
        console.log('Diagnostic A/B: retrying without Chinese SCL changes for '+entry.id);
        const english = await replay(entry,true);
        console.log('Original-package comparison: '+entry.id+' => '+english.status);
      }
    }
  }
} finally {
  await browser.close();
}
console.log('Offline smoke test checked '+snapshot.entrypoints.length+' games.');
if(failures.length) {
  console.error('Failing games: '+failures.join(', ')+
    '\nInspect the offline-debug artifacts for detailed console errors and screenshots.');
  process.exitCode=1;
}
