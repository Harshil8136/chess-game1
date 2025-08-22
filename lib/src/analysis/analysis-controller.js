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
         * Initializes and runs the full game analysis.
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
            
            // 1. Switch the application view. This is now a simple, synchronous call.
            window.switchToAnalysisRoom();
            
            try {
                // 2. Perform a pre-flight check on analysis UI elements
                Validator.verifyElements(Validator.getAnalysisPreflightChecks());

                // 3. Initialize the dedicated analysis chessboard
                AnalysisBoard.init(gameData.history);
                
                // 4. Reset all UI components to their initial state
                AnalysisUI.resetView();

                // 5. Start the core analysis process (this part is still async)
                const reviewData = await AnalysisCore.runReview(gameData);

                // 6. If successful, render the complete results to the UI
                AnalysisUI.renderResults(reviewData);

            } catch (error) {
                // This block will catch validation errors or any other critical failure.
                Logger.error("Analysis initialization failed.", error);
                switchToMainGame();
            } finally {
                if (isAnalysisRunning) {
                    isAnalysisRunning = false;
                    this.stop();
                }
            }
        },

        /**
         * Stops the analysis and terminates the dedicated Stockfish worker to free up resources.
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

    window.AnalysisController = AnalysisController;

})(window);