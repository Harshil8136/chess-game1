// ===================================================================================
//  ANALYSIS-REVIEW.JS
//  Renders the analysis UI components like the move list and summary panel.
// ===================================================================================

/**
 * Renders the full list of reviewed moves.
 * @param {Array} reviewData - The array of move analysis objects.
 * @param {Array} gameHistory - The verbose history from chess.js.
 */
function renderReviewedMoveList(reviewData, gameHistory) {
    const moveListElement = $('#ar-analysis-move-list');
    if (!moveListElement) return;

    let html = '';
    for (let i = 0; i < gameHistory.length; i++) {
        const moveNum = Math.floor(i / 2) + 1;
        const move = gameHistory[i];
        const review = reviewData[i];
        if (!review) continue;

        const info = CLASSIFICATION_DATA[review.classification];
        
        html += `<div class="analysis-move-item flex items-center justify-between gap-3" data-move-index="${i}" title="${info.title}">`;
        html += `<div class="flex items-center gap-3 flex-grow">`;
        if (move.color === 'w') {
            html += `<span class="w-8 text-right font-bold text-dark">${moveNum}.</span>`;
        } else {
            html += `<span class="w-8"></span>`;
        }
        html += `<span class="flex-grow font-mono">${move.san}</span>`;
        html += `<span class="classification-icon font-bold text-lg w-6 text-center ${info.color}">${info.icon}</span>`;
        html += `</div>`;
        html += `<button class="deep-analysis-btn text-xs px-2 py-0.5 rounded btn-secondary flex-shrink-0" data-move-index="${i}">Deep</button>`;
        html += `</div>`;
    }
    moveListElement.html(html);
}

/**
 * Renders the accuracy and move counts in the summary panel.
 * @param {object} accuracy - An object with w and b accuracy percentages.
 * @param {object} moveCounts - An object with w and b move classification counts.
 */
function renderReviewSummary(accuracy, moveCounts) {
    $('#ar-white-accuracy').text(accuracy.w + '%');
    $('#ar-black-accuracy').text(accuracy.b + '%');
    
    let countsHtml = '';
    const displayOrder = ['Brilliant', 'Great', 'Best', 'Miss', 'Blunder', 'Mistake', 'Inaccuracy'];
    
    displayOrder.forEach(key => {
        const w_count = moveCounts.w[key] || 0;
        const b_count = moveCounts.b[key] || 0;
        if (w_count > 0 || b_count > 0) {
            const info = CLASSIFICATION_DATA[key];
            countsHtml += `<div class="text-right">${w_count}</div><div class="text-center font-bold ${info.color}" title="${info.title}">${info.icon} ${key}</div><div class="text-left">${b_count}</div>`;
        }
    });
    $('#ar-move-counts').html(countsHtml);
    $('#review-summary-container').removeClass('hidden');
}

/**
 * Shows the assessment details for the currently selected move.
 * @param {object} moveData - The analysis data for the specific move.
 * @param {string} bestLineSan - The best line in SAN format.
 */
function showMoveAssessmentDetails(moveData, bestLineSan) {
    if (!moveData) return;
    const info = CLASSIFICATION_DATA[moveData.classification];
    const assessmentDetailsElement = $('#ar-move-assessment-details');

    if (info) {
        $('#ar-assessment-title').text(info.title).attr('class', `text-lg font-bold ${info.color}`);
        $('#ar-assessment-comment').text(info.comment);
        assessmentDetailsElement.removeClass('hidden');

        const isBadMove = moveData.classification === 'Mistake' || moveData.classification === 'Blunder';
        $('#ar-retry-mistake-btn').toggleClass('hidden', !isBadMove);

        const bestLineDisplay = $('#ar-best-line-display');
        if (bestLineSan && ['Mistake', 'Blunder', 'Inaccuracy', 'Miss'].includes(moveData.classification)) {
            $('#ar-best-line-moves').text(bestLineSan);
            bestLineDisplay.removeClass('hidden');
        } else {
            bestLineDisplay.addClass('hidden');
        }
    }
}

/**
 * Updates the visual state of a move item in the list (e.g., during deep analysis).
 * @param {number} moveIndex - The index of the move in the list.
 * @param {object} state - An object describing the state, e.g., { isAnalyzing: true }.
 */
function updateMoveInUI(moveIndex, state = {}) {
    const moveItem = $(`#ar-analysis-move-list .analysis-move-item[data-move-index="${moveIndex}"]`);
    const button = moveItem.find('.deep-analysis-btn');
    const icon = moveItem.find('.classification-icon');

    if (state.isAnalyzing) {
        button.html('<div class="spinner-sm"></div>').prop('disabled', true);
    } else {
        const info = CLASSIFICATION_DATA[state.classification];
        icon.html(info.icon).attr('class', `classification-icon font-bold text-lg w-6 text-center ${info.color}`);
        moveItem.attr('title', info.title);
        button.text('Deep').prop('disabled', false);
        
        if (state.hasError) button.text('Error');

        // Brief highlight to show the update
        moveItem.css('transition', 'background-color 0.5s ease').css('background-color', 'var(--text-accent)');
        setTimeout(() => {
            if (!moveItem.hasClass('current-move-analysis')) {
                moveItem.css('background-color', '');
            }
        }, 1000);
    }
}