/* Portable checkpoint bridge for the offline SudokuPad WebView.
 * Shared format: sudokupadx-checkpoint v1. No network, no file access.
 * SudokuPad's own actions record a native replay so the old app keeps
 * auto-saving subsequent moves after the transfer.
 */
globalThis.SudokuPadTransfer = (() => {
  const FORMAT='sudokupadx-checkpoint';
  const PALETTE=['#f8cd75','#a9d9a1','#9fcbff','#e9b0d6','#bfb5fa'];
  const toSymbol=value=>value===undefined||value===null||value===''?null:String(value).toUpperCase();
  const cellsOf=()=> {
    const puzzle=globalThis.Framework?.app?.puzzle;
    if(!puzzle||!Array.isArray(puzzle.cells)||!puzzle.cells.length)
      throw Error('请先等待数独棋盘加载完成');
    return puzzle;
  };
  const slug=url=>{
    try{
      const parsed=new URL(url);
      return parsed.hostname.toLowerCase()==='sudokupad.app'
        ?parsed.pathname.replace(/\\/$/,'').split('/').pop().toLowerCase():'';
    }catch{return '';}
  };
  const cellMarks=(list)=>Array.isArray(list)?list.map(toSymbol).filter(Boolean):[];
  const colorToX=colour=>{
    const n=Number(colour);
    return Number.isInteger(n)&&n>=1&&n<=5?PALETTE[n-1]:
      PALETTE.includes(colour)?colour:null;
  };
  const colorToPad=colour=>colour===null?null:String(PALETTE.indexOf(colour)+1);
  function exportCheckpoint(sourceUrl,puzzleId) {
    try {
      const p=cellsOf();
      const cells=p.cells.map(c=>({
        value:toSymbol(c.value),
        corner:cellMarks(c.pencilmarks),center:cellMarks(c.candidates),
        color:colorToX(c.colours?.[0])
      }));
      const givens=p.cells.map(c=>toSymbol(c.given));
      return JSON.stringify({
        format:FORMAT,version:1,source:'sodokupadAndroid',
        exportedAt:new Date().toISOString(),
        puzzleId,sourceUrl,key:null,
        title:globalThis.Framework?.app?.currentPuzzle?.metadata?.title||puzzleId,
        rows:p.rows,cols:p.cols,givens,cells
      });
    } catch(error) {return JSON.stringify({error:String(error.message||error)});}
  }
  function importCheckpoint(json,sourceUrl){
    try{
      const cp=JSON.parse(json),p=cellsOf();
      if(cp?.format!==FORMAT||cp.version!==1)throw Error('不支持的存档格式');
      if(cp.rows!==p.rows||cp.cols!==p.cols||
         !Array.isArray(cp.cells)||cp.cells.length!==p.cells.length||
         !Array.isArray(cp.givens)||cp.givens.length!==p.cells.length)
        throw Error('棋盘尺寸不匹配');
      if(slug(cp.sourceUrl)&&slug(sourceUrl)&&slug(cp.sourceUrl)!==slug(sourceUrl))
        throw Error('这份存档属于另一道谜题');
      const givens=p.cells.map(c=>toSymbol(c.given));
      if(givens.some((v,i)=>v!==toSymbol(cp.givens[i])))
        throw Error('题目给定数字不匹配，已取消导入');
      const cells=cp.cells.map((c,i)=>{
        if(!c||typeof c!=='object'||Array.isArray(c))throw Error('无效存档单元');
        const value=toSymbol(c.value);
        const corner=cellMarks(c.corner),center=cellMarks(c.center);
        if(value!==null&&!/^[0-9A-Z]$/.test(value))throw Error('无效填入数字');
        if(corner.length>26||center.length>26||
           [...corner,...center].some(v=>!/^[0-9A-Z]$/.test(v)))
          throw Error('无效候选标记');
        const color=c.color??null;
        if(color!==null&&!PALETTE.includes(color))throw Error('无法识别的颜色');
        if(givens[i]!==null&&(value!==null||corner.length||center.length||color!==null))
          throw Error('存档修改了题目给定数字');
        return {value,corner,center,color};
      });
      // Native SudokuPad replay actions, rather than direct DOM edits, make
      // the restored position durable in the old application's local storage.
      p.restartPuzzle();
      let count=0;
      for(let i=0;i<cells.length;i++){
        const c=cells[i];
        if(!c.value&&!c.corner.length&&!c.center.length&&!c.color)continue;
        const cell=p.cells[i];
        p.act({type:'select',arg:[cell]});
        if(c.value)p.act({type:'value',arg:c.value.toLowerCase()});
        else{
          for(const val of c.center)p.act({type:'candidates',arg:val.toLowerCase()});
          for(const val of c.corner)p.act({type:'pencilmarks',arg:val.toLowerCase()});
        }
        if(c.color)p.act({type:'colour',arg:colorToPad(c.color)});
        p.act({type:'deselect',arg:[cell]});
        count++;
      }
      p.saveProgress(true);
      return JSON.stringify({ok:true,count});
    }catch(error){return JSON.stringify({ok:false,error:String(error.message||error)});}
  }
  return {exportCheckpoint,importCheckpoint};
})();