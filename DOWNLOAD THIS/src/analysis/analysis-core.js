// src/analysis/analysis-core.js

// ===================================================================================
//  ANALYSIS-CORE.JS
//  Acts as a controller to initiate a game review and manage the resulting data.
// ===================================================================================

window.AnalysisController = {
    // UI Element References
    moveListElement: null,
    evalChartCanvas: null,
    assessmentDetailsElement: null,
    assessmentTitleElement: null,
    assessmentCommentElement: null,
    analysisBoard: null,
    analysisBoardElement: null,
    boardWrapper: null,
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

    // State Variables
    stockfish: null,
    analysisGame: new Chess(),
    gameHistory: [],
    isAnalyzing: false,
    
    // Analysis result data
    reviewData: [],
    accuracy: { w: 0, b: 0 },
    moveCounts: { w: {}, b: {} },
    estimatedElo: { w: 0, b: 0 },
    phaseAnalysis: {},
    keyMoments: [],
    
    // UI state variables
    evalChart: null,
    currentMoveIndex: -1,
    userShapes: [],
    isDrawing: false,
    drawStartSquare: null,

    // UPDATED: Reference the global CLASSIFICATION_DATA from config.js
    CLASSIFICATION_DATA: window.CLASSIFICATION_DATA,

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

            // --- UPDATED: Proactive FEN Validation ---
            const startingFen = this.analysisGame.header().FEN || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
            if (!AnalysisHelpers.isValidFen(startingFen)) {
                this.showError("Analysis cannot start: The game's starting position (FEN) is invalid or corrupted.");
                this.isAnalyzing = false;
                return;
            }

            this.reviewData = [];
            this.currentMoveIndex = -1;
            this.userShapes = [];
            this.isDrawing = false;
            this.drawStartSquare = null;

            this.populateUIReferences();
            this.initializeVisualizerBoard();
            this.runGameReview();
            
        } catch (error) {
            Logger.error('AnalysisController: Error during initialization', error);
            this.showError("Failed to initialize analysis system.");
            this.isAnalyzing = false;
        }
    },

    /**
     * UPDATED: Now shows an interactive error with a "Retry" option.
     */
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
                    // Re-initializing the whole process is the cleanest way to retry.
                    this.init();
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
        }
        
        if (this.evalChart) { try { this.evalChart.destroy(); this.evalChart = null; } catch (e) { Logger.warn('Minor error destroying eval chart.', e); } }
        if (this.visualizerBoard) { try { this.visualizerBoard.destroy(); this.visualizerBoard = null; } catch(e) { Logger.warn('Minor error destroying visualizer board.', e); }}
        if (this.analysisBoard) { try { this.analysisBoard.destroy(); this.analysisBoard = null; } catch(e) { Logger.warn('Minor error destroying analysis board.', e); }}
        
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
            this.estimatedElo = analysisResult.elo;
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
            if (this.isAnalyzing) { // Only set to false if it wasn't already set by showError
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