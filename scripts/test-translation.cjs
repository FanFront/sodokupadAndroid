const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const js = fs.readFileSync('app/src/main/assets/translate.js','utf8');
let elements;
const element = {nodeType:1, parentElement:null, matches:()=>false, closest:()=>null};
const rules = {nodeType:3,nodeValue:'Rules',parentElement:element};
const other = {nodeType:3,nodeValue:'This ancient castle has many secrets.',parentElement:element};
elements=[rules,other];
class Observer {observe(){} disconnect(){}}
const w = {};
const d = {body:element,createTreeWalker:()=>{let i=0;return{nextNode:()=>elements[i++]||null}}};
const sandbox={window:w,document:d,NodeFilter:{SHOW_TEXT:4},MutationObserver:Observer};
vm.runInNewContext(js,sandbox);
w.SudokuPadAndroidTranslate({'Rules':'规则'});
assert.equal(rules.nodeValue,'规则');
assert.equal(other.nodeValue,'This ancient castle has many secrets.');
assert.ok(w.__spChineseObserver);
console.log('Verified curated Simplified Chinese without online services');
