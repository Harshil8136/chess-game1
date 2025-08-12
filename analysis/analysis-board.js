// ===================================================================================
//  ANALYSIS-BOARD.JS
//  Manages the chessboard instance and interactions for the Analysis Room.
// ===================================================================================

let analysisBoard = null;
let analysisUserShapes = [];
let isAnalysisDrawing = false;
let analysisDrawStartSquare = null;

/**
 * Initializes the chessboard for the analysis interface.
 * @returns {object} The created chessboard.js instance.
 */
function initAnalysisBoard() {
    try {
        const pieceTheme = localStorage.getItem('chessPieceTheme') || APP_CONFIG.DEFAULT_PIECE_THEME;
        const boardConfig = {
            position: 'start',
            pieceTheme: PIECE_THEMES[pieceTheme],
            draggable: false, // The analysis board is not for playing
            showNotation: false
        };
        if (analysisBoard && typeof analysisBoard.destroy === 'function') {
            analysisBoard.destroy();
        }
        analysisBoard = Chessboard('analysis-board', boardConfig);
        
        applyAnalysisTheme();
        setupAnalysisBoardEventHandlers();
        
        return analysisBoard;
    } catch (error) {
        console.error('Failed to initialize analysis board:', error);
        return null;
    }
}

/**
 * Applies the currently selected board theme to the analysis board.
 */
function applyAnalysisTheme() {
    const themeName = localStorage.getItem('chessBoardTheme') || APP_CONFIG.DEFAULT_BOARD_THEME;
    const selectedTheme = THEMES.find(t => t.name === themeName);
    if (selectedTheme) {
        // This relies on CSS variables being set globally, which is handled by ui.js or main.js
        // No direct action is needed here unless the board requires unique colors.
    }
}

/**
 * Sets up right-click drawing handlers for the analysis board.
 */
function setupAnalysisBoardEventHandlers() {
    const boardElement = $('#analysis-board');

    boardElement.off('mousedown contextmenu').on('mousedown contextmenu', function(e) {
        if (e.which !== 3) return; // Only for right-click
        e.preventDefault();
        isAnalysisDrawing = true;
        analysisDrawStartSquare = $(e.target).closest('[data-square]').data('square');
    });

    $(document).off('mouseup.analysis_draw').on('mouseup.analysis_draw', function(e) {
        if (!isAnalysisDrawing || e.which !== 3) return;
        e.preventDefault();

        const endSquare = $(e.target).closest('[data-square]').data('square');
        const drawingOptions = {
            svgOverlay: $('#analysis-board-svg-overlay'),
            boardElement: boardElement,
            boardObject: analysisBoard
        };

        if (analysisDrawStartSquare && endSquare) {
            if (analysisDrawStartSquare === endSquare) { // Highlight
                const existingIdx = analysisUserShapes.findIndex(s => s.type === 'highlight' && s.square === analysisDrawStartSquare);
                if (existingIdx > -1) analysisUserShapes.splice(existingIdx, 1);
                else analysisUserShapes.push({ type: 'highlight', square: analysisDrawStartSquare, color: 'green' });
            } else { // Arrow
                const existingIdx = analysisUserShapes.findIndex(s => s.type === 'arrow' && s.from === analysisDrawStartSquare && s.to === endSquare);
                if (existingIdx > -1) analysisUserShapes.splice(existingIdx, 1);
                else analysisUserShapes.push({ type: 'arrow', from: analysisDrawStartSquare, to: endSquare, color: 'rgba(21, 128, 61, 0.7)' });
            }
        } else { // Clicked off board
            analysisUserShapes = [];
        }
        
        redrawUserShapes(analysisUserShapes, drawingOptions);
        
        isAnalysisDrawing = false;
        analysisDrawStartSquare = null;
    });
}