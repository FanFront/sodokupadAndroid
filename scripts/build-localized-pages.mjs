#!/usr/bin/env node
/**
 * Create editable, human-readable copies of the original game HTML
 * and compiled Simplified Chinese HTML. Both live INSIDE offline/pages/.
 *
 * Existing original HTML is preserved across recaptures so manual changes
 * are not lost. Only reviewed exact-match translations are applied.
 */
import { parse, parseFragment, serialize } from 'parse5';
import { readFile, writeFile, mkdir, copyFile, access, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root=resolve('app/src/main/assets/offline');
const indexFile=join(root,'index.json');
const index=JSON.parse(await readFile(indexFile,'utf8'));
const games=JSON.parse(await readFile('app/src/main/assets/games.json','utf8')).games;
const common=JSON.parse(await readFile('app/src/main/assets/i18n/zh-Hans.json','utf8'));
await mkdir(join(root,'pages'),{recursive:true});

// The Android layout files are handwritten (not captured) and versioned.
// These URL aliases let WebView request them without an INTERNET permission.
for (const [filename, mime] of [
  ['android.css','text/css'],
  ['android.js','application/javascript']
]) {
  const file = 'mobile/' + filename;
  const bytes = (await readFile(join(root,file))).length;
  index.assets['https://sudokupad.app/__android/' + filename] = {file,mime,bytes};
}

function findElement(node, name) {
  if (node.nodeName === name) return node;
  for (const child of node.childNodes || []) {
    const found = findElement(child, name);
    if (found) return found;
  }
  return null;
}
function appendMarkup(parent, html) {
  const fragment = parseFragment(html);
  const nodes = fragment.childNodes || [];
  for (const node of nodes) {
    node.parentNode = parent;
    parent.childNodes.push(node);
  }
}
function stripWebOnlyContent(node) {
  if (!node.childNodes) return;
  node.childNodes = node.childNodes.filter(child => {
    const attr = name => (child.attrs||[]).find(item=>item.name===name)?.value || '';
    if(child.nodeName === 'script' &&
        /(?:lazygtmloader|script\.manual)\.js/.test(attr('src'))) return false;
    if(child.nodeName === 'a' &&
        /\bmenu-link-(?:steam|patreon|kofi|youtube|thanks)\b/.test(attr('class'))) return false;
    return true;
  });
  for(const child of node.childNodes) stripWebOnlyContent(child);
}

function put(node, dictionary, parentName='') {
  if (node.nodeName==='#text' && !/^(script|style|code|pre|textarea|noscript)$/i.test(parentName)) {
    const before=node.value||'';
    const word=before.trim();
    const after=dictionary[word];
    if (typeof after==='string' && after.length && after!==word) {
      const i=before.indexOf(word);
      node.value=before.slice(0,i)+after+before.slice(i+word.length);
    }
  }
  for(const attr of node.attrs||[]) {
    if (['title','alt','placeholder','aria-label'].includes(attr.name)) {
      if (dictionary[attr.value]) attr.value=dictionary[attr.value];
    }
  }
  for(const child of node.childNodes||[]) put(child,dictionary,node.nodeName);
  if(node.content) put(node.content,dictionary,node.nodeName);
}
for(const game of games) {
  if(!/^[a-z0-9-]+$/.test(game.id)) throw new Error('Unsafe game ID');
  const entry=index.assets[game.url];
  if(!entry || !entry.mime.includes('html')) throw new Error('Missing captured HTML for '+game.id);
  const source=join(root,'pages',game.id+'.html');
  try {
    await access(source);
  } catch {
    await copyFile(join(root,entry.file),source);
  }
  const original=await readFile(source,'utf8');
  const specific=JSON.parse(await readFile(
    join('app/src/main/assets/i18n/games',game.id+'.zh-Hans.json'),'utf8'));
  const combined={...common,...specific};
  const doc=parse(original);
  put(doc,combined);
  stripWebOnlyContent(doc);
  const htmlTag=findElement(doc,'html');
  if(htmlTag) {
    const lang=(htmlTag.attrs||[]).find(a=>a.name==='lang');
    if(lang) lang.value='zh-Hans';
    else htmlTag.attrs.push({name:'lang',value:'zh-Hans'});
  }
  const head=findElement(doc,'head'),body=findElement(doc,'body');
  if(!head || !body) throw new Error('Unexpected captured HTML structure');
  // Preserve #board, #controls and the application's script loader.
  appendMarkup(head, '<link rel="stylesheet" href="/__android/android.css">');
  appendMarkup(body, '<script defer src="/__android/android.js"></script>');
  const localized='pages/'+game.id+'.zh-Hans.html';
  const html=serialize(doc);
  await writeFile(join(root,localized),html,'utf8');
  index.assets[game.url]={...entry,file:localized,bytes:Buffer.byteLength(html)};
  console.log('HTML ready for translation:',game.id, '→',localized);
}
await writeFile(indexFile,JSON.stringify(index,null,2)+'\n');
