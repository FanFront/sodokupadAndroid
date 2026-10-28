#!/usr/bin/env node
/**
 * Regression: SudokuPad does NOT use compressToEncodedURIComponent().
 * Both original and translated scl packages must decode with the production
 * Base64-LZ alphabet (+ and /). Confirm puzzle geometry survives the trip.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import LZString from 'lz-string';
import {unpackScl} from './decode-scl.mjs';

const root=resolve('app/src/main/assets/offline');
const index=JSON.parse(await readFile(join(root,'index.json'),'utf8'));
const games=JSON.parse(await readFile('app/src/main/assets/games.json','utf8')).games;

for(const game of games) {
  const api='https://sudokupad.app/api/puzzle'+new URL(game.url).pathname;
  const info=index.assets[api];
  if (!info && process.env.SUDOKU_ALLOW_PENDING_CAPTURE === 'true' &&
      game.id.startsWith('super-sudokoid-')) {
    console.log(game.id+': pending targeted capture');
    continue;
  }
  assert.ok(info, 'Missing game API package '+game.id);
  const source=await readFile(join(root,info.originalFile||info.file),'utf8');
  assert.match(source,/^scl[A-Za-z0-9+/=]+$/);
  let original;
  try {
    original=unpackScl(source);
  } catch (error) {
    const compact=LZString.decompressFromBase64(source.slice(3));
    if (!game.id.startsWith('super-sudokoid-') || !compact?.startsWith('{id:')) throw error;
    const recoded='scl'+LZString.compressToBase64(compact);
    assert.equal(LZString.decompressFromBase64(recoded.slice(3)),compact);
    if (process.argv.includes('--require-translated')) {
      assert.equal(info.file,'translated/'+game.id+'.scl');
    }
    if (info.file.startsWith('translated/')) {
      const localized=await readFile(join(root,info.file),'utf8');
      assert.equal(LZString.decompressFromBase64(localized.slice(3)),compact,
        game.id+' compact source must remain unchanged until reviewed translation');
    }
    console.log(game.id+': compact main SCL decoded and preserved');
    continue;
  }
  const minimum=game.id.startsWith('super-sudokoid-') ? 9 : 35;
  assert.ok(Array.isArray(original.cells) && original.cells.length>=minimum, game.id+' rows');
  assert.ok(original.cells[0].length>=(minimum===9?9:40), game.id+' cols');
  if (!game.id.startsWith('super-sudokoid-'))
    assert.ok(original.metadata.grids.length>=20, game.id+' grids');

  // Rebuild the puzzle with SudokuPad's exact encoding format.
  const output='scl'+LZString.compressToBase64(JSON.stringify(original));
  assert.match(output,/^scl[A-Za-z0-9+/=]+$/);
  assert.deepEqual(unpackScl(output),original,'Lossy Base64-LZ roundtrip '+game.id);

  // In release builds, fail closed instead of silently packaging the original
  // English API package (the exact regression reported on Android).
  if(process.argv.includes('--require-translated')) {
    assert.match(info.file,/^translated\/[a-z0-9-]+\.scl$/,
      game.id+' must point to the Chinese SCL asset');
  }
  // The dynamically built Chinese package must also be parseable.
  if(info.file.startsWith('translated/')) {
    const localized=unpackScl(await readFile(join(root,info.file),'utf8'));
    assert.equal(localized.cells.length,original.cells.length,game.id+' geometry');
    assert.equal(localized.cells[0].length,original.cells[0].length,game.id+' geometry');
    assert.deepEqual(localized.metadata.solution,original.metadata.solution,game.id+' solution');
    assert.deepEqual(localized.triggereffect,original.triggereffect,game.id+' trigger events');
    assert.deepEqual(localized.foglight,original.foglight,game.id+' fog rules');
    const visualText=items=>(items||[]).map(x=>x.text).filter(Boolean);
    // These exact on-board captions are present in the screenshots, not only
    // in a menu. If they remain English, localization was not actually baked.
    if(game.id==='digits-of-despair') {
      assert.ok(visualText(original.overlays).includes('LEARNED RULES'));
      assert.ok(visualText(localized.overlays).includes('已学会的规则'),
        'LEARNED RULES SVG caption not localized');
      assert.ok(visualText(localized.underlays).includes('从圆头向外严格递增。'),
        'Guide THERMO rule not localized');
    } else if(game.id==='lineage-of-logic') {
      assert.ok(visualText(original.overlays).includes('Explore the Castle'));
      assert.ok(visualText(localized.overlays).includes('探索城堡'),
        'Lineage of Logic quest labels not localized');
    }
    console.log(game.id+': original + localized SCL data decoded; '+
      localized.cells.length+'x'+localized.cells[0].length+' cells');
  } else {
    console.log(game.id+': original SCL decoded; Base64-LZ roundtrip OK');
  }
}
