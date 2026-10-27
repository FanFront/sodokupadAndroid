/*
 * Opt-in, exact-match replacement of visible DOM text nodes.
 * This never changes puzzle storage, JavaScript data structures, inputs or SVG artwork.
 * More complex game text needs an authorized puzzle-specific localization strategy.
 */
(function () {
    'use strict';
    window.SudokuPadAndroidTranslate = function (dictionary) {
        if (window.__spAndroidObserver) {
            window.__spAndroidObserver.disconnect();
        }
        if (!document.body || !dictionary) return;
        var has = function (key) {
            return Object.prototype.hasOwnProperty.call(dictionary, key);
        };
        var disallowed = /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|NOSCRIPT|SVG)$/i;
        function textNode(node) {
            var parent = node.parentElement;
            if (!parent || parent.isContentEditable) return;
            if (parent.closest('script,style,textarea,input,select,svg,[contenteditable="true"]')) return;
            var original = node.nodeValue || '';
            var trimmed = original.trim();
            if (!trimmed || !has(trimmed)) return;
            var replacement = dictionary[trimmed];
            if (typeof replacement !== 'string' || !replacement || replacement === trimmed) return;
            var start = original.indexOf(trimmed);
            node.nodeValue = original.slice(0, start) + replacement + original.slice(start + trimmed.length);
        }
        function scan(root) {
            if (!root) return;
            if (root.nodeType === 3) {
                textNode(root);
                return;
            }
            if (root.nodeType !== 1 || disallowed.test(root.tagName)) return;
            var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            var n;
            while ((n = walker.nextNode())) textNode(n);
        }
        scan(document.body);
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                if (m.type === 'characterData') {
                    textNode(m.target);
                } else {
                    for (var i = 0; i < m.addedNodes.length; i++) scan(m.addedNodes[i]);
                }
            });
        });
        observer.observe(document.body, {childList: true, characterData: true, subtree: true});
        window.__spAndroidObserver = observer;
    };
}());
