// src/js/ui-validator.js

// ===================================================================================
//  UI-VALIDATOR.JS
//  A centralized script to verify the integrity of the DOM. It ensures that all
//  critical elements exist before other scripts attempt to use them.
// ===================================================================================

(function(window) {
    'use strict';

    /**
     * The "Book of Errors" - A centralized dictionary of all known UI validation errors.
     * This provides user-friendly titles and messages for display, and more technical
     * messages for the developer console log.
     */
    const VALIDATION_ERRORS = {
        // --- Core Application Containers ---
        'MISSING_GAME_CONTAINER': {
            title: 'Critical UI Error',
            message: 'The main container for the game screen (#main-game) is missing. The application cannot start.',
            logMessage: "Validation failed: Required DOM element '#main-game' not found."
        },
        'MISSING_ANALYSIS_CONTAINER': {
            title: 'Critical UI Error',
            message: 'The main container for the analysis room (#analysis-room) is missing. The game review feature will not work.',
            logMessage: "Validation failed: Required DOM element '#analysis-room' not found."
        },

        // --- Main Game Board Elements ---
        'MISSING_MAIN_BOARD': {
            title: 'Board Error',
            message: 'The container for the main chessboard (#board) is missing from the HTML. The game cannot be displayed.',
            logMessage: "Validation failed: Required DOM element '#board' for the main chessboard not found."
        },
        'MISSING_MAIN_BOARD_OVERLAY': {
            title: 'Board Error',
            message: 'The SVG overlay for drawing arrows on the main board is missing. Interaction will be limited.',
            logMessage: "Validation failed: Required DOM element '#board-svg-overlay' not found."
        },

        // --- Analysis Room Board Elements ---
        'MISSING_ANALYSIS_BOARD': {
            title: 'Analysis Board Error',
            message: 'The container for the analysis chessboard (#analysis-board) is missing. The game review cannot be displayed.',
            logMessage: "Validation failed: Required DOM element '#analysis-board' for the analysis board not found."
        },
        'MISSING_ANALYSIS_BOARD_OVERLAY': {
            title: 'Analysis Board Error',
            message: 'The SVG overlay for drawing arrows on the analysis board is missing. The game review will not function correctly.',
            logMessage: "Validation failed: Required DOM element '#analysis-board-svg-overlay' not found."
        },
        
        // --- Visualizer Elements ---
        'MISSING_VISUALIZER': {
            title: 'Analysis Component Error',
            message: 'The pop-up container for analysis progress (#analysis-visualizer) is missing.',
            logMessage: "Validation failed: Required DOM element '#analysis-visualizer' not found."
        },
        'MISSING_VISUALIZER_BOARD': {
            title: 'Analysis Component Error',
            message: 'The small preview board inside the analysis progress pop-up (#visualizer-board-wrapper) is missing.',
            logMessage: "Validation failed: Required DOM element '#visualizer-board-wrapper' not found."
        },

        // --- Sidebar & Panel Elements ---
        'MISSING_STATUS_PANEL': {
            title: 'UI Component Error',
            message: 'The status display panel (#game-status) is missing. Game status will not be visible.',
            logMessage: "Validation failed: Required DOM element '#game-status' not found."
        },
        'MISSING_MOVE_LOG': {
            title: 'UI Component Error',
            message: 'The container for the move history log (#move-history-log) is missing. Moves will not be displayed.',
            logMessage: "Validation failed: Required DOM element '#move-history-log' not found."
        },
        'MISSING_SETTINGS_TAB': {
            title: 'UI Component Error',
            message: 'The container for the settings tab (#settings-tab) is missing. Settings will be inaccessible.',
            logMessage: "Validation failed: Required DOM element '#settings-tab' not found."
        }
    };

    /**
     * The core validation function. It iterates through a list of required elements
     * and checks for their existence in the DOM. If an element is not found, it
     * logs a critical error and displays a user-friendly alert before halting
     * all further script execution.
     * @param {Array<Object>} checks - An array of objects, each with an 'id' and 'code'.
     * @returns {boolean} - Returns true if all checks pass.
     */
    function verifyElements(checks) {
        for (const check of checks) {
            const element = document.getElementById(check.id);
            if (!element) {
                const error = VALIDATION_ERRORS[check.code];

                // 1. Log the technical error to our persistent console
                Logger.critical(error.logMessage, { checkedId: check.id });

                // 2. Display a user-friendly error message
                Swal.fire({
                    icon: 'error',
                    title: error.title,
                    text: error.message,
                    footer: 'Please check the integrity of the application files.',
                    allowOutsideClick: false
                });
                
                // 3. Halt all further script execution to prevent a cascade of errors
                throw new Error(error.logMessage);
            }
        }
        Logger.info(`UI Validation successful for ${checks.length} elements.`);
        return true;
    }

    // Expose the validator to the global window object
    window.Validator = {
        verifyElements: verifyElements,

        // Define lists of elements to be checked at different stages
        getInitialLoadChecks: function() {
            return [
                { id: 'main-game', code: 'MISSING_GAME_CONTAINER' },
                { id: 'analysis-room', code: 'MISSING_ANALYSIS_CONTAINER' },
                { id: 'board', code: 'MISSING_MAIN_BOARD' },
                { id: 'analysis-board', code: 'MISSING_ANALYSIS_BOARD' },
                { id: 'game-status', code: 'MISSING_STATUS_PANEL' },
                { id: 'move-history-log', code: 'MISSING_MOVE_LOG' },
                { id: 'settings-tab', code: 'MISSING_SETTINGS_TAB' },
                { id: 'analysis-visualizer', code: 'MISSING_VISUALIZER' }
            ];
        },

        getAnalysisPreflightChecks: function() {
            return [
                { id: 'analysis-board', code: 'MISSING_ANALYSIS_BOARD' },
                { id: 'analysis-board-svg-overlay', code: 'MISSING_ANALYSIS_BOARD_OVERLAY' },
                { id: 'visualizer-board-wrapper', code: 'MISSING_VISUALIZER_BOARD' }
            ];
        }
    };

})(window);