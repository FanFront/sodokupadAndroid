/** Decode SudokuPad's compressed "scl" puzzle package.
 *
 * IMPORTANT: The captured SudokuPad engine uses BASE64-LZ encoding, with
 * '+' and '/' (not lz-string's URL-safe '+', '-' alphabet). Decode using
 * precisely the same format that SudokuPad's puzpatcher.bundle.js expects.
 */
import LZString from 'lz-string';

export function unpackScl(packed) {
  if (typeof packed !== 'string' || !packed.startsWith('scl')) {
    throw new Error('Expected a SudokuPad scl package');
  }
  const encoded = packed.slice(3).trim();
  if (!encoded || !/^[A-Za-z0-9+/=]+$/.test(encoded)) {
    throw new Error('Invalid BASE64-LZ SudokuPad package');
  }
  const json = LZString.decompressFromBase64(encoded);
  if (!json || json[0] !== '{') {
    throw new Error('SudokuPad puzzle failed BASE64-LZ decompression');
  }
  const puzzle = JSON.parse(json);
  if (!puzzle || typeof puzzle !== 'object' || !puzzle.metadata) {
    throw new Error('SudokuPad package is missing puzzle metadata');
  }
  return puzzle;
}
