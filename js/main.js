// ===================================================================================
//  MAIN.JS
//  Initializes the application, sets up all event listeners, and loads the engine.
// ===================================================================================

/**
 * Creates a Stockfish worker and returns a promise that resolves only when the 
 * engine is fully initialized and ready. This prevents race conditions on startup.
 * @param {string} engineUrl - The URL of the stockfish.js script.
 * @returns {Promise<Worker>} A promise that resolves with the ready worker instance.
 */
function createEngineWorker(engineUrl) {
    return new Promise((resolve, reject) => {
        const loaderScript = `self.onmessage = (e) => { importScripts(e.data); };`;
        const workerBlob = new Blob([loaderScript], { type: "application/javascript" });
        const workerUrl = URL.createObjectURL(workerBlob);

        const worker = new Worker(workerUrl);
        const timeout = setTimeout(() => {
            worker.terminate();
            reject(new Error('Engine took too long to load.'));
        }, 10000); // 10-second timeout

        worker.onerror = (error) => {
            clearTimeout(timeout);
            reject(new Error('An error occurred in the engine worker.'));
        };

        worker.onmessage = (event) => {
            if (event.data === 'uciok') {
                worker.postMessage('isready');
            }
            if (event.data === 'readyok') {
                clearTimeout(timeout);
                worker.onmessage = null; 
                resolve(worker);
            }
        };
        
        worker.postMessage(engineUrl);
    });
}

async function initApp() {
    // --- Initialize Modules ---
    initSounds();
    initLogBox();
    
    // --- Cache jQuery Element References ---
    const themeSelector = $('#theme-selector');
    const pieceThemeSelector = $('#piece-theme-selector');
    const uiThemeSelector = $('#ui-theme-selector');
    const restartButton = $('#restart-button');
    const swapSidesButton = $('#swap-sides-button');
    const undoButton = $('#undo-button');
    const playerNameElement = $('#player-name');
    const difficultySlider = $('#difficulty-slider');
    const eloDisplay = $('#elo-display');
    const soundToggle = $('#sound-toggle');
    const soundIcon = $('#sound-icon');
    const historyFirstBtn = $('#history-first');
    const historyPrevBtn = $('#history-prev');
    const historyNextBtn = $('#history-next');
    const historyLastBtn = $('#history-last');
    const runAnalysisBtn = $('#run-review-btn');
    const returnToGameBtn = $('#return-to-game-btn');
    const logBoxToggle = $('#log-box-toggle');
    const logBoxClearBtn = $('#log-box-clear');
    const logBoxCloseBtn = $('#log-box-close');
    const hintButton = $('#hint-button');
    const threatsToggle = $('#threats-toggle');
    const fenInput = $('#fen-input');
    const loadFenBtn = $('#load-fen-btn');
    const exportPgnBtn = $('#export-pgn-btn');
    const focusModeToggle = $('#focus-mode-toggle');
    const analysisVisualizer = $('#analysis-visualizer');
    const visualizerCancelBtn = $('#visualizer-cancel-btn');
    const logShortcutBtn = $('#log-shortcut-btn');
    const showShortcutsBtn = $('#show-shortcuts-btn');
    const timeControlSelector = $('#time-control-selector');
    const showTimeControlModalToggle = $('#show-time-control-modal-toggle');
    const boardElement = $('#board');

    // Also populate refs for ui.js
    statusElement = $('#game-status');
    openingNameElement = $('#opening-name');
    capturedByWhiteElement = $('#captured-by-white');
    capturedByBlackElement = $('#captured-by-black');
    bottomPlayerNameElement = $('#bottom-player-name');
    topPlayerNameElement = $('#top-player-name');
    whiteAdvantageElement = $('#white-advantage');
    blackAdvantageElement = $('#black-advantage');
    moveHistoryLog = $('#move-history-log');
    evalBarWhite = $('#eval-bar-white');
    evalBarBlack = $('#eval-bar-black');
    mainGameView = $('#main-game');
    analysisRoomView = $('#analysis-room');
    gameSummarySection = $('#game-summary-section');
    liveGameView = $('#live-game-view');
    summaryAccuracy = $('#summary-accuracy');
    topClockElement = $('#top-clock');
    bottomClockElement = $('#bottom-clock');
    openingExplorer = $('#opening-explorer');
    openingExplorerContent = $('#opening-explorer-content');

    // --- Event Listeners ---
    $('.tab-button').on('click', function() { showTab($(this).data('tab')); });
    
    restartButton.on('click', () => {
        console.log({ logType: 'info', text: 'New Game button clicked.' });
        if (showModalOnRestart) {
            showTimeControlModal();
        } else {
            const selectedKey = timeControlSelector.val();
            const tc = TIME_CONTROLS[selectedKey] || TIME_CONTROLS[APP_CONFIG.DEFAULT_TIME_CONTROL];
            startNewGameWithTime(tc.base, tc.inc);
        }
    });

    swapSidesButton.on('click', () => { 
        if (gameActive && game.history().length === 0) {
            [humanPlayer, aiPlayer] = [aiPlayer, humanPlayer];
            const key = timeControlSelector.val();
            const tc = TIME_CONTROLS[key] || TIME_CONTROLS[APP_CONFIG.DEFAULT_TIME_CONTROL];
            startNewGameWithTime(tc.base, tc.inc);
            console.log({ logType: 'info', text: `Sides swapped. Player is now ${humanPlayer === 'w' ? 'White' : 'Black'}.` });
        } else {
            Swal.fire('Oops!', 'Can only swap sides at the start of a new game.', 'info');
        }
    });
    
    showShortcutsBtn.on('click', showShortcutsModal);
    logShortcutBtn.on('click', () => logBoxToggle.click());

    undoButton.on('click', () => {
        if (undoButton.prop('disabled')) return;
        console.log({ logType: 'info', text: 'Undo button clicked.' });
        undoLastTurn();
    });
    
    historyFirstBtn.on('click', () => { if (!historyFirstBtn.prop('disabled')) { reviewMoveIndex = 0; showHistoryPosition(); } });
    historyPrevBtn.on('click', () => { if (!historyPrevBtn.prop('disabled')) { if (reviewMoveIndex === null) reviewMoveIndex = game.history().length - 1; if (reviewMoveIndex > 0) reviewMoveIndex--; showHistoryPosition(); } });
    historyNextBtn.on('click', () => { if (!historyNextBtn.prop('disabled')) { if (reviewMoveIndex < game.history().length - 1) reviewMoveIndex++; showHistoryPosition(); } });
    historyLastBtn.on('click', () => { exitReviewMode(); });
    moveHistoryLog.on('click', '.move-span', function() { 
        reviewMoveIndex = parseInt($(this).data('move-index'));
        showHistoryPosition(); 
    });
    
    returnToGameBtn.on('click', switchToMainGame);
    
    runAnalysisBtn.on('click', function() {
        if ($(this).prop('disabled')) return;
        analysisVisualizer.removeClass('hidden');
        
        window.gameDataToAnalyze = {
            pgn: game.pgn(),
            fen: currentStartingFen,
            stockfishPath: APP_CONFIG.STOCKFISH_URL
        };
        if (window.AnalysisController && typeof window.AnalysisController.init === 'function') {
            window.AnalysisController.init();
        }
    });
    
    visualizerCancelBtn.on('click', function() {
        if (window.AnalysisController && typeof window.AnalysisController.stop === 'function') {
            window.AnalysisController.stop();
        }
        analysisVisualizer.addClass('hidden');
    });

    hintButton.on('click', function() {
        if ($(this).prop('disabled')) return;
        let originalOnMessage = stockfish.onmessage;
        stockfish.postMessage(`position fen ${game.fen()}`);
        stockfish.postMessage('go movetime 1000');
        
        stockfish.onmessage = event => {
            const message = event.data;
            if (message.startsWith('bestmove')) {
                const move = message.split(' ')[1];
                const from = move.substring(0, 2);
                const to = move.substring(2, 4);
                
                const drawingOptions = { svgOverlay: $('#board-svg-overlay'), boardElement: boardElement, boardObject: board };
                drawArrow(from, to, 'rgba(255, 165, 0, 0.7)', drawingOptions);
                
                setTimeout(() => {
                    const drawingOptions = { svgOverlay: $('#board-svg-overlay'), boardElement: boardElement, boardObject: board };
                    redrawUserShapes(userShapes, drawingOptions);
                }, 3000);
                
                stockfish.onmessage = originalOnMessage;
            }
        };
    });

    loadFenBtn.on('click', () => {
        const fen = fenInput.val().trim();
        if (fen) {
            const key = timeControlSelector.val();
            const tc = TIME_CONTROLS[key] || TIME_CONTROLS['unlimited'];
            startNewGameWithTime(tc.base, tc.inc, fen);
        }
    });
    
    exportPgnBtn.on('click', function() {
         if ($(this).prop('disabled')) return;
         const pgn = game.pgn();
         const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
         const a = document.createElement('a');
         a.href = URL.createObjectURL(blob);
         a.download = `chess-game-${Date.now()}.pgn`;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
    });

    threatsToggle.on('change', function() {
        highlightThreats = $(this).is(':checked');
        localStorage.setItem('chessHighlightThreats', highlightThreats);
        updateThreatHighlights();
    });
    
    focusModeToggle.on('click', function() {
        $('body').toggleClass('focus-mode');
        localStorage.setItem('chessFocusMode', $('body').hasClass('focus-mode'));
        setTimeout(() => { if (board) board.resize(); }, 50);
    });

    // --- Settings Listeners ---
    themeSelector.on('change', () => { localStorage.setItem('chessBoardTheme', themeSelector.val()); buildBoard(game.fen()); });
    pieceThemeSelector.on('change', () => { localStorage.setItem('chessPieceTheme', pieceThemeSelector.val()); buildBoard(game.fen()); updateCapturedPieces()});
    difficultySlider.on('input', e => { aiDifficulty = parseInt(e.target.value, 10); eloDisplay.text(DIFFICULTY_SETTINGS[aiDifficulty]?.elo || 1200); });
    difficultySlider.on('change', () => { localStorage.setItem('chessDifficulty', aiDifficulty); });
    soundToggle.on('click', () => { isMuted = !isMuted; localStorage.setItem('chessSoundMuted', isMuted); soundIcon.attr('src', isMuted ? 'icon/speaker-x-mark.png' : 'icon/speaker-wave.png'); });
    playerNameElement.on('click', () => { Swal.fire({ title: 'Enter your name', input: 'text', inputValue: playerName, showCancelButton: true, confirmButtonText: 'Save', customClass: { popup: '!bg-stone-800', title: '!text-white', input: '!text-black' } }).then(r => { if (r.isConfirmed && r.value) { playerName = r.value.trim(); localStorage.setItem('chessPlayerName', playerName); playerNameElement.text(playerName); updatePlayerLabels(); } }); });
    showTimeControlModalToggle.on('change', function() { showModalOnRestart = $(this).is(':checked'); localStorage.setItem('chessShowModalOnRestart', showModalOnRestart); });
    timeControlSelector.on('change', function() { localStorage.setItem('chessTimeControl', $(this).val()); });
    uiThemeSelector.on('change', () => { const theme = uiThemeSelector.val(); applyUiTheme(theme); localStorage.setItem('chessUiTheme', theme); });
    logBoxClearBtn.on('click', () => { logBoxContent.empty(); });
    logBoxCloseBtn.on('click', () => logBoxToggle.prop('checked', false).trigger('change'));

    // --- Global Key/Mouse Listeners ---
    $(document).on('keydown', function(e) {
        if ($(e.target).is('input, select, textarea') || Swal.isVisible()) return;
        if (isAnalysisMode) return;
        let handled = true;
        switch (e.key.toLowerCase()) {
            case 'arrowleft': historyPrevBtn.click(); break;
            case 'arrowright': historyNextBtn.click(); break;
            case 'arrowup': historyFirstBtn.click(); break;
            case 'arrowdown': historyLastBtn.click(); break;
            case 'n': restartButton.click(); break;
            case 'u': undoButton.click(); break;
            case 'f': board.flip(); renderCoordinates(board, $('#main-game .board-wrapper')); break;
            case 's': swapSidesButton.click(); break;
            case 'm': soundToggle.click(); break;
            case 'h': hintButton.click(); break;
            case 'l': logShortcutBtn.click(); break;
            case 'escape': if ($('body').hasClass('focus-mode')) focusModeToggle.click(); break;
            default: handled = false;
        }
        if (handled) e.preventDefault();
    });

    boardElement.on('mousedown contextmenu', function(e) {
        if (e.which !== 3) return;
        e.preventDefault();
        removeLegalHighlights();
        selectedSquare = null;
        isDrawing = true;
        drawStartSquare = $(e.target).closest('[data-square]').data('square');
    });

    $(document).on('mouseup', function(e) {
        if (isDrawing && e.which === 3) {
            e.preventDefault();
            const endSquare = $(e.target).closest('[data-square]').data('square');
            const drawingOptions = { svgOverlay: $('#board-svg-overlay'), boardElement: boardElement, boardObject: board };
            if (drawStartSquare && endSquare) {
                if (drawStartSquare === endSquare) {
                    const existingIdx = userShapes.findIndex(s => s.type === 'highlight' && s.square === drawStartSquare);
                    if (existingIdx > -1) userShapes.splice(existingIdx, 1);
                    else userShapes.push({ type: 'highlight', square: drawStartSquare, color: 'green' });
                } else {
                    const existingIdx = userShapes.findIndex(s => s.type === 'arrow' && s.from === drawStartSquare && s.to === endSquare);
                    if (existingIdx > -1) userShapes.splice(existingIdx, 1);
                    else userShapes.push({ type: 'arrow', from: drawStartSquare, to: endSquare, color: 'rgba(21, 128, 61, 0.7)' });
                }
            } else {
                userShapes.length = 0;
            }
            redrawUserShapes(userShapes, drawingOptions);
            isDrawing = false;
            drawStartSquare = null;
        }
    });

    $(window).on('resize', () => { 
        clearTimeout(window.resizeTimer); 
        window.resizeTimer = setTimeout(() => { 
            if(board) { 
                board.resize(); 
                const drawingOptions = { svgOverlay: $('#board-svg-overlay'), boardElement: boardElement, boardObject: board };
                redrawUserShapes(userShapes, drawingOptions);
            } 
        }, 150); 
    });

    // --- Engine & App Initialization Sequence ---
    try {
        console.log({logType: 'info', text: 'Loading chess engines...'});

        // Asynchronously create and wait for both engines to be ready.
        [stockfish, liveAnalysisStockfish] = await Promise.all([
            createEngineWorker(APP_CONFIG.STOCKFISH_URL),
            createEngineWorker(APP_CONFIG.STOCKFISH_URL)
        ]);

        console.log({logType: 'info', text: 'Engines loaded successfully.'});

        // Attach the permanent message handler for the main AI.
        stockfish.onmessage = event => {
            const message = event.data;
            if (message.startsWith('bestmove')) {
                performMove(message.split(' ')[1]);
            } else if (message.startsWith('info depth')) {
                const scoreMatch = message.match(/score (cp|mate) (-?\d+)/);
                if (scoreMatch) {
                    let score = parseInt(scoreMatch[2], 10);
                    if (scoreMatch[1] === 'mate') score = (score > 0 ? 1 : -1) * APP_CONFIG.MATE_SCORE;
                    if (game.turn() === 'b') score = -score;
                    updateEvalBar(score);
                }
            }
        };
        
        // --- Load Settings and Start Game ---
        Object.keys(PIECE_THEMES).forEach(name => pieceThemeSelector.append($('<option>', { value: name, text: name.charAt(0).toUpperCase() + name.slice(1) })));
        THEMES.forEach(theme => themeSelector.append($('<option>', { value: theme.name, text: theme.displayName })));
        UI_THEMES.forEach(theme => uiThemeSelector.append($('<option>', { value: theme.name, text: theme.displayName })));
        Object.keys(TIME_CONTROLS).forEach(key => timeControlSelector.append($('<option>', { value: key, text: TIME_CONTROLS[key].label })));

        const savedUiTheme = localStorage.getItem('chessUiTheme') || 'charcoal';
        uiThemeSelector.val(savedUiTheme);
        applyUiTheme(savedUiTheme);
        
        if (localStorage.getItem('chessFocusMode') === 'true') {
            $('body').addClass('focus-mode');
        }

        highlightThreats = localStorage.getItem('chessHighlightThreats') === 'true';
        threatsToggle.prop('checked', highlightThreats);
        
        themeSelector.val(localStorage.getItem('chessBoardTheme') || APP_CONFIG.DEFAULT_BOARD_THEME);
        pieceThemeSelector.val(localStorage.getItem('chessPieceTheme') || APP_CONFIG.DEFAULT_PIECE_THEME);
        
        playerName = localStorage.getItem('chessPlayerName') || 'Player';
        playerNameElement.text(playerName);
        
        aiDifficulty = parseInt(localStorage.getItem('chessDifficulty') || '5', 10);
        difficultySlider.val(aiDifficulty);
        eloDisplay.text(DIFFICULTY_SETTINGS[aiDifficulty]?.elo || 1200);
        
        isMuted = localStorage.getItem('chessSoundMuted') === 'true';
        soundIcon.attr('src', isMuted ? 'icon/speaker-x-mark.png' : 'icon/speaker-wave.png');

        showModalOnRestart = localStorage.getItem('chessShowModalOnRestart') !== 'false';
        showTimeControlModalToggle.prop('checked', showModalOnRestart);
        
        const savedTimeControl = localStorage.getItem('chessTimeControl') || APP_CONFIG.DEFAULT_TIME_CONTROL;
        timeControlSelector.val(savedTimeControl);
        const tc = TIME_CONTROLS[savedTimeControl];
        startNewGameWithTime(tc.base, tc.inc);
        
    } catch (error) {
        console.error('CRITICAL: Failed to load or initialize Stockfish engine.', error);
        $('aside').html(`<div class="text-red-400 font-bold text-center p-4">ENGINE FAILED TO LOAD.<br><br>Please check your internet connection and refresh the page.</div>`);
        Swal.fire({
            title: 'Engine Loading Failed',
            text: 'An error occurred while creating the chess engine.',
            icon: 'error'
        });
    }
}

$(document).ready(initApp);