// ===================================================================================
//  ENGINE.JS
//  Contains all logic for loading and interacting with the Stockfish engine.
// ===================================================================================

function loadEngineAndInitGame() {
    // This is the primary function to start the application.
    // It fetches the engine, sets up workers, loads settings, and starts the first game.

    fetch(APP_CONFIG.STOCKFISH_URL)
        .then(response => { 
            if (!response.ok) throw new Error(`Failed to fetch Stockfish: ${response.status} ${response.statusText}`); 
            return response.text(); 
        })
        .then(text => {
            try {
                let lastEval = 0;
                const blob = new Blob([text], { type: 'application/javascript' });
                const workerUrl = URL.createObjectURL(blob);

                // --- Main AI Opponent Worker ---
                stockfish = new Worker(workerUrl);
                stockfish.onmessage = event => {
                    const message = event.data;
                    
                    if (message.startsWith('bestmove')) {
                        const move = message.split(' ')[1];
                        console.log({ logType: 'engine_move', move: move, eval: (lastEval / 100).toFixed(2) });
                        performMove(move);
                    } else if (message.startsWith('info depth')) {
                        const scoreMatch = message.match(/score (cp|mate) (-?\d+)/);
                        if (scoreMatch) {
                            let score = parseInt(scoreMatch[2], 10);
                            if (scoreMatch[1] === 'mate') score = (score > 0 ? 1 : -1) * APP_CONFIG.MATE_SCORE;
                            if (game.turn() === 'b') score = -score; // Score is from the perspective of the current player
                            lastEval = score; 
                            updateEvalBar(score);
                        }
                    } else {
                        // For debugging: log any other messages from the engine
                        // console.log(`Stockfish (raw): ${message}`);
                    }
                };
                stockfish.onerror = (error) => {
                    console.error('Stockfish Worker Error:', error);
                    Swal.fire('Engine Error', 'Chess engine encountered an error.', 'warning');
                };
                stockfish.postMessage('uci');
                stockfish.postMessage('isready');

                // --- Live Analysis Worker ---
                liveAnalysisStockfish = new Worker(workerUrl);
                liveAnalysisStockfish.onerror = (error) => {
                    console.error('Live Analysis Stockfish Worker Error:', error);
                    liveAnalysisStockfish = null; // Disable live analysis on error
                };
                liveAnalysisStockfish.postMessage('uci');
                liveAnalysisStockfish.postMessage('isready');
                console.log({ logType: 'info', text: "Live analysis engine initialized." });

            } catch (workerError) {
                console.error('Failed to create Stockfish worker:', workerError);
                throw workerError; // Propagate error to the catch block below
            }
            
            // --- Load User Settings and Initialize Game ---
            // This runs only after the engine has been successfully loaded.
            
            const savedUiTheme = localStorage.getItem('chessUiTheme') || 'charcoal';
            uiThemeSelector.val(savedUiTheme);
            applyUiTheme(savedUiTheme);
            
            if (localStorage.getItem('chessFocusMode') === 'true') {
                focusModeToggle.click();
            }
            
            highlightThreats = localStorage.getItem('chessHighlightThreats') === 'true';
            threatsToggle.prop('checked', highlightThreats);
            
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
            soundIcon.attr('src', isMuted ? 'icon/speaker-x-mark.png' : 'icon/speaker-wave.png');

            // Set up time control selector
            Object.keys(TIME_CONTROLS).forEach(key => timeControlSelector.append($('<option>', { value: key, text: TIME_CONTROLS[key].label })));
            const savedTimeControl = localStorage.getItem('chessTimeControl') || APP_CONFIG.DEFAULT_TIME_CONTROL;
            timeControlSelector.val(savedTimeControl);
            showModalOnRestart = (localStorage.getItem('showTimeControlModal') === null) ? true : (localStorage.getItem('showTimeControlModal') === 'true');
            showTimeControlModalToggle.prop('checked', showModalOnRestart);


            // Start the first game
            const tc = TIME_CONTROLS[savedTimeControl];
            if(showModalOnRestart) {
                showTimeControlModal();
            } else {
                startNewGameWithTime(tc.base, tc.inc);
            }
        })
        .catch((error) => {
            console.error('CRITICAL: Failed to load Stockfish:', error);
            $('aside').html(`<div class="text-red-400 font-bold text-center p-4">CRITICAL ERROR:<br>Could not load chess engine.<br><br>Please check your internet connection or the engine URL and refresh the page.</div>`);
            Swal.fire({
                title: 'Engine Loading Failed',
                text: `Could not load the chess engine. ${error.message}`,
                icon: 'error',
                confirmButtonText: 'Refresh Page',
                allowOutsideClick: false
            }).then(() => {
                window.location.reload();
            });
        });
}