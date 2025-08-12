// ===================================================================================
//  DRAWING.JS
//  Provides shared, reusable functions for drawing arrows, highlights, and
//  coordinates on both the main and analysis chessboards.
// ===================================================================================

/**
 * Renders the rank and file coordinates around a specified board.
 * @param {object} boardObject - The chessboard.js instance.
 * @param {jQuery} boardWrapperElement - The jQuery object for the board's wrapper div.
 */
function renderCoordinates(boardObject, boardWrapperElement) {
    if (!boardWrapperElement || !boardWrapperElement.length || !boardObject) return;
    try {
        const isFlipped = boardObject.orientation() === 'black';
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        let ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
        if (isFlipped) {
            files.reverse();
        } else {
            ranks.reverse();
        }
        const filesHtml = files.map(f => `<span>${f}</span>`).join('');
        const ranksHtml = ranks.map(r => `<span>${r}</span>`).join('');

        boardWrapperElement.find('.files.coordinates').html(filesHtml);
        boardWrapperElement.find('.ranks.coordinates').html(ranksHtml);
    } catch (error) {
        console.warn('Error rendering coordinates:', error);
    }
}

/**
 * Draws a single SVG arrow on a board's overlay.
 * @param {string} from - The starting square (e.g., 'e2').
 * @param {string} to - The ending square (e.g., 'e4').
 * @param {string} color - The color of the arrow.
 * @param {object} options - An object containing board elements.
 * @param {jQuery} options.svgOverlay - The SVG overlay element.
 * @param {jQuery} options.boardElement - The board's main element.
 * @param {object} options.boardObject - The chessboard.js instance.
 */
function drawArrow(from, to, color, options) {
    const { svgOverlay, boardElement, boardObject } = options;
    if (!svgOverlay || !boardObject) return;

    const boardWidth = boardElement.width();
    if (!boardWidth || boardWidth === 0) return;
    const squareSize = boardWidth / 8;
    const isFlipped = boardObject.orientation() === 'black';

    const getCoords = (square) => {
        let col = square.charCodeAt(0) - 'a'.charCodeAt(0);
        let row = parseInt(square.charAt(1)) - 1;
        if (isFlipped) {
            col = 7 - col;
            row = 7 - row;
        }
        return {
            x: col * squareSize + squareSize / 2,
            y: (7 - row) * squareSize + squareSize / 2
        };
    };

    const fromCoords = getCoords(from);
    const toCoords = getCoords(to);
    const markerId = `arrowhead-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

    // Create a defs section if it doesn't exist
    let defs = svgOverlay.find('defs');
    if (!defs.length) {
        defs = $(document.createElementNS('http://www.w3.org/2000/svg', 'defs'));
        svgOverlay.prepend(defs);
    }

    // Add a marker (arrowhead) if it's not already defined for this color
    if (!defs.find(`#${markerId}`).length) {
        const marker = $(document.createElementNS('http://www.w3.org/2000/svg', 'marker'));
        marker.attr('id', markerId)
            .attr('viewBox', '0 0 10 10')
            .attr('refX', '5').attr('refY', '5')
            .attr('markerWidth', '3.5').attr('markerHeight', '3.5')
            .attr('orient', 'auto-start-reverse');
        
        const path = $(document.createElementNS('http://www.w3.org/2000/svg', 'path'));
        path.attr('d', 'M 0 0 L 10 5 L 0 10 z');
        path.css('fill', color);
        
        marker.append(path);
        defs.append(marker);
    }

    const line = $(document.createElementNS('http://www.w3.org/2000/svg', 'line'));
    line.attr('x1', fromCoords.x).attr('y1', fromCoords.y)
        .attr('x2', toCoords.x).attr('y2', toCoords.y)
        .css('stroke', color)
        .css('stroke-width', '14px')
        .attr('marker-end', `url(#${markerId})`);
    
    svgOverlay.append(line);
}

/**
 * Redraws all user-created shapes (arrows and highlights) on a board.
 * @param {Array} userShapes - The array of shape objects to draw.
 * @param {object} options - An object containing board elements.
 */
function redrawUserShapes(userShapes, options) {
    const { svgOverlay, boardElement, boardObject } = options;
    if (!svgOverlay || !boardElement || !boardObject) return;

    svgOverlay.empty();
    boardElement.find('.square-55d63').removeClass('highlight-user-green highlight-user-red highlight-user-yellow highlight-user-blue');

    userShapes.forEach(shape => {
        if (shape.type === 'highlight') {
            boardElement.find(`.square-${shape.square}`).addClass(`highlight-user-${shape.color}`);
        } else if (shape.type === 'arrow') {
            drawArrow(shape.from, shape.to, shape.color, options);
        }
    });
}