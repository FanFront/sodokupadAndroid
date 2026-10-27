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
  const app = () => window.Framework && window.Framework.app;
  const feature = () => window.Framework && window.Framework.features &&
    window.Framework.features.largepuzzle;
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
        f.zoomLevel = 1;
        f.panPos = [0,0];
        f.updateTransform();
      } else {
        const r = f.boEl.getBoundingClientRect();
        f.handleZoomInOut(action === 'zoom-in' ? 1 : -1,
          [r.left + r.width/2, r.top + r.height/2]);
      }
      return;
    }
    useApp(a => {
      switch (action) {
        case 'digit':
          a.doPressDigit(value);
          break;
        case 'erase':
          a.act({type: 'clear', arg: a.tool});
          break;
        case 'tool':
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

  function makeButton(label, action, value) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.androidAction = action;
    if (value !== undefined) button.dataset.value = String(value);
    button.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      doGameAction(action, value);
    });
    // Original SudokuPad also listens globally for pointer input.
    button.addEventListener('pointerdown', e => e.stopPropagation());
    button.addEventListener('pointerup', e => e.stopPropagation());
    button.addEventListener('touchstart', e => e.stopPropagation(), {passive:true});
    button.addEventListener('touchend', e => e.stopPropagation(), {passive:true});
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
    ['移动','pan'],['居中','recenter']
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
      if (f.handlePan) f.handlePan([-dx,-dy]);
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

  window.AndroidSudokuvaniaPort = {notify, updateModes, dock};
})();
