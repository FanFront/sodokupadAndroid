import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const bridge=readFileSync('app/src/main/assets/checkpoint-transfer.js','utf8');
function setup() {
  const cells=[
    {given:'1',value:undefined,pencilmarks:[],candidates:[],colours:[]},
    {given:undefined,value:'2',pencilmarks:['3'],candidates:['4'],colours:['2']},
    {given:undefined,value:undefined,pencilmarks:[],candidates:[],colours:[]},
    {given:'4',value:undefined,pencilmarks:[],candidates:[],colours:[]}
  ];
  let current=null,restarts=0,saved=0;
  const puzzle={
    rows:2,cols:2,cells,
    restartPuzzle(){restarts++;for(const c of cells){c.value=undefined;c.candidates=[];c.pencilmarks=[];c.colours=[];}},
    act(action){
      if(action.type==='select')current=action.arg[0];
      else if(action.type==='deselect')current=null;
      else if(action.type==='value')current.value=action.arg;
      else if(action.type==='candidates')current.candidates.push(action.arg);
      else if(action.type==='pencilmarks')current.pencilmarks.push(action.arg);
      else if(action.type==='colour')current.colours.push(action.arg);
      else throw Error('Unexpected action: '+action.type);
    },
    saveProgress(){saved++;}
  };
  const context={URL:globalThis.URL,Framework:{app:{puzzle,currentPuzzle:{metadata:{title:'Puzzle'}}}}};
  context.globalThis=context;
  runInNewContext(bridge,context,{timeout:2000});
  return {api:context.SudokuPadTransfer,cells,counts:()=>({restarts,saved})};
}

const URL='https://sudokupad.app/abc123?setting-nogrid=1';
test('exports active SudokuPad WebView progress in X checkpoint format',()=>{
  const {api}=setup(),cp=JSON.parse(api.exportCheckpoint(URL,'test'));
  assert.equal(cp.format,'sudokupadx-checkpoint');
  assert.equal(cp.rows,2);
  assert.equal(cp.cols,2);
  assert.deepEqual(Array.from(cp.givens),['1',null,null,'4']);
  assert.equal(cp.cells[1].value,'2');
  assert.equal(cp.cells[1].color,'#a9d9a1');
});

test('restores snapshot through native replay actions and saves it',()=>{
  const {api,cells,counts}=setup();
  const input=JSON.parse(api.exportCheckpoint(URL,'test'));
  const result=JSON.parse(api.importCheckpoint(JSON.stringify(input),'https://sudokupad.app/abc123'));
  assert.equal(result.ok,true,result.error);
  assert.equal(result.count,1);
  assert.equal(cells[1].value,'2');
  assert.deepEqual(cells[1].pencilmarks,[]); // Value occupies the main digit.
  assert.deepEqual(cells[1].colours,['2']);
  assert.equal(counts().restarts,1);
  assert.equal(counts().saved,1);
});

test('rejects another puzzle and conflicting givens without modifying the board',()=>{
  const {api,cells,counts}=setup();
  const cp=JSON.parse(api.exportCheckpoint(URL,'test'));
  let result=JSON.parse(api.importCheckpoint(JSON.stringify(cp),'https://sudokupad.app/other'));
  assert.equal(result.ok,false);
  cp.givens[0]='9';
  result=JSON.parse(api.importCheckpoint(JSON.stringify(cp),URL));
  assert.equal(result.ok,false);
  assert.equal(cells[1].value,'2');
  assert.equal(counts().restarts,0);
});
