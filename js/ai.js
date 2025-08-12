// ===================================================================================
//  AI.JS
//  Handles all AI-related logic, including difficulty settings and engine interaction.
// ===================================================================================

let isStockfishThinking = false;
let engineTimeout = null;

/**
 * Initiates the AI's move based on the current difficulty setting.
 */
function makeAiMove() {
    if (!gameActive || game.game_over()) return;
    isStockfishThinking = true;
    $('#game-status').text("AI is thinking...").addClass('thinking-animation');

    // Failsafe timeout in case the engine hangs
    engineTimeout = setTimeout(() => {
        console.error("AI Timeout: Engine did not respond in 20 seconds.");
        isStockfishThinking = false;
        $('#game-status').text("AI Timeout. Can't move.").removeClass('thinking-animation');
        updateStatus();
    }, 20000);

    const difficulty = DIFFICULTY_SETTINGS[aiDifficulty];
    const fen = game.fen();
    stockfish.postMessage(`position fen ${fen}`);
    let goCommand = '';

    switch (difficulty.type) {
        case 'random':
            const moves = game.moves();
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            setTimeout(() => performMove(randomMove), 300);
            return; // Exit early, no need for stockfish

        case 'greedy':
            let bestMove = null;
            let maxVal = -1;
            game.moves({ verbose: true }).forEach(move => {
                let moveVal = 0;
                if (move.captured) {
                    moveVal = MATERIAL_POINTS[move.captured] || 0;
                }
                if (moveVal > maxVal) {
                    maxVal = moveVal;
                    bestMove = move;
                }
            });
            if (!bestMove) { // If no capture is available, make a random move
                const availableMoves = game.moves({ verbose: true });
                bestMove = availableMoves[Math.floor(Math.random() * availableMoves.length)];
            }
            setTimeout(() => performMove(bestMove.san), 300);
            return; // Exit early

        case 'stockfish':
            if (difficulty.depth) {
                goCommand = `go depth ${difficulty.depth}`;
            } else if (difficulty.movetime) {
                goCommand = `go movetime ${difficulty.movetime}`;
            }
            break;
    }

    console.log({ logType: 'info', text: `AI starts thinking. Command: ${goCommand}` });
    stockfish.postMessage(goCommand);
}