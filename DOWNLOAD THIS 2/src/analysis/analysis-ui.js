// src/js/analysis-ui.js

// ===================================================================================
//  ANALYSIS-UI.JS
//  Manages all UI components and interactions for the Analysis Room.
// ===================================================================================

(function(controller) {
    if (!controller) {
        console.error("Analysis Core module must be loaded before the UI module.");
        return;
    }

    const uiMethods = {

        populateUIReferences: function() {
            this.moveListElement = $('#ar-analysis-move-list');
            this.evalChartCanvas = $('#ar-eval-chart');
            this.assessmentDetailsElement = $('#ar-move-assessment-details');
            this.assessmentTitleElement = $('#ar-assessment-title');
            this.assessmentCommentElement = $('#ar-assessment-comment');
            this.boardWrapper = $('#analysis-room .board-wrapper');
            this.reviewSummaryContainer = $('#review-summary-container');
            this.whiteAccuracyElement = $('#ar-white-accuracy');
            this.blackAccuracyElement = $('#ar-black-accuracy');
            this.whiteAccuracyBar = $('#ar-white-accuracy-bar');
            this.blackAccuracyBar = $('#ar-black-accuracy-bar');
            this.moveCountsContainer = $('#ar-move-counts');
            this.retryMistakeBtn = $('#ar-retry-mistake-btn');
            this.bestLineDisplay = $('#ar-best-line-display');
            this.bestLineMoves = $('#ar-best-line-moves');
            this.analysisBoardSvgOverlay = $('#analysis-board-svg-overlay');
            this.analysisBoardElement = $('#analysis-board');
            this.visualizerBoardWrapper = $('#visualizer-board-wrapper');
            this.visualizerStatusElement = $('#visualizer-status');
            this.visualizerMoveNumberElement = $('#visualizer-move-number');
            this.visualizerMovePlayedElement = $('#visualizer-move-played');
            this.visualizerMoveAssessmentElement = $('#visualizer-move-assessment');
            this.visualizerProgressBar = $('#visualizer-progress-bar');
            this.analysisDashboardContainer = $('#analysis-dashboard');
            this.estimatedEloPanel = $('#estimated-elo-panel');
            this.whiteEloElement = $('#ar-white-elo');
            this.blackEloElement = $('#ar-black-elo');
            this.gamePhasePanel = $('#game-phase-panel');
            this.phaseDisplayElement = $('#ar-phase-display');
            this.keyMomentsToggleContainer = $('#key-moments-toggle-container');
        },

        initializeBoard: function() {
            try {
                const boardConfig = {
                    position: 'start',
                    pieceTheme: PIECE_THEMES[localStorage.getItem('chessPieceTheme') || 'cburnett'],
                    draggable: false,
                    showNotation: false
                };
                if (this.analysisBoard && typeof this.analysisBoard.destroy === 'function') {
                    this.analysisBoard.destroy();
                }
                this.analysisBoard = Chessboard('analysis-board', boardConfig);
                this.applyTheme();
                this.renderCoordinates();
            } catch (error) {
                Logger.error('AnalysisController: Error initializing board', error);
                this.showError("Failed to initialize analysis board.");
            }
        },

        initializeVisualizerBoard: function() {
            try {
                const boardConfig = {
                    position: 'start',
                    pieceTheme: PIECE_THEMES[localStorage.getItem('chessPieceTheme') || 'cburnett']
                };
                if (this.visualizerBoard && typeof this.visualizerBoard.destroy === 'function') {
                    this.visualizerBoard.destroy();
                }
                this.visualizerBoard = Chessboard('visualizer-board-wrapper', boardConfig);
            } catch (error) {
                Logger.error('AnalysisController: Error initializing visualizer board', error);
            }
        },
        
        setupEventHandlers: function() {
            this.moveListElement.off('click.navigate').on('click.navigate', '.analysis-move-row, .analysis-move-item', (e) => {
                e.stopPropagation();
                const moveIndex = parseInt($(e.currentTarget).data('move-index'));
                if (!isNaN(moveIndex) && moveIndex >= -1 && moveIndex < this.gameHistory.length) {
                    this.navigateToMove(moveIndex);
                    window.playSound('moveSelf');
                }
            });
            
            this.retryMistakeBtn.off('click').on('click', () => {
                if (this.currentMoveIndex < 0) return;
                const tempGame = new Chess(this.analysisGame.header().FEN || undefined);
                for (let i = 0; i < this.currentMoveIndex; i++) {
                    tempGame.move(this.gameHistory[i]);
                }
                window.loadFenOnReturn = tempGame.fen();
                switchToMainGame();
            });

            this.keyMomentsToggleContainer.off('click').on('click', 'button', (e) => {
                const filter = $(e.currentTarget).data('filter');
                this.keyMomentsToggleContainer.find('button').removeClass('active');
                $(e.currentTarget).addClass('active');

                if (filter === 'all') {
                    this.moveListElement.find('.analysis-move-row').show();
                } else {
                    this.moveListElement.find('.analysis-move-row').hide();
                    this.moveListElement.find('.analysis-move-row[data-key-moment="true"]').show();
                }
            });

            $(document).off('keydown.analysis').on('keydown.analysis', (e) => {
                if ($(e.target).is('input, select, textarea') || !isAnalysisMode) return;
                let newIndex = this.currentMoveIndex;
                switch (e.key.toLowerCase()) {
                    case 'arrowleft': if (this.currentMoveIndex >= 0) newIndex--; break;
                    case 'arrowright': if (this.currentMoveIndex < this.gameHistory.length - 1) newIndex++; break;
                    case 'arrowup': newIndex = -1; break;
                    case 'arrowdown': newIndex = this.gameHistory.length - 1; break;
                    case 'f':
                        this.analysisBoard.flip();
                        this.renderCoordinates();
                        this.redrawUserShapes();
                        break;
                    default: return;
                }
                if (newIndex !== this.currentMoveIndex) {
                    this.navigateToMove(newIndex);
                    window.playSound('moveSelf');
                }
                e.preventDefault();
            });

            this.setupBoardDrawingHandlers();
        },

        renderReviewedMoveList: function() {
            if (!this.moveListElement) return;
            let html = '';
            html += `<div class="analysis-move-row" data-move-index="-1"><div class="move-number">--</div><div class="analysis-move-item text-dark font-bold col-span-2"><span>Starting Position</span></div></div>`;

            for (let i = 0; i < this.gameHistory.length; i += 2) {
                const moveNum = Math.floor(i / 2) + 1;
                const whiteMove = this.gameHistory[i];
                const whiteReview = this.reviewData[i];
                const whiteInfo = this.CLASSIFICATION_DATA[whiteReview.classification];
                const isWhiteKey = (this.keyMoments || []).includes(i);

                const blackMove = this.gameHistory[i + 1];
                const blackReview = this.reviewData[i + 1];
                const isBlackKey = blackMove ? (this.keyMoments || []).includes(i + 1) : false;
                
                let whiteHtml = `<div class="analysis-move-item" data-move-index="${i}" title="${whiteInfo.title}"><span class="font-mono">${whiteMove.san}</span><img class="classification-icon" src="${whiteInfo.icon}" alt="${whiteInfo.title}"/></div>`;
                
                let blackHtml = '<div></div>';
                let blackClass = '';
                if (blackMove && blackReview) {
                    const blackInfo = this.CLASSIFICATION_DATA[blackReview.classification];
                    blackClass = blackReview.classification;
                    blackHtml = `<div class="analysis-move-item" data-move-index="${i+1}" title="${blackInfo.title}"><span class="font-mono">${blackMove.san}</span><img class="classification-icon" src="${blackInfo.icon}" alt="${blackInfo.title}"/></div>`;
                }
                
                html += `<div class="analysis-move-row ${isWhiteKey || isBlackKey ? 'key-moment' : ''}" data-move-index="${i}" data-classification-w="${whiteReview.classification}" data-classification-b="${blackClass}" data-key-moment="${isWhiteKey || isBlackKey}"><div class="move-number">${moveNum}</div>${whiteHtml}${blackHtml}</div>`;
            }
            this.moveListElement.html(html);
        },

        renderReviewSummary: function() {
            this.whiteAccuracyElement.text(this.accuracy.w + '%');
            this.blackAccuracyElement.text(this.accuracy.b + '%');
            this.whiteAccuracyBar.css('width', this.accuracy.w + '%');
            this.blackAccuracyBar.css('width', this.accuracy.b + '%');
            
            let countsHtml = '';
            const displayOrder = ['Brilliant', 'Great', 'Best', 'Excellent', 'Good', 'Inaccuracy', 'Mistake', 'Blunder', 'Miss', 'Book'];
            
            const createCountItem = (player, key) => {
                const count = (this.moveCounts[player] && this.moveCounts[player][key]) ? this.moveCounts[player][key] : 0;
                if (count === 0) return '';
                const info = this.CLASSIFICATION_DATA[key];
                return `<div class="move-count-item" title="${info.title}"><img src="${info.icon}" alt="${info.title}" /><span class="count">${count}</span></div>`;
            };
            
            countsHtml += `<div class="flex justify-center flex-wrap gap-x-3 gap-y-1">${displayOrder.map(key => createCountItem('w', key)).join('')}</div>`;
            countsHtml += `<div class="flex justify-center flex-wrap gap-x-3 gap-y-1">${displayOrder.map(key => createCountItem('b', key)).join('')}</div>`;

            const headerHtml = `<div class="font-bold text-light text-center">White</div><div class="font-bold text-light text-center">Black</div>`;
            this.moveCountsContainer.html(headerHtml + countsHtml);
            this.reviewSummaryContainer.removeClass('hidden');
        },

        // UPDATED: Corrected to use 'this.elo' to match the updated analysis-core.js file.
        renderEstimatedElo: function() {
            this.whiteEloElement.text(this.elo.w);
            this.blackEloElement.text(this.elo.b);
            this.estimatedEloPanel.removeClass('hidden');
        },

        renderPhaseAnalysis: function() {
            const createPhaseRow = (phaseName) => {
                const lowerPhase = phaseName.toLowerCase();
                const whiteRating = AnalysisHelpers.cplToPhaseRating(this.phaseAnalysis.w[lowerPhase]);
                const blackRating = AnalysisHelpers.cplToPhaseRating(this.phaseAnalysis.b[lowerPhase]);
                return `<div class="phase-row"><div class="phase-rating white-phase rating-${whiteRating.toLowerCase()}">${whiteRating}</div><div class="phase-label">${phaseName}</div><div class="phase-rating black-phase rating-${blackRating.toLowerCase()}">${blackRating}</div></div>`;
            };
            const html = createPhaseRow('Opening') + createPhaseRow('Middlegame') + createPhaseRow('Endgame');
            this.phaseDisplayElement.html(html);
            this.gamePhasePanel.removeClass('hidden');
        },
        
        renderGameSummaryAccuracies: function() {
            if (summaryAccuracy) {
                summaryAccuracy.find('div:first-child .font-bold').text(this.accuracy.w + '%');
                summaryAccuracy.find('div:last-child .font-bold').text(this.accuracy.b + '%');
            }
        },

        renderFinalReview: function() {
            this.renderReviewSummary();
            this.renderEstimatedElo();
            this.renderPhaseAnalysis();
            this.renderReviewedMoveList();
            this.drawEvalChart();
            this.renderGameSummaryAccuracies();
            if (this.keyMoments && this.keyMoments.length > 0) {
                this.keyMomentsToggleContainer.removeClass('hidden');
            }
            this.navigateToMove(-1);
        },
        
        navigateToMove: function(moveIndex) {
            if (moveIndex < -1 || moveIndex >= this.gameHistory.length) return;
            this.currentMoveIndex = moveIndex;
            
            const fen = (moveIndex === -1) 
                ? (this.analysisGame.header().FEN || 'start') 
                : this.gameHistory[moveIndex].after;
            
            this.analysisBoard.position(fen);
            this.showMoveAssessmentDetails(moveIndex);
            
            this.moveListElement.find('.current-move').removeClass('current-move');
            const targetRow = this.moveListElement.find(`[data-move-index="${moveIndex}"]`).first().closest('.analysis-move-row');
            targetRow.addClass('current-move');
            
            this.highlightChartPoint(moveIndex);
            this.redrawUserShapes();
        },

        showMoveAssessmentDetails: function(moveIndex) {
            if (moveIndex < 0) {
                this.assessmentDetailsElement.addClass('hidden');
                return;
            }
            const data = this.reviewData[moveIndex];
            if (!data || !data.classification) return;
            const info = this.CLASSIFICATION_DATA[data.classification];
            if (info) {
                this.assessmentTitleElement.html(`<img src="${info.icon}" class="inline-block w-6 h-6 mr-2 -mt-1"/> ${info.title}`).attr('class', `text-lg font-bold ${info.color}`);
                this.assessmentCommentElement.text(info.comment);
                this.assessmentDetailsElement.removeClass('hidden');
                const isBadMove = data.classification === 'Mistake' || data.classification === 'Blunder';
                this.retryMistakeBtn.toggleClass('hidden', !isBadMove);
                if (data.bestLineUci && ['Mistake', 'Blunder', 'Inaccuracy', 'Miss'].includes(data.classification)) {
                    const tempGame = new Chess(this.gameHistory[moveIndex].before);
                    const sanLine = this.uciToSanLine(tempGame.fen(), data.bestLineUci);
                    this.bestLineMoves.text(sanLine);
                    this.bestLineDisplay.removeClass('hidden');
                } else {
                    this.bestLineDisplay.addClass('hidden');
                }
            }
        },
        
        drawEvalChart: function() {
            if (!this.evalChartCanvas || !this.evalChartCanvas.length) return;
            try {
                if (this.evalChart) this.evalChart.destroy();
                const labels = ['Start'];
                const data = [20];
                const blunderPoints = [], brilliantPoints = [];

                this.reviewData.forEach((item, index) => {
                    labels.push(`${Math.floor(index / 2) + 1}${index % 2 === 0 ? '.' : '...'} ${item.move}`);
                    data.push(item.score);
                    if (item.classification === 'Blunder') blunderPoints.push({ x: index + 1, y: item.score });
                    else if (item.classification === 'Brilliant') brilliantPoints.push({ x: index + 1, y: item.score });
                });
                const ctx = this.evalChartCanvas[0].getContext('2d');
                this.evalChart = new Chart(ctx, {
                    type: 'line', data: { labels, datasets: [
                        { label: 'Evaluation', data, borderColor: 'rgba(230, 230, 230, 0.9)', fill: 'origin', borderWidth: 2, pointRadius: 1, pointHoverRadius: 5, tension: 0.1 },
                        { type: 'scatter', label: 'Blunders', data: blunderPoints, backgroundColor: 'rgba(248, 113, 113, 1)', radius: 5, hoverRadius: 7 },
                        { type: 'scatter', label: 'Brilliant Moves', data: brilliantPoints, backgroundColor: 'rgba(45, 212, 191, 1)', radius: 5, hoverRadius: 7 }
                    ]},
                    options: { responsive: true, maintainAspectRatio: false, onClick: (e) => { const activePoints = this.evalChart.getElementsAtEventForMode( e, 'index', { intersect: false }, true ); if (activePoints.length > 0) { const moveIndex = activePoints[0].index - 1; this.navigateToMove(moveIndex); window.playSound('moveSelf'); } }, scales: { y: { suggestedMin: -600, suggestedMax: 600, grid: { color: 'rgba(255,255,255,0.05)', zeroLineColor: 'rgba(255,255,255,0.4)', zeroLineWidth: 2 }, ticks: { color: 'var(--text-dark)', callback: (v) => (v / 100).toFixed(1) } }, x: { display: false } }, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, backgroundColor: 'rgba(0,0,0,0.8)', titleFont: { weight: 'bold'}, callbacks: { label: function(context) { let label = ' Eval: '; let score = context.parsed.y / 100; if (Math.abs(score) > 95) label += (score > 0 ? 'M' : '-M') + Math.abs(100 - Math.abs(score)).toFixed(0); else label += score.toFixed(2); return label; } }}}, interaction: { mode: 'index', intersect: false } }
                });
            } catch (error) { Logger.error('Error creating evaluation chart', error); }
        },
        
        highlightChartPoint: function(moveIndex) {
            if (!this.evalChart) return;
            const chart = this.evalChart;
            const pointCount = chart.data.datasets[0].data.length;
            const radii = new Array(pointCount).fill(1);
            const colors = new Array(pointCount).fill('rgba(230, 230, 230, 0.9)');
            const chartIndex = moveIndex + 1;
            if (chartIndex >= 0 && chartIndex < pointCount) {
                radii[chartIndex] = 6;
                colors[chartIndex] = '#ffca28';
            }
            chart.data.datasets[0].pointRadius = radii;
            chart.data.datasets[0].pointBackgroundColor = colors;
            chart.update('none');
        },

        applyTheme: function() {
            try {
                const themeName = localStorage.getItem('chessBoardTheme') || 'green';
                const selectedTheme = THEMES.find(t => t.name === themeName);
                if (selectedTheme) {
                    document.documentElement.style.setProperty('--light-square-color', selectedTheme.colors.light);
                    document.documentElement.style.setProperty('--dark-square-color', selectedTheme.colors.dark);
                }
            } catch (error) { Logger.warn('Error applying theme', error); }
        },

        renderCoordinates: function() {
            if (!this.boardWrapper || !this.boardWrapper.length || !this.analysisBoard) return;
            try {
                const isFlipped = this.analysisBoard.orientation() === 'black';
                const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
                let ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
                if (isFlipped) { files.reverse(); } else { ranks.reverse(); }
                const filesHtml = files.map(f => `<span>${f}</span>`).join('');
                const ranksHtml = ranks.map(r => `<span>${r}</span>`).join('');
                this.boardWrapper.find('#analysis-top-files').html(filesHtml);
                this.boardWrapper.find('#analysis-bottom-files').html(filesHtml);
                this.boardWrapper.find('#analysis-left-ranks').html(ranksHtml);
                this.boardWrapper.find('#analysis-right-ranks').html(ranksHtml);
            } catch (error) { Logger.warn('Error rendering coordinates', error); }
        },

        clearUserShapes: function() {
            this.userShapes = [];
            this.redrawUserShapes();
        },

        redrawUserShapes: function() {
            if (!this.analysisBoardSvgOverlay) return;
            this.analysisBoardSvgOverlay.empty();
            if (this.analysisBoardElement) {
                this.analysisBoardElement.find('.square-55d63').removeClass('highlight-user-green highlight-user-red highlight-user-yellow highlight-user-blue');
            }
            
            this.userShapes.forEach(shape => {
                if (shape.type === 'highlight') {
                    this.analysisBoardElement.find(`.square-${shape.square}`).addClass(`highlight-user-${shape.color}`);
                } else if (shape.type === 'arrow') {
                    this.drawArrow(shape.from, shape.to, shape.color);
                }
            });

            if (!this.analysisBoard || this.currentMoveIndex < 0) return;
            
            const data = this.reviewData[this.currentMoveIndex];
            const move = this.gameHistory[this.currentMoveIndex];
            if (data && move) {
                this.drawArrow(move.from, move.to, 'rgba(59, 130, 246, 0.7)');
                const isBadMove = ['Mistake', 'Blunder', 'Inaccuracy', 'Miss'].includes(data.classification);
                if (isBadMove && data.bestLineUci) {
                    const bestMoveUci = data.bestLineUci.split(' ')[0];
                    if(bestMoveUci.length >= 4) {
                        const from = bestMoveUci.substring(0, 2);
                        const to = bestMoveUci.substring(2, 4);
                        if (from !== move.from || to !== move.to) {
                            this.drawArrow(from, to, 'rgba(34, 197, 94, 0.7)');
                        }
                    }
                }
            }
        },

        drawArrow: function(from, to, color = 'rgba(42, 122, 42, 0.7)') {
            if (!this.analysisBoardSvgOverlay || !this.analysisBoard || !from || !to) return;
            
            const boardWidth = this.analysisBoardElement.width();
            if (!boardWidth || boardWidth === 0) return;
            const squareSize = boardWidth / 8;
            const isFlipped = this.analysisBoard.orientation() === 'black';

            const getCoords = (square) => {
                let col = square.charCodeAt(0) - 'a'.charCodeAt(0);
                let row = parseInt(square.charAt(1)) - 1;
                if (isFlipped) { col = 7 - col; row = 7 - row; }
                return { x: col * squareSize + squareSize / 2, y: (7 - row) * squareSize + squareSize / 2 };
            };

            const fromCoords = getCoords(from);
            const toCoords = getCoords(to);
            const markerId = `arrowhead-analysis-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

            if (this.analysisBoardSvgOverlay.find(`#${markerId}`).length === 0) {
                const defs = this.analysisBoardSvgOverlay.find('defs').length > 0 ? this.analysisBoardSvgOverlay.find('defs') : $('<defs></defs>').appendTo(this.analysisBoardSvgOverlay);
                const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                marker.setAttribute('id', markerId);
                marker.setAttribute('viewBox', '0 0 10 10');
                marker.setAttribute('refX', '5'); marker.setAttribute('refY', '5');
                marker.setAttribute('markerWidth', '3.5'); marker.setAttribute('markerHeight', '3.5');
                marker.setAttribute('orient', 'auto-start-reverse');
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
                path.style.fill = color;
                marker.appendChild(path);
                $(marker).appendTo(defs);
            }

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', fromCoords.x); line.setAttribute('y1', fromCoords.y);
            line.setAttribute('x2', toCoords.x); line.setAttribute('y2', toCoords.y);
            line.style.stroke = color;
            line.style.strokeWidth = '14px';
            line.setAttribute('marker-end', `url(#${markerId})`);
            this.analysisBoardSvgOverlay.append(line);
        },
        
        setupBoardDrawingHandlers: function() {
            this.analysisBoardElement.off('mousedown contextmenu').on('mousedown contextmenu', (e) => {
                if (e.which !== 3) return;
                e.preventDefault();
                this.isDrawing = true;
                this.drawStartSquare = $(e.target).closest('[data-square]').data('square');
            });
        
            $(document).off('mouseup.analysis_draw').on('mouseup.analysis_draw', (e) => {
                if (!this.isDrawing || e.which !== 3) return;
                e.preventDefault();
                const endSquare = $(e.target).closest('[data-square]').data('square');
                if (this.drawStartSquare && endSquare) {
                    if (this.drawStartSquare === endSquare) {
                        const existingIndex = this.userShapes.findIndex(s => s.type === 'highlight' && s.square === this.drawStartSquare);
                        if (existingIndex > -1) this.userShapes.splice(existingIndex, 1);
                        else this.userShapes.push({ type: 'highlight', square: this.drawStartSquare, color: 'green' });
                    } else {
                        const existingIndex = this.userShapes.findIndex(s => s.type === 'arrow' && s.from === this.drawStartSquare && s.to === endSquare);
                        if (existingIndex > -1) this.userShapes.splice(existingIndex, 1);
                        else this.userShapes.push({ type: 'arrow', from: this.drawStartSquare, to: endSquare, color: 'rgba(21, 128, 61, 0.7)' });
                    }
                } else { 
                    this.clearUserShapes(); 
                }
                this.redrawUserShapes();
                this.isDrawing = false;
                this.drawStartSquare = null;
            });
        },
    };

    Object.assign(controller, uiMethods);
})(window.AnalysisController);