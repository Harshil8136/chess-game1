// src/analysis/analysis-board.js

// ===================================================================================
//  ANALYSIS-BOARD.JS
//  Manages the dedicated chessboard instance for the game review interface.
// ===================================================================================

(function(window) {
    'use strict';

    let analysisBoard = null;
    let gameHistory = [];
    let svgOverlay = null;

    function _drawArrow(from, to, color = 'rgba(255, 165, 0, 0.7)') {
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
        
        init: function(history) {
            gameHistory = history || [];
            svgOverlay = $('#analysis-board-svg-overlay');

            const config = {
                position: 'start',
                pieceTheme: PIECE_THEMES[pieceThemeSelector.val()],
                showNotation: false 
            };

            if (analysisBoard) analysisBoard.destroy();
            analysisBoard = Chessboard('analysis-board', config);
            
            // --- FIX FOR SCOPE ERROR ---
            // Safely get the orientation from the main game 'board' if it exists,
            // otherwise, default to 'white'. This prevents a ReferenceError.
            const orientation = (typeof board !== 'undefined' && board) ? board.orientation() : 'white';
            analysisBoard.orientation(orientation);

            renderCoordinates(orientation, 'analysis'); 
            
            setTimeout(() => {
                if (analysisBoard) analysisBoard.resize();
            }, 100);
        },

        displayPosition: function(moveIndex) {
            if (!analysisBoard || moveIndex < -1 || moveIndex >= gameHistory.length) return;

            const tempGame = new Chess();
            for (let i = 0; i <= moveIndex; i++) {
                tempGame.move(gameHistory[i].san);
            }
            analysisBoard.position(tempGame.fen());
        },

        showBestMove: function(bestMoveUci) {
            this.clearShapes();
            if (bestMoveUci) {
                const from = bestMoveUci.substring(0, 2);
                const to = bestMoveUci.substring(2, 4);
                _drawArrow(from, to, 'rgba(21, 128, 61, 0.7)');
            }
        },

        clearShapes: function() {
            if (svgOverlay) {
                svgOverlay.empty();
            }
        }
    };

    window.AnalysisBoard = AnalysisBoard;

})(window);