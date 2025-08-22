// src/analysis/analysis-ui.js

// ===================================================================================
//  ANALYSIS-UI.JS
//  Manages all DOM rendering and user interactions for the analysis room.
// ===================================================================================

(function(window) {
    'use strict';

    // --- State & Element References (Declared but not assigned) ---
    let reviewData = null;
    let currentMoveIndex = -1;
    let evalChart = null;
    let elements = {}; // This will be populated by the init function

    // --- Private Helper Functions ---

    function _buildMoveList() {
        if (!reviewData) return;
        elements.moveList.empty();

        const isKeyMomentsOnly = elements.keyMomentsToggle.find('[data-filter="key"]').hasClass('active');

        for (let i = 0; i < reviewData.moves.length; i += 2) {
            const moveNum = (i / 2) + 1;
            
            const whiteMove = reviewData.moves[i];
            const blackMove = reviewData.moves[i + 1];

            const isWhiteKey = reviewData.keyMoments.includes(i);
            const isBlackKey = blackMove && reviewData.keyMoments.includes(i + 1);

            if (isKeyMomentsOnly && !isWhiteKey && !isBlackKey) {
                continue; 
            }
            
            const whiteInfo = CLASSIFICATION_DATA[whiteMove.classification];
            const blackInfo = blackMove ? CLASSIFICATION_DATA[blackMove.classification] : null;

            const whiteMoveHtml = `
                <div class="analysis-move-item move-${whiteMove.classification.toLowerCase()}" data-move-index="${i}">
                    <img src="${whiteInfo.icon}" class="classification-icon" alt="${whiteInfo.title}">
                    <span class="font-mono">${whiteMove.move}</span>
                </div>`;
            
            const blackMoveHtml = blackMove ? `
                <div class="analysis-move-item move-${blackMove.classification.toLowerCase()}" data-move-index="${i + 1}">
                    <img src="${blackInfo.icon}" class="classification-icon" alt="${blackInfo.title}">
                    <span class="font-mono">${blackMove.move}</span>
                </div>` : '<div></div>';

            const rowClass = (isWhiteKey || isBlackKey) ? 'key-moment' : '';

            const rowHtml = `
                <div class="analysis-move-row ${rowClass}" data-row-index="${i}">
                    <div class="move-number">${moveNum}.</div>
                    ${whiteMoveHtml}
                    ${blackMoveHtml}
                </div>`;
            
            elements.moveList.append(rowHtml);
        }
    }

    function _buildEvalChart() {
        if (!reviewData) return;
        if (evalChart) evalChart.destroy();

        const labels = reviewData.moves.map((_, i) => Math.ceil((i + 1) / 2));
        const scores = [0, ...reviewData.moves.map(m => m.score / 100)]; 
        const cappedScores = scores.map(s => Math.max(-10, Math.min(10, s))); 

        const ctx = document.getElementById('ar-eval-chart').getContext('2d');
        evalChart = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [{
                data: cappedScores,
                borderColor: 'rgba(255, 255, 255, 0.5)',
                backgroundColor: (context) => {
                    const value = context.raw;
                    return value >= 0 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.3)';
                },
                fill: 'start', tension: 0.1, pointRadius: 0
            }]},
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    y: { min: -10, max: 10, ticks: { color: 'rgba(255, 255, 255, 0.5)' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                    x: { ticks: { display: false }, grid: { display: false } }
                },
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                onHover: (event, chartElement) => {
                    $('.analysis-move-row').removeClass('chart-hover');
                    if(chartElement.length > 0) {
                        const moveIndex = chartElement[0].index - 1;
                        if(moveIndex >= 0) {
                            const rowIndex = Math.floor(moveIndex / 2) * 2;
                            $(`[data-row-index="${rowIndex}"]`).addClass('chart-hover');
                        }
                    }
                }
            }
        });
    }
    
    function _updateMoveDetails() {
        if (currentMoveIndex < 0 || !reviewData) {
            elements.assessmentContainer.addClass('hidden');
            elements.bestLineContainer.addClass('hidden');
            AnalysisBoard.clearShapes();
            return;
        }

        const moveData = reviewData.moves[currentMoveIndex];
        const info = CLASSIFICATION_DATA[moveData.classification];
        
        elements.assessmentTitle.html(`<img src="${info.icon}" class="classification-icon mr-2" /> ${info.title}`).removeClass().addClass(`text-lg font-bold flex items-center ${info.color}`);
        elements.assessmentComment.text(info.comment);
        elements.assessmentContainer.removeClass('hidden');

        if (moveData.bestLineUci) {
            const bestLineSan = _convertUciLineToSan(moveData.bestLineUci);
            elements.bestLineMoves.text(bestLineSan);
            elements.bestLineContainer.removeClass('hidden');
            AnalysisBoard.showBestMove(moveData.bestLineUci.split(' ')[0]);
        } else {
            elements.bestLineContainer.addClass('hidden');
            AnalysisBoard.clearShapes();
        }
    }
    
    function _convertUciLineToSan(uciLine) {
        const tempGame = new Chess();
        const fullHistory = window.gameDataToAnalyze.history;
        for (let i = 0; i < currentMoveIndex; i++) {
            // Note: we go up to BEFORE the current move to get the correct starting position
            tempGame.move(fullHistory[i].san);
        }
        
        const moves = uciLine.split(' ');
        let sanLine = [];
        for (const uciMove of moves) {
            const moveResult = tempGame.move({ from: uciMove.substring(0,2), to: uciMove.substring(2,4), promotion: uciMove.length === 5 ? uciMove.substring(4) : undefined });
            if (moveResult) {
                sanLine.push(moveResult.san);
            } else {
                break;
            }
        }
        return sanLine.join(' ');
    }

    // --- Public Interface ---
    const AnalysisUI = {
        init: function() {
            // --- FIX: Populate element references at the correct time ---
            elements = {
                playerNames: $('#ar-player-names'),
                whiteAccuracy: $('#ar-white-accuracy'), whiteAccuracyBar: $('#ar-white-accuracy-bar'),
                blackAccuracy: $('#ar-black-accuracy'), blackAccuracyBar: $('#ar-black-accuracy-bar'),
                whiteElo: $('#ar-white-elo'), blackElo: $('#ar-black-elo'),
                moveCounts: $('#ar-move-counts'),
                phaseDisplay: $('#ar-phase-display'),
                moveList: $('#ar-analysis-move-list'),
                chartContainer: $('#eval-chart-container'),
                assessmentTitle: $('#ar-assessment-title'),
                assessmentComment: $('#ar-assessment-comment'),
                assessmentContainer: $('#ar-move-assessment-details'),
                bestLineMoves: $('#ar-best-line-moves'),
                bestLineContainer: $('#ar-best-line-display'),
                keyMomentsToggle: $('#key-moments-toggle-container')
            };

            // --- FIX: Attach event listeners only once during initialization ---
            elements.moveList.off('click').on('click', '.analysis-move-item', function() {
                currentMoveIndex = parseInt($(this).data('move-index'));
                
                $('.analysis-move-row').removeClass('current-move');
                $(this).closest('.analysis-move-row').addClass('current-move');
                
                AnalysisBoard.displayPosition(currentMoveIndex);
                _updateMoveDetails();
            });

            elements.keyMomentsToggle.off('click').on('click', 'button', function() {
                elements.keyMomentsToggle.find('button').removeClass('active');
                $(this).addClass('active');
                _buildMoveList();
            });
        },

        resetView: function() {
            // If elements aren't initialized yet, run init first
            if (Object.keys(elements).length === 0) {
                this.init();
            }

            elements.whiteAccuracy.text('--%');
            elements.whiteAccuracyBar.css('width', '0%');
            elements.blackAccuracy.text('--%');
            elements.blackAccuracyBar.css('width', '0%');
            elements.whiteElo.text('----');
            elements.blackElo.text('----');
            elements.moveCounts.empty();
            elements.phaseDisplay.empty();
            elements.moveList.empty();
            elements.assessmentContainer.addClass('hidden');
            elements.bestLineContainer.addClass('hidden');
            elements.keyMomentsToggle.addClass('hidden');
            if(evalChart) evalChart.destroy();
        },

        renderResults: function(data) {
            reviewData = data;
            
            elements.whiteAccuracy.text(`${reviewData.accuracy.w}%`);
            elements.whiteAccuracyBar.css('width', `${reviewData.accuracy.w}%`);
            elements.blackAccuracy.text(`${reviewData.accuracy.b}%`);
            elements.blackAccuracyBar.css('width', `${reviewData.accuracy.b}%`);
            elements.whiteElo.text(reviewData.elo.w);
            elements.blackElo.text(reviewData.elo.b);

            const allClassifications = Object.keys(CLASSIFICATION_DATA).filter(k => k !== 'Pending' && k !== 'Best' && k !== 'Great');
            let moveCountsHtml = '<div></div><div class="flex justify-between font-mono text-sm text-dark"><span class="ml-8">White</span><span>Black</span></div>';
            for (const classification of allClassifications) {
                const countW = reviewData.moveCounts.w[classification] || 0;
                const countB = reviewData.moveCounts.b[classification] || 0;
                if (countW > 0 || countB > 0) {
                    const info = CLASSIFICATION_DATA[classification];
                    moveCountsHtml += `
                        <div class="flex justify-between items-center text-sm py-1">
                            <div class="flex items-center gap-2">
                                <img src="${info.icon}" class="w-5 h-5" alt="${info.title}">
                                <span class="font-bold">${info.title}</span>
                            </div>
                            <div class="flex items-center gap-4 font-mono w-20 justify-between">
                                <span>${countW}</span>
                                <span>${countB}</span>
                            </div>
                        </div>`;
                }
            }
            elements.moveCounts.html(moveCountsHtml);

            _buildMoveList();
            _buildEvalChart();
            if (reviewData.keyMoments.length > 0) {
                elements.keyMomentsToggle.removeClass('hidden');
            }

            currentMoveIndex = reviewData.moves.length - 1;
            AnalysisBoard.displayPosition(currentMoveIndex);
            _updateMoveDetails();
            elements.moveList.find(`[data-move-index="${currentMoveIndex}"]`).closest('.analysis-move-row').addClass('current-move');
        }
    };

    window.AnalysisUI = AnalysisUI;

})(window);