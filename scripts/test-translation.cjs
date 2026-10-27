// Node test for app/src/main/assets/translate.js; no network or dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app/src/main/assets/translate.js', 'utf8');

const body = {
  nodeType: 1,
  parentElement: null,
  getClientRects: () => [{width: 100}],
  closest: () => null,
  matches: () => false
};
const rules = {nodeType:3,nodeValue:'Rules',parentElement:body,isConnected:true};
const narrative = {nodeType:3,nodeValue:'The castle has a mysterious secret.',parentElement:body,isConnected:true};
const nodes = [rules, narrative];
const posted = [];
const windowMock = {
  getComputedStyle: () => ({display:'block',visibility:'visible'}),
  setTimeout: () => 1,
  clearTimeout: () => {},
  SudokuTranslate: {postMessage: s => posted.push(JSON.parse(s)),onmessage:null}
};
class FakeObserver { observe(){} disconnect(){} }
const context = vm.createContext({
  window: windowMock,
  document: {
    body,
    createTreeWalker: () => {
      let next = 0;
      return {nextNode: () => nodes[next++] || null};
    }
  },
  NodeFilter: {SHOW_TEXT:4},
  MutationObserver: FakeObserver,
  Map, Set, JSON
});
new vm.Script(source).runInContext(context);
windowMock.SudokuPadAndroidTranslate({'Rules':'规则'}, true);
assert.equal(rules.nodeValue, '规则', 'curated Chinese terms take precedence');
assert.equal(posted.length, 1, 'narrative must be sent to on-device translator');
assert.equal(posted[0].text, narrative.nodeValue);
windowMock.SudokuTranslate.onmessage({
  data: JSON.stringify({id:posted[0].id,translated:'城堡里有一个神秘的秘密。'})
});
assert.equal(narrative.nodeValue, '城堡里有一个神秘的秘密。');
windowMock.__spAndroidTranslator.setMachine(false);
assert.equal(rules.nodeValue, 'Rules', 'comparison mode restores curated labels');
assert.equal(narrative.nodeValue, 'The castle has a mysterious secret.',
    'comparison mode restores machine-translated text');
windowMock.__spAndroidTranslator.setMachine(true);
assert.equal(rules.nodeValue, '规则', 're-enable curated translations');
assert.equal(narrative.nodeValue, '城堡里有一个神秘的秘密。', 'cached dynamic translation reused');
windowMock.__spAndroidTranslator.destroy();
console.log('Live translation DOM tests OK');
