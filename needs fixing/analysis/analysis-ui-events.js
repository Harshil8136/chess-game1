// ===================================================================================
//  ANALYSIS-UI-EVENTS.JS
//  Handles all event listeners for the analysis panel.
// ===================================================================================

(function(controller) {
    if (!controller) {
        console.error("Analysis Controller must be initialized before loading UI components.");
        return;
    }

    const uiEventMethods = {
        setupEventHandlers: function() {
            // Clicks on moves in the analysis move list
            this.moveListElement.off('click.navigate').on('click.navigate', '.analysis-move-item', (e) => {
                const moveIndex = parseInt($(e.currentTarget).data('move-index'));
                if (!isNaN(moveIndex) && moveIndex >= -1 && moveIndex < this.gameHistory.length) {
                    this.navigateToMove(moveIndex);
                    window.playSound('moveSelf');
                }
            });

            // Clicks on the 'Deep' analysis button
            this.moveListElement.off('click.deep_analysis').on('click.deep_analysis', '.deep-analysis-btn', (e) => {
                e.stopPropagation(); 
                const moveIndex = parseInt($(e.currentTarget).data('move-index'));
                if (!isNaN(moveIndex)) {
                    this.runDeepAnalysis(moveIndex);
                }
            });

            // Click handler for the 'Retry Mistake' button
            this.retryMistakeBtn.off('click').on('click', () => {
                if (this.currentMoveIndex < 0) return;
                
                // Reconstruct the FEN of the position just before the bad move
                let tempGame = new Chess(this.startingFen);
                for (let i = 0; i < this.currentMoveIndex; i++) {
                    tempGame.move(this.gameHistory[i]);
                }
                // Set a global variable for the main game to pick up on return
                window.loadFenOnReturn = tempGame.fen();
                switchToMainGame();
            });

            // Keyboard navigation for analysis mode
            $(document).off('keydown.analysis').on('keydown.analysis', (e) => {
                if ($(e.target).is('input, select, textarea') || !isAnalysisMode) return;
                
                let newIndex = this.currentMoveIndex;
                switch (e.key.toLowerCase()) {
                    case 'arrowleft': if (this.currentMoveIndex > 0) newIndex--; else if (this.currentMoveIndex === 0) newIndex = -1; break;
                    case 'arrowright': if (this.currentMoveIndex < this.gameHistory.length - 1) newIndex++; break;
                    case 'arrowup': newIndex = -1; break; // Go to start position
                    case 'arrowdown': newIndex = this.gameHistory.length - 1; break;
                    case 'f':
                        this.analysisBoard.flip();
                        this.renderCoordinates();
                        this.redrawUserShapes();
                        break;
                    default: return;
                }

                if (newIndex !== this.currentMoveIndex) {
                    this.navigateToMove(newIndex);
                    if(newIndex > this.currentMoveIndex) window.playSound('moveSelf');
                }
                e.preventDefault();
            });

            // Right-click drawing handlers for the analysis board
            this.analysisBoardElement.off('mousedown contextmenu').on('mousedown contextmenu', (e) => {
                if (e.which !== 3) return; // Only for right-click
                e.preventDefault();
                this.isDrawing = true;
                this.drawStartSquare = $(e.target).closest('[data-square]').data('square');
            });

            $(document).off('mouseup.analysis_draw').on('mouseup.analysis_draw', (e) => {
                if (!this.isDrawing || e.which !== 3) return;
                e.preventDefault();
                
                const endSquare = $(e.target).closest('[data-square]').data('square');
                if (this.drawStartSquare && endSquare) {
                    if (this.drawStartSquare === endSquare) { // Highlight a square
                        const existingIndex = this.userShapes.findIndex(s => s.type === 'highlight' && s.square === this.drawStartSquare);
                        if (existingIndex > -1) this.userShapes.splice(existingIndex, 1);
                        else this.userShapes.push({ type: 'highlight', square: this.drawStartSquare, color: 'green' });
                    } else { // Draw an arrow
                        const existingIndex = this.userShapes.findIndex(s => s.type === 'arrow' && s.from === this.drawStartSquare && s.to === endSquare);
                        if (existingIndex > -1) this.userShapes.splice(existingIndex, 1);
                        else this.userShapes.push({ type: 'arrow', from: this.drawStartSquare, to: endSquare, color: 'rgba(21, 128, 61, 0.7)' });
                    }
                } else { // Clicked off board, clear all shapes
                    this.clearUserShapes();
                }
                this.redrawUserShapes();
                this.isDrawing = false;
                this.drawStartSquare = null;
            });
        },
    };

    Object.assign(controller, uiEventMethods);

})(window.AnalysisController);