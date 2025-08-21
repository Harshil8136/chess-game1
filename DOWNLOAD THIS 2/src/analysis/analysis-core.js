// src/js/analysis-core.js

// ===================================================================================
//  ANALYSIS-CORE.JS
//  Defines the main AnalysisController and its core data/logic.
// ===================================================================================

// UPDATED: New private helper function to gracefully stop the engine and wait for it to be ready.
function _resetEngine(stockfish) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("Engine did not become ready after 'stop' command."));
        }, 3000);

        stockfish.onmessage = (event) => {
            if (event.data === 'readyok') {
                clearTimeout(timeout);
                stockfish.onmessage = null;
                resolve();
            }
        };
        stockfish.postMessage('stop');
        stockfish.postMessage('isready');
    });
}

window.AnalysisController = {
    // --- UI Element References (will be populated by analysis-ui.js) ---
    moveListElement: null,
    evalChartCanvas: null,
    assessmentDetailsElement: null,
    assessmentTitleElement: null,
    assessmentCommentElement: null,
    analysisBoard: null,
    analysisBoardElement: null,
    boardWrapper: null,
    reviewSummaryContainer: null,
    whiteAccuracyElement: null,
    blackAccuracyElement: null,
    moveCountsContainer: null,
    retryMistakeBtn: null,
    bestLineDisplay: null,
    bestLineMoves: null,
    analysisBoardSvgOverlay: null,
    visualizerBoard: null,
    visualizerBoardWrapper: null,
    visualizerStatusElement: null,
    visualizerMoveNumberElement: null,
    visualizerMovePlayedElement: null,
    visualizerMoveAssessmentElement: null,
    visualizerProgressBar: null,

    // --- State Variables ---
    stockfish: null,
    analysisGame: new Chess(),
    gameHistory: [],
    reviewData: [],
    evalChart: null,
    currentMoveIndex: -1,
    isAnalyzing: false,
    isDeepAnalyzing: false,
    accuracy: { w: 0, b: 0 },
    moveCounts: { w: {}, b: {} },
    cpl: { w: [], b: [] },
    userShapes: [],
    isDrawing: false,
    drawStartSquare: null,

    // --- State variables for new analysis features ---
    cplByPlayer: { w: [], b: [] }, 
    elo: { w: 0, b: 0 },
    phaseAnalysis: {
        w: { opening: -1, middlegame: -1, endgame: -1 },
        b: { opening: -1, middlegame: -1, endgame: -1 }
    },
    keyMoments: [],

    // UPDATED: Corrected icon paths to include 'assets/' prefix.
    CLASSIFICATION_DATA: {
        'Brilliant': { title: 'Brilliant', comment: 'A great sacrifice or the only good move in a critical position!', color: 'classification-color-brilliant', bgColor: 'classification-bg-brilliant', icon: 'assets/icon/classification-brilliant.png' },
        'Great': { title: 'Great Move', comment: 'Finds the only good move in a complex position.', color: 'classification-color-great', bgColor: 'classification-bg-great', icon: 'assets/icon/classification-great.png' },
        'Best': { title: 'Best Move', comment: 'The strongest move, according to the engine.', color: 'classification-color-best', bgColor: 'classification-bg-best', icon: 'assets/icon/classification-best.png' },
        'Excellent': { title: 'Excellent', comment: 'A strong move that maintains the position\'s potential.', color: 'classification-color-excellent', bgColor: 'classification-bg-excellent', icon: 'assets/icon/classification-excellent.png' },
        'Good': { title: 'Good', comment: 'A solid, decent move.', color: 'classification-color-good', bgColor: 'classification-bg-good', icon: 'assets/icon/classification-good.png' },
        'Book': { title: 'Book Move', comment: 'A standard opening move from theory.', color: 'classification-color-book', bgColor: 'classification-bg-book', icon: 'assets/icon/classification-book.png' },
        'Inaccuracy': { title: 'Inaccuracy', comment: 'This move weakens your position slightly.', color: 'classification-color-inaccuracy', bgColor: 'classification-bg-inaccuracy', icon: 'assets/icon/classification-inaccuracy.png' },
        'Mistake': { title: 'Mistake', comment: 'A significant error that damages your position.', color: 'classification-color-mistake', bgColor: 'classification-bg-mistake', icon: 'assets/icon/classification-mistake.png' },
        'Blunder': { title: 'Blunder', comment: 'A very bad move that could lead to losing the game.', color: 'classification-color-blunder', bgColor: 'classification-bg-blunder', icon: 'assets/icon/classification-blunder.png' },
        'Miss': { title: 'Missed Opportunity', comment: 'Your opponent made a mistake, but you missed the best punishment.', color: 'classification-color-miss', bgColor: 'classification-bg-miss', icon: 'assets/icon/classification-miss.png' }
    },
    DEEP_ANALYSIS_MOVETIME: 2000,

    init: function() {
        Logger.info('AnalysisController: Initializing...');
        const gameData = window.gameDataToAnalyze;
        if (!gameData || !gameData.stockfish || !gameData.pgn) {
            this.showError("Game data is missing or incomplete for analysis.");
            return;
        }

        try {
            this.isAnalyzing = true;
            this.stockfish = gameData.stockfish;
            
            this.analysisGame = new Chess();
            this.analysisGame.load_pgn(gameData.pgn);
            this.gameHistory = this.analysisGame.history({ verbose: true });
            
            // Reset all state variables
            this.reviewData = [];
            this.currentMoveIndex = -1;
            this.userShapes = [];
            this.isDrawing = false;
            this.drawStartSquare = null;
            this.accuracy = { w: 0, b: 0 };
            this.cpl = { w: [], b: [] }; // Kept for compatibility with old structure
            this.cplByPlayer = { w: [], b: [] };
            this.elo = { w: 0, b: 0 };
            this.phaseAnalysis = {
                w: { opening: -1, middlegame: -1, endgame: -1 },
                b: { opening: -1, middlegame: -1, endgame: -1 }
            };
            this.moveCounts = { w: {}, b: {} };

            this.populateUIReferences();
            this.initializeVisualizerBoard();
            this.runGameReview();
            
        } catch (error) {
            Logger.error('AnalysisController: Error during initialization', error);
            this.showError("Failed to initialize analysis system.");
            this.isAnalyzing = false;
        }
    },

    showError: function(message) {
        Logger.error('Analysis Error', new Error(message));
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Analysis Error', text: message, icon: 'error', confirmButtonText: 'Return to Game'
            }).then(() => {
                if (typeof switchToMainGame === 'function') switchToMainGame();
                else $('#return-to-game-btn').click();
            });
        } else {
            alert('Analysis Error: ' + message);
        }
    },

    stop: function() {
        Logger.info('AnalysisController: Stopping analysis...');
        this.isAnalyzing = false;
        
        if (this.stockfish) {
            this.stockfish.terminate();
            this.stockfish = null;
        }
        
        if (this.evalChart) { try { this.evalChart.destroy(); this.evalChart = null; } catch (e) { /* ignore */ } }
        if (this.visualizerBoard) { try { this.visualizerBoard.destroy(); this.visualizerBoard = null; } catch(e) { /* ignore */ }}
        if (this.analysisBoard) { try { this.analysisBoard.destroy(); this.analysisBoard = null; } catch(e) { /* ignore */ }}
        
        $(document).off('keydown.analysis');
        $(document).off('mouseup.analysis_draw');
    },

    // UPDATED: The entire review process is upgraded to be "game-aware" and use the resilient engine evaluation.
    runGameReview: async function() {
        if (this.gameHistory.length === 0) {
            this.showError("No moves to analyze.");
            return;
        }
        
        try {
            let tempGame = new Chess();
            let opponentCpl = 0;
            let lastEval = 20;

            for (let i = 0; i < this.gameHistory.length && this.isAnalyzing; i++) {
                const move = this.gameHistory[i];
                const progressPercent = ((i + 1) / this.gameHistory.length) * 100;
                
                this.visualizerStatusElement.text(`Analyzing move ${i + 1} of ${this.gameHistory.length}...`);
                this.visualizerProgressBar.css('width', `${progressPercent}%`);
                this.visualizerBoard.position(tempGame.fen());
                
                const evalBeforePlayer = (move.color === 'w') ? lastEval : -lastEval;
                tempGame.move(move);
                
                let positionEval;
                if (tempGame.game_over()) {
                    Logger.info(`Game-ending move found: ${move.san}. Bypassing engine.`);
                    let finalScore = 0;
                    if (tempGame.in_checkmate()) {
                        finalScore = (move.color === 'w') ? 10000 : -10000;
                    }
                    positionEval = { best: finalScore, second: finalScore, best_pv: '' };
                } else {
                    positionEval = await this._getEvaluationWithRetry(this.stockfish, tempGame.fen(), lastEval);
                }

                const evalAfter = positionEval.best;
                const evalAfterPlayer = (move.color === 'w') ? evalAfter : -evalAfter;
                
                const cpl = Math.max(0, AnalysisHelpers.normalizeEvalForCpl(evalBeforePlayer) - AnalysisHelpers.normalizeEvalForCpl(evalAfterPlayer));
                const moveNum = Math.floor(i / 2) + 1;
                this.cplByPlayer[move.color].push({ cpl: cpl, moveNum: moveNum });

                const classification = AnalysisHelpers.classifyMove({ cpl, opponentCpl, evalBefore: evalBeforePlayer, pgn: tempGame.pgn(), isCheckmate: tempGame.in_checkmate() });

                this.visualizerMovePlayedElement.text(move.san);
                const classificationInfo = this.CLASSIFICATION_DATA[classification];
                if(classificationInfo) {
                     this.visualizerMoveAssessmentElement.text(classificationInfo.title).attr('class', `font-bold ${classificationInfo.color}`);
                }
                
                this.reviewData.push({ move: move.san, score: evalAfter, classification, bestLineUci: positionEval.best_pv, cpl });

                opponentCpl = cpl;
                lastEval = evalAfter;
            }

            if (this.isAnalyzing) {
                this.recalculateStats();

                const whiteAvgCpl = this.cpl.w.length > 0 ? this.cpl.w.reduce((a, b) => a + b, 0) / this.cpl.w.length : 0;
                const blackAvgCpl = this.cpl.b.length > 0 ? this.cpl.b.reduce((a, b) => a + b, 0) / this.cpl.b.length : 0;
                this.elo = { w: AnalysisHelpers.cplToElo(whiteAvgCpl), b: AnalysisHelpers.cplToElo(blackAvgCpl) };
                
                const OPENING_END = 12;
                const MIDGAME_END = 40;
                this.phaseAnalysis.w.opening = AnalysisHelpers.calculatePhaseCpl(this.cplByPlayer.w, 1, OPENING_END);
                this.phaseAnalysis.w.middlegame = AnalysisHelpers.calculatePhaseCpl(this.cplByPlayer.w, OPENING_END + 1, MIDGAME_END);
                this.phaseAnalysis.w.endgame = AnalysisHelpers.calculatePhaseCpl(this.cplByPlayer.w, MIDGAME_END + 1, 999);
                this.phaseAnalysis.b.opening = AnalysisHelpers.calculatePhaseCpl(this.cplByPlayer.b, 1, OPENING_END);
                this.phaseAnalysis.b.middlegame = AnalysisHelpers.calculatePhaseCpl(this.cplByPlayer.b, OPENING_END + 1, MIDGAME_END);
                this.phaseAnalysis.b.endgame = AnalysisHelpers.calculatePhaseCpl(this.cplByPlayer.b, MIDGAME_END + 1, 999);

                switchToAnalysisRoom();
                this.initializeBoard();
                this.setupEventHandlers();
                this.renderFinalReview();
            }
        } catch (error) {
            this.showError(`Analysis failed. Error: ${error.message}`);
            Logger.error('Analysis failed during review process', error);
        } finally {
            this.isAnalyzing = false;
        }
    },
    
    // UPDATED: The engine evaluation logic is now fully resilient with a retry-and-reset mechanism.
    _getEvaluationWithRetry: async function(stockfish, fen, lastEval) {
        const _singleAttempt = (movetime) => {
            return new Promise((resolve, reject) => {
                let scores = {}; let best_pv = ''; let bestMoveFound = false;
                const timeout = setTimeout(() => !bestMoveFound && reject(new Error("Evaluation timed out")), 8000);

                stockfish.onmessage = (event) => {
                    const message = event.data;
                    const pvMatch = message.match(/multipv (\d+) .* pv (.+)/);
                    if (pvMatch) {
                        const pvIndex = parseInt(pvMatch[1]);
                        const scoreMatch = message.match(/score (cp|mate) (-?\d+)/);
                        if (scoreMatch) {
                            let score = parseInt(scoreMatch[2]);
                            if (scoreMatch[1] === 'mate') score = (score > 0 ? 1 : -1) * 10000;
                            scores[pvIndex] = score;
                        }
                        if (pvIndex === 1) best_pv = pvMatch[2];
                    }
                    if (message.startsWith('bestmove')) {
                        bestMoveFound = true;
                        clearTimeout(timeout);
                        stockfish.onmessage = null;
                        resolve({ best: scores[1] || 0, second: scores[2] || 0, best_pv });
                    }
                };
                stockfish.postMessage(`setoption name MultiPV value 3`);
                stockfish.postMessage(`position fen ${fen}`);
                stockfish.postMessage(`go movetime ${movetime}`);
            });
        };
        
        try {
            return await _singleAttempt(1500);
        } catch (error) {
            Logger.warn(`Evaluation timed out. Resetting engine and retrying...`, { fen });
            await _resetEngine(stockfish);
            try {
                return await _singleAttempt(3000);
            } catch (retryError) {
                Logger.error(`Evaluation failed on retry. Using fallback.`, { fen });
                await _resetEngine(stockfish);
                return { best: lastEval, second: lastEval, best_pv: '' };
            }
        }
    },
    
    recalculateStats: function() {
        this.cpl = { w: [], b: [] };
        this.moveCounts = { w: {}, b: {} };
        for (const key in this.CLASSIFICATION_DATA) {
            if (Object.prototype.hasOwnProperty.call(this.CLASSIFICATION_DATA, key)) {
                this.moveCounts.w[key] = 0;
                this.moveCounts.b[key] = 0;
            }
        }

        this.reviewData.forEach((data, index) => {
            const player = this.gameHistory[index].color;
            if (data.cpl >= 0) {
                this.cpl[player].push(data.cpl);
            }
            if (this.moveCounts[player] && data.classification in this.moveCounts[player]) {
                this.moveCounts[player][data.classification]++;
            }
        });

        this.calculateAccuracy();
    },
    
    calculateAccuracy: function() {
        const calculate = (cpl_array) => {
            if (cpl_array.length === 0) return 100;
            const avg_cpl = cpl_array.reduce((a, b) => a + b, 0) / cpl_array.length;
            return Math.max(0, Math.min(100, Math.round(103.16 * Math.exp(-0.04354 * avg_cpl))));
        };
        this.accuracy.w = calculate(this.cpl.w);
        this.accuracy.b = calculate(this.cpl.b);
    },
    
    uciToSanLine: function(fen, uciLine) {
        try {
            const tempGame = new Chess(fen);
            const moves = uciLine.split(' ');
            let sanMoves = [];
            for (let i = 0; i < Math.min(moves.length, 5); i++) {
                const move = tempGame.move(moves[i], { sloppy: true });
                if (move) sanMoves.push(move.san); else break;
            }
            return sanMoves.join(' ');
        } catch(e) {
            Logger.warn('Could not convert UCI line to SAN.', { fen, uciLine });
            return uciLine;
        }
    },
};