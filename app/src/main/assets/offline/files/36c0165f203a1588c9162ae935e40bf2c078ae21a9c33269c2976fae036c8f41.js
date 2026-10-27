
const FeatureProject9x9 = (() => {
	// Helpers
		const getTransform = el => {
			const [scale, x, y] = (getComputedStyle(el).transform
				.match(/matrix\(\s*([^,]*)\s*,[^,]*,[^,]*,[^,]*,\s*([^,]*)\s*,\s*([^,]*)\s*\)/) || [])
				.slice(1).map(n => parseFloat(n))
				;
			return {x, y, scale};
		};
		const setTransform = (el, t) => {
			const rnd = (n, r = 3) => Math.round(Number(n) * 10**r) / 10**r;
			let parts = [];
			if(t.x !== undefined || t.y !== undefined) parts.push(`translate(${rnd(t.x)}px, ${rnd(t.y)}px)`);
			if(t.scale !== undefined) parts.push(`scale(${rnd(t.scale)})`);
			el.style.transform = parts.join(' ');
		};
	
	function FeatureProject9x9() {
		bindHandlers(this);
		PortableEvents.mixin(this);
		this.featureEnabled = false;
		this.handleEarlyInit();
	}
	const C = FeatureProject9x9, P = Object.assign(C.prototype, {constructor: C});
	C.Name = 'project9x9';
	C.SettingName = C.Name;
	C.layoutStyle = ``;
	C.LayoutClassName = 'layout9x9';
	C.DefaultSettings = {
		largedigits: false,
		autocheck: true,
		toolletter: false,
		toolpen: false,
		copycells: false,
		toolcalculator: false,
		showplayinsudokupad: false,
		marksolveddigits: false,
		hidesvenpeek: false,
		hidesupportlinks: true,
		showplayinsudokupad: false,
		hidesventobyemoji: false,
		hidetimer: true,
		nopauseonstart: false,
		marksolveddigits: 'on',
		conflictchecker: 'simple',
		checkpencilmarks: false,
		puzzleevents: 'off',
		'foganim-testpuffs': true,
		
		nopauseonstart: true, // testing
	};
	C.DefaultStylesheet = `
		.layout9x9 {
			--main-color: #5286BE;
		}
		.controls-footer { display: none; }
		.controls-info .puzzle-header { display: none; }
		.controls-info .puzzle-rules {
			/*
			background-color: #E4E9EC;
			border: 0.2rem solid #36464E;
			*/
			margin: 0;
			border: none;
			border-radius: 0;
			padding: 1rem 0.5rem;
			font-size: 0.8rem;
			background-color: var(--main-color);
			color: #fff;
			background-color: #a3b9db;
			background-color: #e4e9ec;
			color: #000;
			overflow-y: auto;
		}
		.topbar-header {
			position: absolute;
			z-index: -1;
			left: 0;
			width: 100%;
			text-align: center;
		}
		.topbar-author { font-size: smaller; }
		.layout9x9 .killercalc-onscreen {
			left: -9rem;
		}
		.controls #control-getreplay {
			font-size: 1.5rem;
			width: auto;
			padding-right: 0.75rem;
		}
		.controls #control-getreplay .icon { padding-right: 0.5rem; }
	`;
	C.handleInitWithReplay = function() {
		function handleGetReplay() {
			Framework?.features?.replaysave.handleOpenDialog();
		}
		const coEl = document.querySelector('.controls-app');
		coEl.insertAdjacentHTML('beforeend',
			`<button id="control-getreplay" data-control="getreplay"><div class="icon">${Framework.icons.download}</div>Get Replay</button>`
		);
		document.querySelector('#control-getreplay')
			.addEventListener('click', handleGetReplay);
	},
	C.Layouts = {
		'project9x9-1': { tools: ['normal'] },
		'project9x9-1r': { tools: ['normal'], handleInit: C.handleInitWithReplay },
		'project9x9-2': { tools: ['normal', 'centre'] },
		'project9x9-2r': { tools: ['normal', 'centre'], handleInit: C.handleInitWithReplay },
		'project9x9-3': { tools: ['normal', 'corner'] },
		'project9x9-3r': { tools: ['normal', 'corner'], handleInit: C.handleInitWithReplay },
		'project9x9-4': { tools: ['normal', 'corner', 'centre'] },
		'project9x9-4r': { tools: ['normal', 'corner', 'centre'], handleInit: C.handleInitWithReplay },
		'project9x9-5': { tools: ['normal', 'corner', 'centre'], settings: {toolcalculator: true} },
		'project9x9-5r': { tools: ['normal', 'corner', 'centre'], settings: {toolcalculator: true}, handleInit: C.handleInitWithReplay },
		'project9x9-6': { tools: ['normal', 'corner', 'centre', 'colour'] },
		'project9x9-6r': { tools: ['normal', 'corner', 'centre', 'colour'], handleInit: C.handleInitWithReplay },
		'project9x9-7': { tools: ['normal', 'corner', 'centre', 'colour'], settings: {toolcalculator: true} },
		'project9x9-7r': { tools: ['normal', 'corner', 'centre', 'colour'], settings: {toolcalculator: true}, handleInit: C.handleInitWithReplay },
		'project9x9-8': {
			tools: ['normal', 'corner', 'centre', 'colour', 'pen', 'letter'],
			settings: {toolcalculator: true, hidetimer: false, toolletter: true},
		},
		'project9x9-8r': {
			tools: ['normal', 'corner', 'centre', 'colour', 'pen', 'letter'],
			settings: {toolcalculator: true, hidetimer: false, toolletter: true},
			handleInit: C.handleInitWithReplay,
		},
		'thumbnail': {
			tools: [],
			removeControls: ['undo', 'redo', 'check', 'select'],
			settings: {toolcalculator: false, hidetimer: true, toolletter: false, hidesvenpeek: true},
			stylesheet: `${C.DefaultStylesheet}
				:root {color: red}
				.controls-info .puzzle-rules,
				.topbar,
				.controls
					{ display: none !important; }
			`,
		},
	};
	C.CoreTools = {
		'normal': ToolNormal,
		'corner': ToolCorner, 
		'centre': ToolCentre,
		'colour': ToolColor,
		'pen': ToolPen,
		'letter': ToolLetter,
	};
	// API
		C.create = async function() {
			const feature = new C();
			Framework.withApp(() => feature.addFeature());
			return feature;
		};
		P.init = async function() {
			Framework.features = Framework.features || {};
			if(Framework.features[C.Name] !== undefined) {
				console.error('Feature "%s" already exists.', C.Name);
			}
			else {
				Framework.features[C.Name] = this;
			}
			const proto = Object.getPrototypeOf(this);
			for await (const prop of Object.getOwnPropertyNames(proto)) {
				if('function' !== typeof this[prop] || !/^handleInit.*/.test(prop)) continue;
				await this[prop]();
			}
			if(C.featureStyle) this.featureStylesheet = await attachStylesheet(C.featureStyle);
		};
		P.addFeature = async function() {
			this.init();
		};
		P.removeFeature = async function() {
			this.featureEnabled = false;
			if(this.featureStylesheet) this.featureStylesheet.remove();
		};
	// Handlers
	// Settings
		P.setSettings = async function(settings) {
			for(const [key, val] of Object.entries(settings)) {
				//console.log('  Change setting[%s]:', key, Framework.getSetting(key), val);
				Framework.tempSettings.push(key);
				Framework.setSetting(key, val);
			}
		};
	// Tools
		P.setTools = async function(tools, refresh = true) {
			const toolNames = Object.keys(C.CoreTools),
						defaultTool = toolNames[0],
						currentTool = Framework.app.tool;
			const normalizeTools = (tools, def = defaultTool) => tools.reduce((acc, cur) => def === cur ? acc : [...acc, cur], []);
			tools = normalizeTools(tools);
			Framework.app.changeTool(defaultTool);
			await sleep(0)();
			for(const name of toolNames) if(name !== defaultTool) Framework.removeTool(name);
			for(const name of tools) Framework.addTool(C.CoreTools[name]);
			Framework.app.changeTool(currentTool);
		if(refresh) Framework.app.refreshControls();
		};
		P.setControls = async function(controls, refresh = true) {
			const AppControls = [appButtonSettings, appButtonFullscreen, appButtonRules, appButtonInfo, appButtonRestart],
						curr = [...document.querySelectorAll('.controls-app button')].map(({id}) => id.replace(/^control-/, ''));
			for(const name of curr) Framework.removeControlButton(name);
			Framework.addAppButtons(controls.map(name => AppControls.find(({name: n}) => n === name)));
			if(refresh) Framework.app.refreshControls();
		};
	// Menu
		P.handleMenuRestart = async function() {
			createAppMenu.closeMenu();
			Framework.app.handleRestartPuzzle();
		};
		P.initMenu = async function() {
			const removeItemNames = ['steam', 'kofi', 'patreon', 'youtube', 'openalternate', 'shorturl', 'endless'],
						removeItems = [...document.querySelectorAll(removeItemNames
							.map(name => `#appmenuitems .menu-link-${name}`)
							.join(', ')
						)];
			for(const el of removeItems) el.remove();
			document.querySelector('#appmenuitems .menu-link-home').insertAdjacentHTML('afterend', 
				`<a class="mdc-list-item menu-link-restart" href="#">
					<div class="icon">${Framework.icons.restart}</div>
					<span class="mdc-list-item-text">Restart Puzzle</span>
				</a>`
			);
			document.querySelector('#appmenuitems .menu-link-restart').addEventListener('click', this.handleMenuRestart);
		};
	// Layout
		P.getParamLayout = () => (new URLSearchParams(document.location.search)).get('layout');
		P.isValidLayout = layoutName => C.Layouts[layoutName] !== undefined;
		P.getOrientation = function() {
			const gaEl = document.querySelector('.game'),
						gaBounds = bounds(gaEl);
			let orientation;
			if(gaBounds.width > gaBounds.height) {
				orientation = 'landscape';
			}
			else {
				orientation = 'portrait';
			}
			return orientation;
		};
		P.execLayoutHandler = async function(handlerName, ...args) {
			const layoutName = this.currentLayout,
						layout = C.Layouts[layoutName],
						handlerFn = layout[handlerName];
			if(typeof handlerFn === 'function') handlerFn.apply(this, args);
		};
		P.handleResize = function() {
			const {CellSize} = SvgRenderer,
						margin = 0.5 * CellSize,
						gaEl = document.querySelector('.game'),
						boEl = document.querySelector('#board'),
						coEl = document.querySelector('#controls'),
						ciEl = document.querySelector('.controls-info'),
						cbEl = document.querySelector('.controls-buttons');
			const resetTransformXY = el => {
				let trans = getTransform(el);
				delete trans.x;
				delete trans.y;
				setTransform(el, trans);
			};
			const centerBoard = () => {
				resetTransformXY(boEl);
				boEl.style['transform-origin'] = 'center';
				boEl.style.left = 'unset';
				boEl.style.top = 'unset';
			};
			const alignControls = () => {
				document.body.classList.toggle('layout-controlsflipped', false);
				const resetStyle = {
					position: 'fixed',
					transform: 'none',
					left: '0px', top: '0px',
					'transform-origin': 'top left',
				};
				for(const {style} of [coEl, ciEl, cbEl]) Object.assign(style, resetStyle);
				let gaBounds = bounds(gaEl),
						boBounds = bounds(boEl),
						cbBounds = bounds(cbEl),
						boT = getTransform(boEl);
				//let boMargin = CellSize * 0.5 * boT.scale;
				let boMargin = margin;
				//let cbScaleH = (gaBounds.right - boBounds.right - margin - boMargin) / (cbBounds.width);
				//let cbScaleV = (boBounds.height - 2 * boMargin) / cbBounds.height;
				let cbScaleH = (gaBounds.right - boBounds.right - 2 * margin) / cbBounds.width;
				let cbScaleV = (gaBounds.height - 2 * margin) / cbBounds.height;
				let cbScale = Math.min(cbScaleH, cbScaleV);
				setTransform(cbEl, {scale: cbScale});
				cbBounds = bounds(cbEl);
				let coTopMin = gaBounds.top + margin,
						coTopMax = gaBounds.bottom - cbBounds.height - margin,
						coTopVal = boBounds.bottom - cbBounds.height - margin,
						coTop = Math.round(Math.max(coTopMin, Math.min(coTopMax, coTopVal)));
				Object.assign(coEl.style, {
					left: `${Math.round(boBounds.right + margin)}px`,
					//top: `${Math.round(boBounds.bottom - cbBounds.height - boMargin)}px`,
					//top: `${Math.round(Math.max(gaBounds.top + margin, boBounds.top))}px`,
					top: `${coTop}px`,
					width: `${Math.round(cbBounds.width)}px`,
				});
				Object.assign(cbEl.style, {
					//left: `${Math.round(boBounds.right + boMargin)}px`,
					left: `${Math.round(boBounds.right + margin)}px`,
					//top: `${Math.round(Math.max(gaBounds.top + margin, boBounds.top))}px`,
					top: `${coTop}px`,
				});
				Object.assign(ciEl.style, {
					//left: `${margin}px`,
					//top: `${Math.round(boBounds.top + margin)}px`,
					//width: `${Math.round(boBounds.left - margin - boMargin)}px`,
					//'max-height': `${Math.round(gaBounds.height - boBounds.top - 2 * margin)}px`,
					left: `0px`,
					top: `${Math.round(gaBounds.top)}px`,
					width: `${Math.round(boBounds.left - boMargin)}px`,
					height: `${Math.round(gaBounds.height)}px`,
				});
				Object.assign(ciEl.querySelector('.puzzle-rules').style, {
					//'max-height': `${Math.round(gaBounds.height - boBounds.top - 2 * margin)}px`,
					'max-height': 'none',
					height: `${Math.round(gaBounds.height)}px`,
				});
			};
			if(this.getOrientation() === 'landscape') {
				centerBoard();
				alignControls();
			}
			else {
				//TODO: Fix portrait layout'
				centerBoard();
				alignControls();
			}
			this.execLayoutHandler('handleResize');
		};
		P.refreshLayout = async function() {
			const {app} = Framework;
			app.off('resize', this.handleResize);
			app.on('resize', this.handleResize);
			app.resize();
		};
		P.updateTitle = async function() {
			const {app, app: {currentPuzzle: {title, author}}} = Framework;
			const tbEl = document.querySelector('.topbar');
			tbEl.querySelector('.game-clock').insertAdjacentHTML('beforebegin',
				`<div class="topbar-header"><span class="topbar-title">${title}</span> <span class="topbar-author">by ${author}</span></div>`
			);
		};
	// API Handlers
		P.msgInit = async function(data) {
			this.postMessage({type: 'result', data});
		};
		P.msgLoadpuzzle = async function(data) {
			const {fetchPuzzle, parsePuzzleData, resolvePuzzleData} = PuzzleLoader,
						{app, app: {puzzle}} = Framework;
			this.loadPuzzleId = data.shortid;
			puzzle.puzzleId = undefined;
			await app.loadCTCPuzzle(await resolvePuzzleData(data.shortid));
			this.postMessage({type: 'result', data});
		};
		P.msgRestartpuzzle = async function(data) {
			const {app} = Framework;
			await app.restartPuzzle();
			this.postMessage({type: 'result', data});
		};
		P.msgCreatethumbnail = async function(data) {
			this.postMessage({type: 'result', data, result: await this.createThumb(data)});
		};
		P.msgSetdigit = async function(data) {
			const {app, app: {puzzle, puzzle: {grid}}} = Framework;
			let [r, c, v] = Puzzle.parseRCVal(data.rcv);
			let selCells = [...puzzle.selectedCells];
			app.deselect();
			app.select(grid.getCell(r, c));
			app.doPressDigit(v);
			app.deselect();
			app.select(selCells);
			this.postMessage({type: 'result', data});
		};
		P.msgPuzzlestatus = async function(data) {
			const {app, app: {puzzle, timer}} = Framework;
			this.postMessage({type: 'result', data, result: {
				completed: puzzle.isCompleted(),
				errorsVisible: puzzle.errorsVisible,
				paused: !timer.running,
				replay: app.getReplay(),
			}});
		};
		P.msgPause = async function(data) {
			const {app: {timer}} = Framework;
			timer.stop();
			this.postMessage({type: 'result', data, result: {paused: !timer.running}});
		};
		P.msgUnpause = async function(data) {
			const {app: {timer}} = Framework;
			timer.resume();
			this.postMessage({type: 'result', data, result: {paused: !timer.running}});
		};
		P.msgShowpausedialog = async function(data) {
			const {app: {timer}} = Framework;
			timer.showPauseDialog(true);
			this.postMessage({type: 'result', data});
		};
		P.msgClosedialog = async function(data) {
			Framework.closeDialog();
			this.postMessage({type: 'result', data});
		};
	// Messaging
		P.postMessage = async function(msg) {
			window.parent.postMessage(msg, '*'); 
		};
		P.getEventListeners = function() {
			return this.eventListeners = this.eventListeners ?? {};
		};
		P.getEventTarget = function(target) {
			const {app, app: {puzzle}} = Framework,
						targetMap = {
							app: app,
							puzzle: puzzle,
						};
			return targetMap[target];
		};
		P.unlistenEvent = function(listenerId) {
			const eventListeners = this.getEventListeners();
			Object.keys(eventListeners)
				.filter(key => key.startsWith(listenerId ?? ''))
				.forEach(listenerId => {
					let [target, name] = listenerId.split(':');
					this.getEventTarget(target).off(name, eventListeners[listenerId]);
					delete eventListeners[listenerId];
				});
		};
		P.listenEvent = function({target, name}) {
			console.warn('FeatureProject9x9.listenEvent(target, name);', target, name);
			const eventListeners = this.getEventListeners(),
						listenerId = `${target}:${name}`,
						targetObj = this.getEventTarget(target);
			if(targetObj === undefined) throw new Error(`Invalid listen target: ${JSON.stringify(target)}`);
			this.unlistenEvent(listenerId);
			const handler = args => {
				console.warn('  listenEvent > handler;', target, name, args);
				this.postMessage({type: 'event', name, args});
			};
			eventListeners[listenerId] = handler;
			targetObj.on(name, handler);
		};
		P.handleDialogNoErrors = function() {
			console.warn('FeatureProject9x9.handleDialogNoErrors();');
			const {app, app: {puzzle}} = Framework;
			this.postMessage({type: 'event', name: 'completed', replay: app.getReplay()});
		};
		P.beginMessaging = async function(args) {
			console.info('FeatureProject9x9.beginMessaging(args);', args);
			const {app, app: {puzzle}} = Framework;
			app.on('dialognoerrors', this.handleDialogNoErrors);
		};
		P.createThumb = async function(data) {
			//console.info('FeatureProject9x9.createThumb(data);', data);
			const {svgToDataUri, puzzleToSvg, urlToImg, imgToCanvas, imgUriToBlob, blobToBlobUrl, svgToDataUriBase64} = PuzzleTools,
						{features: {screenshot}, app} = Framework;
			Object.assign(screenshot.options, data.options);
			document.body.insertAdjacentHTML('beforeEnd',`
				<img id="screenshot_preview" style="display: block; position: absolute; left: 0; top: 0;width:200px;height:200px;">
			`);
			delete screenshot.__lastOptions;
			await screenshot.updateScreenshot();
			let previewImg = resolveSelector('#screenshot_preview')[0];
			let blob = await imgUriToBlob(previewImg.src);
			let ext = blob.type.match(/^image\/(svg|png)/)[1];
			previewImg.remove();
			return blob;
		};
		P.handleMessage = async function(event) {
			if(event.origin === document.location.origin) return;
			const {app, app: {puzzle, timer}} = Framework,
						{data} = event;
			try {
				switch(data?.action) {
					// testing
					case 'listen': this.listenEvent(data); break;
					case 'unlisten': this.unlistenEvent(data.target); break;
					// API
					case 'init': await this.msgInit(data); break;
					case 'loadpuzzle': await this.msgLoadpuzzle(data); break;
					case 'restartpuzzle': await this.msgRestartpuzzle(data); break;
					case 'createthumbnail': await this.msgCreatethumbnail(data); break;
					case 'setdigit': await this.msgSetdigit(data); break;
					case 'puzzlestatus': await this.msgPuzzlestatus(data); break;
					case 'pause': await this.msgPause(data); break;
					case 'unpause': await this.msgUnpause(data); break;
					case 'showpausedialog': await this.msgShowpausedialog(data); break;
					case 'closedialog': await this.msgClosedialog(data); break;
					default:
						console.error('Invalid data:', data);
						this.postMessage({type: 'error', data, error: new Error('Invalid request')});
				}
			}
			catch(err) {
				console.error('FeatureProject9x9.handleMessage > Error handling message:', data, err);
				this.postMessage({type: 'error', data, error: err});
			}
		};
		P.initMessaging = async function() {
			const {app, app: {puzzle}} = Framework;
			window.addEventListener('message', this.handleMessage, false);
			this.postMessage({type: 'event', name: 'ready'});
			puzzle.on('loaded', () => {
				this.postMessage({type: 'event', name: 'loaded', shortid: this.loadPuzzleId});
			});
		};
	// Feature
		P.handleLoaded = async function() {
			const {app, app: {puzzle}} = Framework;
			puzzle.off('loaded', this.handleLoaded);
			await this.updateTitle();
			app.resize();
			app.refreshControls(true);
		};
		P.clearLayout = function() {
			document.body.classList.remove(C.LayoutClassName, ...Object.keys(C.Layouts));
			delete this.currentLayout;
		};
		P.loadLayout = async function(layoutName) {
			//console.info('FeatureProject9x9.loadLayout("%s");', layoutName);
			const {app, app: {puzzle}} = Framework;
			if(!this.isValidLayout(layoutName)) return;
			this.clearLayout();
			this.currentLayout = layoutName;
			//console.info('loadLayout > currentLayout:', this.currentLayout);
			const {
							stylesheet = C.DefaultStylesheet,
							settings: layoutSettings,
							controls = [],
							tools = [],
							removeControls = [],
						} = C.Layouts[layoutName],
						settings = Object.assign({}, C.DefaultSettings, layoutSettings);
			document.body.classList.add(C.LayoutClassName, layoutName);
			this.layoutStylesheet = await attachStylesheet(stylesheet);
			await this.setSettings(settings);
			await this.initMenu(); // What does this do?
			await this.setControls(controls, false);
			await this.setTools(tools, false);
			for(const name of removeControls) Framework.removeControlButton(name);
			app.refreshControls(true);
			await this.setSettings(settings); // Why again? Layout?
			await this.execLayoutHandler('handleInit');
			await this.refreshLayout(); // Just resize/refresh
			if(app.currentPuzzle !== undefined) {
				this.handleLoaded();
			}
			else {
				puzzle.on('loaded', this.handleLoaded);
			}
		};
		P.attachElem = function() {
			if(this.featureEnabled) return;
			this.featureEnabled = true;
		};
		P.detachElem = function() {
			if(!this.featureEnabled) return;
			this.featureEnabled = false;
		};
		P.handleSettingChange = async function() {
			const setting = Framework.getSetting(C.SettingName);
			setting ? this.attachElem() : this.detachElem();
		};
		P.handleEarlyInit = async function() {
			const layoutName = this.getParamLayout();
			if(this.isValidLayout(layoutName)) {
				Framework.LocalDataPrefix = layoutName;
			}
		};
		P.handleInit = async function() {
			await this.loadLayout(this.getParamLayout());
			await this.initMessaging();
		};
	
	return C;
})();

FeatureProject9x9.create();