// ===================================================================================
//  ANALYSIS-EVAL.JS
//  Contains logic for move classification and accuracy calculation.
// ===================================================================================

/**
 * Classifies a single move based on Centipawn Loss (CPL) and other context.
 * @param {number} cpl - The Centipawn Loss for the move.
 * @param {number} opponentCpl - The CPL of the opponent's previous move.
 * @param {number} bestMoveAdvantage - The evaluation difference between the best and second-best moves.
 * @param {string} pgn - The full PGN string up to the current move.
 * @returns {string} The classification key (e.g., 'Blunder', 'Best').
 */
function classifyMove(cpl, opponentCpl, bestMoveAdvantage, pgn) {
    const moveNumber = pgn.split(' ').filter(p => p.includes('.')).length;
    if (moveNumber <= 10 && OPENINGS.some(o => pgn.trim().startsWith(o.pgn))) {
        return 'Book';
    }
    if (opponentCpl > 150 && cpl > 70) return 'Miss';
    if (cpl < 10 && bestMoveAdvantage > 250) return 'Brilliant';
    if (cpl < 10 && bestMoveAdvantage > 100) return 'Great';
    if (cpl >= 300) return 'Blunder';
    if (cpl >= 120) return 'Mistake';
    if (cpl >= 50) return 'Inaccuracy';
    if (cpl < 10) return 'Best';
    if (cpl < 30) return 'Excellent';
    return 'Good';
}

/**
 * Calculates game statistics based on the full review data.
 * @param {Array} reviewData - The array of move analysis objects.
 * @param {Array} gameHistory - The verbose history from chess.js.
 * @returns {object} An object containing CPL arrays, move counts, and accuracy scores.
 */
function recalculateStats(reviewData, gameHistory) {
    const stats = {
        cpl: { w: [], b: [] },
        moveCounts: { w: {}, b: {} },
        accuracy: { w: 0, b: 0 }
    };

    for (const key in CLASSIFICATION_DATA) {
        stats.moveCounts.w[key] = 0;
        stats.moveCounts.b[key] = 0;
    }

    reviewData.forEach((data, index) => {
        const player = gameHistory[index].color;
        if (data.cpl > 0) {
            stats.cpl[player].push(Math.min(data.cpl, 350));
        }
        if (stats.moveCounts[player] && data.classification in stats.moveCounts[player]) {
            stats.moveCounts[player][data.classification]++;
        }
    });

    const calculate = (cpl_array) => {
        if (cpl_array.length === 0) return 100;
        const avg_cpl = cpl_array.reduce((a, b) => a + b, 0) / cpl_array.length;
        return Math.max(0, Math.min(100, Math.round(103.16 * Math.exp(-0.04354 * avg_cpl))));
    };

    stats.accuracy.w = calculate(stats.cpl.w);
    stats.accuracy.b = calculate(stats.cpl.b);

    return stats;
}

/**
 * Converts a UCI move sequence to SAN format from a given position.
 * @param {string} fen - The starting FEN of the position.
 * @param {string} uciLine - The space-separated UCI move sequence.
 * @returns {string} The SAN representation of the first few moves.
 */
function uciToSanLine(fen, uciLine) {
    try {
        const tempGame = new Chess(fen);
        const moves = uciLine.split(' ');
        let sanMoves = [];
        for (let i = 0; i < Math.min(moves.length, 5); i++) {
            const move = tempGame.move(moves[i], { sloppy: true });
            if (move) {
                sanMoves.push(move.san);
            } else {
                break;
            }
        }
        return sanMoves.join(' ');
    } catch (e) {
        return uciLine;
    }
}