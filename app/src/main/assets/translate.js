/*
 * Live Chinese localization for SudokuPad.
 * Translates original on-screen text only; never changes puzzle JSON, digits,
 * editable fields, event handlers, or the website's save data.
 * A curated dictionary takes priority over optional on-device ML translation.
 */
(function () {
    'use strict';

    window.SudokuPadAndroidTranslate = function (dictionary, allowMachine) {
        if (window.__spAndroidTranslator) window.__spAndroidTranslator.destroy();
        if (!document.body) return;

        var dictionaryHas = function (key) {
            return Object.prototype.hasOwnProperty.call(dictionary, key);
        };
        var machineEnabled = !!allowMachine && !!window.SudokuTranslate;
        var translations = new Map();
        var storedNodes = new Map(); // changed DOM nodes; lets players compare with English
        var pending = new Map(); // request id -> { original, nodes }
        var queued = new Map(); // source string -> text nodes
        var requested = new Set();
        var nextId = 1;
        var destroyed = false;
        var observer, timer;
        var excluded = 'script,style,textarea,input,select,option,noscript,code,pre,canvas,[contenteditable="true"]';
        var MAX_INFLIGHT = 5;
        var MAX_QUEUE = 300;
        var MAX_TEXT = 1000;

        function visible(parent) {
            if (!parent || parent.closest('[hidden],[aria-hidden="true"],' + excluded)) return false;
            for (var el = parent, i = 0; el && i < 12; el = el.parentElement, i++) {
                var s = window.getComputedStyle(el);
                if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
            }
            if (!parent.getClientRects || !parent.getClientRects().length) return false;
            return true;
        }

        function setText(node, original, translated) {
            if (!node || !node.isConnected || !visible(node.parentElement)) return;
            if ((node.nodeValue || '').trim() !== original) return;
            if (!translated || translated === original) return;
            var raw = node.nodeValue;
            var at = raw.indexOf(original);
            if (at < 0) return;
            storedNodes.set(node, { original: raw, translated: raw.slice(0, at) + translated + raw.slice(at + original.length) });
            node.nodeValue = storedNodes.get(node).translated;
        }

        function looksLikeEnglish(sentence) {
            if (sentence.length < 8 || sentence.length > MAX_TEXT) return false;
            if (!/[a-zA-Z]/.test(sentence) || /[\u3400-\u9FFF]/.test(sentence)) return false;
            // Skip grid coordinates, lone digits, links, code, and unexplained glyphs.
            if (/^(?:[Rr]\d+[Cc]\d+|\d+[A-Za-z]?|https?:\/\/\S+)$/.test(sentence)) return false;
            var words = sentence.match(/[A-Za-z]{2,}/g) || [];
            return words.length >= 2 && words.join('').length >= 8;
        }

        function observeNode(node) {
            if (!node || !node.isConnected || node.nodeType !== 3) return;
            if (!dictionary) return;
            if (!visible(node.parentElement)) return;
            var saved = storedNodes.get(node);
            if (saved && node.nodeValue === saved.translated) return;
            if (saved && node.nodeValue !== saved.original) storedNodes.delete(node);
            var original = (node.nodeValue || '').trim();
            if (!original) return;
            if (dictionaryHas(original)) {
                setText(node, original, dictionary[original]);
            } else if (machineEnabled && looksLikeEnglish(original)) {
                if (translations.has(original)) {
                    setText(node, original, translations.get(original));
                } else if (queued.size < MAX_QUEUE) {
                    if (!queued.has(original)) queued.set(original, []);
                    queued.get(original).push(node);
                    sendRequests();
                }
            }
        }

        function scan(root) {
            if (!root || destroyed) return;
            if (root.nodeType === 3) { observeNode(root); return; }
            if (root.nodeType !== 1 || root.matches(excluded)) return;
            var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            var node;
            var count = 0;
            while ((node = walker.nextNode()) && count++ < 25000) observeNode(node);
        }

        function sendRequests() {
            if (!machineEnabled || !window.SudokuTranslate) return;
            while (pending.size < MAX_INFLIGHT && queued.size) {
                var iterator = queued.entries().next().value;
                var source = iterator[0];
                var nodes = iterator[1];
                queued.delete(source);
                if (requested.has(source)) continue;
                var id = nextId++;
                pending.set(id, { original: source, nodes: nodes });
                requested.add(source);
                try {
                    window.SudokuTranslate.postMessage(JSON.stringify({ id: id, text: source }));
                } catch (error) {
                    pending.delete(id);
                    requested.delete(source);
                }
            }
        }

        if (window.SudokuTranslate) {
            window.SudokuTranslate.onmessage = function (event) {
                if (destroyed) return;
                var payload;
                try { payload = JSON.parse(event.data); } catch (error) { return; }
                var entry = pending.get(payload.id);
                if (!entry) return;
                pending.delete(payload.id);
                var result = typeof payload.translated === 'string' ? payload.translated.trim() : '';
                if (result) {
                    translations.set(entry.original, result);
                    if (machineEnabled) entry.nodes.forEach(function (node) {
                        setText(node, entry.original, result);
                    });
                }
                // Any duplicate text nodes that arrived while this request was
                // pending should now receive the cached translation, too.
                schedule();
                sendRequests();
            };
        }

        function schedule() {
            if (destroyed || timer) return;
            timer = window.setTimeout(function () {
                timer = null;
                // Multiple unrelated subtrees may change in one SudokuPad update.
                scan(document.body);
            }, 180);
        }

        observer = new MutationObserver(function (changes) {
            if (destroyed) return;
            var root = null;
            changes.forEach(function (change) {
                if (change.type === 'characterData') {
                    if (!root) root = change.target.parentElement;
                } else if (change.type === 'attributes') {
                    if (!root) root = change.target;
                } else if (change.addedNodes.length > 0) {
                    // Scan the added subtree in the next animation tick.
                    if (!root) root = change.target;
                }
            });
            if (root) schedule();
        });

        observer.observe(document.body, {
            childList: true, characterData: true, subtree: true,
            attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
        });
        window.__spAndroidTranslator = {
            setMachine: function (enabled) {
                machineEnabled = !!enabled && !!window.SudokuTranslate;
                if (machineEnabled) {
                    storedNodes.forEach(function (record, node) {
                        if (!node.isConnected) storedNodes.delete(node);
                    });
                    queued.clear();
                    requested.clear();
                    scan(document.body);
                    sendRequests();
                } else {
                    queued.clear();
                    storedNodes.forEach(function (record, node) {
                        if (!node.isConnected) { storedNodes.delete(node); return; }
                        // Leave reviewed dictionary translations in place.
                        if (node.nodeValue === record.translated && !dictionaryHas(record.original.trim())) {
                            node.nodeValue = record.original;
                            storedNodes.delete(node);
                        }
                    });
                }
            },
            destroy: function () {
                destroyed = true;
                observer.disconnect();
                if (timer) window.clearTimeout(timer);
                if (window.SudokuTranslate) window.SudokuTranslate.onmessage = null;
                queued.clear();
                pending.clear();
                storedNodes.clear();
            }
        };
        scan(document.body);
        sendRequests();
    };
}());
