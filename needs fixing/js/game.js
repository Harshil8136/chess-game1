// ===================================================================================
//  GAME.JS
//  Manages core game logic, state, and AI interaction.
// ===================================================================================

// --- Game State ---
const game = new Chess();
let gameActive = true;
let humanPlayer = 'w';
let aiPlayer = 'b';
let aiDifficulty = 5;
let pendingMove = null;
let pendingPremove = null;
let stockfish;
let isStockfishThinking = false;
let reviewMoveIndex = null;
let engineTimeout = null;
let isAnalysisMode = false;

let moveAnalysisData = [];
let liveAnalysisStockfish = null; 
let isLiveAnalyzing = false;

let capturedByWhite = [];
let capturedByBlack = [];

// New variables for time control
let timerInterval = null;
let whiteTime = 600000;
let blackTime = 600000;
let gameTime = { base: 0, inc: 0 }; // Default to Unlimited


// --- Core Game Functions ---
function startNewGameWithTime(base, inc, fen = null) {
    gameTime = { base, inc };
    if (fen) {
        initGameFromFen(fen);
    } else {
        initGame();
    }
}

function initGame() {
    stopTimer();
    exitReviewMode();
    game.reset();

    whiteTime = gameTime.base * 60 * 1000;
    blackTime = gameTime.base * 60 * 1000;
    
    gameActive = true;
    isStockfishThinking = false;
    pendingPremove = null;
    pendingMove = null;
    moveAnalysisData = []; 
    capturedByWhite = []; 
    capturedByBlack = []; 
    removePremoveHighlight();
    removeLegalHighlights();
    selectedSquare = null;
    clearUserShapes();
    buildBoard('start');
    updatePlayerLabels();
    updateEvalBar(0);
    updateGameSummary();
    updateGameState(false);
    window.playSound('gameStart');
    showLiveGameView();
    showTab('moves');
    
    setTimeout(() => {
        if (board) board.resize();
    }, 100);
    
    if (game.turn() === aiPlayer) {
        setTimeout(makeAiMove, 500);
    }

    if (gameActive && gameTime.base > 0) {
       startTimer();
    } else {
       updateClockDisplay();
    }
}

function initGameFromFen(fen) {
    stopTimer();
    exitReviewMode();
    
    if (!game.load(fen)) {
        console.error("Invalid FEN provided:", fen);
        Swal.fire('Error', 'The provided FEN string is invalid.', 'error');
        return;
    }
    
    whiteTime = gameTime.base * 60 * 1000;
    blackTime = gameTime.base * 60 * 1000;
    
    gameActive = true;
    isStockfishThinking = false;
    pendingPremove = null;
    pendingMove = null;
    moveAnalysisData = []; 
    capturedByWhite = []; 
    capturedByBlack = []; 
    removePremoveHighlight();
    removeLegalHighlights();
    selectedSquare = null;
    clearUserShapes();
    buildBoard(game.fen());
    updatePlayerLabels();
    updateEvalBar(0);
    updateGameSummary();
    updateGameState(false);
    window.playSound('notify');
    showLiveGameView();
    showTab('moves');
    
    setTimeout(() => {
        if (board) board.resize();
    }, 100);

    if (game.turn() === aiPlayer) {
        setTimeout(makeAiMove, 500);
    }

    if (gameActive && gameTime.base > 0) {
       startTimer();
    } else {
       updateClockDisplay();
    }
}

function updateGameState(updateBoard = true) {
    if (updateBoard && reviewMoveIndex === null) {
        board.position(game.fen());
        redrawUserShapes();
    }
    updateStatus();
    updateCapturedPieces();
    updateMoveHistoryDisplay();
    updateOpeningName();
    updateThreatHighlights();
    updateOpeningExplorer();
    updateClockDisplay();

    if (!gameActive || game.game_over()) {
        if (gameActive) {
            stopTimer();
            endGame();
        }
        return;
    }

    if (reviewMoveIndex === null && game.history().length > 0) {
        setTimeout(analyzeLastMove, 100);
    }

    if (game.turn() === aiPlayer && !isStockfishThinking && reviewMoveIndex === null) {
        makeAiMove();
    }
}

function endGame() {
    stopTimer();
    gameActive = false;
    isStockfishThinking = false;
    let msg = "";
    if (game.in_checkmate()) { msg = `Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`; }
    else if (game.in_stalemate()) { msg = "Stalemate"; }
    else if (game.in_threefold_repetition()) { msg = "Draw by threefold repetition"; }
    else if (game.insufficient_material()) { msg = "Draw by insufficient material"; }
    else { msg = "Game is a draw."; }
    statusElement.text(msg);
    window.playSound('gameEnd');
    showGameOverView();
    console.log({ logType: 'info', text: `Game Over. Result: ${msg}` });
}

function endGameByFlag(loserColor) {
    stopTimer();
    gameActive = false;
    const winnerColor = loserColor === 'white' ? 'Black' : 'White';
    const msg = `${winnerColor} wins on time.`;
    statusElement.text(msg);
    game.header('Result', winnerColor === 'White' ? '1-0' : '0-1');
    window.playSound('gameEnd');
    showGameOverView();
    console.log({ logType: 'info', text: `Game Over. Result: ${msg}` });
}

// --- Timer Functions ---
function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function startTimer() {
    if (timerInterval) stopTimer();
    timerInterval = setInterval(tick, 100);
}

function tick() {
    const turn = game.turn();
    if (turn === 'w') {
        whiteTime -= 100;
        if (whiteTime <= 0) {
            whiteTime = 0;
            updateClockDisplay();
            endGameByFlag('white');
        }
    } else {
        blackTime -= 100;
        if (blackTime <= 0) {
            blackTime = 0;
            updateClockDisplay();
            endGameByFlag('black');
        }
    }
    updateClockDisplay();
}

// --- Move Handling ---
function performMove(move) {
    removeLegalHighlights();
    selectedSquare = null;
    clearUserShapes();

    clearTimeout(engineTimeout);
    
    stopTimer();
    const playerWhoMoved = game.turn();
    
    const moveResult = game.move(move, { sloppy: true });
    isStockfishThinking = false;
    
    if (moveResult) {
        if (gameTime.inc > 0) {
            if (playerWhoMoved === 'w') {
                whiteTime += gameTime.inc * 1000;
            } else {
                blackTime += gameTime.inc * 1000;
            }
        }

        if (moveResult.captured) {
            if (moveResult.color === 'w') { 
                capturedByWhite.push({ type: moveResult.captured, color: 'b' });
            } else { 
                capturedByBlack.push({ type: moveResult.captured, color: 'w' });
            }
        }
        playMoveSound(moveResult);
        updateGameState(true);
        
        if (gameActive && gameTime.base > 0) {
            startTimer();
        }
        
        if (pendingPremove && gameActive) setTimeout(executePremove, 50);
    } else {
        if (gameActive && gameTime.base > 0) {
            startTimer(); // Restart clock if move was invalid
        }
    }
}

function executePremove() {
    if (!pendingPremove) return;
    const move = pendingPremove;
    pendingPremove = null;
    removePremoveHighlight();
    const validPremove = game.moves({ verbose: true }).find(m => m.from === move.from && m.to === move.to);
    if (validPremove) {
        clearUserShapes();
        performMove(validPremove.san);
    }
}

function undoLastTurn() {
    if (game.history().length < 1) return;
    stopTimer();
    
    const movesToUndo = (game.turn() !== humanPlayer && game.history().length > 1) ? 2 : 1;

    for (let i = 0; i < movesToUndo; i++) {
        if (game.history().length > 0) game.undo();
    }

    // After undoing, fully recalculate the captured pieces list from the new history.
    capturedByWhite = [];
    capturedByBlack = [];
    game.history({ verbose: true }).forEach(move => {
        if (move.captured) {
            if (move.color === 'w') capturedByWhite.push({ type: move.captured, color: 'b' });
            else capturedByBlack.push({ type: move.captured, color: 'w' });
        }
    });

    if (window.moveAnalysisData) {
        moveAnalysisData.length = game.history().length;
    }

    if (gameActive && gameTime.base > 0) {
        startTimer();
    }
}


// --- Live Analysis Functions ---
async function analyzeLastMove() {
    if (isLiveAnalyzing) return; 

    isLiveAnalyzing = true;
    const history = game.history({ verbose: true });
    if (history.length === 0) {
        isLiveAnalyzing = false;
        return;
    }

    const moveIndex = history.length - 1;
    const lastMove = history[moveIndex];
    
    moveAnalysisData[moveIndex] = { classification: 'Pending' };
    updateMoveHistoryDisplay();

    const undoneMove = game.undo();
    if (!undoneMove) {
        isLiveAnalyzing = false;
        return; 
    }
    const fenBefore = game.fen();
    game.move(undoneMove.san);
    
    const evalBefore = await getLiveEvaluation(fenBefore);
    const evalAfter = await getLiveEvaluation(game.fen());

    const evalBeforePlayer = (lastMove.color === 'w') ? evalBefore : -evalBefore;
    const evalAfterPlayer = (lastMove.color === 'w') ? evalAfter : -evalAfter;
    const cpl = Math.max(0, evalBeforePlayer - evalAfterPlayer);

    const opponentCpl = moveIndex > 0 && moveAnalysisData[moveIndex - 1] ? moveAnalysisData[moveIndex - 1].cpl || 0 : 0;
    const classification = classifyLiveMove(cpl, opponentCpl, game.pgn());

    moveAnalysisData[moveIndex] = { classification: classification, cpl: cpl };
    
    console.log({
        logType: 'analysis',
        move: lastMove.san,
        classification: classification,
        cpl: cpl,
        evalBefore: (evalBefore/100).toFixed(2),
        evalAfter: (evalAfter/100).toFixed(2)
    });
    
    updateMoveHistoryDisplay();
    isLiveAnalyzing = false;
}

function getLiveEvaluation(fen) {
    return new Promise((resolve) => {
        if (!liveAnalysisStockfish) return resolve(0);

        let bestScore = 0;
        let onMessage;
        
        const timeout = setTimeout(() => {
            if (liveAnalysisStockfish) liveAnalysisStockfish.onmessage = null;
            console.warn(`Live analysis timed out for FEN: ${fen}`);
            resolve(bestScore);
        }, 3000);
        
        onMessage = (event) => {
            const message = event.data;
            if (message.startsWith('info depth')) {
                const scoreMatch = message.match(/score (cp|mate) (-?\d+)/);
                if (scoreMatch) {
                    let score = parseInt(scoreMatch[2]);
                    if (scoreMatch[1] === 'mate') score = (score > 0 ? 1 : -1) * APP_CONFIG.MATE_SCORE;
                    bestScore = score;
                }
            }
            if (message.startsWith('bestmove')) {
                clearTimeout(timeout);
                if (liveAnalysisStockfish) liveAnalysisStockfish.onmessage = null;
                resolve(bestScore);
            }
        };

        try {
            liveAnalysisStockfish.onmessage = onMessage;
            liveAnalysisStockfish.postMessage('stop');
            liveAnalysisStockfish.postMessage(`position fen ${fen}`);
            liveAnalysisStockfish.postMessage('go depth 12');
        } catch (e) {
            console.error("Failed to send command to live analysis engine.", e);
            clearTimeout(timeout);
            resolve(0);
        }
    });
}

function classifyLiveMove(cpl, opponentCpl, pgn) {
    const pgnParts = pgn.split(' ').filter(p => p.includes('.')).length;
    if (pgnParts <= 10 && OPENINGS.some(o => pgn.trim().startsWith(o.pgn))) return 'Book';
    if (opponentCpl > 150 && cpl > 70) return 'Miss';
    if (cpl >= 300) return 'Blunder';
    if (cpl >= 120) return 'Mistake';
    if (cpl >= 50) return 'Inaccuracy';
    if (cpl < 10) return 'Best';
    if (cpl < 30) return 'Excellent';
    return 'Good';
}

// --- AI Functions ---
function makeAiMove() {
    if (!gameActive || game.game_over()) return;
    isStockfishThinking = true;
    statusElement.text("AI is thinking...").addClass('thinking-animation');
    engineTimeout = setTimeout(() => {
        console.error("AI Timeout: Engine did not respond in 20 seconds.");
        isStockfishThinking = false;
        statusElement.text("AI Timeout. Can't move.").removeClass('thinking-animation');
        updateStatus();
    }, 20000);
    const difficulty = DIFFICULTY_SETTINGS[aiDifficulty];
    const fen = game.fen();
    stockfish.postMessage(`position fen ${fen}`);
    let goCommand = '';
    switch (difficulty.type) {
        case 'random':
            setTimeout(() => performMove(game.moves()[Math.floor(Math.random() * game.moves().length)]), 300);
            return;
        case 'greedy':
            let bestMove = null;
            let maxVal = -1;
            game.moves({ verbose: true }).forEach(move => {
                let moveVal = 0;
                if (move.captured) moveVal = MATERIAL_POINTS[move.captured] || 0;
                if (moveVal > maxVal) { maxVal = moveVal; bestMove = move; }
            });
            if (!bestMove) bestMove = game.moves({verbose: true})[Math.floor(Math.random() * game.moves().length)];
            setTimeout(() => performMove(bestMove.san), 300);
            return;
        case 'stockfish':
            if (difficulty.depth) goCommand = `go depth ${difficulty.depth}`;
            else if (difficulty.movetime) goCommand = `go movetime ${difficulty.movetime}`;
            break;
    }
    console.log({ logType: 'info', text: `AI starts thinking. Command: ${goCommand}` });
    stockfish.postMessage(goCommand);
}


// --- History Review Functions ---
function showHistoryPosition() {
    if (reviewMoveIndex === null) return;
    const history = game.history({ verbose: true });
    const startingFen = game.header().FEN;
    const tempGame = startingFen ? new Chess(startingFen) : new Chess();
    for (let i = 0; i <= reviewMoveIndex; i++) { tempGame.move(history[i].san); }
    board.position(tempGame.fen());
    updateMoveHistoryDisplay();
    updateNavButtons();
    statusElement.text(`Reviewing move ${Math.floor(reviewMoveIndex / 2) + 1}...`);
    clearUserShapes();
}

function exitReviewMode() {
    if (reviewMoveIndex === null) return;
    reviewMoveIndex = null;
    board.position(game.fen());
    updateMoveHistoryDisplay();
    updateNavButtons();
    updateStatus();
    clearUserShapes();
}