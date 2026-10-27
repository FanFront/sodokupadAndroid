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
  assert.ok(info, 'Missing game API package '+game.id);
  const source=await readFile(join(root,info.originalFile||info.file),'utf8');
  assert.match(source,/^scl[A-Za-z0-9+/=]+$/);
  const original=unpackScl(source);
  assert.ok(Array.isArray(original.cells) && original.cells.length>=35, game.id+' rows');
  assert.ok(original.cells[0].length>=40, game.id+' cols');
  assert.ok(original.metadata.grids.length>=20, game.id+' grids');

  // Rebuild the puzzle with SudokuPad's exact encoding format.
  const output='scl'+LZString.compressToBase64(JSON.stringify(original));
  assert.match(output,/^scl[A-Za-z0-9+/=]+$/);
  assert.deepEqual(unpackScl(output),original,'Lossy Base64-LZ roundtrip '+game.id);

  // The dynamically built Chinese package must also be parseable.
  if(info.file.startsWith('translated/')) {
    const localized=unpackScl(await readFile(join(root,info.file),'utf8'));
    assert.equal(localized.cells.length,original.cells.length,game.id+' geometry');
    assert.equal(localized.cells[0].length,original.cells[0].length,game.id+' geometry');
    assert.deepEqual(localized.metadata.solution,original.metadata.solution,game.id+' solution');
    assert.deepEqual(localized.triggereffect,original.triggereffect,game.id+' trigger events');
    assert.deepEqual(localized.foglight,original.foglight,game.id+' fog rules');
    console.log(game.id+': original + localized SCL data decoded; '+
      localized.cells.length+'x'+localized.cells[0].length+' cells');
  } else {
    console.log(game.id+': original SCL decoded; Base64-LZ roundtrip OK');
  }
}
