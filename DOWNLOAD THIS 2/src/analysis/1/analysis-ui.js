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
            this.analysisDashboardContainer = $('#analysis-dashboard');
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
            this.visualizerMovePlayedElement = $('#visualizer-move-played');
            this.visualizerProgressBar = $('#visualizer-progress-bar');
            this.whiteEloElement = $('#ar-white-elo');
            this.blackEloElement = $('#ar-black-elo');
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
            this.moveListElement.off('click.navigate').on('click.navigate', '.analysis-move-row', (e) => {
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
                    const keyRows = this.keyMoments.map(idx => Math.floor(idx / 2));
                    this.moveListElement.find('.analysis-move-row').each(function(i) {
                        if (i === 0 || keyRows.includes(i - 1)) {
                            $(this).show();
                        } else {
                            $(this).hide();
                        }
                    });
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

                const blackMove = this.gameHistory[i + 1];
                const blackReview = this.reviewData[i + 1];

                let whiteHtml = `<div class="analysis-move-item" data-move-index="${i}" title="${whiteInfo.title}"><span class="font-mono">${whiteMove.san}</span><img class="classification-icon" src="${whiteInfo.icon}" alt="${whiteInfo.title}"/></div>`;
                
                let blackHtml = '<div></div>';
                if (blackMove) {
                    const blackInfo = this.CLASSIFICATION_DATA[blackReview.classification];
                    blackHtml = `<div class="analysis-move-item" data-move-index="${i+1}" title="${blackInfo.title}"><span class="font-mono">${blackMove.san}</span><img class="classification-icon" src="${blackInfo.icon}" alt="${blackInfo.title}"/></div>`;
                }
                
                html += `<div class="analysis-move-row" data-move-index="${i}"><div class="move-number">${moveNum}</div>${whiteHtml}${blackHtml}</div>`;
            }
            this.moveListElement.html(html);
        },
        
        // UPDATED: All summary rendering is now consolidated into this single, reliable function.
        renderDashboard: function() {
            // Populate Accuracy and ELO
            this.whiteAccuracyElement.text(this.accuracy.w + '%');
            this.blackAccuracyElement.text(this.accuracy.b + '%');
            this.whiteAccuracyBar.css('width', this.accuracy.w + '%');
            this.blackAccuracyBar.css('width', this.accuracy.b + '%');
            this.whiteEloElement.text(this.elo.w);
            this.blackEloElement.text(this.elo.b);

            // Populate Move Counts
            let countsHtml = '';
            const displayOrder = ['Brilliant', 'Great', 'Best', 'Excellent', 'Good', 'Inaccuracy', 'Mistake', 'Blunder', 'Miss'];
            
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

            // Show the container
            this.analysisDashboardContainer.removeClass('hidden');
        },

        renderGameSummaryAccuracies: function() {
            if (summaryAccuracy) {
                summaryAccuracy.find('div:first-child .font-bold').text(this.accuracy.w + '%');
                summaryAccuracy.find('div:last-child .font-bold').text(this.accuracy.b + '%');
            }
        },

        // UPDATED: This function is now streamlined to call the new consolidated dashboard function.
        renderFinalReview: function() {
            this.renderDashboard();
            this.renderReviewedMoveList();
            this.drawEvalChart();
            this.renderGameSummaryAccuracies();
            if (this.keyMoments.length > 0) {
                this.keyMomentsToggleContainer.removeClass('hidden');
            }
            this.navigateToMove(-1);
        },
        
        navigateToMove: function(moveIndex) {
            // ... (code unchanged)
        },

        showMoveAssessmentDetails: function(moveIndex) {
            // ... (code unchanged)
        },
        
        drawEvalChart: function() {
            // ... (code unchanged)
        },
        
        applyTheme: function() {
            // ... (code unchanged)
        },

        renderCoordinates: function() {
            // ... (code unchanged)
        },

        clearUserShapes: function() {
            // ... (code unchanged)
        },

        redrawUserShapes: function() {
            // ... (code unchanged)
        },

        drawArrow: function(from, to, color = 'rgba(42, 122, 42, 0.7)') {
            // ... (code unchanged)
        },

        setupBoardDrawingHandlers: function() {
            // ... (code unchanged)
        }
    };
    
    // UPDATED: The old, separate rendering functions are removed.
    Object.assign(controller, uiMethods);

})(window.AnalysisController);