// src/js/analysis-helpers.js

// ===================================================================================
//  ANALYSIS-HELPERS.JS
//  Contains centralized, advanced logic for move classification and evaluation handling.
// ===================================================================================

window.AnalysisHelpers = {
    /**
     * Clamps an engine evaluation score to a maximum value for stable CPL calculation.
     */
    normalizeEvalForCpl: function(score) {
        const CPL_CAP = 1500; // Cap the eval at +/- 15 pawns for CPL purposes.
        return Math.max(-CPL_CAP, Math.min(CPL_CAP, score));
    },

    /**
     * Classifies a move based on CPL and other game context.
     */
    classifyMove: function(params) {
        const { cpl, opponentCpl, evalBefore, pgn } = params;
        const moveNumber = pgn.split(' ').filter(p => p.includes('.')).length;
        if (moveNumber <= 10 && OPENINGS.some(o => pgn.trim().startsWith(o.pgn))) {
            return 'Book';
        }
        if (opponentCpl >= 300 && cpl >= 120 && Math.abs(evalBefore) < 800) {
            return 'Miss';
        }
        if (cpl >= 300) return 'Blunder';
        if (cpl >= 120) return 'Mistake';
        if (cpl >= 50) return 'Inaccuracy';
        if (cpl < 10) return 'Best';
        if (cpl < 30) return 'Excellent';
        return 'Good';
    },

    /**
     * Calculates the average Centipawn Loss for a specific phase of the game.
     */
    calculatePhaseCpl: function(allPlayerMoves, startMove, endMove) {
        const phaseMoves = allPlayerMoves.filter(move => move.moveNum >= startMove && move.moveNum <= endMove);
        if (phaseMoves.length === 0) {
            return -1; // Sentinel value for no moves in this phase
        }
        const totalCpl = phaseMoves.reduce((sum, move) => sum + move.cpl, 0);
        return totalCpl / phaseMoves.length;
    },

    /**
     * Converts an average CPL score into an estimated ELO performance.
     */
    cplToElo: function(averageCpl) {
        if (averageCpl < 15) return 2600;
        if (averageCpl < 20) return 2400;
        if (averageCpl < 25) return 2200;
        if (averageCpl < 35) return 2000;
        if (averageCpl < 50) return 1800;
        if (averageCpl < 70) return 1600;
        if (averageCpl < 90) return 1400;
        if (averageCpl < 120) return 1200;
        if (averageCpl < 150) return 1000;
        return 800;
    },
    
    /**
     * Converts an average CPL for a game phase into a qualitative rating.
     */
    cplToPhaseRating: function(phaseCpl) {
        if (phaseCpl === -1) return 'None';
        if (phaseCpl < 30) return 'Excellent';
        if (phaseCpl < 60) return 'Good';
        if (phaseCpl < 100) return 'Inaccurate';
        return 'Poor';
    },

    /**
     * Performs a full, robust validation of a FEN string using the chess.js library.
     * This is the most reliable way to prevent malformed FENs from causing errors.
     * @param {string} fen - The FEN string to validate.
     * @returns {boolean} - True if the FEN is valid according to chess.js rules.
     */
    isValidFen: function(fen) {
        if (typeof fen !== 'string' || fen.trim() === '') {
            return false;
        }
        // Create a temporary, throwaway instance of the game to use its validator.
        const tempGame = new Chess();
        return tempGame.load(fen);
    }
};