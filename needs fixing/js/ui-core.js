// ===================================================================================
//  UI-CORE.JS
//  Manages core UI state, element references, layout, sounds, and the log box.
// ===================================================================================

// --- Element Refs ---
const statusElement = $('#game-status');
const openingNameElement = $('#opening-name');
const themeSelector = $('#theme-selector');
const pieceThemeSelector = $('#piece-theme-selector');
const uiThemeSelector = $('#ui-theme-selector');
const capturedByWhiteElement = $('#captured-by-white');
const capturedByBlackElement = $('#captured-by-black');
const restartButton = $('#restart-button');
const swapSidesButton = $('#swap-sides-button');
const undoButton = $('#undo-button');
const playerNameElement = $('#player-name');
const bottomPlayerNameElement = $('#bottom-player-name');
const topPlayerNameElement = $('#top-player-name');
const whiteAdvantageElement = $('#white-advantage');
const blackAdvantageElement = $('#black-advantage');
const moveHistoryLog = $('#move-history-log');
const evalBarWhite = $('#eval-bar-white');
const evalBarBlack = $('#eval-bar-black');
const difficultySlider = $('#difficulty-slider');
const eloDisplay = $('#elo-display');
const soundToggle = $('#sound-toggle');
const soundIcon = $('#sound-icon');
const historyFirstBtn = $('#history-first');
const historyPrevBtn = $('#history-prev');
const historyNextBtn = $('#history-next');
const historyLastBtn = $('#history-last');
const runAnalysisBtn = $('#run-review-btn');
const mainGameView = $('#main-game');
const analysisRoomView = $('#analysis-room');
const returnToGameBtn = $('#return-to-game-btn');
const logBoxToggle = $('#log-box-toggle');
const logBoxContainer = $('#log-box-container');
const logBoxHeader = $('#log-box-header');
const logBoxContent = $('#log-box-content');
const logBoxClearBtn = $('#log-box-clear');
const logBoxCloseBtn = $('#log-box-close');
const logBoxResizeHandle = $('#log-box-resize-handle');
const hintButton = $('#hint-button');
const threatsToggle = $('#threats-toggle');
const fenInput = $('#fen-input');
const loadFenBtn = $('#load-fen-btn');
const exportPgnBtn = $('#export-pgn-btn');
const openingExplorer = $('#opening-explorer');
const openingExplorerContent = $('#opening-explorer-content');
const focusModeToggle = $('#focus-mode-toggle');
const analysisVisualizer = $('#analysis-visualizer');
const visualizerCancelBtn = $('#visualizer-cancel-btn');
const gameSummarySection = $('#game-summary-section');
const liveGameView = $('#live-game-view');
const summaryAccuracy = $('#summary-accuracy');
const logShortcutBtn = $('#log-shortcut-btn');
const showShortcutsBtn = $('#show-shortcuts-btn');
const topClockElement = $('#top-clock');
const bottomClockElement = $('#bottom-clock');
const timeControlSelector = $('#time-control-selector');
const showTimeControlModalToggle = $('#show-time-control-modal-toggle');


// --- UI State ---
let sounds = {};
let isMuted = false;
let playerName = 'Player';
let highlightThreats = false;
let analysisStockfish = null; 
let showModalOnRestart = true;

// --- Layout and View Functions ---

function showTab(tabId) {
    $('.tab-content').removeClass('active');
    $('.tab-button').removeClass('active');
    $(`#${tabId}-tab`).addClass('active');
    $(`[data-tab="${tabId}"]`).addClass('active');
}

function showLiveGameView() {
    liveGameView.removeClass('hidden');
    gameSummarySection.addClass('hidden');
}

function showGameOverView() {
    liveGameView.addClass('hidden');
    gameSummarySection.removeClass('hidden');
    runAnalysisBtn.prop('disabled', game.history().length === 0);
}

function applyAnalysisLayout() {
    if (window.innerWidth < 1024) {
        $('#analysis-room').css({ display: 'flex', flexDirection: 'column' });
        return;
    };

    $('#analysis-room').css({
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch'
    });
    $('#analysis-room > div:first-child').css({
        flex: '1 1 auto'
    });
    $('#analysis-room > aside').css({
        flex: '0 0 320px'
    });
}

function switchToMainGame() {
    isAnalysisMode = false;
    analysisRoomView.addClass('hidden');
    mainGameView.removeClass('hidden');
    analysisVisualizer.addClass('hidden'); 
    
    if (window.AnalysisController && typeof window.AnalysisController.stop === 'function') {
        window.AnalysisController.stop();
    }
    
    if (window.loadFenOnReturn) {
        initGameFromFen(window.loadFenOnReturn);
        delete window.loadFenOnReturn;
    }
}

window.switchToAnalysisRoom = function() {
    isAnalysisMode = true;
    mainGameView.addClass('hidden');
    analysisVisualizer.addClass('hidden');
    analysisRoomView.removeClass('hidden');
    
    applyAnalysisLayout();
};

function applyUiTheme(themeName) {
    const theme = UI_THEMES.find(t => t.name === themeName);
    if (!theme) { console.error(`UI Theme "${themeName}" not found.`); return; }
    for (const [key, value] of Object.entries(theme.colors)) {
        document.documentElement.style.setProperty(key, value);
    }
}

// --- Sound Functions ---

function initSounds() {
    Object.keys(SOUND_PATHS).forEach(key => {
        sounds[key] = new Howl({ src: [SOUND_PATHS[key]] });
    });
}

window.playSound = function(soundName) {
    if (isMuted) return;
    if (sounds[soundName]) sounds[soundName].play();
}

function playMoveSound(move) {
    if (move.flags.includes('p')) window.playSound('promote');
    else if (move.flags.includes('k') || move.flags.includes('q')) window.playSound('castle');
    else if (move.flags.includes('c')) window.playSound('capture');
    else window.playSound('moveSelf');
    if (game.in_check()) window.playSound('check');
}

// --- Log Box Functions ---

function initLogBox() {
    const originalConsole = { log: console.log, error: console.error, warn: console.warn };
    
    const logToBox = (message, type) => {
        if (logBoxContainer.is(':hidden')) return;
        
        let content = '';
        const timestamp = `<span class="text-gray-500">${new Date().toLocaleTimeString()}:</span>`;
        let logClass = type;
        let prefix = '';
        let body = '';

        if (typeof message === 'object' && message !== null && message.logType) {
            logClass = `log-${message.logType}`;
            prefix = `<span class="log-prefix">[${message.logType.toUpperCase().replace('_', ' ')}]</span>`;

            switch (message.logType) {
                case 'analysis':
                    const info = CLASSIFICATION_DATA[message.classification] || {};
                    let detail = message.deep ? '(Deep)' : '';
                    if (message.hasOwnProperty('evalBefore')) {
                        detail += ` Eval: ${message.evalBefore} → ${message.evalAfter}`;
                    }
                    body = `Move <b>${message.move}</b> | CPL: ${message.cpl.toFixed(0)} | Class: <b class="${info.color || ''}">${message.classification}</b> ${detail}`;
                    break;
                case 'engine_move':
                    body = `Best move: <b>${message.move}</b> | Eval: ${message.eval}`;
                    break;
                case 'info':
                    body = message.text;
                    break;
                default:
                    body = JSON.stringify(message);
            }
            content = `${timestamp} ${prefix} ${body}`;
        } else {
            let formattedMessage = '';
            try {
                formattedMessage = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
            } catch (e) { formattedMessage = '[[Unserializable Object]]'; }
            content = `${timestamp} ${formattedMessage}`;
        }
        
        logBoxContent.append(`<div class="log-message ${logClass}">${content}</div>`);
        logBoxContent.scrollTop(logBoxContent[0].scrollHeight);
    };

    console.log = function() { originalConsole.log.apply(console, arguments); logToBox(arguments[0], 'log-info'); };
    console.error = function() { originalConsole.error.apply(console, arguments); logToBox(arguments[0], 'log-error'); };
    console.warn = function() { originalConsole.warn.apply(console, arguments); logToBox(arguments[0], 'log-warn'); };
    
    logBoxToggle.on('change', function() { logBoxContainer.toggleClass('hidden', !this.checked); if (this.checked) console.log({ logType: 'info', text: 'Debug log opened.' }); });
    logBoxClearBtn.on('click', () => { console.log({ logType: 'info', text: 'Log cleared.' }); logBoxContent.empty(); });
    logBoxCloseBtn.on('click', () => logBoxToggle.prop('checked', false).trigger('change'));
    
    let isDragging = false, offset = { x: 0, y: 0 };
    let isResizing = false;

    logBoxHeader.on('mousedown', function(e) {
        if ($(e.target).is('button') || $(e.target).parent().is('button')) return;
        isDragging = true;
        let containerOffset = logBoxContainer.offset();
        offset.x = e.clientX - containerOffset.left;
        offset.y = e.clientY - containerOffset.top;
    });

    logBoxResizeHandle.on('mousedown', function(e) {
        e.preventDefault();
        isResizing = true;
    });

    $(document).on('mousemove', function(e) {
        if (isDragging) {
            logBoxContainer.css({ top: e.clientY - offset.y, left: e.clientX - offset.x });
        }
        if (isResizing) {
            const containerOffset = logBoxContainer.offset();
            const newWidth = e.clientX - containerOffset.left;
            const newHeight = e.clientY - containerOffset.top;
            logBoxContainer.css({ width: `${newWidth}px`, height: `${newHeight}px` });
        }
    });

    $(document).on('mouseup', () => {
        isDragging = false;
        isResizing = false;
    });
}