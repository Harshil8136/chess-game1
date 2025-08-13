// ===================================================================================
//  ANALYSIS-MAIN.JS
//  Defines the main AnalysisController object, state, and init/stop methods.
// ===================================================================================

window.AnalysisController = {
    // --- UI Element References (will be populated by analysis-ui-init.js) ---
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
    isDeepAnalyzing: false, // Flag to prevent multiple deep analyses at once
    accuracy: { w: 0, b: 0 },
    moveCounts: { w: {}, b: {} },
    cpl: { w: [], b: [] },
    userShapes: [],
    isDrawing: false,
    drawStartSquare: null,
    startingFen: 'start',

    // --- Main Control Methods ---
    init: function() {
        console.log('AnalysisController: Initializing with dedicated engine...');
        const gameData = window.gameDataToAnalyze;
        if (!gameData || !gameData.stockfish || !gameData.pgn) {
            this.showError("Game data is missing or incomplete for analysis.");
            return;
        }

        try {
            this.isAnalyzing = true; 
            this.stockfish = gameData.stockfish;
            this.startingFen = gameData.fen || 'start';
            
            this.analysisGame = new Chess();
            this.analysisGame.load_pgn(gameData.pgn);
            this.gameHistory = this.analysisGame.history({ verbose: true });
            this.reviewData = [];
            this.currentMoveIndex = -1;

            this.userShapes = [];
            this.isDrawing = false;
            this.drawStartSquare = null;
            this.accuracy = { w: 0, b: 0 };
            this.cpl = { w: [], b: [] };
            this.moveCounts = { w: {}, b: {} };
            for (const key in CLASSIFICATION_DATA) {
                this.moveCounts.w[key] = 0;
                this.moveCounts.b[key] = 0;
            }

            this.populateUIReferences();
            this.initializeVisualizerBoard();
            this.runGameReview();
            
        } catch (error) {
            console.error('AnalysisController: Error during initialization:', error);
            this.showError("Failed to initialize analysis system.");
            this.isAnalyzing = false;
        }
    },

    stop: function() {
        console.log('AnalysisController: Stopping analysis...');
        this.isAnalyzing = false;
        
        // Terminate the dedicated analysis worker
        if (this.stockfish && typeof this.stockfish.terminate === 'function') { 
            this.stockfish.terminate();
            this.stockfish = null;
            analysisStockfish = null; // Also nullify the global ref from ui-core
        }
        
        // Clean up UI components
        if (this.evalChart) { try { this.evalChart.destroy(); this.evalChart = null; } catch (e) { console.warn(e); } }
        if (this.visualizerBoard) { try { this.visualizerBoard.destroy(); this.visualizerBoard = null; } catch(e) { console.warn(e); }}
        if (this.analysisBoard) { try { this.analysisBoard.destroy(); this.analysisBoard = null; } catch(e) { console.warn(e); }}
        if(this.reviewSummaryContainer) this.reviewSummaryContainer.addClass('hidden');
        if(this.assessmentDetailsElement) this.assessmentDetailsElement.addClass('hidden');
        
        // Unbind all analysis-specific events
        $(document).off('keydown.analysis');
        $(document).off('mouseup.analysis_draw');
        if(this.moveListElement) this.moveListElement.off();
        if(this.retryMistakeBtn) this.retryMistakeBtn.off();

        // Reset state
        this.clearUserShapes();
        this.reviewData = [];
        this.currentMoveIndex = -1;
    },

    showError: function(message) {
        // This helper function remains here for self-contained error handling
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
};