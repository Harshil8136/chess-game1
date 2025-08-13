// ===================================================================================
//  LISTENERS.JS
//  Contains all UI event listeners for the main game interface.
// ===================================================================================

function setupEventListeners() {
    // --- Tabs ---
    $('.tab-button').on('click', function() { 
        console.log({ logType: 'info', text: `Tab changed to: ${$(this).data('tab')}` });
        showTab($(this).data('tab')); 
    });

    // --- Main Action Buttons ---
    restartButton.on('click', () => {
        console.log({ logType: 'info', text: 'New Game button clicked.' });
        const tcKey = timeControlSelector.val();
        const tc = TIME_CONTROLS[tcKey];
        if(showModalOnRestart) {
            showTimeControlModal();
        } else {
            startNewGameWithTime(tc.base, tc.inc);
        }
    });

    swapSidesButton.on('click', () => { 
        console.log({ logType: 'info', text: 'Swap Sides button clicked.' });
        if (gameActive && game.history().length === 0) {
            [humanPlayer, aiPlayer] = [aiPlayer, humanPlayer];
            const tcKey = timeControlSelector.val();
            const tc = TIME_CONTROLS[tcKey];
            startNewGameWithTime(tc.base, tc.inc); // Restart game with sides swapped
        } else { 
            Swal.fire('Oops!', 'Can only swap sides at the start of a new game.', 'info'); 
        } 
    });

    undoButton.on('click', () => {
        console.log({ logType: 'info', text: 'Undo button clicked.' });
        if (undoButton.prop('disabled')) return;
        
        undoLastTurn();
        
        removeLegalHighlights();
        selectedSquare = null;
        exitReviewMode();
        clearUserShapes();
        updateGameState(true);
    });

    hintButton.on('click', function() {
        console.log({ logType: 'info', text: 'Hint button clicked.' });
        if ($(this).prop('disabled') || !stockfish) return;
        
        const originalShapes = [...userShapes];
        clearUserShapes();

        let originalOnMessage = stockfish.onmessage;
        stockfish.postMessage(`position fen ${game.fen()}`);
        stockfish.postMessage('go movetime 1000');
        
        stockfish.onmessage = event => {
            const message = event.data;
            if (message.startsWith('bestmove')) {
                const move = message.split(' ')[1];
                const from = move.substring(0, 2);
                const to = move.substring(2, 4);
                drawArrow(from, to, 'rgba(255, 165, 0, 0.7)');
                
                // Restore original user drawings after a delay
                setTimeout(() => {
                    userShapes = originalShapes;
                    redrawUserShapes();
                }, 3000);
                
                stockfish.onmessage = originalOnMessage;
            }
        };
    });

    // --- History Navigation ---
    historyFirstBtn.on('click', () => { console.log({ logType: 'info', text: 'History First button clicked.' }); if (!historyFirstBtn.prop('disabled')) { reviewMoveIndex = 0; showHistoryPosition(); } });
    historyPrevBtn.on('click', () => { console.log({ logType: 'info', text: 'History Previous button clicked.' }); if (!historyPrevBtn.prop('disabled')) { if (reviewMoveIndex === null) reviewMoveIndex = game.history().length - 1; if (reviewMoveIndex > 0) reviewMoveIndex--; else reviewMoveIndex = 0; showHistoryPosition(); } });
    historyNextBtn.on('click', () => { console.log({ logType: 'info', text: 'History Next button clicked.' }); if (!historyNextBtn.prop('disabled')) { if (reviewMoveIndex === null) return; if (reviewMoveIndex < game.history().length - 1) reviewMoveIndex++; showHistoryPosition(); } });
    historyLastBtn.on('click', () => { console.log({ logType: 'info', text: 'History Last button clicked.' }); exitReviewMode(); });
    moveHistoryLog.on('click', '.move-span', function() { 
        reviewMoveIndex = parseInt($(this).data('move-index'));
        console.log({ logType: 'info', text: `Jumped to move ${reviewMoveIndex + 1} from history.` });
        showHistoryPosition(); 
    });

    // --- Analysis Buttons ---
    runAnalysisBtn.on('click', function() {
        console.log({ logType: 'info', text: 'Run Full Game Review button clicked.' });
        if ($(this).prop('disabled')) return;
        if (game.history().length === 0) { Swal.fire('Error', 'No moves to analyze.', 'error'); return; }

        analysisVisualizer.removeClass('hidden');
        
        fetch(APP_CONFIG.STOCKFISH_URL)
            .then(response => response.text())
            .then(text => {
                try {
                    const blob = new Blob([text], { type: 'application/javascript' });
                    analysisStockfish = new Worker(URL.createObjectURL(blob));
                    analysisStockfish.onerror = (error) => {
                        console.error('Analysis Stockfish Worker Error:', error);
                        Swal.fire('Engine Error', 'The analysis engine encountered an error.', 'warning');
                    };

                    window.gameDataToAnalyze = {
                        pgn: game.pgn(),
                        fen: game.header().FEN || 'start', // Pass starting FEN for accuracy
                        stockfish: analysisStockfish, 
                        history: game.history({ verbose: true })
                    };

                    if (window.AnalysisController && typeof window.AnalysisController.init === 'function') {
                        window.AnalysisController.init();
                    } else {
                        throw new Error('AnalysisController not available');
                    }
                } catch (workerError) {
                    console.error('Failed to create analysis worker:', workerError);
                    analysisVisualizer.addClass('hidden');
                    Swal.fire('Error', 'Could not create the analysis engine.', 'error');
                }
            })
            .catch(error => {
                console.error("Failed to load Stockfish for analysis:", error);
                analysisVisualizer.addClass('hidden');
                Swal.fire('Error', 'Could not load the chess engine for analysis.', 'error');
            });
    });
    
    visualizerCancelBtn.on('click', function() {
        console.log({ logType: 'info', text: 'Analysis canceled by user.' });
        analysisVisualizer.addClass('hidden');
        if (window.AnalysisController && typeof window.AnalysisController.stop === 'function') {
            window.AnalysisController.stop();
        }
    });

    returnToGameBtn.on('click', switchToMainGame);

    // --- FEN/PGN Controls ---
    loadFenBtn.on('click', () => {
        const fen = fenInput.val().trim();
        console.log({ logType: 'info', text: `Load FEN button clicked. FEN: ${fen}` });
        if (fen) {
             const tcKey = timeControlSelector.val();
             const tc = TIME_CONTROLS[tcKey];
             startNewGameWithTime(tc.base, tc.inc, fen);
        } else Swal.fire('Info', 'Please paste a FEN string into the text field.', 'info');
    });
    
    exportPgnBtn.on('click', function() {
        console.log({ logType: 'info', text: 'Export PGN button clicked.' });
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

    // --- Settings and Options ---
    difficultySlider.on('input', e => { 
        aiDifficulty = parseInt(e.target.value, 10); 
        eloDisplay.text(DIFFICULTY_SETTINGS[aiDifficulty]?.elo || 1200); 
    });
    difficultySlider.on('change', () => {
        localStorage.setItem('chessDifficulty', aiDifficulty);
        console.log({ logType: 'info', text: `AI difficulty changed to ${aiDifficulty}` });
    });
    
    themeSelector.on('change', () => { console.log({ logType: 'info', text: `Board theme changed to: ${themeSelector.val()}` }); localStorage.setItem('chessBoardTheme', themeSelector.val()); buildBoard(game.fen()); });
    pieceThemeSelector.on('change', () => { console.log({ logType: 'info', text: `Piece theme changed to: ${pieceThemeSelector.val()}` }); localStorage.setItem('chessPieceTheme', pieceThemeSelector.val()); buildBoard(game.fen()); updateCapturedPieces()});
    uiThemeSelector.on('change', () => {
        const selectedTheme = uiThemeSelector.val();
        console.log({ logType: 'info', text: `UI theme changed to: ${selectedTheme}` });
        applyUiTheme(selectedTheme);
        localStorage.setItem('chessUiTheme', selectedTheme);
    });
    
    soundToggle.on('click', () => { 
        isMuted = !isMuted; 
        localStorage.setItem('chessSoundMuted', isMuted); 
        soundIcon.attr('src', isMuted ? 'icon/speaker-x-mark.png' : 'icon/speaker-wave.png'); 
        console.log({ logType: 'info', text: `Sound toggled: ${!isMuted}` }); 
    });

    playerNameElement.on('click', () => { 
        Swal.fire({ 
            title: 'Enter your name', 
            input: 'text', 
            inputValue: playerName, 
            showCancelButton: true, 
            confirmButtonText: 'Save', 
            customClass: { popup: '!bg-stone-800', title: '!text-white', input: '!text-black' }, 
            inputValidator: v => !v || v.trim().length === 0 ? 'Please enter a name!' : null 
        }).then(r => { 
            if (r.isConfirmed) { 
                playerName = r.value.trim(); 
                console.log({ logType: 'info', text: `Player name changed to: ${playerName}` }); 
                localStorage.setItem('chessPlayerName', playerName); 
                updatePlayerLabels(); 
            } 
        }); 
    });
    
    threatsToggle.on('change', function() {
        highlightThreats = $(this).is(':checked');
        console.log({ logType: 'info', text: `Highlight Threats toggled: ${highlightThreats}` });
        localStorage.setItem('chessHighlightThreats', highlightThreats);
        updateThreatHighlights();
    });

    logShortcutBtn.on('click', () => logBoxToggle.click());
    
    focusModeToggle.on('click', function() {
        $('body').toggleClass('focus-mode');
        const isFocus = $('body').hasClass('focus-mode');
        console.log({ logType: 'info', text: `Focus Mode toggled: ${isFocus}` });
        localStorage.setItem('chessFocusMode', isFocus);
        setTimeout(() => {
            if (board) board.resize();
        }, 50);
    });

    timeControlSelector.on('change', () => {
        localStorage.setItem('chessTimeControl', timeControlSelector.val());
    });

    showTimeControlModalToggle.on('change', function() {
        showModalOnRestart = $(this).is(':checked');
        localStorage.setItem('showTimeControlModal', showModalOnRestart);
    });

    showShortcutsBtn.on('click', showShortcutsModal);

    // --- Global Mouse/Keyboard Listeners ---
    $(document).on('keydown', function(e) {
        if ($(e.target).is('input, select, textarea') || Swal.isVisible()) return;
        if (isAnalysisMode) return; // Analysis mode has its own key handler

        switch (e.key.toLowerCase()) {
            case 'arrowleft':   historyPrevBtn.click(); break;
            case 'arrowright':  historyNextBtn.click(); break;
            case 'arrowup':     historyFirstBtn.click(); break;
            case 'arrowdown':   historyLastBtn.click(); break;
            case 'n': restartButton.click(); break;
            case 'u': undoButton.click(); break;
            case 'f':
                console.log({ logType: 'info', text: 'Board flipped via keyboard shortcut.' });
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

    boardElement.on('mousedown contextmenu', function(e) {
        if (e.which !== 3) return; // Right-click only
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

            if (drawStartSquare && endSquare) {
                if (drawStartSquare === endSquare) {
                    const existingHighlightIndex = userShapes.findIndex(s => s.type === 'highlight' && s.square === drawStartSquare);
                    if (existingHighlightIndex > -1) userShapes.splice(existingHighlightIndex, 1);
                    else userShapes.push({ type: 'highlight', square: drawStartSquare, color: 'green' });
                } else {
                    const existingArrowIndex = userShapes.findIndex(s => s.type === 'arrow' && s.from === drawStartSquare && s.to === endSquare);
                     if (existingArrowIndex > -1) userShapes.splice(existingArrowIndex, 1);
                     else userShapes.push({ type: 'arrow', from: drawStartSquare, to: endSquare, color: 'rgba(21, 128, 61, 0.7)' });
                }
            } else {
                clearUserShapes();
            }
            
            redrawUserShapes();
            isDrawing = false;
            drawStartSquare = null;
        }
    });

    // Debounced resize handler
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