// ===================================================================================
//  TIMER.JS
//  Manages all game clock and timing logic.
// ===================================================================================

let timerInterval = null;
let whiteTime = 0;
let blackTime = 0;
let gameTime = { base: 0, inc: 0 }; // Default to Unlimited

/**
 * Stops the current game timer interval.
 */
function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

/**
 * Starts a new game timer interval, stopping any existing one.
 */
function startTimer() {
    if (timerInterval) stopTimer();
    timerInterval = setInterval(tick, 100);
}

/**
 * The core timer function, executed every 100ms.
 * Decrements the active player's clock and checks for flag fall.
 */
function tick() {
    const turn = game.turn();
    if (turn === 'w') {
        whiteTime -= 100;
        if (whiteTime <= 0) {
            whiteTime = 0;
            updateClockDisplay();
            endGameByFlag('white');
        }
    } else {
        blackTime -= 100;
        if (blackTime <= 0) {
            blackTime = 0;
            updateClockDisplay();
            endGameByFlag('black');
        }
    }
    updateClockDisplay();
}

/**
 * Ends the game when a player's time runs out.
 * @param {string} loserColor - The color of the player who ran out of time.
 */
function endGameByFlag(loserColor) {
    stopTimer();
    gameActive = false;
    const winnerColor = loserColor === 'white' ? 'Black' : 'White';
    const msg = `${winnerColor} wins on time.`;
    
    // Set the game result in the PGN header
    const result = winnerColor === 'White' ? '1-0' : '0-1';
    game.header('Result', result);

    $('#game-status').text(msg);
    playSound('gameEnd');
    showGameOverView();
    console.log({ logType: 'info', text: `Game Over. Result: ${msg}` });
}