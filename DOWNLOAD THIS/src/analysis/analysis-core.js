// src/analysis/analysis-core.js

// ===================================================================================
//  ANALYSIS-CORE.JS
//  The "brain" of the analysis feature. Manages the review process and data handling.
// ===================================================================================

(function(window) {
    'use strict';

    // --- Element References for the progress visualizer ---
    const visualizer = {
        container: $('#analysis-visualizer'),
        status: $('#visualizer-status'),
        moveNumber: $('#visualizer-move-number'),
        movePlayed: $('#visualizer-move-played'),
        assessment: $('#visualizer-move-assessment'),
        progressBar: $('#visualizer-progress-bar'),
        boardWrapper: $('#visualizer-board-wrapper'),
        cancelBtn: $('#visualizer-cancel-btn')
    };

    let visualizerBoard = null; // A small board for the progress pop-up

    // Private helper to manage the progress visualizer UI
    function _updateProgress(data) {
        const { moveNumber, totalMoves, moveSan } = data;
        const progress = Math.round((moveNumber / totalMoves) * 100);

        visualizer.status.text(`Analyzing move ${moveNumber} of ${totalMoves}...`);
        visualizer.moveNumber.text(`${moveNumber} / ${totalMoves}`);
        visualizer.movePlayed.text(moveSan);
        visualizer.progressBar.css('width', `${progress}%`);

        // Update the small visualizer board to show the current move being analyzed
        const tempGame = new Chess();
        const fullHistory = window.gameDataToAnalyze.history;
        for (let i = 0; i < moveNumber; i++) {
            tempGame.move(fullHistory[i].san);
        }
        if (visualizerBoard) {
            visualizerBoard.position(tempGame.fen());
        }
    }

    const AnalysisCore = {
        /**
         * Runs the full game review using the GameReviewer module.
         * @param {object} gameData - The data object containing pgn, history, and the engine worker.
         * @returns {Promise<object>} A promise that resolves with the full review data.
         */
        runReview: async function(gameData) {
            Logger.info("Analysis Core: Starting game review process.");
            
            // --- Setup the Progress Visualizer ---
            visualizer.container.removeClass('hidden');
            visualizer.progressBar.css('width', '0%');
            visualizer.status.text('Initializing engine for review...');
            visualizer.moveNumber.text('--');
            visualizer.movePlayed.text('--');

            // Initialize the small board inside the visualizer pop-up
            if (visualizerBoard) visualizerBoard.destroy();
            visualizerBoard = Chessboard(visualizer.boardWrapper.attr('id'), {
                position: 'start',
                pieceTheme: PIECE_THEMES[pieceThemeSelector.val()],
                showNotation: false
            });

            // The callback function that GameReviewer will call after each move
            const progressCallback = (progressData) => {
                _updateProgress(progressData);
                // The assessment will be updated by the reviewer itself in a future step if needed
            };

            try {
                // --- Run the Analysis ---
                // This is the main, long-running task. The 'await' will pause execution
                // here until the GameReviewer is finished.
                const reviewData = await GameReviewer.analyze(
                    gameData.pgn,
                    gameData.stockfish,
                    progressCallback
                );

                Logger.info("Analysis Core: Game review process completed successfully.");
                visualizer.container.addClass('hidden');
                
                // Return the completed data to the controller
                return reviewData;

            } catch (error) {
                Logger.error("Analysis Core: The review process failed or was cancelled.", error);
                visualizer.container.addClass('hidden');

                // Propagate the error up to the controller to be handled
                throw error;
            }
        }
    };

    window.AnalysisCore = AnalysisCore;

})(window);