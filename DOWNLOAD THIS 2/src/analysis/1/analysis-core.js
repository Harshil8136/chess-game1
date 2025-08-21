// src/analysis/analysis-core.js

// ===================================================================================
//  ANALYSIS-CORE.JS
//  Defines the main AnalysisController and its core data/logic.
// ===================================================================================

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
    accuracy: { w: 0, b: 0 },
    moveCounts: { w: {}, b: {} },
    elo: { w: 0, b: 0 },
    phaseAnalysis: {},
    keyMoments: [],
    userShapes: [],
    isDrawing: false,
    drawStartSquare: null,

    // UPDATED: Corrected icon paths to include the 'assets/' directory.
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

    init: function() {
        Logger.info('AnalysisController: Initializing with dedicated engine...');
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

            // UPDATED: Redundant initializations removed. The GameReviewer is now the single source of truth.
            
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
        this.isAnalyzing = false;
        analysisVisualizer.addClass('hidden');

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Analysis Error',
                text: message,
                icon: 'error',
                showCancelButton: true,
                confirmButtonText: 'Retry Analysis',
                cancelButtonText: 'Return to Game',
                customClass: {
                    popup: '!bg-bg-panel',
                    title: '!text-white',
                    htmlContainer: '!text-text-dark',
                    confirmButton: '!btn-primary !px-6 !py-2',
                    cancelButton: '!btn-secondary !px-6 !py-2'
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    Logger.info('User chose to retry analysis.');
                    $('#run-review-btn').click();
                } else {
                    if (typeof switchToMainGame === 'function') switchToMainGame();
                }
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
            // UPDATED: Removed modification of global 'analysisStockfish' variable to prevent engine cross-contamination.
        }
        
        if (this.evalChart) { try { this.evalChart.destroy(); this.evalChart = null; } catch (e) { /* ignore */ } }
        if (this.visualizerBoard) { try { this.visualizerBoard.destroy(); this.visualizerBoard = null; } catch(e) { /* ignore */ }}
        if (this.analysisBoard) { try { this.analysisBoard.destroy(); this.analysisBoard = null; } catch(e) { /* ignore */ }}
        
        $(document).off('keydown.analysis');
        $(document).off('mouseup.analysis_draw');
    },

    runGameReview: async function() {
        if (this.gameHistory.length === 0) {
            this.showError("No moves to analyze.");
            return;
        }
        
        try {
            const progressCallback = (progress) => {
                if (!this.isAnalyzing) return;
                const percent = (progress.moveNumber / progress.totalMoves) * 100;
                this.visualizerStatusElement.text(`Analyzing move ${progress.moveNumber} of ${progress.totalMoves}...`);
                this.visualizerProgressBar.css('width', `${percent}%`);
                this.visualizerBoard.position(this.gameHistory[progress.moveNumber - 1].after);
                this.visualizerMovePlayedElement.text(progress.moveSan);
                this.visualizerMoveAssessmentElement.text('Evaluating...');
            };

            const analysisResult = await window.GameReviewer.analyze(
                this.analysisGame.pgn(),
                this.stockfish,
                progressCallback
            );

            if (!this.isAnalyzing) return;

            this.reviewData = analysisResult.moves;
            this.accuracy = analysisResult.accuracy;
            this.elo = analysisResult.elo;
            this.moveCounts = analysisResult.moveCounts;
            this.phaseAnalysis = analysisResult.phaseAnalysis;
            this.keyMoments = analysisResult.keyMoments;
            
            if (typeof switchToAnalysisRoom === 'function') switchToAnalysisRoom();
            this.initializeBoard();
            this.setupEventHandlers();
            this.renderFinalReview();

        } catch (error) {
            this.showError(`Analysis failed. Error: ${error.message}`);
            Logger.error('Analysis failed during review process', error);
        } finally {
            if (this.isAnalyzing) {
                this.isAnalyzing = false;
            }
        }
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
            Logger.warn('Could not convert UCI line to SAN.', e);
            return uciLine;
        }
    },
};