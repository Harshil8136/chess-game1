// src/analysis/analysis-ui.js

// ===================================================================================
//  ANALYSIS-UI.JS
//  Manages the primary UI components and interactions for the Analysis Room.
// ===================================================================================

(function(controller) {
    'use strict';

    if (!controller) {
        if (window.Logger) {
            Logger.critical("Analysis Core module must be loaded before the UI module.", new Error("Module loading dependency failed"));
        }
        return;
    }

    const uiMethods = {

        /**
         * Caches jQuery references to all UI elements in the Analysis Room.
         */
        populateUIReferences: function() {
            this.moveListElement = $('#ar-analysis-move-list');
            this.evalChartCanvas = $('#ar-eval-chart');
            this.assessmentDetailsElement = $('#ar-move-assessment-details');
            this.assessmentTitleElement = $('#ar-assessment-title');
            this.assessmentCommentElement = $('#ar-assessment-comment');
            this.boardWrapper = $('#analysis-room .board-wrapper');
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
            this.keyMomentsToggleContainer = $('#key-moments-toggle-container');
            this.analysisDashboard = $('#analysis-dashboard');
            this.whiteAccuracyElement = $('#ar-white-accuracy');
            this.blackAccuracyElement = $('#ar-black-accuracy');
            this.whiteAccuracyBar = $('#ar-white-accuracy-bar');
            this.blackAccuracyBar = $('#ar-black-accuracy-bar');
            this.whiteEloElement = $('#ar-white-elo');
            this.blackEloElement = $('#ar-black-elo');
            this.moveCountsContainer = $('#ar-move-counts');
        },

        /**
         * Initializes the temporary board shown during the analysis progress display.
         */
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
        
        /**
         * Sets up all event handlers for the Analysis Room UI.
         */
        setupEventHandlers: function() {
            // Move list navigation
            this.moveListElement.off('click.navigate').on('click.navigate', '.analysis-move-row', (e) => {
                const moveIndex = parseInt($(e.currentTarget).data('move-index'));
                if (!isNaN(moveIndex) && moveIndex >= -1 && moveIndex < this.gameHistory.length) {
                    this.navigateToMove(moveIndex);
                    window.playSound('moveSelf');
                }
            });
            
            // "Retry Mistake" button
            this.retryMistakeBtn.off('click').on('click', () => {
                if (this.currentMoveIndex < 0) return;
                const tempGame = new Chess(this.analysisGame.header().FEN || undefined);
                for (let i = 0; i < this.currentMoveIndex; i++) {
                    tempGame.move(this.gameHistory[i]);
                }
                window.loadFenOnReturn = tempGame.fen();
                switchToMainGame();
            });

            // "Key Moments" filter
            this.keyMomentsToggleContainer.off('click').on('click', 'button', (e) => {
                const filter = $(e.currentTarget).data('filter');
                this.keyMomentsToggleContainer.find('button').removeClass('active');
                $(e.currentTarget).addClass('active');

                if (filter === 'all') {
                    this.moveListElement.find('.analysis-move-row').show();
                } else {
                    this.moveListElement.find('.analysis-move-row:first-child').show();
                    this.moveListElement.find('.analysis-move-row:not(:first-child)').each(function() {
                        if ($(this).hasClass('key-moment')) {
                            $(this).show();
                        } else {
                            $(this).hide();
                        }
                    });
                }
            });

            // Keyboard navigation and shortcuts
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

            // Set up board drawing handlers from the analysis-board.js module
            if (typeof this.setupBoardDrawingHandlers === 'function') {
                this.setupBoardDrawingHandlers();
            }
        },

        /**
         * Renders the complete, classified move list for the reviewed game.
         */
        renderReviewedMoveList: function() {
            if (!this.moveListElement) return;
            let html = '';
            html += `<div class="analysis-move-row" data-move-index="-1"><div class="move-number">--</div><div class="analysis-move-item text-dark font-bold col-span-2"><span>Starting Position</span></div></div>`;

            for (let i = 0; i < this.gameHistory.length; i += 2) {
                const moveNum = Math.floor(i / 2) + 1;
                const whiteMove = this.gameHistory[i];
                const whiteReview = this.reviewData[i];
                const whiteInfo = this.CLASSIFICATION_DATA[whiteReview.classification];
                const whiteMoveClass = `move-${whiteReview.classification.toLowerCase()}`;

                const blackMove = this.gameHistory[i + 1];
                const blackReview = this.reviewData[i + 1];

                const isKeyMoment = this.keyMoments.includes(i) || (blackMove && this.keyMoments.includes(i + 1));
                const keyMomentClass = isKeyMoment ? 'key-moment' : '';

                let whiteHtml = `<div class="analysis-move-item ${whiteMoveClass}" data-move-index="${i}" title="${whiteInfo.title}"><span class="font-mono">${whiteMove.san}</span><img class="classification-icon" src="${whiteInfo.icon}" alt="${whiteInfo.title}"/></div>`;
                
                let blackHtml = '<div></div>';
                if (blackMove) {
                    const blackInfo = this.CLASSIFICATION_DATA[blackReview.classification];
                    const blackMoveClass = `move-${blackReview.classification.toLowerCase()}`;
                    blackHtml = `<div class="analysis-move-item ${blackMoveClass}" data-move-index="${i+1}" title="${blackInfo.title}"><span class="font-mono">${blackMove.san}</span><img class="classification-icon" src="${blackInfo.icon}" alt="${blackInfo.title}"/></div>`;
                }
                
                html += `<div class="analysis-move-row ${keyMomentClass}" data-move-index="${i}" data-second-move-index="${i+1}"><div class="move-number">${moveNum}</div>${whiteHtml}${blackHtml}</div>`;
            }
            this.moveListElement.html(html);

            this.moveListElement.find('.analysis-move-item').on('click', (e) => {
                e.stopPropagation();
                const moveIndex = parseInt($(e.currentTarget).data('move-index'));
                if (!isNaN(moveIndex)) {
                     this.navigateToMove(moveIndex);
                     window.playSound('moveSelf');
                }
            });
        },
        
        /**
         * Renders the main dashboard with accuracy, ELO, and move counts.
         */
        renderDashboard: function() {
            this.whiteAccuracyElement.text(this.accuracy.w + '%');
            this.blackAccuracyElement.text(this.accuracy.b + '%');
            this.whiteAccuracyBar.css('width', this.accuracy.w + '%');
            this.blackAccuracyBar.css('width', this.accuracy.b + '%');

            this.whiteEloElement.text(this.elo.w);
            this.blackEloElement.text(this.elo.b);
            
            const displayOrder = ['Brilliant', 'Great', 'Best', 'Mistake', 'Blunder', 'Miss'];
            
            const whiteCountsHtml = displayOrder.map(key => {
                const count = (this.moveCounts.w && this.moveCounts.w[key]) || 0;
                if (count > 0) {
                    const info = this.CLASSIFICATION_DATA[key];
                    return `<div class="move-count-item" title="${count} ${info.title} moves by White"><img src="${info.icon}" alt="${info.title}" /><span class="count">${count}</span></div>`;
                }
                return '';
            }).join('');

            const blackCountsHtml = displayOrder.map(key => {
                const count = (this.moveCounts.b && this.moveCounts.b[key]) || 0;
                if (count > 0) {
                    const info = this.CLASSIFICATION_DATA[key];
                    return `<div class="move-count-item" title="${count} ${info.title} moves by Black"><img src="${info.icon}" alt="${info.title}" /><span class="count">${count}</span></div>`;
                }
                return '';
            }).join('');
            
            this.moveCountsContainer.html(whiteCountsHtml + '<div class="w-full border-t border-white/10 col-span-full my-2"></div>' + blackCountsHtml);
            this.analysisDashboard.removeClass('hidden');
        },
        
        /**
         * Updates the accuracy numbers on the post-game summary screen.
         */
        renderGameSummaryAccuracies: function() {
            if (window.summaryAccuracy) {
                summaryAccuracy.find('div:first-child .font-bold').text(this.accuracy.w + '%');
                summaryAccuracy.find('div:last-child .font-bold').text(this.accuracy.b + '%');
            }
        },

        /**
         * Orchestrates the rendering of all final analysis UI components.
         */
        renderFinalReview: function() {
            this.renderDashboard();
            this.renderReviewedMoveList();
            this.drawEvalChart();
            this.renderGameSummaryAccuracies();
            this.keyMomentsToggleContainer.removeClass('hidden');
            this.navigateToMove(-1);
        },
        
        /**
         * Navigates the analysis view to a specific move index.
         * @param {number} moveIndex - The index of the move to view (-1 for start).
         */
        navigateToMove: function(moveIndex) {
            if (moveIndex < -1 || moveIndex >= this.gameHistory.length) return;
            
            this.currentMoveIndex = moveIndex;
            
            if (moveIndex === -1) {
                const startFen = this.analysisGame.header().FEN || 'start';
                this.analysisBoard.position(startFen);
                this.assessmentDetailsElement.addClass('hidden');
            } else {
                const tempGame = new Chess(this.analysisGame.header().FEN || undefined);
                for (let i = 0; i <= moveIndex; i++) tempGame.move(this.gameHistory[i]);
                if (this.analysisBoard) this.analysisBoard.position(tempGame.fen());
                this.showMoveAssessmentDetails(moveIndex);
            }
            
            this.moveListElement.find('.current-move').removeClass('current-move');
            const targetRow = this.moveListElement.find(`[data-move-index="${moveIndex}"], [data-second-move-index="${moveIndex}"]`).first();
            if (targetRow.hasClass('analysis-move-item')) {
                 targetRow.closest('.analysis-move-row').addClass('current-move');
            } else {
                 targetRow.addClass('current-move');
            }
            
            // Call the dedicated function to update the chart highlight
            if (typeof this.highlightChartPoint === 'function') {
                this.highlightChartPoint(moveIndex);
            }

            this.redrawUserShapes();
        },

        /**
         * Shows the move assessment panel with details about the currently selected move.
         * @param {number} moveIndex - The index of the move to assess.
         */
        showMoveAssessmentDetails: function(moveIndex) {
            const data = this.reviewData[moveIndex];
            if (!data) return;
            const info = this.CLASSIFICATION_DATA[data.classification];
            if (info) {
                this.assessmentTitleElement.html(`<img src="${info.icon}" class="inline-block w-6 h-6 mr-2 -mt-1"/> ${info.title}`).attr('class', `text-lg font-bold ${info.color}`);
                this.assessmentCommentElement.text(info.comment);
                this.assessmentDetailsElement.removeClass('hidden');
                const isBadMove = data.classification === 'Mistake' || data.classification === 'Blunder';
                this.retryMistakeBtn.toggleClass('hidden', !isBadMove);
                if (data.bestLineUci && ['Mistake', 'Blunder', 'Inaccuracy', 'Miss'].includes(data.classification)) {
                    const tempGame = new Chess(this.analysisGame.header().FEN || undefined);
                    for(let i=0; i < moveIndex; i++) tempGame.move(this.gameHistory[i]);
                    const sanLine = this.uciToSanLine(tempGame.fen(), data.bestLineUci);
                    this.bestLineMoves.text(sanLine);
                    this.bestLineDisplay.removeClass('hidden');
                } else {
                    this.bestLineDisplay.addClass('hidden');
                }
            }
        }
    };

    // Attach all the UI-related methods to the main AnalysisController
    Object.assign(controller, uiMethods);

})(window.AnalysisController);