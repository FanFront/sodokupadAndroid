/*
 * Natural, reviewed Simplified Chinese replacements for already-visible
 * SudokuPad text. Runs solely within the APK; no translation service.
 */
(function () {
  'use strict';
  window.SudokuPadAndroidTranslate = function (dictionary) {
    if (window.__spChineseObserver) window.__spChineseObserver.disconnect();
    if (!document.body || !dictionary) return;
    const excluded = 'script,style,textarea,input,select,option,noscript,code,pre,[contenteditable="true"]';

    function translate(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest(excluded)) return;
      const original = node.nodeValue || '';
      const English = original.trim();
      if (!Object.prototype.hasOwnProperty.call(dictionary, English)) return;
      const chinese = dictionary[English];
      if (typeof chinese !== 'string' || !chinese || chinese === English) return;
      const index = original.indexOf(English);
      node.nodeValue = original.slice(0,index)+chinese+original.slice(index+English.length);
    }
    function scan(node) {
      if (!node) return;
      if (node.nodeType === 3) { translate(node); return; }
      if (node.nodeType !== 1 || node.matches(excluded)) return;
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let text;
      while ((text=walker.nextNode())) translate(text);
    }
    const observer = new MutationObserver(mutations => {
      for(const change of mutations) {
        if(change.type === 'characterData') translate(change.target);
        else for(const node of change.addedNodes) scan(node);
      }
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    window.__spChineseObserver = observer;
    scan(document.body);
  };
}());
