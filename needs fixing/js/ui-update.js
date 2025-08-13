// ===================================================================================
//  UI-UPDATE.JS
//  Contains all functions that dynamically update the UI display.
// ===================================================================================

function updateOpeningName() {
    const pgn = game.pgn();
    let currentOpening = '';
    if (pgn) {
        // Search backwards for the most specific match first
        for (let i = OPENINGS.length - 1; i >= 0; i--) {
            if (pgn.startsWith(OPENINGS[i].pgn)) {
                currentOpening = OPENINGS[i].name;
                break;
            }
        }
    }
    openingNameElement.text(currentOpening);
}

function updateEvalBar(score) {
    // Clamp the score for a more stable bar, e.g., map a score of +/-1000 to the bar's limits
    const clampedScore = Math.max(-1000, Math.min(1000, score));
    // A non-linear transformation (atan) to make the bar more sensitive to small changes near 0
    const evalPercentage = 50 * (1 + (2 / Math.PI) * Math.atan(clampedScore / 350));
    
    // Clamp the final percentage to prevent the bar from completely disappearing
    const finalPercentage = Math.max(0.5, Math.min(99.5, evalPercentage));

    gsap.to(evalBarWhite, { height: `${finalPercentage}%`, duration: 0.7, ease: 'power2.out' });
    gsap.to(evalBarBlack, { height: `${100 - finalPercentage}%`, duration: 0.7, ease: 'power2.out' });
}

function updatePlayerLabels() {
    if (humanPlayer === 'w') {
        bottomPlayerNameElement.text(`${playerName} (White)`);
        topPlayerNameElement.text(`AI (Black)`);
    } else {
        bottomPlayerNameElement.text(`AI (White)`);
        topPlayerNameElement.text(`${playerName} (Black)`);
    }
}

function updateStatus() {
    if (reviewMoveIndex !== null) {
        undoButton.prop('disabled', true);
        hintButton.prop('disabled', true);
        return;
    }
    const turn = game.turn() === 'w' ? 'White' : 'Black';
    let text = game.game_over() ? 'Game Over' : `${turn}'s Turn`;
    if (game.in_check()) text += ' (in Check)';

    if (!isStockfishThinking) {
        statusElement.text(text).removeClass('thinking-animation');
    }

    const isPlayerTurn = game.turn() === humanPlayer && gameActive;
    undoButton.prop('disabled', !isPlayerTurn || game.history().length < 1);
    hintButton.prop('disabled', !isPlayerTurn);
}

function updateCapturedPieces() {
    const pieceThemePath = PIECE_THEMES[pieceThemeSelector.val()];
    if (!pieceThemePath) return;

    // Sort captured pieces by material value for a consistent display
    const pieceOrder = { p: 1, n: 2, b: 3, r: 4, q: 5 };
    capturedByWhite.sort((a,b) => pieceOrder[a.type] - pieceOrder[b.type]);
    capturedByBlack.sort((a,b) => pieceOrder[a.type] - pieceOrder[b.type]);
    
    const whiteCapturedHtml = capturedByWhite.map(p => `<img src="${pieceThemePath.replace('{piece}', p.color + p.type.toUpperCase())}" class="captured-piece" alt="${p.type}" />`).join('');
    const blackCapturedHtml = capturedByBlack.map(p => `<img src="${piece-themePath.replace('{piece}', p.color + p.type.toUpperCase())}" class="captured-piece" alt="${p.type}" />`).join('');
    
    capturedByWhiteElement.html(whiteCapturedHtml);
    capturedByBlackElement.html(blackCapturedHtml);
    
    // Calculate and display material advantage
    const whiteMatAdv = capturedByWhite.reduce((acc, p) => acc + (MATERIAL_POINTS[p.type] || 0), 0);
    const blackMatAdv = capturedByBlack.reduce((acc, p) => acc + (MATERIAL_POINTS[p.type] || 0), 0);
    
    const adv = whiteMatAdv - blackMatAdv;
    whiteAdvantageElement.text(adv > 0 ? `+${adv}` : '').toggleClass('hidden', adv <= 0);
    blackAdvantageElement.text(adv < 0 ? `+${-adv}` : '').toggleClass('hidden', adv >= 0);
}

function updateClockDisplay() {
    const isWhiteAtBottom = board.orientation() === 'white';
    const whiteClock = isWhiteAtBottom ? bottomClockElement : topClockElement;
    const blackClock = isWhiteAtBottom ? topClockElement : bottomClockElement;

    // Show infinity symbol for untimed games.
    if (!gameTime || gameTime.base === 0) {
        whiteClock.html('&infin;').addClass('infinity');
        blackClock.html('&infin;').addClass('infinity');
        whiteClock.removeClass('clock-active low-time');
        blackClock.removeClass('clock-active low-time');
        return;
    }
    
    whiteClock.removeClass('infinity');
    blackClock.removeClass('infinity');

    const formatTime = (timeInMs) => {
        if (timeInMs <= 0) return "0:00.0";
        const totalSeconds = Math.floor(timeInMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        // Show tenths of a second when under 10 seconds
        if (timeInMs < 10000 && timeInMs > 0) {
            const tenths = Math.floor((timeInMs % 1000) / 100);
            return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    whiteClock.text(formatTime(whiteTime));
    blackClock.text(formatTime(blackTime));

    whiteClock.removeClass('clock-active low-time');
    blackClock.removeClass('clock-active low-time');

    if (gameActive && game.turn() === 'w') {
        whiteClock.addClass('clock-active');
        if (whiteTime < 20000) whiteClock.addClass('low-time');
    } else if (gameActive && game.turn() === 'b') {
        blackClock.addClass('clock-active');
        if (blackTime < 20000) blackClock.addClass('low-time');
    }
}

function updateMoveHistoryDisplay() {
    const history = game.history({ verbose: true });
    moveHistoryLog.empty().addClass('move-history-grid');

    for (let i = 0; i < history.length; i += 2) {
        const moveNum = (i / 2) + 1;
        
        const w_move = history[i];
        let w_classificationIcon = '';
        if (window.moveAnalysisData && window.moveAnalysisData[i]) {
            const classification = window.moveAnalysisData[i].classification;
            const info = CLASSIFICATION_DATA[classification] || CLASSIFICATION_DATA['Pending'];
            w_classificationIcon = `<span class="classification-icon font-bold text-sm ${info.color}" title="${info.title}">${info.icon}</span>`;
        }
        const w_highlight = (reviewMoveIndex === i) ? 'highlight-move' : '';
        const w_moveSpan = `
            <span class="move-span ${w_highlight} flex justify-between items-center gap-1" data-move-index="${i}">
                <span>${w_move.san}</span>
                ${w_classificationIcon}
            </span>`;

        const b_move = history[i + 1];
        let b_moveSpan = '<span></span>';
        if (b_move) {
            let b_classificationIcon = '';
            if (window.moveAnalysisData && window.moveAnalysisData[i+1]) {
                const classification = window.moveAnalysisData[i+1].classification;
                const info = CLASSIFICATION_DATA[classification] || CLASSIFICATION_DATA['Pending'];
                b_classificationIcon = `<span class="classification-icon font-bold text-sm ${info.color}" title="${info.title}">${info.icon}</span>`;
            }
            const b_highlight = (reviewMoveIndex === i + 1) ? 'highlight-move' : '';
            b_moveSpan = `
                <span class="move-span ${b_highlight} flex justify-between items-center gap-1" data-move-index="${i + 1}">
                    <span>${b_move.san}</span>
                    ${b_classificationIcon}
                </span>`;
        }
        
        moveHistoryLog.append(`<span class="text-center font-bold text-dark">${moveNum}</span>`);
        moveHistoryLog.append(w_moveSpan);
        moveHistoryLog.append(b_moveSpan);
    }

    // Auto-scroll to the latest move
    if (reviewMoveIndex === null && moveHistoryLog.length) {
        moveHistoryLog.scrollTop(moveHistoryLog[0].scrollHeight);
    }
    updateNavButtons();
}

function updateGameSummary() {
    summaryAccuracy.find('div:first-child .font-bold').text('--%');
    summaryAccuracy.find('div:last-child .font-bold').text('--%');
}

function updateOpeningExplorer() {
    const pgn = game.pgn();
    // Only show explorer in the early game
    if (!pgn || game.history().length > 10) {
        openingExplorer.addClass('hidden');
        return;
    }

    const currentOpening = OPENINGS.find(o => pgn === o.pgn);
    if (currentOpening) {
        openingExplorerContent.text(currentOpening.name);
        openingExplorer.removeClass('hidden');
    } else {
        openingExplorer.addClass('hidden');
    }
}

function updateNavButtons() {
    const historyLen = game.history().length;
    exportPgnBtn.prop('disabled', historyLen === 0);

    if (reviewMoveIndex === null) {
        // We are in live game mode
        historyFirstBtn.prop('disabled', historyLen === 0);
        historyPrevBtn.prop('disabled', historyLen === 0);
        historyNextBtn.prop('disabled', true);
        historyLastBtn.prop('disabled', true);
    } else {
        // We are in review mode
        historyFirstBtn.prop('disabled', reviewMoveIndex <= 0);
        historyPrevBtn.prop('disabled', reviewMoveIndex <= 0);
        historyNextBtn.prop('disabled', reviewMoveIndex >= historyLen - 1);
        historyLastBtn.prop('disabled', false);
    }
}