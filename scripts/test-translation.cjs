const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app/src/main/assets/translate.js', 'utf8');
const attributes={title:'Rules'};
const parent = {
  nodeType:1,parentElement:null,matches:()=>false,closest:()=>null,
  getAttribute:key=>attributes[key]||null,
  setAttribute:(key,value)=>{attributes[key]=value;}
};
const rule={nodeType:3,nodeValue:'Rules',parentElement:parent};
const narrative={nodeType:3,nodeValue:'The castle has many secrets. This is a normal sentence.',parentElement:parent};
const nodes=[rule,narrative];
class FakeObserver {observe(){} disconnect(){}}
const win={};
const doc={body:parent,createTreeWalker:()=>{
  let index=0;
  return {nextNode:()=>nodes[index++]||null};
}};
vm.runInNewContext(source,{
  window:win,document:doc,NodeFilter:{SHOW_TEXT:4,SHOW_ELEMENT:1},
  MutationObserver:FakeObserver,Map,Object
});
win.SudokuPadAndroidTranslate({
  'Rules':'规则',
  'The castle has many secrets.':'城堡里藏着许多秘密。'
});
assert.equal(rule.nodeValue,'规则');
assert.equal(attributes.title,'规则');
assert.equal(narrative.nodeValue,'城堡里藏着许多秘密。 This is a normal sentence.');
assert.ok(win.__spChineseObserver);
console.log('Chinese DOM translations, attributes and partial paragraphs pass');
