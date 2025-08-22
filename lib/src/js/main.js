// src/js/main.js

// ===================================================================================
//  MAIN.JS
//  Initializes the application, sets up event listeners, and loads the engine.
// ===================================================================================

// Global flag for performance toggle, defaults to true.
window.enableLiveEngineLogging = true;

function initApp() {
    // 1. Perform a full UI integrity check on the newly created DOM
    try {
        Validator.verifyElements(Validator.getInitialLoadChecks());
    } catch (error) {
        console.error("UI validation failed. Halting application.", error.message);
        return; 
    }

    // 2. Initialize all jQuery element variables
    initElements();

    // 3. Initialize all other application modules
    initSounds();
    initLogBox();
    initCollapsiblePanels();
    initConsoleTab();
    initModalEventListeners();
    
    // 4. Attach All Event Listeners
    $('.tab-button').on('click', function() { 
        showTab($(this).data('tab')); 
    });

    restartButton.on('click', () => {
        Logger.info('New Game button clicked.');
        if (isAnalysisMode) {
            switchToMainGame();
        }
        if (showModalOnRestart) {
            showTimeControlModal();
        } else {
            const selectedKey = timeControlSelector.val();
            const tc = TIME_CONTROLS[selectedKey] || TIME_CONTROLS[APP_CONFIG.DEFAULT_TIME_CONTROL];
            startNewGameWithTime(tc.base, tc.inc);
        }
    });

    swapSidesButton.on('click', () => { 
        Logger.info('Swap Sides button clicked.');
        if(gameActive && game.history().length === 0) {
            humanPlayer = humanPlayer === 'w' ? 'b' : 'w';
            aiPlayer = humanPlayer === 'w' ? 'b' : 'w';
            initGame();
        } else { 
            Swal.fire('Oops!', 'Can only swap sides at the start of a new game.', 'info'); 
        } 
    });
    
    showShortcutsBtn.on('click', showShortcutsModal);

    // UPDATED: Shortcut button now calls the intelligent toggle function directly.
    logShortcutBtn.on('click', () => window.toggleLogBox());

    undoButton.on('click', () => {
        Logger.info('Undo button clicked.');
        if (undoButton.prop('disabled')) return;
        undoLastTurn();
        removeLegalHighlights();
        selectedSquare = null;
        exitReviewMode();
        clearUserShapes();
        updateGameState(true);
    });
    
    historyFirstBtn.on('click', () => { if (!historyFirstBtn.prop('disabled')) { reviewMoveIndex = 0; showHistoryPosition(); } });
    historyPrevBtn.on('click', () => { if (!historyPrevBtn.prop('disabled')) { if (reviewMoveIndex === null) reviewMoveIndex = game.history().length - 1; if (reviewMoveIndex > 0) reviewMoveIndex--; else reviewMoveIndex = 0; showHistoryPosition(); } });
    historyNextBtn.on('click', () => { if (!historyNextBtn.prop('disabled')) { if (reviewMoveIndex === null) return; if (reviewMoveIndex < game.history().length - 1) reviewMoveIndex++; showHistoryPosition(); } });
    historyLastBtn.on('click', () => { exitReviewMode(); });
    moveHistoryLog.on('click', '.move-span', function() { 
        reviewMoveIndex = parseInt($(this).data('move-index'));
        showHistoryPosition(); 
    });
    
    returnToGameBtn.on('click', switchToMainGame);
    
    runAnalysisBtn.on('click', async function() {
        Logger.info('Run Full Game Review button clicked.');
        if ($(this).prop('disabled')) return;
        if (game.history().length === 0) { Swal.fire('Error', 'No moves to analyze.', 'error'); return; }
        
        try {
            const reviewEngine = await createStockfishWorker();
            configureEngine(reviewEngine, { Threads: 4, Hash: 128 });
            window.gameDataToAnalyze = {
                pgn: game.pgn(),
                stockfish: reviewEngine, 
                history: game.history({ verbose: true })
            };
            if (window.AnalysisController && typeof window.AnalysisController.init === 'function') {
                window.AnalysisController.init();
            } else {
                throw new Error('AnalysisController not available.');
            }
        } catch (error) {
            Logger.error("Failed to initialize analysis engine", error);
            analysisVisualizer.addClass('hidden');
            Swal.fire('Error', 'Could not load or configure the chess engine for analysis.', 'error');
        }
    });
    
    visualizerCancelBtn.on('click', function() {
        Logger.warn('Analysis canceled by user.', new Error('Analysis Canceled'));
        analysisVisualizer.addClass('hidden');
        if (window.AnalysisController && typeof window.AnalysisController.stop === 'function') {
            window.AnalysisController.stop();
        }
    });

    hintButton.on('click', function() {
        Logger.info('Hint button clicked.');
        if ($(this).prop('disabled') || !liveAnalysisStockfish) return;
        const hintArrow = { type: 'arrow', from: '', to: '', color: 'rgba(255, 165, 0, 0.7)', isHint: true };
        userShapes.push(hintArrow);
        liveAnalysisStockfish.onmessage = event => {
            const message = event.data;
            if (message.startsWith('bestmove')) {
                const move = message.split(' ')[1];
                hintArrow.from = move.substring(0, 2);
                hintArrow.to = move.substring(2, 4);
                redrawUserShapes();
                setTimeout(() => {
                    const hintIndex = userShapes.findIndex(s => s.isHint);
                    if (hintIndex > -1) {
                        userShapes.splice(hintIndex, 1);
                        redrawUserShapes();
                    }
                }, 3000);
                liveAnalysisStockfish.onmessage = null;
            }
        };
        liveAnalysisStockfish.postMessage('stop');
        liveAnalysisStockfish.postMessage(`position fen ${game.fen()}`);
        liveAnalysisStockfish.postMessage('go movetime 1000');
    });

    loadFenBtn.on('click', () => {
        const fen = fenInput.val().trim();
        if (fen) initGameFromFen(fen);
        else Swal.fire('Info', 'Please paste a FEN string into the text field.', 'info');
    });
    
    exportPgnBtn.on('click', function() {
         if ($(this).prop('disabled')) return;
         const pgn = game.pgn();
         const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `chess-game-${Date.now()}.pgn`;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(url);
    });

    threatsToggle.on('change', function() {
        highlightThreats = $(this).is(':checked');
        localStorage.setItem('chessHighlightThreats', highlightThreats);
        updateThreatHighlights();
    });
    
    showTimeControlModalToggle.on('change', function() {
        showModalOnRestart = $(this).is(':checked');
        localStorage.setItem('chessShowModalOnRestart', showModalOnRestart);
    });

    liveEngineLogToggle.on('change', function() {
        window.enableLiveEngineLogging = $(this).is(':checked');
        localStorage.setItem('chessLiveEngineLogging', window.enableLiveEngineLogging);
        Logger.info(`Live Engine Logging set to: ${window.enableLiveEngineLogging}`);
    });

    // The checkbox in settings uses the simple toggle with a true/false state.
    logBoxToggle.on('change', function() {
        if (typeof window.toggleLogBox === 'function') {
            window.toggleLogBox(this.checked);
        }
    });

    focusModeToggle.on('click', function() {
        $('body').toggleClass('focus-mode');
        const isFocus = $('body').hasClass('focus-mode');
        localStorage.setItem('chessFocusMode', isFocus);
        setTimeout(() => { if (board) board.resize(); }, 50);
    });
    
    difficultySlider.on('input', function() {
        const level = $(this).val();
        eloDisplay.text(DIFFICULTY_SETTINGS[level].elo);
    });

    difficultySlider.on('change', function() {
        aiDifficulty = parseInt($(this).val(), 10);
        localStorage.setItem('chessDifficulty', aiDifficulty);
        Logger.info(`AI difficulty changed to level ${aiDifficulty} (ELO: ${DIFFICULTY_SETTINGS[aiDifficulty].elo})`);
    });

    themeSelector.on('change', function() {
        const themeName = $(this).val();
        localStorage.setItem('chessBoardTheme', themeName);
        buildBoard(game.fen());
    });
    
    pieceThemeSelector.on('change', function() {
        const themeName = $(this).val();
        localStorage.setItem('chessPieceTheme', themeName);
        buildBoard(game.fen());
        updateCapturedPieces();
    });

    uiThemeSelector.on('change', function() {
        const themeName = $(this).val();
        localStorage.setItem('chessUiTheme', themeName);
        applyUiTheme(themeName);
    });

    timeControlSelector.on('change', function() {
        const selectedKey = $(this).val();
        localStorage.setItem('chessTimeControl', selectedKey);
    });
    
    soundToggle.on('click', function() {
        isMuted = !isMuted;
        soundIcon.attr('src', isMuted ? 'assets/icon/speaker-x-mark.png' : 'assets/icon/speaker-wave.png');
        localStorage.setItem('chessSoundMuted', isMuted);
        if (!isMuted) playSound('notify');
    });

    $(document).on('keydown', function(e) {
        if ($(e.target).is('input, select, textarea') || Swal.isVisible()) return;
        const key = e.key.toLowerCase();
        if (isAnalysisMode) return;
        switch (key) {
            case 'arrowleft':   historyPrevBtn.click(); break;
            case 'arrowright':  historyNextBtn.click(); break;
            case 'arrowup':     historyFirstBtn.click(); break;
            case 'arrowdown':   historyLastBtn.click(); break;
            case 'n': restartButton.click(); break;
            case 'u': undoButton.click(); break;
            case 'f': board.flip(); renderCoordinates(board.orientation()); redrawUserShapes(); break;
            case 's': swapSidesButton.click(); break;
            case 'm': soundToggle.click(); break;
            case 'h': hintButton.click(); break;
            // UPDATED: The 'L' shortcut now calls the intelligent toggle directly.
            case 'l': window.toggleLogBox(); break;
            case 'escape': if ($('body').hasClass('focus-mode')) focusModeToggle.click(); break;
            default: return;
        }
        e.preventDefault();
    });
    
    // --- 5. Load Engines, Populate UI, and Start the Game ---
    Promise.all([
        createStockfishWorker(),
        createStockfishWorker()
    ]).then(([mainEngine, analysisEngine]) => {
        stockfish = mainEngine;
        liveAnalysisStockfish = analysisEngine;
        configureEngine(liveAnalysisStockfish, { Hash: 64 });
        
        stockfish.onmessage = event => {
            const message = event.data;
            if (message.startsWith('bestmove')) {
                const move = message.split(' ')[1];
                performMove(move);
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

        UI_THEMES.forEach(theme => uiThemeSelector.append($('<option>', { value: theme.name, text: theme.displayName })));
        THEMES.forEach(theme => themeSelector.append($('<option>', { value: theme.name, text: theme.displayName })));
        Object.keys(PIECE_THEMES).forEach(themeName => pieceThemeSelector.append($('<option>', { value: themeName, text: themeName.charAt(0).toUpperCase() + themeName.slice(1) })));
        Object.keys(TIME_CONTROLS).forEach(key => timeControlSelector.append($('<option>', { value: key, text: TIME_CONTROLS[key].label })));

        const savedUiTheme = localStorage.getItem('chessUiTheme') || 'charcoal';
        uiThemeSelector.val(savedUiTheme);
        applyUiTheme(savedUiTheme);
        if (localStorage.getItem('chessFocusMode') === 'true') focusModeToggle.click();
        highlightThreats = localStorage.getItem('chessHighlightThreats') === 'true';
        threatsToggle.prop('checked', highlightThreats);
        const savedLiveLog = localStorage.getItem('chessLiveEngineLogging');
        window.enableLiveEngineLogging = savedLiveLog === null ? true : (savedLiveLog === 'true');
        liveEngineLogToggle.prop('checked', window.enableLiveEngineLogging);
        themeSelector.val(localStorage.getItem('chessBoardTheme') || APP_CONFIG.DEFAULT_BOARD_THEME);
        pieceThemeSelector.val(localStorage.getItem('chessPieceTheme') || APP_CONFIG.DEFAULT_PIECE_THEME);
        playerName = localStorage.getItem('chessPlayerName') || 'Player';
        playerNameElement.text(playerName);
        aiDifficulty = parseInt(localStorage.getItem('chessDifficulty') || '5', 10);
        difficultySlider.val(aiDifficulty);
        eloDisplay.text(DIFFICULTY_SETTINGS[aiDifficulty]?.elo || 1200);
        isMuted = localStorage.getItem('chessSoundMuted') === 'true';
        soundIcon.attr('src', isMuted ? 'assets/icon/speaker-x-mark.png' : 'assets/icon/speaker-wave.png');
        const savedShowModal = localStorage.getItem('chessShowModalOnRestart');
        showModalOnRestart = savedShowModal === null ? false : (savedShowModal === 'true');
        showTimeControlModalToggle.prop('checked', showModalOnRestart);
        timeControlSelector.val(localStorage.getItem('chessTimeControl') || APP_CONFIG.DEFAULT_TIME_CONTROL);

        if (showModalOnRestart && game.history().length === 0) {
            showTimeControlModal();
        } else {
            const selectedKey = timeControlSelector.val();
            const tc = TIME_CONTROLS[selectedKey];
            startNewGameWithTime(tc.base, tc.inc);
        }

    }).catch(error => {
        Logger.critical('CRITICAL: Failed to load Stockfish engine.', error);
        $('aside').html(`<div class="text-red-400 font-bold text-center p-4">CRITICAL ERROR:<br>Could not load chess engine.<br><br>Please check your internet connection and refresh the page.</div>`);
        Swal.fire({
            title: 'Engine Loading Failed',
            text: 'Could not load the chess engine. The application cannot start.',
            icon: 'error',
            confirmButtonText: 'Refresh Page',
            allowOutsideClick: false
        }).then(() => { window.location.reload(); });
    });
        
    $(window).on('resize', () => { 
        clearTimeout(window.resizeTimer); 
        window.resizeTimer = setTimeout(() => { if(board) { board.resize(); redrawUserShapes(); } }, 150); 
    });
}

// ===================================================================================
//  APPLICATION ENTRY POINT
// ===================================================================================
$(document).ready(function() {
    // 1. Inject the persistent HTML structure into the page.
    initTemplates();
    
    // 2. Initialize the main application logic.
    initApp();
});