// ===================================================================================
//  GAME.JS
//  Manages core game logic, state transitions, and interaction between modules.
// ===================================================================================

// --- Game State ---
const game = new Chess();
let gameActive = true;
let humanPlayer = 'w';
let aiPlayer = 'b';
let pendingMove = null;
let pendingPremove = null;
let reviewMoveIndex = null;
let isAnalysisMode = false;
let currentStartingFen = 'start';

let moveAnalysisData = [];
let liveAnalysisStockfish = null; 
let isLiveAnalyzing = false;

let capturedByWhite = [];
let capturedByBlack = [];

function startNewGameWithTime(base, inc, fen = 'start') {
    gameTime = { base, inc };
    currentStartingFen = fen;
    initGame(fen);
}

function initGame(fen = 'start') {
    stopTimer();
    exitReviewMode();
    
    if (fen === 'start') {
        game.reset();
    } else {
        if (!game.load(fen)) {
            console.error("Invalid FEN provided:", fen);
            Swal.fire('Error', 'The provided FEN string is invalid.', 'error');
            game.reset(); // Fallback to a valid state
        }
    }

    whiteTime = gameTime.base * 60 * 1000;
    blackTime = gameTime.base * 60 * 1000;
    
    gameActive = true;
    pendingPremove = null;
    pendingMove = null;
    moveAnalysisData = []; 
    capturedByWhite = []; 
    capturedByBlack = []; 
    removePremoveHighlight();
    removeLegalHighlights();
    selectedSquare = null;
    userShapes.length = 0; // Clear user drawings
    
    buildBoard(game.fen());
    updatePlayerLabels();
    updateEvalBar(0);
    updateGameSummary();
    updateGameState(false);
    playSound('gameStart');
    showLiveGameView();
    showTab('moves');
    
    setTimeout(() => { if (board) board.resize(); }, 100);
    
    if (game.turn() === aiPlayer) {
        setTimeout(makeAiMove, 500);
    }

    if (gameActive && gameTime.base > 0) {
       startTimer();
    }
    updateClockDisplay();
}

function updateGameState(updateBoard = true) {
    if (updateBoard && reviewMoveIndex === null) {
        board.position(game.fen());
        const drawingOptions = { svgOverlay: $('#board-svg-overlay'), boardElement: $('#board'), boardObject: board };
        redrawUserShapes(userShapes, drawingOptions);
    }
    updateStatus();
    updateCapturedPieces();
    updateMoveHistoryDisplay();
    updateOpeningName();
    updateThreatHighlights();
    updateOpeningExplorer();
    updateClockDisplay();

    if (game.game_over()) {
        if (gameActive) endGame();
        return;
    }

    if (reviewMoveIndex === null && game.history().length > 0) {
        analyzeLastMove();
    }

    if (game.turn() === aiPlayer && !isStockfishThinking && reviewMoveIndex === null) {
        makeAiMove();
    }
}

function endGame() {
    stopTimer();
    gameActive = false;
    isStockfishThinking = false;
    let msg = "Game Over";
    if (game.in_checkmate()) { msg = `Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`; }
    else if (game.in_stalemate()) { msg = "Stalemate"; }
    else if (game.in_threefold_repetition()) { msg = "Draw by Threefold Repetition"; }
    else if (game.insufficient_material()) { msg = "Draw by Insufficient Material"; }
    else if (game.isDraw()) { msg = "Draw by 50-move Rule"; }
    
    statusElement.text(msg);
    playSound('gameEnd');
    showGameOverView();
    console.log({ logType: 'info', text: `Game Over. Result: ${msg}` });
}

function performMove(move) {
    removeLegalHighlights();
    selectedSquare = null;
    const drawingOptions = { svgOverlay: $('#board-svg-overlay'), boardElement: $('#board'), boardObject: board };
    userShapes.length = 0; // Clear drawings on move
    redrawUserShapes(userShapes, drawingOptions);

    clearTimeout(engineTimeout);
    
    const playerWhoMoved = game.turn();
    const moveResult = game.move(move, { sloppy: true });
    isStockfishThinking = false; // Reset thinking flag after move is made
    
    if (moveResult) {
        if (gameTime.inc > 0) {
            if (playerWhoMoved === 'w') whiteTime += gameTime.inc * 1000;
            else blackTime += gameTime.inc * 1000;
        }

        if (moveResult.captured) {
            const capturedColor = moveResult.color === 'w' ? 'b' : 'w';
            if (moveResult.color === 'w') { 
                capturedByWhite.push({ type: moveResult.captured, color: capturedColor });
            } else { 
                capturedByBlack.push({ type: moveResult.captured, color: capturedColor });
            }
        }
        playMoveSound(moveResult);
        updateGameState(true);
        
        if (pendingPremove && gameActive) setTimeout(executePremove, 50);
    }
}

function executePremove() {
    if (!pendingPremove) return;
    const { from, to } = pendingPremove;
    pendingPremove = null;
    removePremoveHighlight();
    
    const validPremove = game.moves({ verbose: true }).find(m => m.from === from && m.to === to);
    if (validPremove) {
        console.log({ logType: 'info', text: `Executing premove: ${validPremove.san}` });
        performMove(validPremove.san);
    }
}

function undoLastTurn() {
    if (game.history().length === 0) return;
    stopTimer();
    
    const movesToUndo = game.turn() !== humanPlayer && game.history().length > 1 ? 2 : 1;

    for (let i = 0; i < movesToUndo; i++) {
        game.undo();
    }

    capturedByWhite = [];
    capturedByBlack = [];
    game.history({ verbose: true }).forEach(move => {
        if (move.captured) {
            const capturedColor = move.color === 'w' ? 'b' : 'w';
            if (move.color === 'w') capturedByWhite.push({ type: move.captured, color: capturedColor });
            else capturedByBlack.push({ type: move.captured, color: capturedColor });
        }
    });

    if (window.moveAnalysisData) {
        moveAnalysisData.length = game.history().length;
    }
    
    if (gameActive && gameTime.base > 0) startTimer();
    updateGameState(true);
}

function exitReviewMode() {
    if (reviewMoveIndex === null) return;
    reviewMoveIndex = null;
    board.position(game.fen());
    updateGameState(false);
}

// --- Live Analysis Functions (re-integrated) ---

async function analyzeLastMove() {
    if (isLiveAnalyzing || !liveAnalysisStockfish) return; 

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
    
    updateMoveHistoryDisplay();
    isLiveAnalyzing = false;
}

function getLiveEvaluation(fen) {
    return new Promise((resolve) => {
        if (!liveAnalysisStockfish) return resolve(0);

        let bestScore = 0;
        
        const timeout = setTimeout(() => {
            liveAnalysisStockfish.onmessage = null;
            resolve(bestScore);
        }, 3000);
        
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
                resolve(bestScore);
            }
        };

        try {
            liveAnalysisStockfish.postMessage('stop');
            liveAnalysisStockfish.postMessage(`position fen ${fen}`);
            liveAnalysisStockfish.postMessage('go depth 12');
        } catch (e) {
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