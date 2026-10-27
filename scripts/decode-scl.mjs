/** Decode the "scl" URL-safe LZ-String package used by SudokuPad.
 * Pure JS: does not change or execute original game data. */
export function unpackScl(packed) {
  if (typeof packed !== 'string' || !packed.startsWith('scl')) {
    throw new Error('Expected a SudokuPad scl package');
  }
  const text = packed.slice(3).trim().replace(/ /g, '+');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$';
  const nextValue = n => alphabet.indexOf(text.charAt(n));
  const data = {val: nextValue(0), mask:32, index:1};
  const dictionary = [0,1,2];
  let size=4, bits=3, enlarge=4, output=[];
  function read(count) {
    let num=0, p=1, upper=2**count;
    while(p<upper) {
      const bit=data.val & data.mask;
      data.mask>>=1;
      if(!data.mask) { data.mask=32; data.val=nextValue(data.index++); }
      num+=(bit?1:0)*p;
      p*=2;
    }
    return num;
  }
  let initial=read(2);
  if (initial===2) return {};
  let current=initial===0?String.fromCharCode(read(8))
    :String.fromCharCode(read(16));
  dictionary[3]=current;
  output.push(current);
  for(let limit=0;limit<10000000;limit++) {
    if(data.index>text.length) throw new Error('Truncated SudokuPad puzzle package');
    let code=read(bits);
    if(code===0 || code===1) {
      dictionary[size++]=String.fromCharCode(read(code ? 16:8));
      code=size-1;
      enlarge--;
    } else if (code===2) {
      return JSON.parse(output.join(''));
    }
    if (!enlarge) { enlarge=2**bits; bits++; }
    let phrase=dictionary[code]!==undefined ? dictionary[code]
      :code===size ? current+current[0] : null;
    if (phrase===null) throw new Error('Invalid compressed puzzle data');
    output.push(phrase);
    dictionary[size++]=current+phrase[0];
    current=phrase;
    if(!--enlarge) {enlarge=2**bits;bits++;}
  }
  throw new Error('Puzzle package exceeded decompression limit');
}
