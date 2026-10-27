/*
TODO:
	- Don't select same "special" hint several times in a row
	- Choose hint types proportionally, special hints less frequently
	- Add [X] close button in top right
	- Add [abort/skip] button
*/

const FeatureAiAssistant = (() => {
	function pickRandom(arr) {
		return arr[Math.floor(Math.random() * arr.length)];
	}
	
	
	function FeatureAiAssistant() {
		bindHandlers(this);
		PortableEvents.mixin(this);
	}
	const C = FeatureAiAssistant, P = Object.assign(C.prototype, {constructor: C});
	C.Name = 'aiassistant';
	C.SettingName = C.Name;
	C.iconAiSparkle = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="24" height="24" fill="currentColor"><path d="M27 13v-1c1-4 1-4 5-5V6c-4 0-4 0-5-4V1l-1 1c-1 4 0 4-5 4v1c5 1 4 1 5 5l1 1ZM15 29l1-1c1-6 1-6 8-7v-2c-7-1-7-1-8-7l-1-1v1c-1 6-2 6-8 7l-1 1 1 1c7 1 7 1 8 7v1Zm16 26 1-1c2-13 4-15 17-17l1-1-1-1c-13-1-15-3-17-16l-1-1-1 1c-2 13-3 15-16 16l-1 1 1 1c13 2 14 4 16 17l1 1Z"/></svg>`;
	C.featureStyle = `
		#aiass_ui {
			position: absolute;
			top: 0px;
			width: 80%;
			margin: 0 10%;
			padding: 0.5rem 1rem;
			background: rgba(32, 32, 32, 0.8);
			border: 0.2rem solid rgba(0, 0, 0, 0.8);
			border-bottom-left-radius: 1.5rem;
			border-bottom-right-radius: 1.5rem;
			z-index: 1000;
			color: #fff;
		}
		#aiass_ui .aiicon {
			position: absolute;
			top: 0.1rem; left: 0.1rem;
		}
		button#closeassistant {
			position: absolute;
			top: 0; right: 0;
			background-color: rgba(255, 255, 255, 0);
			color: rgba(255, 255, 255);
		}
		button#closeassistant:hover {
			background-color: rgba(255, 255, 255, 0.2);
		}
		#aiass_ui .chatlog {
			min-height: 2rem;
			border: 1px solid #fff;
			border-radius: 0.5rem;
			padding: 0.5rem;
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}
		#aiass_ui .chatlog p {
			margin: 0;
		}
		#aiass_ui button {
			line-height: 1.5rem;
			height: 1.5rem;
			font-size: 1rem;
			margin: 0 0.5rem 0 0;
		} 
		#aiass_ui button svg { height: 80%; }
		.assistantfeedback .feedbackoptions {
			width: max-content;
			margin: 0 auto;
			padding: 0;
			list-style: none;
		}
		.assistantfeedback .feedbackoptions label input {
			display: inline-block;
			width: auto;
		}
		.assistantfeedback .dialog-options {
			flex-direction: row;
			flex-wrap: wrap;
			margin: 0 1rem;
		}
		.assistantfeedback .dialog .dialog-options button {
			flex: 1 1 auto;
			min-width: 0;
			font-size: 0.9em;
		}
		.assistantfeedback .dialog .dialog-options button.skipbtn {
			opacity: 1;
			filter: saturate(0.2);
		}
		.assistantfeedback .dialog .dialog-options button.submitbtn {
		}
		.assistantfeedback .dialog .dialog-options button.submitbtn:disabled {
			opacity: 0.5;
			filter: saturate(1);
		}
	`;
	C.aitext = {
		fails: [
			`Uh, oh... that's not right at all!`,
			`Hmm, this is much tougher than I expected.`,
		],
		neutral: [
			`Here, I hope this helps you onward!`
		],
		color: [
			`Uhhh, pretty color!`
		],
	};
	// API
		C.create = async function() {
			const feature = new C();
			Framework.withApp(() => feature.addFeature());
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
	// Assistant Dialogs
		P.handleShowIntroDialog = function() {
			const handleButton = button => {
				if(button.startsWith('Yes')) this.attachElem();
			};
			Framework.closeDialog();
			Framework.showDialog({
				parts: [
					{tag: 'title', innerHTML: 'SudokuPad\'s "✨AI Assistant✨"', style: 'text-align: center'},
					{innerHTML: `
						<p>I'm happy you have chosen ME, ✨🤖✨, to help you out today!</p>
						<p>This is an exclusive preview, only available TODAY, April <span id="firstfools">First</span></p>
						<p><em>⚠️WARNING⚠️ This AI assistant may spoil parts of the puzzle.</em></p>
						<p>Let's have some fun!</p>`
					},
					{tag: 'options', options: [
						'Yes, try April Intelligence Assistant',
						'No, perhaps later'
						]},
				],
				onButton: handleButton,
				centerOverBoard: true
			});
		};
		P.showFeedbackDialog = function() {
			const feedbackOptions = [
				'😡 No, please NO!',
				'🥱 Ha-ha, funny...',
				'😍 Serious potential!',
			];
			const getFeedback = () => document.body.querySelector('.assistantfeedback input[name="feedback"]:checked')?.value;
			function handleFeedbackChange(event) {
				const submitBtnEl = document.body.querySelector('.assistantfeedback .dialog-options .submitbtn');
				submitBtnEl.disabled = false;
				submitBtnEl.textContent = `Submit: ${feedbackOptions[getFeedback() - 1]}`;
			}
			function handleFeedbackSubmit(button) {
				if(button.startsWith('Submit')) {
					const msg = feedbackOptions[getFeedback() - 1];
					Framework.track('feedback', {msg});
				}
			}
			Framework.closeDialog();
			Framework.showDialog({
				parts: [
					{tag: 'title', innerHTML: '✨🤖✨ values your feedback', style: 'text-align: center'},
					{tag: 'text', content: 'Happy April 1st! What did you think?', style: 'text-align: center'},
					{innerHTML: `
						<ul class="feedbackoptions">${
							feedbackOptions.map((val, idx) => 
								`<li><label><input type="radio" name="feedback" value="${idx + 1}"> ${val}</label></li>`
							).join('\n')
						}</ul>
						`
					},
					{tag: 'options', options: [
						{content: 'Skip', class: 'skipbtn'},
						{content: 'Select Feedback', class: 'submitbtn', disabled: true},
					]},
				],
				overlayClass: 'assistantfeedback',
				onButton: handleFeedbackSubmit,
				centerOverBoard: true
			});
			document.body.querySelector('.assistantfeedback').addEventListener('change', handleFeedbackChange);
		};
	// Chatlog
		P.getText = function() {
			const choices = C.aitext.fails;
			console.log('  choices:', choices);
			let choice = choices[Math.floor(Math.random() * choices.length)];
			console.log('  choice:', choice);
			return choice;
		};
		P.clearLog = function() {
			const logEl = document.body.querySelector('#aiass_ui .chatlog');
			logEl.innerHTML = '';
		};
		P.writeLog = function(text) {
			const logEl = document.body.querySelector('#aiass_ui .chatlog');
			logEl.insertAdjacentHTML('beforeend', `<p>${text}</p>`);
		};
		P.addLogButton = async function({label, handler, text}) {
			this.writeLog(`<button>${label}</button>${text ?? ''}`);
			addDownEventHandler('#aiass_ui .chatlog > :last-child > button', handler.bind(this));
		};
	// Hint Helpers
		P.clearTool = function() {
			const {app, app: {puzzle}} = Framework;
			const colorCells = puzzle.cells.filter(cell => cell.hasProp(app.tool));
			if(colorCells.length > 0) {
				app.deselect();
				app.select(colorCells);
				app.act({type: 'clear', arg: app.tool});
				return true;
			}
			return false;
		};
		P.undoActions = function(undoSteps) {
			const {app} = Framework;
			app.deselect();
			app.changeTool();
			for(let i = 0; i < undoSteps; i++) app.undoOnce();
		};
		P.abortHintAction = async function(msg) {
			this.writeLog(msg ?? '🥺 I\'m sorry, I can\'t think of anything either!');
			await sleep(700)();
		};
	// Hint Actions
		P.hintActionPRing = async function() {
			// pre-conditions: check for 9x9
			const {app, app: {puzzle}} = Framework;
			//console.log('cells:', puzzle.cells);
			//console.log('selectedCells:', puzzle.selectedCells);
			const filterRing = ({row, col}) => 
					(col >= 2 && col <= 6 && (row === 2 || row === 6))
					|| (row >= 2 && row <= 6 && (col === 2 || col === 6));
			const filterCorners = ({row, col}) => 
					(col <= 1 && row <= 1)
					|| (col >= 7 && row <= 1)
					|| (col >= 7 && row >= 7)
					|| (col <= 1 && row >= 7);
			
			this.undoSteps += 3;
			
			app.changeTool('colour', true);
			
			this.writeLog('🥸 Let me show you something amazing with some coloring:');

			if(this.clearTool()) this.undoSteps++;

			await sleep(500)();
			this.writeLog('1. Believe it or not, but the blue digits...');

			app.deselect();
			app.select(puzzle.cells.filter(filterRing));
			await sleep(300)();
			app.doPressDigit(9);
			
			await sleep(500)();
			this.writeLog('2. Are the same in the red digits!');

			app.deselect();
			app.select(puzzle.cells.filter(filterCorners));
			await sleep(300)();
			app.doPressDigit(7);
			
			await sleep(1000)();
			this.writeLog('3. Amazing, isn\'t it? Let\'s put everything back...');
			await sleep(2000)();
		};
		P.hintActionCheckerboard = async function() {
			const {app, app: {puzzle}} = Framework;
			this.writeLog('🧐 Hmm... Let me try something.');
			await sleep(500)();
			
			app.changeTool('colour', true);
			if(this.clearTool()) this.undoSteps++;
			let cells = [...puzzle.cells];
			while(cells.length > 0) {
				const idx = Math.floor(Math.random() * cells.length);
				const cell = cells[idx];
				//console.log('idx:', idx, cells.length, cell);
				cells[idx] = cells[cells.length - 1];
				cells.length--;
				await sleep(10)();
				if((cell.row + cell.col) % 2 === 1) {
					app.deselect();
					app.select(cell);
					app.doPressDigit(3);
					this.undoSteps++;
				}
			}
			await sleep(500)();
			this.writeLog('🏁 This is more like it! How about a game of checkers?');
			await sleep(2000)();
			this.writeLog('Ok, I\'m sorry, I really don\'t have a clue!');
		};
		P.hintActionDigit = async function() {
			const {app, app: {puzzle, currentPuzzle: {solution = ''}}} = Framework;
			const getCellIdx = cell => puzzle.cells.indexOf(cell);
			function getAllCellOptions() {
				const solver = createSolver(app.toP81());
				solver.updateCandidates();
				return puzzle.cells.map((cell, idx) => [cell, solver.puzzle729.slice(idx * 9, idx * 9 + 9).filter(val => val !== '.')]);
			}
			function getCellOptions(cell) {
				const solver = createSolver(app.toP81());
				solver.updateCandidates();
				const cellIdx = getCellIdx(cell);
				return solver.puzzle729.slice(cellIdx * 9, cellIdx * 9 + 9).filter(val => val !== '.');
			}
			this.writeLog('Let\'s make some progress.');
			/*
			const unsolvedCells = [],
						incorrectCells = [];
			puzzle.cells.forEach((cell, idx) => {
				if(cell.getVal() !== solution[idx]) {
					unsolvedCells.push(cell);
					if(cell.getVal() !== undefined) incorrectCells.push(cell);
				}
			});
			console.log('unsolvedCells:', unsolvedCells);
			console.log('incorrectCells:', incorrectCells);
			*/
			const allCellOptions = getAllCellOptions()
				.filter(([c, options]) => c.getVal() === undefined && options.length > 1)
				.sort((a, b) => b[1].length - a[1].length);
			if(allCellOptions.length === 0) return this.abortHintAction();
			const [pickedCell, cellOptions] = pickRandom(allCellOptions.slice(0, 5));

			await sleep(300)();
			this.writeLog('🤓 Hey, why not just take a guess?');
			app.deselect();
			app.select(pickedCell);
			await sleep(200)();
			
			// Flash random picks
			let optionPick;
			this.undoSteps++;
			for(let i = 2; i <= 8; i++) {
				//optionPick = pickRandom(cellOptions);
				optionPick = cellOptions[i % cellOptions.length];
				app.doPressDigit(optionPick);
				this.undoSteps++;
				await sleep(50*i)();
			}
			this.undoActions(this.undoSteps);
			this.undoSteps = 0;
			
			// Select final pick
			app.deselect();
			app.select(pickedCell);
			app.doPressDigit(optionPick);
			await sleep(200)();

			// Flash 3 times
			for(let i = 0; i < 3; i++) {
				app.undoOnce();
				await sleep(200)();
				app.redoOnce();
				await sleep(200)();
			}
			if(optionPick === solution[getCellIdx(pickedCell)]) {
				this.writeLog('😁 Wow, lucky guess!');
				Framework.features.streamtool.markCell(pickedCell);
			}
			else {
				this.writeLog('🥺 Hmm, bad guess...');
			}
		};
		C.HintActions = [
			{name: 'PhistomefelRing', action: P.hintActionPRing, weight: 1},
			{name: 'CheckerBoard', action: P.hintActionCheckerboard, weight: 3},
			{name: 'TryDigit', action: P.hintActionDigit, weight: 20},
		];
	// Handle Action
		P.handleOverlayClick = function (event) {
			event.stopPropagation();
		};
		P.handleBlockKeyboard = function(event) {
			event.preventDefault();
			event.stopImmediatePropagation();
		};
		P.preAction = async function(hintAction) {
			if(this.overlayElem) this.overlayElem.remove();
			this.overlayElem = Framework.createElem({
				className: 'dialog-overlay',
				style: 'background-color: transparent;'
			});
			addDownEventHandler(this.overlayElem, this.handleOverlayClick, {passive: false});
			document.body.appendChild(this.overlayElem);
			window.addEventListener('keydown', this.handleBlockKeyboard, {capture: true})
			this.clearLog();
			this.undoSteps = 0;
		};
		P.postAction = async function(hintAction) {
			this.undoActions(this.undoSteps);
			this.undoSteps = 0;
			this.addChatButton('nexthint');
			if(this.overlayElem) {
				window.removeEventListener('keydown', this.handleBlockKeyboard, {capture: true})
				removeDownEventHandler(this.overlayElem, this.handleOverlayClick, {passive: false});
				this.overlayElem.remove();
			}
		};
		P.execHintAction = async function(hintAction) {
			await this.preAction(hintAction);
			try {
				await hintAction.action.call(this);
			}
			catch(err) {
				console.error('Error in hint:', err, hintAction);
				this.writeLog('👉👈 Whoopsie daisies, I seem to have tripped...');
				await sleep(1000)();
			}
			await this.postAction(hintAction);
		};
		P.pickNextHint = function() {
			const hints = C.HintActions,
						{lastHint, hintStreak} = this,
						qFactor = 0.7,
						effectiveWeight = [];
			let totalWeight = 0;
			for(const hint of hints) {
				let weight = hint.weight;
				if(hint === lastHint) {
					weight *= Math.pow(qFactor, hintStreak);
				}
				effectiveWeight.push(weight);
				totalWeight += weight;
			}
			for(const idx in effectiveWeight) effectiveWeight[idx] /= totalWeight;
			let chosen = hints[hints.length - 1],
					r = Math.random();
			for(let i = 0; i < hints.length; i++) {
				r -= effectiveWeight[i];
				if(r <= 0) {
					chosen = hints[i];
					break;
				}
			}
			if(lastHint !== chosen) this.hintStreak = 0;
			this.lastHint = chosen;
			this.hintStreak++;
			return this.lastHint;
		};
		P.triggerHint = async function() {
			await this.execHintAction(this.pickNextHint());
		};
	// Buttons
		C.ChatButtons = {
			firsthint: {
				label: 'Hint',
				handler: P.triggerHint,
				text: '← Try this button here!'
			},
			nexthint: {
				label: 'Another Hint',
				handler: P.triggerHint,
				text: 'Let\'s try another hint!'
			},
			feedback: {
				label: 'Feedback',
				handler: P.showFeedbackDialog,
				text:' Test feedback form'
			},
		};
		P.addChatButton = function(name) {
			this.addLogButton(C.ChatButtons[name]);
		};
	// UI
		P.startAssistant = async function() {
			this.addChatButton('firsthint');
		};
		P.closeAssistant = async function() {
			this.detachElem();
			this.showFeedbackDialog();
		};
		P.createAIAButton = function() {
			Framework.addAuxButton({
				name: 'aiass', title: 'AI Ass.',
				content: `<div class="icon">${C.iconAiSparkle}</div>✨`,
			});
			addDownEventHandler('#control-aiass', this.handleShowIntroDialog);
		};
		P.removeAIAButton = function() {
			Framework.removeControlButton('aiass');
		};
		P.handleClose = function() {
			this.closeAssistant();
		};
		P.createGui = function() {
			const guiEl = `
				<div id="aiass_ui">
					<div class="aiicon">${C.iconAiSparkle}</div>
					<button id="closeassistant">✕</button>
					<div class="chatlog"></div>
				</div>
			`;
			document.body.insertAdjacentHTML('beforeend', guiEl);
			this.guiEl = document.body.lastElementChild;
			addDownEventHandler('button#closeassistant', this.handleClose);
		};
	// Feature
		P.attachElem = function() {
			if(this.featureEnabled) return;
			this.featureEnabled = true;
			this.createGui();
			this.startAssistant();
		};
		P.detachElem = function() {
			if(!this.featureEnabled) return;
			this.featureEnabled = false;
			if(this.guiEl) {
				this.guiEl.remove();
				delete this.guiEl;
			}
		};
		P.handleInit = async function() {
			const hiddenSettingName = `hide-${C.SettingName}`,
						isHidden = Framework.getSetting(hiddenSettingName) === true,
						isInDateRange = /^2026-04-0[1-2]/.test((new Date()).toISOString());
			if(isInDateRange && !isHidden) {
				this.createAIAButton();
				const handleHideSettingChange = (val, prev) => {
					if(val) this.removeAIAButton();
					else this.createAIAButton();
				}
				Framework.addSetting({
					group: 'experimental', name: hiddenSettingName, content: 'Hide AI Ass. button',
					tag: 'toggle',
					onToggle: handleHideSettingChange,
				});
			}
			else {
				Framework.addSetting({
					group: 'experimental', name: C.SettingName, content: 'Try AI Ass.',
					tag: 'button',
					handler: this.handleShowIntroDialog,
				});
			}
		};
	
	return C;
})();

FeatureAiAssistant.create();