// src/js/game.js

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

let timerInterval = null;
let whiteTime = 600000;
let blackTime = 600000;
let gameTime = { base: 0, inc: 0 };

let liveAnalysisQueue = [];
let isLiveEngineBusy = false;


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
    Logger.startNewSession();
    stopTimer();
    exitReviewMode();
    game.reset();

    whiteTime = gameTime.base * 60 * 1000;
    blackTime = gameTime.base * 60 * 1000;
    
    gameActive = true;
    isStockfishThinking = false;
    isAnalysisMode = false;
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
    Logger.startNewSession();
    stopTimer();
    exitReviewMode();
    
    if (!game.load(fen)) {
        const errorMsg = 'Invalid FEN provided for new game';
        Logger.error(errorMsg, new Error(errorMsg));
        Swal.fire('Error', 'The provided FEN string is invalid.', 'error');
        return;
    }
    
    whiteTime = gameTime.base * 60 * 1000;
    blackTime = gameTime.base * 60 * 1000;
    
    gameActive = true;
    isStockfishThinking = false;
    isAnalysisMode = false;
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
    Logger.info(`Game Over. Result: ${msg}`);
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
    Logger.info(`Game Over. Result: ${msg}`);
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
            const pieceList = moveResult.color === 'w' ? capturedByWhite : capturedByBlack;
            const capturedColor = moveResult.color === 'w' ? 'b' : 'w';
            pieceList.push({ type: moveResult.captured, color: capturedColor });
        }
        playMoveSound(moveResult);
        updateGameState(true);
        
        if (gameActive && gameTime.base > 0) {
            startTimer();
        }
        
        if (pendingPremove && gameActive) setTimeout(executePremove, 50);
    } else {
        if (gameActive && gameTime.base > 0) {
            startTimer();
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
    if (isStockfishThinking || game.history().length < 2 || game.turn() !== humanPlayer) return;
    
    stopTimer();
    game.undo();
    game.undo();

    capturedByWhite = [];
    capturedByBlack = [];
    game.history({ verbose: true }).forEach(move => {
        if (move.captured) {
            const pieceList = move.color === 'w' ? capturedByWhite : capturedByBlack;
            const capturedColor = move.color === 'w' ? 'b' : 'w';
            pieceList.push({ type: move.captured, color: capturedColor });
        }
    });

    if (window.moveAnalysisData) {
        moveAnalysisData.length = game.history().length;
    }

    if (gameActive && gameTime.base > 0) {
        startTimer();
    }
    updateGameState(true);
}


// --- Live Analysis Functions ---
async function analyzeLastMove() {
    if (isLiveAnalyzing || isAnalysisMode) return; 

    isLiveAnalyzing = true;
    const history = game.history({ verbose: true });
    if (history.length === 0) { isLiveAnalyzing = false; return; }

    const moveIndex = history.length - 1;
    const lastMove = history[moveIndex];
    
    moveAnalysisData[moveIndex] = { classification: 'Pending' };
    updateMoveHistoryDisplay();

    const undoneMove = game.undo();
    if (!undoneMove) { isLiveAnalyzing = false; return; }
    const fenBefore = game.fen();
    game.move(undoneMove.san);
    
    const evalBefore = await getLiveEvaluation(fenBefore);
    const evalAfter = await getLiveEvaluation(game.fen());

    const evalBeforePlayer = (lastMove.color === 'w') ? evalBefore : -evalBefore;
    const evalAfterPlayer = (lastMove.color === 'w') ? evalAfter : -evalBefore;
    
    const cpl = Math.max(0, AnalysisHelpers.normalizeEvalForCpl(evalBeforePlayer) - AnalysisHelpers.normalizeEvalForCpl(evalAfterPlayer));
    const opponentCpl = moveIndex > 0 && moveAnalysisData[moveIndex - 1] ? moveAnalysisData[moveIndex - 1].cpl || 0 : 0;
    
    const classification = AnalysisHelpers.classifyMove({ cpl, opponentCpl, evalBefore: evalBeforePlayer, pgn: game.pgn() });
    moveAnalysisData[moveIndex] = { classification: classification, cpl: cpl };
    
    Logger.debug('Live analysis complete', { 
        move: lastMove.san, classification, cpl, 
        evalBefore: (evalBefore/100).toFixed(2), 
        evalAfter: (evalAfter/100).toFixed(2) 
    });
    
    updateMoveHistoryDisplay();
    isLiveAnalyzing = false;
}

function getLiveEvaluation(fen) {
    return new Promise((resolve) => {
        liveAnalysisQueue.push({ fen: fen, resolve: resolve });
        processLiveAnalysisQueue();
    });
}

function processLiveAnalysisQueue() {
    if (isLiveEngineBusy || liveAnalysisQueue.length === 0 || !liveAnalysisStockfish) { return; }
    isLiveEngineBusy = true;
    
    const request = liveAnalysisQueue.shift();
    let bestScore = 0;

    const timeout = setTimeout(() => {
        Logger.warn('Live analysis timed out.', new Error('Live analysis timeout'));
        if (liveAnalysisStockfish) liveAnalysisStockfish.onmessage = null; 
        isLiveEngineBusy = false;
        request.resolve(0); 
        processLiveAnalysisQueue(); 
    }, 5000); 

    liveAnalysisStockfish.onmessage = (event) => {
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
            liveAnalysisStockfish.onmessage = null;
            isLiveEngineBusy = false;
            request.resolve(bestScore);
            processLiveAnalysisQueue();
        }
    };

    try {
        liveAnalysisStockfish.postMessage('stop');
        liveAnalysisStockfish.postMessage(`position fen ${request.fen}`);
        liveAnalysisStockfish.postMessage('go movetime 750');
    } catch (e) {
        Logger.error('Failed to send command to live analysis engine.', e);
        clearTimeout(timeout);
        if (liveAnalysisStockfish) liveAnalysisStockfish.onmessage = null;
        isLiveEngineBusy = false;
        request.resolve(0);
        processLiveAnalysisQueue();
    }
}

// --- AI Functions ---
function makeAiMove() {
    if (!gameActive || game.game_over()) return;

    isStockfishThinking = true;
    statusElement.text("AI is thinking...").addClass('thinking-animation');

    engineTimeout = setTimeout(() => {
        Logger.error("AI Timeout: Engine did not respond.", new Error("Engine Timeout"));
        isStockfishThinking = false;
        updateStatus();
    }, 20000);

    const difficulty = DIFFICULTY_SETTINGS[aiDifficulty];

    switch (difficulty.type) {
        case 'random':
            const randomMoves = game.moves();
            const randomMove = randomMoves[Math.floor(Math.random() * randomMoves.length)];
            setTimeout(() => performMove(randomMove), 300);
            return;

        case 'greedy':
            let bestGreedyMove = null;
            let maxVal = -1;
            game.moves({ verbose: true }).forEach(move => {
                let moveVal = 0;
                if (move.captured) {
                    moveVal = MATERIAL_POINTS[move.captured] || 0;
                }
                if (moveVal > maxVal) {
                    maxVal = moveVal;
                    bestGreedyMove = move;
                }
            });

            if (!bestGreedyMove) {
                const greedyMoves = game.moves({ verbose: true });
                bestGreedyMove = greedyMoves[Math.floor(Math.random() * greedyMoves.length)];
            }
            setTimeout(() => performMove(bestGreedyMove.san), 300);
            return;

        case 'stockfish':
            stockfish.postMessage(`position fen ${game.fen()}`);
            let goCommand = '';
            if (difficulty.depth) {
                goCommand = `go depth ${difficulty.depth}`;
            } else if (difficulty.movetime) {
                goCommand = `go movetime ${difficulty.movetime}`;
            }
            Logger.info(`AI starts thinking.`, { command: goCommand });
            stockfish.postMessage(goCommand);
            break;
    }
}


// --- History Review Functions ---
function showHistoryPosition() {
    if (reviewMoveIndex === null) return;
    const history = game.history({ verbose: true });
    const tempGame = new Chess(game.header().FEN || undefined);
    for (let i = 0; i <= reviewMoveIndex; i++) { tempGame.move(history[i]); }
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