// ===================================================================================
//  BOARD.JS
//  Manages the main game chessboard, interactions, and visual feedback.
// ===================================================================================

// --- Board State ---
let board = null;
let selectedSquare = null;
let userShapes = []; // For right-click drawings
let isDrawing = false;
let drawStartSquare = null;

/**
 * Initializes or re-initializes the main game board.
 * @param {string} position - The FEN string of the position to display.
 */
function buildBoard(position = 'start') {
    const boardThemeName = $('#theme-selector').val();
    const pieceThemeName = $('#piece-theme-selector').val();
    const selectedTheme = THEMES.find(t => t.name === boardThemeName) || THEMES[0];
    
    document.documentElement.style.setProperty('--light-square-color', selectedTheme.colors.light);
    document.documentElement.style.setProperty('--dark-square-color', selectedTheme.colors.dark);
    
    const config = {
        position,
        draggable: true,
        onDragStart,
        onDrop,
        pieceTheme: PIECE_THEMES[pieceThemeName],
        animationSpeed: 200
    };
    
    if (board) board.destroy();
    board = Chessboard('board', config);
    
    $('#board .square-55d63').off('click').on('click', function() {
        onSquareClick($(this).data('square'));
    });
    
    const orientation = humanPlayer === 'w' ? 'white' : 'black';
    board.orientation(orientation);
    
    const drawingOptions = {
        svgOverlay: $('#board-svg-overlay'),
        boardElement: $('#board'),
        boardObject: board
    };
    renderCoordinates(board, $('#main-game .board-wrapper'));
    redrawUserShapes(userShapes, drawingOptions);
}

function removeLegalHighlights() {
    $('#board .square-55d63').removeClass('highlight-legal highlight-selected');
}

function highlightLegalMoves(square) {
    removeLegalHighlights();
    const moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;

    $('#board').find(`.square-${square}`).addClass('highlight-selected');
    for (const move of moves) {
        $('#board').find(`.square-${move.to}`).addClass('highlight-legal');
    }
}

function removePremoveHighlight() { 
    $('#board .premove-highlight').removeClass('premove-highlight'); 
}

function updateThreatHighlights() {
    $('#board .square-55d63').removeClass('threatened-square');
    if (!highlightThreats || game.game_over() || reviewMoveIndex !== null) return;
    
    const threatenedPlayer = game.turn();
    const attackingPlayer = threatenedPlayer === 'w' ? 'b' : 'w';
    
    game.SQUARES.forEach(square => {
        const piece = game.get(square);
        if (piece && piece.color === threatenedPlayer) {
            if (game.isAttacked(square, attackingPlayer)) {
                $('#board').find(`[data-square=${square}]`).addClass('threatened-square');
            }
        }
    });
}

function onSquareClick(square) {
    if (isDrawing || reviewMoveIndex !== null) return;
    if (game.turn() !== humanPlayer || !gameActive) return;

    const pieceOnClickedSquare = game.get(square);

    if (selectedSquare) {
        const move = game.moves({ square: selectedSquare, verbose: true }).find(m => m.to === square);
        if (move) {
            if ((move.flags.includes('p') || move.flags.includes('k')) && (move.to.endsWith('8') || move.to.endsWith('1'))) {
                pendingMove = { from: selectedSquare, to: square, promotion: 'q' };
                showPromotionDialog(humanPlayer, $('#piece-theme-selector').val());
            } else {
                performMove(move.san);
            }
        }
        selectedSquare = null;
        removeLegalHighlights();
    } else {
        if (pieceOnClickedSquare && pieceOnClickedSquare.color === humanPlayer) {
            selectedSquare = square;
            highlightLegalMoves(square);
        }
    }
}

function onDrop(source, target) {
    removeLegalHighlights();
    selectedSquare = null;
    const drawingOptions = { svgOverlay: $('#board-svg-overlay'), boardElement: $('#board'), boardObject: board };
    userShapes.length = 0; // Clear drawings on move
    redrawUserShapes(userShapes, drawingOptions);

    if (reviewMoveIndex !== null) return;
    
    // Handle Premove
    if (isStockfishThinking && game.turn() !== humanPlayer) {
        removePremoveHighlight();
        pendingPremove = { from: source, to: target };
        $(`.square-${source}`).addClass('premove-highlight');
        $(`.square-${target}`).addClass('premove-highlight');
        return 'snapback';
    }

    if (game.turn() !== humanPlayer) return 'snapback';
    
    const move = game.moves({ verbose: true }).find(m => m.from === source && m.to === target);
    if (!move) return 'snapback';

    // Handle Promotion
    if ((move.flags.includes('p') || move.flags.includes('k')) && (move.to.endsWith('8') || move.to.endsWith('1'))) {
        pendingMove = { from: source, to: target, promotion: 'q' };
        showPromotionDialog(humanPlayer, $('#piece-theme-selector').val());
        return; // chess.js move will be handled by the modal
    }
    
    performMove(move.san);
}

function onDragStart(source, piece) {
    removeLegalHighlights();
    selectedSquare = null;
    return reviewMoveIndex === null && gameActive && !game.game_over() && piece.startsWith(humanPlayer);
}