/* Reviewed Chinese text, including story/rules revealed later by the game.
   Display-only: puzzle JSON and SudokuPad's internal validation remain English. */
(() => {
  'use strict';
  window.SudokuPadAndroidTranslate = dictionary => {
    window.__spChineseObserver?.disconnect();
    if (!document.body || !dictionary) return;
    const excluded='script,style,textarea,input,select,option,noscript,code,pre,[contenteditable="true"]';
    const entries=Object.entries(dictionary)
      .filter(([en,zh])=>en && typeof zh==='string' && zh && zh!==en)
      .sort((a,b)=>b[0].length-a[0].length);
    const exact=new Map(entries);
    const longer=entries.filter(([en])=>en.length>=22 && !en.includes('://'));
    function translateString(raw) {
      const trimmed=raw.trim();
      const full=exact.get(trimmed);
      if(full) {
        const at=raw.indexOf(trimmed);
        return raw.slice(0,at)+full+raw.slice(at+trimmed.length);
      }
      // Text generated from puzzle metadata may contain several rule sentences
      // in one node. Replace only verified phrases, longest first, preserving
      // punctuation, markup nodes and any still-untranslated English.
      let value=raw;
      for(const [en,zh] of longer) {
        if(value.includes(en)) value=value.split(en).join(zh);
      }
      return value;
    }
    function textNode(node) {
      const parent=node.parentElement;
      if(!parent || parent.closest(excluded) ||
         parent.closest('#cell-values,#cell-givens,#cell-candidates,#cell-pencilmarks')) return;
      const original=node.nodeValue || '';
      const translated=translateString(original);
      if(translated!==original) node.nodeValue=translated;
    }
    function attributes(elem) {
      if(!elem || elem.nodeType!==1 || elem.matches(excluded))return;
      for(const key of ['title','aria-label','placeholder','alt']) {
        const current=elem.getAttribute(key);
        if(current) {
          const translated=translateString(current);
          if(translated!==current)elem.setAttribute(key,translated);
        }
      }
    }
    function scan(root) {
      if(!root)return;
      if(root.nodeType===3) {textNode(root);return;}
      if(root.nodeType!==1 || root.matches(excluded))return;
      attributes(root);
      const nodes=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
      let n;
      while((n=nodes.nextNode())) {
        if(n.nodeType===3)textNode(n);
        else attributes(n);
      }
    }
    const watcher=new MutationObserver(changes=>{
      for(const m of changes) {
        if(m.type==='characterData')textNode(m.target);
        if(m.type==='childList')for(const n of m.addedNodes)scan(n);
        if(m.type==='attributes')attributes(m.target);
      }
    });
    watcher.observe(document.body,{
      subtree:true,childList:true,characterData:true,
      attributes:true,attributeFilter:['title','aria-label','placeholder','alt']
    });
    window.__spChineseObserver=watcher;
    scan(document.body);
  };
})();
