// src/js/board.js

// ===================================================================================
//  BOARD.JS
//  Manages the chessboard interface, interactions, and visual feedback.
// ===================================================================================

// --- Element Refs ---
const boardElement = $('#board');
const topFiles = $('#top-files');
const bottomFiles = $('#bottom-files');
const leftRanks = $('#left-ranks');
const rightRanks = $('#right-ranks');
const boardSvgOverlay = $('#board-svg-overlay');

// --- Board State ---
let board = null;
let selectedSquare = null;
let userShapes = [];
let isDrawing = false;
let drawStartSquare = null;

/**
 * Checks if a square is attacked by a given color using a safe, non-mutating method.
 * @param {string} square - The square to check (e.g., 'e4').
 * @param {string} attackerColor - The color of the attacker ('w' or 'b').
 * @param {object} gameInstance - The current chess.js game instance.
 * @returns {boolean} - True if the square is under attack, false otherwise.
 */
function isSquareAttacked(square, attackerColor, gameInstance) {
    const tempGame = new Chess(gameInstance.fen());
    const piece = tempGame.get(square);

    if (piece && piece.type === 'k' && piece.color === attackerColor) {
        return false;
    }

    tempGame.remove(square);

    const kingColor = attackerColor === 'w' ? 'b' : 'w';
    if (!tempGame.put({ type: 'k', color: kingColor }, square)) {
        return false;
    }
    
    const fenParts = tempGame.fen().split(' ');
    fenParts[1] = attackerColor;
    tempGame.load(fenParts.join(' '));

    return tempGame.in_check();
}


// --- Core Board Functions ---
function buildBoard(position = 'start') {
    const selectedTheme = THEMES.find(t => t.name === themeSelector.val()) || THEMES[0];
    document.documentElement.style.setProperty('--light-square-color', selectedTheme.colors.light);
    document.documentElement.style.setProperty('--dark-square-color', selectedTheme.colors.dark);
    
    const config = {
        position,
        draggable: true,
        onDragStart,
        onDrop,
        pieceTheme: PIECE_THEMES[pieceThemeSelector.val()],
        animationSpeed: 'fast'
    };
    
    if (board) board.destroy();
    board = Chessboard('board', config);
    
    boardElement.find('.square-55d63').off('click').on('click', function() {
        onSquareClick($(this).data('square'));
    });
    
    const orientation = humanPlayer === 'w' ? 'white' : 'black';
    board.orientation(orientation);
    renderCoordinates(orientation, 'main');
    redrawUserShapes();
}

function renderCoordinates(orientation = 'white', target = 'main') { 
    const isFlipped = orientation === 'black'; 
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']; 
    let ranks = ['1', '2', '3', '4', '5', '6', '7', '8']; 
    if (isFlipped) { files.reverse(); } else { ranks.reverse(); } 
    const filesHtml = files.map(f => `<span>${f}</span>`).join(''); 
    const ranksHtml = ranks.map(r => `<span>${r}</span>`).join(''); 
    
    if (target === 'main') {
        $('#top-files').html(filesHtml); 
        $('#bottom-files').html(filesHtml); 
        $('#left-ranks').html(ranksHtml); 
        $('#right-ranks').html(ranksHtml);
    } else if (target === 'analysis') {
        $('#analysis-top-files').html(filesHtml);
        $('#analysis-bottom-files').html(filesHtml);
        $('#analysis-left-ranks').html(ranksHtml);
        $('#analysis-right-ranks').html(ranksHtml);
    }
}

// --- Highlighting and Drawing Functions ---
function removeLegalHighlights() {
    boardElement.find('.square-55d63').removeClass('highlight-legal highlight-selected');
}

function highlightLegalMoves(square) {
    removeLegalHighlights();
    const moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return;

    boardElement.find(`.square-${square}`).addClass('highlight-selected');
    for (const move of moves) {
        boardElement.find(`.square-${move.to}`).addClass('highlight-legal');
    }
}

function removePremoveHighlight() { 
    boardElement.find('.premove-highlight').removeClass('premove-highlight'); 
}

function updateThreatHighlights() {
    boardElement.find('.square-55d63').removeClass('threatened-square');
    if (!highlightThreats || game.game_over() || reviewMoveIndex !== null) return;
    
    const threatenedPlayer = game.turn();
    const attackingPlayer = threatenedPlayer === 'w' ? 'b' : 'w';
    
    game.SQUARES.forEach(square => {
        const piece = game.get(square);
        if (piece && piece.color === threatenedPlayer) {
            if (isSquareAttacked(square, attackingPlayer, game)) {
                boardElement.find(`[data-square=${square}]`).addClass('threatened-square');
            }
        }
    });
}

function clearUserShapes() {
    userShapes = [];
    redrawUserShapes();
}

function redrawUserShapes(svgOverlay = boardSvgOverlay) {
    svgOverlay.empty();
    boardElement.find('.square-55d63').removeClass('highlight-user-green highlight-user-red highlight-user-yellow highlight-user-blue');

    if (!board) return;

    userShapes.forEach(shape => {
        if (shape.type === 'highlight') {
            boardElement.find(`.square-${shape.square}`).addClass(`highlight-user-${shape.color}`);
        } else if (shape.type === 'arrow') {
            drawArrow(shape.from, shape.to, shape.color, svgOverlay);
        }
    });
}

function drawArrow(from, to, color = 'rgba(21, 128, 61, 0.7)', svgOverlay = boardSvgOverlay) {
    if (!from || !to) return;
    const boardWidth = boardElement.width();
    if (!boardWidth) return;
    const squareSize = boardWidth / 8;
    const isFlipped = board.orientation() === 'black';
    const getCoords = (square) => {
        let col = square.charCodeAt(0) - 'a'.charCodeAt(0);
        let row = parseInt(square.charAt(1)) - 1;
        if (isFlipped) { col = 7 - col; row = 7 - row; }
        return { x: col * squareSize + squareSize / 2, y: (7 - row) * squareSize + squareSize / 2 };
    };
    const fromCoords = getCoords(from);
    const toCoords = getCoords(to);
    const markerId = `arrowhead-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

    if (svgOverlay.find(`#${markerId}`).length === 0) {
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', markerId);
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '5'); marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '3.5'); marker.setAttribute('markerHeight', '3.5');
        marker.setAttribute('orient', 'auto-start-reverse');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        path.style.fill = color;
        marker.appendChild(path);
        svgOverlay.append(marker);
    }

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', fromCoords.x); line.setAttribute('y1', fromCoords.y);
    line.setAttribute('x2', toCoords.x); line.setAttribute('y2', toCoords.y);
    line.style.stroke = color;
    line.style.strokeWidth = '14px';
    line.setAttribute('marker-end', `url(#${markerId})`);
    svgOverlay.append(line);
}

// --- Board Interaction Handlers ---
function onSquareClick(square) {
    if (isDrawing) return;
    const clickedSquare = square;

    if (selectedSquare === clickedSquare) {
        selectedSquare = null;
        removeLegalHighlights();
        return;
    }

    if (game.turn() !== humanPlayer || !gameActive || reviewMoveIndex !== null) {
        if (selectedSquare) {
            selectedSquare = null;
            removeLegalHighlights();
        }
        return;
    }

    const pieceOnClickedSquare = game.get(clickedSquare);

    if (selectedSquare) {
        const move = game.moves({ square: selectedSquare, verbose: true }).find(m => m.to === clickedSquare);
        
        if (move) {
            removeLegalHighlights();
            if (move.flags.includes('p') && (move.to.endsWith('8') || move.to.endsWith('1'))) {
                pendingMove = { from: selectedSquare, to: clickedSquare, promotion: 'q' };
                showPromotionDialog(humanPlayer);
            } else {
                const moveResult = game.move(move.san);
                if (moveResult) {
                    clearUserShapes();
                    playMoveSound(moveResult);
                    updateGameState(false);
                }
            }
            selectedSquare = null;
            return;
        }
    }
    
    removeLegalHighlights();
    selectedSquare = null;

    if (pieceOnClickedSquare && pieceOnClickedSquare.color === humanPlayer) {
        selectedSquare = clickedSquare;
        highlightLegalMoves(clickedSquare);
    }
}

function onDrop(source, target) {
    removeLegalHighlights();
    selectedSquare = null;
    clearUserShapes();
    if (reviewMoveIndex !== null) return;
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
    if (move.flags.includes('p') && (move.to.endsWith('8') || move.to.endsWith('1'))) {
        pendingMove = { from: source, to: target, promotion: 'q' };
        showPromotionDialog(humanPlayer);
        return;
    }
    const moveResult = game.move(move.san);
    if (moveResult) {
        playMoveSound(moveResult);
        updateGameState(false);
    }
}

function onDragStart(source, piece) {
    removeLegalHighlights();
    selectedSquare = null;
    return reviewMoveIndex === null && gameActive && !game.game_over() && piece.startsWith(humanPlayer) && (game.turn() === humanPlayer || isStockfishThinking);
}