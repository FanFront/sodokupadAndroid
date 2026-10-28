/* Android control surface for the captured offline SudokuPad engine.
   Uses SudokuPad's own public app actions; does not alter any puzzle solution,
   fog, state history or save data. Long presses on board are left intact when
   moving mode is off. */
(() => {
  'use strict';
  if (window.AndroidSudokuvaniaPort) return;
  const doc = document;
  const root = doc.documentElement;
  root.classList.add('android-port');
  const getFramework = () => typeof Framework !== 'undefined' ? Framework : null;
  const app = () => getFramework()?.app;
  const feature = () => getFramework()?.features?.largepuzzle;
  let moveMode = false;
  let drag = null;
  let noticeTimer;
  const dock = doc.createElement('section');
  dock.id = 'android-gamepad';
  dock.setAttribute('role', 'group');
  dock.setAttribute('aria-label', '数独手机控制台');

  function notify(msg) {
    let status = dock.querySelector('#android-status');
    if (!status) {
      status = doc.createElement('div');
      status.id = 'android-status';
      status.setAttribute('role', 'status');
      dock.appendChild(status);
    }
    status.textContent = msg;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => status.remove(), 2300);
  }

  function useApp(fn) {
    const a = app();
    if (!a || !a.puzzle) return notify('游戏正在加载，请稍后操作');
    try { fn(a); }
    catch (err) {
      console.error('Android control error:', err);
      notify('此操作暂时无法使用');
    }
  }

  /**
   * The large Sudokuvania board is about 50x50 cells. Fitting the WHOLE
   * board to a 390px phone screen makes the entrance unreadably small.
   * Focus the first entrance grid using the engine's built-in pan and zoom.
   * User progress, fog and selected digits are not touched.
   */
  function focusEntrance() {
    // Standalone 9x9 boss and enemy puzzles have no 50x50 castle entrance.
    // Applying the map's row-22 fallback would pan the boss board offscreen.
    if (!isMap()) return false;
    const a = app();
    const f = feature();
    if (!a || !a.puzzle || !a.puzzle.currentPuzzle || !f) return false;
    if (!f.featureEnabled) {
      // A mobile build needs the Large Puzzle feature for map gestures.
      if (typeof f.attachElem === 'function') f.attachElem();
      return false;
    }
    const board = doc.getElementById('board');
    const svg = doc.getElementById('svgrenderer');
    // SudokuPad writes these inline sizes only after resizeBoard() has
    // calculated the puzzle geometry; don't focus against a placeholder SVG.
    if (!board || !svg || !board.style.width || !board.style.height ||
        !board.getBoundingClientRect().width) return false;
    const viewBox = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    if (viewBox.length !== 4 || !viewBox.every(Number.isFinite) || viewBox[2] <= 0) return false;
    const grids = a.sourcePuzzle?.metadata?.grids || [];
    const entrance = grids[0];
    const cellSize = typeof SvgRenderer !== 'undefined' ? SvgRenderer.CellSize : 64;
    // Grid coordinates from metadata are zero-based.
    const focusCol = entrance && Number.isFinite(+entrance.left)
      ? +entrance.left + Math.max(1, (+entrance.width || 6) * 0.5)
      : (/^\/(?:3g0qh2la4v|xfq6z64i66)$/.test(window.location.pathname)
         ? (a.puzzle.cols || 9) / 2 : 3);
    const focusRow = entrance && Number.isFinite(+entrance.top)
      ? +entrance.top + Math.max(0.5, (+entrance.height || 6) * 0.5)
      : (/^\/(?:3g0qh2la4v|xfq6z64i66)$/.test(window.location.pathname)
         ? (a.puzzle.rows || 9) / 2 : 22);
    const playfield = doc.querySelector('.game')?.getBoundingClientRect();
    if (!playfield || playfield.height < 120 || playfield.width < 120) return false;
    const usable = Math.min(playfield.width / (7 * cellSize),
      playfield.height / (9 * cellSize));
    const scale = Math.max(0.38, Math.min(0.82, usable));
    const baseScale = Number.isFinite(f.baseScale) ? f.baseScale : 1;
    f.zoomLevel = Math.max(1, 1 + scale - baseScale);
    f.panPos = [
      (focusCol * cellSize - (viewBox[0] + 0.5 * viewBox[2])) * scale,
      (focusRow * cellSize - (viewBox[1] + 0.5 * viewBox[3])) * scale
    ];
    f.rawUpdateTransform();
    return true;
  }


  // The stock gridrules feature writes *current selected-grid* rules into
  // #controls .puzzle-rules. Keep that DOM alive, and reuse its live content
  // rather than guessing which boss belongs to a tapped SVG cell.
  let regionOverlay = null;
  const mapStorageKey = 'android-sudokuvania-main-map';
  const isMap = () => /^(?:\/sudokuvania\/(?:digits-of-despair|lineage-of-logic(?:-plain)?)|\/(?:3g0qh2la4v|xfq6z64i66))$/
    .test(window.location.pathname);

  function currentRules() {
    const rulesFeature = getFramework()?.features?.gridrules;
    if (rulesFeature?.featureEnabled && typeof rulesFeature.updateRules === 'function') {
      try { rulesFeature.updateRules(); } catch (error) {
        console.warn('Cannot update selected-grid rules:', error);
      }
    }
    const rules = doc.querySelector('#controls .puzzle-rules');
    return rules?.querySelector('.gridrulessection') || rules || null;
  }
  function getBossLinks(source) {
    if (!source) return [];
    const result = [];
    for (const a of source.querySelectorAll('a[href]')) {
      let url;
      try { url = new URL(a.getAttribute('href'), window.location.href); }
      catch { continue; }
      if (url.origin !== 'https://sudokupad.app') continue;
      // Super Sudokoid includes unlabeled short-link bonus puzzles as well
      // as explicit bosses. Only treat them as side puzzles on its maps.
      const superMap=/^\/(?:3g0qh2la4v|xfq6z64i66)$/.test(window.location.pathname);
      const side=superMap && /^\/[a-z0-9-]{8,40}$/.test(url.pathname);
      if (!side && !(/boss|首领/i.test(a.textContent || '') || /\/boss-/i.test(url.pathname))) continue;
      if (!result.some(link => link.href === url.href)) {
        result.push({href:url.href, label:a.textContent.trim()});
      }
    }
    return result;
  }
  function closeRegion() {
    regionOverlay?.remove();
    regionOverlay = null;
  }
  function followRuleLink(href) {
    let destination;
    try { destination = new URL(href, window.location.href); }
    catch { return notify('谜题链接无效'); }
    if (destination.origin !== 'https://sudokupad.app') return notify('离线模式无法打开外部网站');
    if (isMap()) {
      try { sessionStorage.setItem(mapStorageKey, window.location.href); }
      catch (error) { console.warn('Cannot store main-map route:', error); }
    }
    closeRegion();
    // Navigate in the same WebView; target=_blank is not supported offline.
    window.location.assign(destination.href);
  }
  function openRegion(bossOnly = false) {
    if (!app()?.puzzle?.currentPuzzle) return notify('谜题仍在加载');
    closeRegion();
    const source = currentRules();
    const overlay = doc.createElement('div');
    overlay.id = 'android-region-overlay';
    overlay.setAttribute('role','presentation');
    const dialog = doc.createElement('section');
    dialog.className = 'android-region-dialog';
    dialog.setAttribute('role','dialog');
    dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-label', bossOnly ? (/^\/(?:3g0qh2la4v|xfq6z64i66)$/.test(window.location.pathname)?'支线／首领谜题':'首领谜题') : '当前区域规则');
    const heading = doc.createElement('header');
    const title = doc.createElement('strong');
    title.textContent = bossOnly ? (/^\/(?:3g0qh2la4v|xfq6z64i66)$/.test(window.location.pathname)?'支线／首领谜题':'首领谜题') : '当前区域规则';
    const close = doc.createElement('button');
    close.type = 'button';
    close.textContent = '关闭';
    close.dataset.regionClose = '1';
    heading.append(title,close);
    const contents = doc.createElement('div');
    contents.className = 'android-region-content';
    if (bossOnly) {
      const links = getBossLinks(source);
      if (!links.length) {
        contents.textContent = '当前区域尚未显示可进入的独立谜题。请先选中已探索的区域格子，必要时继续揭开迷雾。';
      } else {
        const note = doc.createElement('p');
        note.textContent = '进入独立谜题后，可使用下方「返回」按钮回到主地图。';
        contents.append(note);
        for (const link of links) {
          const a = doc.createElement('a');
          a.href = link.href;
          a.className = 'android-boss-link';
          a.textContent = link.label || '进入首领谜题';
          contents.append(a);
        }
      }
    } else if (source) {
      contents.append(source.cloneNode(true));
    } else {
      contents.textContent = '尚未加载此区域的规则。请先轻触棋盘格子。';
    }
    dialog.append(heading, contents);
    overlay.append(dialog);
    doc.body.append(overlay);
    regionOverlay = overlay;
    // SudokuPad's global handlers can cancel compatibility click events on
    // Android. A direct touchend handler makes modal links actually usable.
    let touchStart = null;
    overlay.addEventListener('touchstart', e => {
      const t = e.changedTouches?.[0];
      if (t) touchStart = {id:t.identifier,x:t.clientX,y:t.clientY};
    }, {capture:true, passive:true});
    overlay.addEventListener('touchend', e => {
      const t = Array.from(e.changedTouches || []).find(t => t.identifier === touchStart?.id);
      if (!t || Math.hypot(t.clientX-touchStart.x,t.clientY-touchStart.y) > 30) return;
      const target = doc.elementFromPoint(t.clientX,t.clientY);
      const anchor = target?.closest?.('#android-region-overlay a[href]');
      const closeButton = target?.closest?.('#android-region-overlay [data-region-close]');
      if (!anchor && !closeButton) return;
      if (e.cancelable) e.preventDefault();
      e.stopImmediatePropagation();
      if (anchor) followRuleLink(anchor.href);
      else closeRegion();
    }, {capture:true,passive:false});
    overlay.addEventListener('click', e => {
      const anchor = e.target.closest?.('a[href]');
      const closeButton = e.target.closest?.('[data-region-close]');
      if (anchor || closeButton) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (anchor) followRuleLink(anchor.href);
        else closeRegion();
      } else if (e.target === overlay) closeRegion();
    }, {capture:true});
  }
  // Native SudokuPad rule links also need same-tab navigation in WebView.
  doc.addEventListener('click', event => {
    if (regionOverlay || !event.target.closest) return;
    const anchor = event.target.closest('#controls .gridrulessection a[href]');
    if (!anchor) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    followRuleLink(anchor.href);
  }, {capture:true});

  function doGameAction(action, value) {
    if (action === 'home') {
      window.location.href = 'sudokuandroid://home';
      return;
    }
    if (action === 'region' || action === 'boss') {
      openRegion(action === 'boss');
      return;
    }
    if (action === 'back-map') {
      if (isMap()) return notify('当前已经在地图中');
      let saved = null;
      try { saved = sessionStorage.getItem(mapStorageKey); } catch {}
      if (window.history.length > 1) window.history.back();
      else if (saved) window.location.assign(saved);
      else notify('当前没有可返回的地图，请使用主页');
      return;
    }
    if (action === 'pan') {
      moveMode = !moveMode;
      root.classList.toggle('android-pan', moveMode);
      drag = null;
      notify(moveMode ? '移动模式：在棋盘上拖动或双指缩放' : '填数模式：点选格子后输入数字');
      updateModes();
      return;
    }
    if (action === 'zoom-in' || action === 'zoom-out' || action === 'recenter') {
      if (action === 'recenter' && !isMap()) {
        app()?.resize?.();
        return;
      }
      const f = feature();
      if (!f || !f.featureEnabled || !f.boEl) {
        notify('大棋盘缩放尚未就绪');
        return;
      }
      if (action === 'recenter') {
        if (!focusEntrance()) notify('地图仍在载入中');
      } else {
        const r = f.boEl.getBoundingClientRect();
        f.handleZoomInOut(action === 'zoom-in' ? 1 : -1,
          [r.left + r.width/2, r.top + r.height/2]);
      }
      return;
    }
    useApp(a => {
      switch (action) {
        case 'digit': {
          if(!a.puzzle.selectedCells?.length) {
            notify('请先轻触棋盘格子，再输入数字');
            return;
          }
          // SudokuPad may remap the normal keypad to letters or colour IDs.
          const original = doc.querySelector('.controls-input button[data-key="' + value + '"]');
          a.doPressDigit(original?.dataset.value || value);
          break;
        }
        case 'letter': {
          if (typeof ToolLetter === 'undefined') return notify('该谜题未加载字母工具');
          if (!a.hasTool('letter')) getFramework().addTool(ToolLetter);
          ToolLetter.tool.toggleMode();
          updateModes();
          notify(ToolLetter.tool.letterMode ? '已切换至字母键盘' : '已切换至数字键盘');
          break;
        }
        case 'erase':
          a.act({type: 'clear', arg: a.tool});
          break;
        case 'tool':
          if (value === 'pen' && !a.hasTool('pen') && typeof ToolPen !== 'undefined') {
            getFramework().addTool(ToolPen);
          }
          if (!a.hasTool(value)) return notify('当前游戏不支持这种标记');
          a.changeTool(value);
          updateModes();
          break;
        case 'undo': a.undo(); break;
        case 'redo': a.redo(); break;
        case 'rules': {
          const original = doc.querySelector('#controls button[data-control="rules"]');
          // SudokuPad routes these buttons via pointer events, not click().
          if (original && a.handleButton) {
            a.handleButton({
              type: 'mousedown', target: original, clientX: 1, clientY: 1,
              preventDefault(){}, stopPropagation(){}
            });
          } else {
            notify('请从游戏规则窗口查看说明');
          }
          break;
        }
        case 'check': a.check({log:true,alertOnError:true,alertOnNoError:true}); break;
      }
    });
  }

  /*
   * SudokuPad installs global mouse/touch handlers before this module loads.
   * On Android WebView they may cancel the compatibility "click" dispatched
   * after a finger tap. Listening ONLY for click therefore leaves the
   * keypad looking active while none of its buttons work.
   *
   * Intercept direct touchend in capture phase, independent of synthesized
   * mouse/click events. Pointerup is the fallback for devices that dispatch
   * pointer but not Touch Events; click remains for desktop / keyboard.
   * Do not interact with puzzle cells, which stay under SudokuPad's handlers.
   */
  const touchGesture = {button:null, identifier:null, x:0, y:0, consumed:false};
  let lastActivation = null;

  function visibleModal() {
    return Array.from(doc.querySelectorAll('.dialog-overlay')).some(el =>
      el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  }
  function buttonAt(x, y) {
    if (regionOverlay || visibleModal()) return null;
    const rect = dock.getBoundingClientRect();
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) return null;
    // Geometry lookup also works if an old SudokuPad element covers the dock
    // in the hit-testing layer while our buttons remain visually visible.
    for (const button of dock.querySelectorAll('button[data-android-action]')) {
      const b = button.getBoundingClientRect();
      if(x >= b.left && x < b.right && y >= b.top && y < b.bottom) return button;
    }
    return null;
  }
  function activate(button, kind) {
    if (!button || button.disabled) return false;
    // Suppress synthetic click/pointer events for a touch we just handled.
    // Never suppress another real touchstart/touchend gesture.
    const syntheticClick = kind === 'click' && lastActivation?.button === button &&
      performance.now() - lastActivation.at < 550;
    const duplicateTouchPointer = kind === 'pointer' &&
      lastActivation?.kind === 'touch' && lastActivation.button === button &&
      performance.now() - lastActivation.at < 180;
    if(syntheticClick || duplicateTouchPointer) return true;
    lastActivation = {button, kind, at:performance.now()};
    button.dataset.androidTapCount = String((+button.dataset.androidTapCount || 0)+1);
    button.classList.add('android-tapped');
    setTimeout(() => button.classList.remove('android-tapped'), 160);
    doGameAction(button.dataset.androidAction,button.dataset.value);
    return true;
  }
  function preventPuzzleInput(event) {
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }
  doc.addEventListener('touchstart', event => {
    const touch=event.changedTouches?.[0];
    if (!touch) return;
    const button=buttonAt(touch.clientX,touch.clientY);
    if (!button) return;
    Object.assign(touchGesture, {
      button, identifier:touch.identifier, x:touch.clientX, y:touch.clientY, consumed:false
    });
    preventPuzzleInput(event);
  },{capture:true,passive:false});
  doc.addEventListener('touchend', event => {
    const touch=Array.from(event.changedTouches || [])
      .find(t => t.identifier === touchGesture.identifier);
    if (!touch || !touchGesture.button) return;
    const button=buttonAt(touch.clientX,touch.clientY);
    const startButton=touchGesture.button;
    const moved=Math.hypot(touch.clientX-touchGesture.x,touch.clientY-touchGesture.y);
    touchGesture.button=null;
    touchGesture.identifier=null;
    preventPuzzleInput(event);
    if(button===startButton && moved < 32) activate(button,'touch');
  },{capture:true,passive:false});
  doc.addEventListener('touchcancel', event => {
    if(!touchGesture.button) return;
    touchGesture.button=null;
    touchGesture.identifier=null;
    preventPuzzleInput(event);
  },{capture:true,passive:false});
  doc.addEventListener('pointerdown', event => {
    if (buttonAt(event.clientX,event.clientY)) preventPuzzleInput(event);
  },{capture:true,passive:false});
  doc.addEventListener('pointerup', event => {
    const button=buttonAt(event.clientX,event.clientY);
    if (!button) return;
    preventPuzzleInput(event);
    // Prefer touchend over pointerup where both are supported.
    if (event.pointerType !== 'touch' || !touchGesture.button) {
      activate(button,event.pointerType === 'touch' ? 'pointer' : 'mouse');
    }
  },{capture:true,passive:false});
  doc.addEventListener('click', event => {
    const button=event.target.closest?.('#android-gamepad button[data-android-action]') ||
      buttonAt(event.clientX,event.clientY);
    if (!button) return;
    preventPuzzleInput(event);
    activate(button,'click');
  },{capture:true,passive:false});

  function makeButton(label, action, value) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.androidAction = action;
    if (value !== undefined) button.dataset.value = String(value);
    return button;
  }

  function row(cls, entries) {
    const r = doc.createElement('div');
    r.className = cls;
    for (const item of entries) r.appendChild(makeButton(...item));
    dock.appendChild(r);
    return r;
  }
  row('android-tools', [
    ['数字','tool','normal'],['角标','tool','corner'],
    ['中心','tool','centre'],['颜色','tool','colour'],
    ['画线','tool','pen'],['字母','letter'],['移动','pan'],['居中','recenter']
  ]);
  row('android-numbers', [
    ...['1','2','3','4','5','6','7','8','9','0'].map(n=>[n,'digit',n]),
    ['⌫','erase'],['↶','undo']
  ]);
  row('android-actions', [
    ['主页','home'],['规则','rules'],['区域','region'],
    ['首领','boss'],['返回','back-map'],['重做','redo'],
    ['检查','check'],['＋','zoom-in'],['－','zoom-out']
  ]);
  doc.body.appendChild(dock);

  function updateDockHeight() {
    root.style.setProperty('--android-dock-height', Math.ceil(dock.getBoundingClientRect().height) + 'px');
    if (app() && typeof app().resize === 'function') app().resize();
  }
  new ResizeObserver(updateDockHeight).observe(dock);
  window.addEventListener('resize', updateDockHeight);
  updateDockHeight();

  function updateModes() {
    const a = app();
    for (const btn of dock.querySelectorAll('button')) {
      let on = btn.dataset.androidAction === 'pan' && moveMode;
      if (a && btn.dataset.androidAction === 'tool') {
        on = a.tool === btn.dataset.value && !moveMode;
      }
      if (btn.dataset.androidAction === 'letter' && typeof ToolLetter !== 'undefined') {
        on = !!ToolLetter.tool.letterMode;
      }
      if (btn.dataset.androidAction === 'digit') {
        const orig = doc.querySelector('.controls-input button[data-key="' + btn.dataset.value + '"]');
        btn.textContent = orig?.dataset.value || btn.dataset.value;
      }
      if (btn.dataset.androidAction === 'back-map') btn.hidden = isMap();
      if (btn.dataset.androidAction === 'boss')
        btn.textContent = /^\/(?:3g0qh2la4v|xfq6z64i66)$/.test(window.location.pathname) ? '副本' : '首领';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  setInterval(updateModes, 1000);
  updateModes();

  // Board drag works ONLY in explicitly selected Move mode; single-finger
  // touches remain the original sudoku selection gesture otherwise.
  function coords(touches) {
    let x = 0, y = 0;
    for (const touch of touches) { x += touch.clientX; y += touch.clientY; }
    return [x / touches.length, y / touches.length];
  }
  function distance(touches) {
    if (touches.length < 2) return 0;
    return Math.hypot(touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY);
  }
  function capture(e) {
    if (!moveMode || !e.target.closest || !e.target.closest('#board')) return;
    const f = feature();
    if (!f || !f.featureEnabled) return;
    if (e.type === 'touchend' || e.type === 'touchcancel') {
      drag = null;
    } else if (e.type === 'touchstart') {
      drag = {center:coords(e.touches),distance:distance(e.touches)};
    } else if (e.type === 'touchmove' && drag && e.touches.length) {
      const point = coords(e.touches);
      const dx = point[0]-drag.center[0], dy = point[1]-drag.center[1];
      if (f.handlePan) f.handlePan([dx,dy]);
      const now = distance(e.touches);
      if (now && drag.distance && Math.abs(now-drag.distance)>13) {
        f.handleZoomInOut(now > drag.distance ? 1 : -1, point);
        drag.distance = now;
      }
      drag.center = point;
    }
    if(e.cancelable) e.preventDefault();
    e.stopImmediatePropagation();
  }
  ['touchstart','touchmove','touchend','touchcancel'].forEach(type =>
    doc.addEventListener(type, capture, {capture:true,passive:false}));

  // Do not steal the player's current position after startup. Only focus
  // once, after the decoded puzzle metadata and SVG viewBox are ready.
  let tries = 0;
  if (isMap()) {
  const timer = setInterval(() => {
    if (focusEntrance()) {
      clearInterval(timer);
    } else if (++tries === 50) {
      notify('正在渲染大型数独地图，请稍候…');
    } else if (tries > 240) {
      clearInterval(timer);
      notify('棋盘未能加载：请检查离线资源并重新打开游戏');
      console.error('Android board startup failed', {
        framework: !!app(), loaded: !!app()?.puzzle?.currentPuzzle,
        largePuzzle: !!feature()?.featureEnabled,
        viewBox: doc.getElementById('svgrenderer')?.getAttribute('viewBox')
      });
    }
  }, 400);
  }

  window.AndroidSudokuvaniaPort = {notify, updateModes, focusEntrance, openRegion, getBossLinks, dock};
})();
