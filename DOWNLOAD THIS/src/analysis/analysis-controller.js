// src/analysis/analysis-controller.js

// ===================================================================================
//  ANALYSIS-CONTROLLER.JS
//  Acts as the public interface and central manager for the game review feature.
// ===================================================================================

(function(window) {
    'use strict';

    let currentAnalysisEngine = null;
    let isAnalysisRunning = false;

    /**
     * The AnalysisController is the single point of entry for the game review mode.
     * It coordinates the actions of the other analysis modules (core, ui, board).
     */
    const AnalysisController = {
        
        /**
         * Initializes and runs the full game analysis. This is the main function
         * called when the user clicks the "Run Full Game Review" button.
         */
        init: async function() {
            if (isAnalysisRunning) {
                Logger.warn("Analysis is already in progress.");
                return;
            }

            const gameData = window.gameDataToAnalyze;
            if (!gameData || !gameData.stockfish) {
                Logger.critical("AnalysisController.init called without game data or a valid engine instance.", new Error("MissingAnalysisData"));
                Swal.fire('Error', 'Could not start analysis due to missing game data or engine.', 'error');
                return;
            }
            
            isAnalysisRunning = true;
            currentAnalysisEngine = gameData.stockfish;
            
            // 1. Switch the application view to the analysis room
            window.switchToAnalysisRoom();
            
            // 2. Initialize the dedicated analysis chessboard
            // This function will be defined in analysis-board.js
            AnalysisBoard.init(gameData.history);
            
            // 3. Reset all UI components to their initial state
            // This function will be defined in analysis-ui.js
            AnalysisUI.resetView();

            try {
                // 4. Start the core analysis process, which shows the progress visualizer.
                // The progress callback will be handled inside AnalysisCore.
                // This function will be defined in analysis-core.js
                const reviewData = await AnalysisCore.runReview(gameData);

                // 5. If successful, render the complete results to the UI
                // This function will be defined in analysis-ui.js
                AnalysisUI.renderResults(reviewData);

            } catch (error) {
                // The error is logged within the respective modules (e.g., GameReviewer)
                // but we ensure the UI is returned to a usable state.
                Swal.fire('Analysis Stopped', `The analysis was stopped or encountered an error: ${error.message}`, 'error');
                switchToMainGame(); // Return the user to the main game screen
            } finally {
                // 6. This block runs whether the analysis succeeded, failed, or was cancelled.
                isAnalysisRunning = false;
                this.stop(); // Ensure the dedicated engine worker is always terminated
            }
        },

        /**
         * Stops the analysis and terminates the dedicated Stockfish worker to free up resources.
         * This is a critical cleanup step to prevent memory leaks.
         */
        stop: function() {
            if (currentAnalysisEngine) {
                currentAnalysisEngine.terminate();
                currentAnalysisEngine = null;
                Logger.info("Dedicated analysis engine has been terminated.");
            }
            isAnalysisRunning = false;
        }
    };

    // Expose the controller to the global window object
    window.AnalysisController = AnalysisController;

})(window);