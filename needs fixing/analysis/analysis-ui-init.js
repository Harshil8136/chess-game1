// ===================================================================================
//  ANALYSIS-UI-INIT.JS
//  Initializes UI element references and the analysis board.
// ===================================================================================

(function(controller) {
    if (!controller) {
        console.error("Analysis Controller must be initialized before loading UI components.");
        return;
    }

    const uiInitMethods = {
        populateUIReferences: function() {
            this.moveListElement = $('#ar-analysis-move-list');
            this.evalChartCanvas = $('#ar-eval-chart');
            this.assessmentDetailsElement = $('#ar-move-assessment-details');
            this.assessmentTitleElement = $('#ar-assessment-title');
            this.assessmentCommentElement = $('#ar-assessment-comment');
            this.boardWrapper = $('#analysis-room .board-wrapper');
            this.reviewSummaryContainer = $('#review-summary-container');
            this.whiteAccuracyElement = $('#ar-white-accuracy');
            this.blackAccuracyElement = $('#ar-black-accuracy');
            this.moveCountsContainer = $('#ar-move-counts');
            this.retryMistakeBtn = $('#ar-retry-mistake-btn');
            this.bestLineDisplay = $('#ar-best-line-display');
            this.bestLineMoves = $('#ar-best-line-moves');
            this.analysisBoardSvgOverlay = $('#analysis-board-svg-overlay');
            this.analysisBoardElement = $('#analysis-board');
            this.visualizerBoardWrapper = $('#visualizer-board-wrapper');
            this.visualizerStatusElement = $('#visualizer-status');
            this.visualizerMoveNumberElement = $('#visualizer-move-number');
            this.visualizerMovePlayedElement = $('#visualizer-move-played');
            this.visualizerMoveAssessmentElement = $('#visualizer-move-assessment');
            this.visualizerProgressBar = $('#visualizer-progress-bar');
        },

        initializeBoard: function() {
            try {
                const boardConfig = {
                    position: 'start',
                    pieceTheme: PIECE_THEMES[localStorage.getItem('chessPieceTheme') || 'cburnett'],
                    draggable: false, // Draggability is not needed on the analysis board
                    showNotation: false
                };
                if (this.analysisBoard && typeof this.analysisBoard.destroy === 'function') {
                    this.analysisBoard.destroy();
                }
                this.analysisBoard = Chessboard('analysis-board', boardConfig);
                this.applyTheme();
                this.renderCoordinates();
            } catch (error) {
                console.error('AnalysisController: Error initializing board:', error);
                this.showError("Failed to initialize analysis board.");
            }
        },

        initializeVisualizerBoard: function() {
            try {
                // The visualizer board is a simple, non-interactive board for the loading overlay.
                this.visualizerBoardWrapper.empty(); // Clear previous board if any
                const boardConfig = {
                    position: 'start',
                    pieceTheme: PIECE_THEMES[localStorage.getItem('chessPieceTheme') || 'cburnett']
                };
                if (this.visualizerBoard && typeof this.visualizerBoard.destroy === 'function') {
                    this.visualizerBoard.destroy();
                }
                this.visualizerBoard = Chessboard('visualizer-board-wrapper', boardConfig);
            } catch (error) {
                console.error('AnalysisController: Error initializing visualizer board:', error);
            }
        },
    };

    Object.assign(controller, uiInitMethods);

})(window.AnalysisController);