// src/analysis/analysis-board.js

// ===================================================================================
//  ANALYSIS-BOARD.JS
//  Manages the dedicated chessboard instance for the game review interface.
// =================================G==================================================

(function(window) {
    'use strict';

    let analysisBoard = null;
    let gameHistory = []; // Stores the full history for review
    let svgOverlay = null; // FIX: Declared here, but assigned later

    // Private helper to draw an arrow on the SVG overlay
    function _drawArrow(from, to, color = 'rgba(255, 165, 0, 0.7)') {
        // Ensure svgOverlay and board are initialized before drawing
        if (!from || !to || !analysisBoard || !svgOverlay) return;
        
        const boardEl = $('#analysis-board');
        const boardWidth = boardEl.width();
        if (!boardWidth) return;
        
        const squareSize = boardWidth / 8;
        const isFlipped = analysisBoard.orientation() === 'black';

        const getCoords = (square) => {
            let col = square.charCodeAt(0) - 'a'.charCodeAt(0);
            let row = parseInt(square.charAt(1)) - 1;
            if (isFlipped) { col = 7 - col; row = 7 - row; }
            return { x: col * squareSize + squareSize / 2, y: (7 - row) * squareSize + squareSize / 2 };
        };

        const fromCoords = getCoords(from);
        const toCoords = getCoords(to);
        const markerId = `arrowhead-analysis-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

        if (svgOverlay.find(`#${markerId}`).length === 0) {
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', markerId);
            marker.setAttribute('viewBox', '0 0 10 10');
            marker.setAttribute('refX', '5');
            marker.setAttribute('refY', '5');
            marker.setAttribute('markerWidth', '3.5');
            marker.setAttribute('markerHeight', '3.5');
            marker.setAttribute('orient', 'auto-start-reverse');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
            path.style.fill = color;
            marker.appendChild(path);
            svgOverlay.append(marker);
        }

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', fromCoords.x);
        line.setAttribute('y1', fromCoords.y);
        line.setAttribute('x2', toCoords.x);
        line.setAttribute('y2', toCoords.y);
        line.style.stroke = color;
        line.style.strokeWidth = '14px';
        line.setAttribute('marker-end', `url(#${markerId})`);
        svgOverlay.append(line);
    }

    const AnalysisBoard = {
        
        /**
         * Initializes the analysis board.
         * @param {Array} history - The verbose history object from chess.js.
         */
        init: function(history) {
            gameHistory = history || [];
            
            // FIX: Assign the svgOverlay variable now that the DOM is ready
            svgOverlay = $('#analysis-board-svg-overlay');

            const config = {
                position: 'start',
                pieceTheme: PIECE_THEMES[pieceThemeSelector.val()],
                showNotation: false 
            };

            if (analysisBoard) analysisBoard.destroy();
            
            // This line will now succeed because this function is called after the UI is visible
            analysisBoard = Chessboard('analysis-board', config);
            
            const orientation = board.orientation(); 
            analysisBoard.orientation(orientation);
            renderCoordinates(orientation, 'analysis'); 
            
            setTimeout(() => {
                if (analysisBoard) analysisBoard.resize();
            }, 100);
        },

        /**
         * Displays a specific move from the game's history on the board.
         * @param {number} moveIndex - The index of the move to display.
         */
        displayPosition: function(moveIndex) {
            if (!analysisBoard || moveIndex < -1 || moveIndex >= gameHistory.length) return;

            const tempGame = new Chess();
            for (let i = 0; i <= moveIndex; i++) {
                tempGame.move(gameHistory[i].san);
            }
            analysisBoard.position(tempGame.fen());
        },

        /**
         * Draws the "best move" arrow on the board.
         * @param {string} bestMoveUci - The best move in UCI format (e.g., 'e2e4').
         */
        showBestMove: function(bestMoveUci) {
            this.clearShapes();
            if (bestMoveUci) {
                const from = bestMoveUci.substring(0, 2);
                const to = bestMoveUci.substring(2, 4);
                _drawArrow(from, to, 'rgba(21, 128, 61, 0.7)');
            }
        },

        /**
         * Clears all drawn shapes from the board overlay.
         */
        clearShapes: function() {
            if (svgOverlay) {
                svgOverlay.empty();
            }
        }
    };

    window.AnalysisBoard = AnalysisBoard;

})(window);