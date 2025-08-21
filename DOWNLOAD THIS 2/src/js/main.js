// src/js/main.js

// ===================================================================================
//  MAIN.JS
//  Initializes the application, sets up event listeners, and loads the engine.
// ===================================================================================

// Global flag for performance toggle, defaults to true.
window.enableLiveEngineLogging = true;

function initApp() {
    initSounds();
    initLogBox();
    initCollapsiblePanels();
    initConsoleTab();
    
    // --- Event Listeners ---
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
            Logger.info(`Starting new game with saved time control: ${tc.label}`);
            startNewGameWithTime(tc.base, tc.inc);
        }
    });

    swapSidesButton.on('click', () => { 
        Logger.info('Swap Sides button clicked.');
        if(gameActive && game.history().length === 0) {
            const tempPlayer = humanPlayer;
            humanPlayer = aiPlayer;
            aiPlayer = tempPlayer;
            initGame();
        } else { 
            Swal.fire('Oops!', 'Can only swap sides at the start of a new game.', 'info'); 
        } 
    });
    
    showShortcutsBtn.on('click', showShortcutsModal);
    logShortcutBtn.on('click', () => logBoxToggle.prop('checked', !logBoxToggle.prop('checked')).trigger('change'));

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
    
    // UPDATED: This function now creates a new, dedicated engine for the game review.
    runAnalysisBtn.on('click', async function() {
        Logger.info('Run Full Game Review button clicked.');
        if ($(this).prop('disabled')) return;
        if (game.history().length === 0) { Swal.fire('Error', 'No moves to analyze.', 'error'); return; }

        analysisVisualizer.removeClass('hidden');
        
        try {
            // Create a new, temporary engine worker specifically for this review.
            const reviewEngine = await createStockfishWorker();
            
            configureEngine(reviewEngine, { Threads: 4, Hash: 128 });

            // Pass this dedicated engine to the analysis controller.
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
        if ($(this).prop('disabled') || !liveAnalysisStockfish) {
            Logger.warn('Hint request ignored: button disabled or analysis engine not ready.', new Error('Hint request ignored'));
            return;
        }
        
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

    logBoxToggle.on('change', function() {
        if (typeof window.toggleLogBox === 'function') {
            window.toggleLogBox(this.checked);
        }
    });

    focusModeToggle.on('click', function() {
        $('body').toggleClass('focus-mode');
        const isFocus = $('body').hasClass('focus-mode');
        localStorage.setItem('chessFocusMode', isFocus);
        setTimeout(() => {
            if (board) board.resize();
        }, 50);
    });

    $(document).on('keydown', function(e) {
        if ($(e.target).is('input, select, textarea') || Swal.isVisible()) return;
        const key = e.key.toLowerCase();

        if (isAnalysisMode) {
            return;
        }

        switch (key) {
            case 'arrowleft':   historyPrevBtn.click(); break;
            case 'arrowright':  historyNextBtn.click(); break;
            case 'arrowup':     historyFirstBtn.click(); break;
            case 'arrowdown':   historyLastBtn.click(); break;
            case 'n': restartButton.click(); break;
            case 'u': undoButton.click(); break;
            case 'f':
                Logger.info('Board flipped via keyboard shortcut.');
                board.flip();
                renderCoordinates(board.orientation());
                redrawUserShapes();
                break;
            case 's': swapSidesButton.click(); break;
            case 'm': soundToggle.click(); break;
            case 'h': hintButton.click(); break;
            case 'l': logShortcutBtn.click(); break;
            case 'escape':
                if ($('body').hasClass('focus-mode')) {
                    focusModeToggle.click();
                }
                break;
            default: return;
        }
        e.preventDefault();
    });
    
    Promise.all([
        createStockfishWorker(),
        createStockfishWorker()
    ]).then(([mainEngine, analysisEngine]) => {
        stockfish = mainEngine;
        liveAnalysisStockfish = analysisEngine;

        configureEngine(liveAnalysisStockfish, { Hash: 64 });
        
        let lastEval = 0;
        stockfish.onmessage = event => {
            const message = event.data;
            if (message.startsWith('bestmove')) {
                const move = message.split(' ')[1];
                Logger.info(`AI played ${move}`, { eval: (lastEval / 100).toFixed(2) });
                performMove(move);
            } else if (message.startsWith('info depth')) {
                const scoreMatch = message.match(/score (cp|mate) (-?\d+)/);
                if (scoreMatch) {
                    let score = parseInt(scoreMatch[2], 10);
                    if (scoreMatch[1] === 'mate') score = (score > 0 ? 1 : -1) * APP_CONFIG.MATE_SCORE;
                    if (game.turn() === 'b') score = -score;
                    lastEval = score; 
                    updateEvalBar(score);
                }
            }
        };

        // Load all settings from localStorage
        const savedUiTheme = localStorage.getItem('chessUiTheme') || 'charcoal';
        uiThemeSelector.val(savedUiTheme);
        applyUiTheme(savedUiTheme);
        if (localStorage.getItem('chessFocusMode') === 'true') {
            focusModeToggle.click();
        }
        highlightThreats = localStorage.getItem('chessHighlightThreats') === 'true';
        threatsToggle.prop('checked', highlightThreats);
        
        const savedLiveLog = localStorage.getItem('chessLiveEngineLogging');
        window.enableLiveEngineLogging = savedLiveLog === null ? true : (savedLiveLog === 'true');
        liveEngineLogToggle.prop('checked', window.enableLiveEngineLogging);

        themeSelector.val(localStorage.getItem('chessBoardTheme') || APP_CONFIG.DEFAULT_BOARD_THEME);
        pieceThemeSelector.val(localStorage.getItem('chessPieceTheme') || APP_CONFIG.DEFAULT_PIECE_THEME);
        Object.keys(PIECE_THEMES).forEach(themeName => pieceThemeSelector.append($('<option>', { value: themeName, text: themeName.charAt(0).toUpperCase() + themeName.slice(1) })));
        THEMES.forEach(theme => themeSelector.append($('<option>', { value: theme.name, text: theme.displayName })));
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

        if (showModalOnRestart) {
            showTimeControlModal();
        } else {
            const selectedKey = timeControlSelector.val() || APP_CONFIG.DEFAULT_TIME_CONTROL;
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
        }).then(() => {
            window.location.reload();
        });
    });
        
    $(window).on('resize', () => { 
        clearTimeout(window.resizeTimer); 
        window.resizeTimer = setTimeout(() => { 
            if(board) { 
                board.resize(); 
                redrawUserShapes();
            } 
        }, 150); 
    });
}

$(document).ready(initApp);