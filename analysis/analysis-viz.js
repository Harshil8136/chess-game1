// ===================================================================================
//  ANALYSIS-VIZ.JS
//  Manages the "Analyzing..." progress pop-up (visualizer).
// ===================================================================================

let visualizerBoard = null;

/**
 * Initializes the small chessboard inside the analysis progress visualizer.
 */
function initVisualizerBoard() {
    try {
        const pieceTheme = localStorage.getItem('chessPieceTheme') || APP_CONFIG.DEFAULT_PIECE_THEME;
        const boardConfig = {
            position: 'start',
            pieceTheme: PIECE_THEMES[pieceTheme]
        };
        if (visualizerBoard && typeof visualizerBoard.destroy === 'function') {
            visualizerBoard.destroy();
        }
        visualizerBoard = Chessboard('visualizer-board-wrapper', boardConfig);
    } catch (error) {
        console.error('Error initializing visualizer board:', error);
    }
}

/**
 * Updates all UI elements within the analysis visualizer.
 * @param {object} data - An object containing progress data.
 * @param {number} data.currentMove - The current move number being analyzed.
 * @param {number} data.totalMoves - The total number of moves in the game.
 * @param {string} data.fen - The FEN of the position being shown.
 * @param {string} data.san - The SAN of the move being assessed.
 * @param {string} data.classification - The classification of the move.
 */
function updateVisualizerProgress(data) {
    if (!visualizerBoard) return;

    const progressPercent = (data.currentMove / data.totalMoves) * 100;
    const info = CLASSIFICATION_DATA[data.classification];

    $('#visualizer-status').text(`Analyzing move ${data.currentMove} of ${data.totalMoves}...`);
    $('#visualizer-progress-bar').css('width', `${progressPercent}%`);
    visualizerBoard.position(data.fen);

    $('#visualizer-move-number').text(`${Math.floor((data.currentMove - 1) / 2) + 1}${data.moveColor === 'w' ? '.' : '...'}`);
    $('#visualizer-move-played').text(data.san);
    $('#visualizer-move-assessment').text(info.title).attr('class', `font-bold ${info.color}`);
}