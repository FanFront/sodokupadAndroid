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
      : 3;
    const focusRow = entrance && Number.isFinite(+entrance.top)
      ? +entrance.top + Math.max(0.5, (+entrance.height || 6) * 0.5)
      : 22;
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

  function doGameAction(action, value) {
    if (action === 'home') {
      window.location.href = 'sudokuandroid://home';
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
    if (visibleModal()) return null;
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
    ['主页','home'],['规则','rules'],['重做','redo'],
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

  window.AndroidSudokuvaniaPort = {notify, updateModes, focusEntrance, dock};
})();
