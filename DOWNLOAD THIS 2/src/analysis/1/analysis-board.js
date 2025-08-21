// src/analysis/analysis-board.js

// ===================================================================================
//  ANALYSIS-BOARD.JS
//  Manages the Analysis Room's chessboard, coordinates, and drawing interactions.
// ===================================================================================

(function(controller) {
    'use strict';

    if (!controller) {
        // This check is a safeguard. The Logger might not be available if core files failed to load.
        if (window.Logger) {
            Logger.critical("Analysis Core module must be loaded before the Board module.", new Error("Module loading dependency failed"));
        }
        return;
    }

    const boardMethods = {

        /**
         * Initializes the chessboard.js instance for the analysis room.
         */
        initializeBoard: function() {
            try {
                const boardConfig = {
                    position: 'start',
                    pieceTheme: PIECE_THEMES[localStorage.getItem('chessPieceTheme') || 'cburnett'],
                    draggable: false,
                    showNotation: false
                };
                if (this.analysisBoard && typeof this.analysisBoard.destroy === 'function') {
                    this.analysisBoard.destroy();
                }
                this.analysisBoard = Chessboard('analysis-board', boardConfig);
                this.applyTheme();
                this.renderCoordinates();
            } catch (error) {
                Logger.error('AnalysisController: Error initializing board', error);
                this.showError("Failed to initialize analysis board.");
            }
        },

        /**
         * Applies the user-selected board theme to the analysis board.
         */
        applyTheme: function() {
            try {
                const themeName = localStorage.getItem('chessBoardTheme') || 'green';
                const selectedTheme = THEMES && THEMES.find ? THEMES.find(function(t) { return t.name === themeName; }) : null;
                if (selectedTheme) {
                    document.documentElement.style.setProperty('--light-square-color', selectedTheme.colors.light);
                    document.documentElement.style.setProperty('--dark-square-color', selectedTheme.colors.dark);
                }
            } catch (error) { Logger.warn('Error applying theme', error); }
        },

        /**
         * Renders the file and rank coordinates around the analysis board.
         */
        renderCoordinates: function() {
            if (!this.boardWrapper || !this.boardWrapper.length || !this.analysisBoard) return;
            try {
                const isFlipped = this.analysisBoard.orientation() === 'black';
                const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
                let ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
                if (isFlipped) { files.reverse(); } else { ranks.reverse(); }
                const filesHtml = files.map(function(f) { return `<span>${f}</span>`; }).join('');
                const ranksHtml = ranks.map(function(r) { return `<span>${r}</span>`; }).join('');
                this.boardWrapper.find('#analysis-top-files').html(filesHtml);
                this.boardWrapper.find('#analysis-bottom-files').html(filesHtml);
                this.boardWrapper.find('#analysis-left-ranks').html(ranksHtml);
                this.boardWrapper.find('#analysis-right-ranks').html(ranksHtml);
            } catch (error) { Logger.warn('Error rendering coordinates', error); }
        },

        /**
         * Sets up the right-click mouse events for drawing arrows and highlights.
         */
        setupBoardDrawingHandlers: function() {
            this.analysisBoardElement.off('mousedown contextmenu').on('mousedown contextmenu', (e) => {
                if (e.which !== 3) return;
                e.preventDefault();
                this.isDrawing = true;
                this.drawStartSquare = $(e.target).closest('[data-square]').data('square');
            });

            $(document).off('mouseup.analysis_draw').on('mouseup.analysis_draw', (e) => {
                if (!this.isDrawing || e.which !== 3) return;
                e.preventDefault();
                const endSquare = $(e.target).closest('[data-square]').data('square');
                if (this.drawStartSquare && endSquare) {
                    if (this.drawStartSquare === endSquare) {
                        const existingIndex = this.userShapes.findIndex(s => s.type === 'highlight' && s.square === this.drawStartSquare);
                        if (existingIndex > -1) this.userShapes.splice(existingIndex, 1);
                        else this.userShapes.push({ type: 'highlight', square: this.drawStartSquare, color: 'green' });
                    } else {
                        const existingIndex = this.userShapes.findIndex(s => s.type === 'arrow' && s.from === this.drawStartSquare && s.to === endSquare);
                        if (existingIndex > -1) this.userShapes.splice(existingIndex, 1);
                        else this.userShapes.push({ type: 'arrow', from: this.drawStartSquare, to: endSquare, color: 'rgba(21, 128, 61, 0.7)' });
                    }
                } else { this.clearUserShapes(); }
                this.redrawUserShapes();
                this.isDrawing = false;
                this.drawStartSquare = null;
            });
        },

        /**
         * Clears all user-drawn shapes from the board.
         */
        clearUserShapes: function() {
            this.userShapes = [];
            this.redrawUserShapes();
        },

        /**
         * Redraws all arrows and highlights on the SVG overlay.
         */
        redrawUserShapes: function() {
            if (!this.analysisBoardSvgOverlay) return;
            this.analysisBoardSvgOverlay.empty();
            if (this.analysisBoardElement) {
                this.analysisBoardElement.find('.square-55d63').removeClass('highlight-user-green highlight-user-red highlight-user-yellow highlight-user-blue');
            }
            
            if (!this.analysisBoard || this.currentMoveIndex < 0) return;
            
            const data = this.reviewData[this.currentMoveIndex];
            const move = this.gameHistory[this.currentMoveIndex];
            if (data && move) {
                this.drawArrow(move.from, move.to, 'rgba(59, 130, 246, 0.7)');
                
                const isBadMove = ['Mistake', 'Blunder', 'Inaccuracy', 'Miss'].includes(data.classification);
                if (isBadMove && data.bestLineUci) {
                    const bestMoveUci = data.bestLineUci.split(' ')[0];
                    const from = bestMoveUci.substring(0, 2);
                    const to = bestMoveUci.substring(2, 4);
                    if (from !== move.from || to !== move.to) {
                        this.drawArrow(from, to, 'rgba(34, 197, 94, 0.7)');
                    }
                }
            }
            
            this.userShapes.forEach(shape => {
                if (shape.type === 'highlight') {
                    this.analysisBoardElement.find(`.square-${shape.square}`).addClass(`highlight-user-${shape.color}`);
                } else if (shape.type === 'arrow') {
                    this.drawArrow(shape.from, shape.to, shape.color);
                }
            });
        },

        /**
         * Draws a single arrow on the SVG overlay.
         * @param {string} from - The starting square (e.g., 'e2').
         * @param {string} to - The ending square (e.g., 'e4').
         * @param {string} color - The color of the arrow.
         */
        drawArrow: function(from, to, color = 'rgba(42, 122, 42, 0.7)') {
            if (!this.analysisBoardSvgOverlay || !this.analysisBoard) return;
            
            const boardWidth = this.analysisBoardElement.width();
            if (!boardWidth || boardWidth === 0) return;
            const squareSize = boardWidth / 8;
            const isFlipped = this.analysisBoard.orientation() === 'black';

            const getCoords = (square) => {
                let col = square.charCodeAt(0) - 'a'.charCodeAt(0);
                let row = parseInt(square.charAt(1)) - 1;
                if (isFlipped) { col = 7 - col; row = 7 - row; }
                return { x: col * squareSize + squareSize / 2, y: (7 - row) * squareSize + squareSize / 2 };
            };

            const fromCoords = getCoords(from);
            const toCoords = getCoords(to);
            const markerId = `arrowhead-analysis-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

            if (!this.analysisBoardSvgOverlay.find(`#${markerId}`).length) {
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
                this.analysisBoardSvgOverlay.append(marker);
            }

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', fromCoords.x); line.setAttribute('y1', fromCoords.y);
            line.setAttribute('x2', toCoords.x); line.setAttribute('y2', toCoords.y);
            line.style.stroke = color;
            line.style.strokeWidth = '14px';
            line.setAttribute('marker-end', `url(#${markerId})`);
            this.analysisBoardSvgOverlay.append(line);
        }
    };

    // Attach all the board-related methods to the main AnalysisController
    Object.assign(controller, boardMethods);

})(window.AnalysisController);