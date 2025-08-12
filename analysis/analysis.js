// ===================================================================================
//  ANALYSIS.JS
//  Main controller for the analysis feature. Orchestrates all analysis modules.
// ===================================================================================

const AnalysisController = {
    // --- State Variables ---
    stockfish: null,
    analysisGame: new Chess(),
    gameHistory: [],
    reviewData: [],
    currentMoveIndex: -1,
    isAnalyzing: false,
    isDeepAnalyzing: false,
    startingFen: 'start',

    // --- Core Methods ---
    init: async function() {
        const gameData = window.gameDataToAnalyze;
        if (!gameData || !gameData.pgn) {
            Swal.fire('Error', 'Game data is missing for analysis.', 'error');
            return;
        }

        this.isAnalyzing = true;
        this.resetState();
        this.analysisGame.load_pgn(gameData.pgn);
        this.gameHistory = this.analysisGame.history({ verbose: true });
        this.startingFen = gameData.fen || 'start';

        initVisualizerBoard();

        try {
            // UPDATED: Asynchronously wait for the engine to be fully ready.
            console.log({logType: 'info', text: 'Loading analysis engine...'});
            this.stockfish = await initAnalysisEngine(gameData.stockfishPath);
            console.log({logType: 'info', text: 'Analysis engine loaded successfully.'});
            await this.runGameReview();

        } catch (error) {
            Swal.fire('Analysis Engine Error', error.message, 'error').then(switchToMainGame);
            this.stop();
        }
    },

    stop: function() {
        this.isAnalyzing = false;
        this.isDeepAnalyzing = false;
        if (this.stockfish) {
            try { this.stockfish.terminate(); } catch (e) {}
            this.stockfish = null;
        }
        if (evalChart) {
            try { evalChart.destroy(); } catch(e) {}
            evalChart = null;
        }
        $(document).off('keydown.analysis');
    },

    resetState: function() {
        if (this.isAnalyzing) this.stop();
        this.reviewData = [];
        this.currentMoveIndex = -1;
        analysisUserShapes = [];
        $('#review-summary-container').addClass('hidden');
        $('#ar-move-assessment-details').addClass('hidden');
        $('#ar-analysis-move-list').empty();
    },

    runGameReview: async function() {
        let tempGame = new Chess(this.startingFen);
        let opponentCpl = 0;

        for (let i = 0; i < this.gameHistory.length; i++) {
            if (!this.isAnalyzing) break;
            
            const fenBefore = tempGame.fen();
            const move = this.gameHistory[i];
            
            const positionEval = await getStaticEvaluation(this.stockfish, fenBefore, { movetime: 500 });
            tempGame.move(move);
            const evalAfterMove = await getStaticEvaluation(this.stockfish, tempGame.fen(), { movetime: 500 });

            const evalBeforePlayer = (move.color === 'w') ? positionEval.best : -evalAfterMove.best;
            const evalAfterPlayer = (move.color === 'w') ? evalAfterMove.best : -evalAfterMove.best;
            const cpl = Math.max(0, evalBeforePlayer - evalAfterPlayer);
            const advantage = Math.abs(positionEval.best - positionEval.second);
            const classification = classifyMove(cpl, opponentCpl, advantage, tempGame.pgn());

            this.reviewData.push({
                move: move.san,
                score: evalAfterMove.best,
                classification: classification,
                bestLineUci: positionEval.best_pv,
                cpl: cpl
            });

            updateVisualizerProgress({
                currentMove: i + 1,
                totalMoves: this.gameHistory.length,
                fen: fenBefore,
                san: move.san,
                classification: classification,
                moveColor: move.color
            });

            opponentCpl = cpl;
        }

        if (this.isAnalyzing) {
            this.finalizeReview();
        }
    },

    finalizeReview: function() {
        const stats = recalculateStats(this.reviewData, this.gameHistory);
        renderReviewSummary(stats.accuracy, stats.moveCounts);
        renderReviewedMoveList(this.reviewData, this.gameHistory);
        drawEvalChart(this.reviewData);
        
        $('#summary-accuracy').find('div:first-child .font-bold').text(stats.accuracy.w + '%');
        $('#summary-accuracy').find('div:last-child .font-bold').text(stats.accuracy.b + '%');

        analysisBoard = initAnalysisBoard();
        this.setupEventHandlers();
        
        switchToAnalysisRoom();
        this.navigateToMove(0);
    },

    runDeepAnalysis: async function(moveIndex) {
        if (this.isDeepAnalyzing) return;
        this.isDeepAnalyzing = true;
        updateMoveInUI(moveIndex, { isAnalyzing: true });

        let tempGame = new Chess(this.startingFen);
        for (let i = 0; i < moveIndex; i++) tempGame.move(this.gameHistory[i]);
        
        const fenBefore = tempGame.fen();
        const move = this.gameHistory[moveIndex];
        const opponentCpl = (moveIndex > 0) ? this.reviewData[moveIndex - 1].cpl : 0;
        
        const positionEval = await getStaticEvaluation(this.stockfish, fenBefore, { movetime: 5000 });
        tempGame.move(move);
        const evalAfterMove = await getStaticEvaluation(this.stockfish, tempGame.fen(), { movetime: 5000 });

        const evalBeforePlayer = (move.color === 'w') ? positionEval.best : -positionEval.best;
        const evalAfterPlayer = (move.color === 'w') ? evalAfterMove.best : -evalAfterMove.best;
        const cpl = Math.max(0, evalBeforePlayer - evalAfterPlayer);
        const advantage = Math.abs(positionEval.best - positionEval.second);
        const classification = classifyMove(cpl, opponentCpl, advantage, tempGame.pgn());

        this.reviewData[moveIndex] = { ...this.reviewData[moveIndex], classification, cpl, bestLineUci: positionEval.best_pv, score: evalAfterMove.best };
        
        const stats = recalculateStats(this.reviewData, this.gameHistory);
        renderReviewSummary(stats.accuracy, stats.moveCounts);
        drawEvalChart(this.reviewData);
        updateMoveInUI(moveIndex, { classification: classification });
        this.navigateToMove(moveIndex); // Refresh details panel

        this.isDeepAnalyzing = false;
    },

    navigateToMove: function(moveIndex) {
        this.currentMoveIndex = moveIndex;
        let tempGame = new Chess(this.startingFen);
        for (let i = 0; i <= moveIndex; i++) tempGame.move(this.gameHistory[i]);
        
        if (analysisBoard) analysisBoard.position(tempGame.fen());
        
        $('.analysis-move-item').removeClass('current-move-analysis');
        $(`.analysis-move-item[data-move-index="${moveIndex}"]`).addClass('current-move-analysis');
        
        let tempGameForLine = new Chess(this.startingFen);
        for (let i = 0; i < moveIndex; i++) tempGameForLine.move(this.gameHistory[i]);
        const bestLineSan = uciToSanLine(tempGameForLine.fen(), this.reviewData[moveIndex].bestLineUci);

        showMoveAssessmentDetails(this.reviewData[moveIndex], bestLineSan);
        
        const drawingOptions = { svgOverlay: $('#analysis-board-svg-overlay'), boardElement: $('#analysis-board'), boardObject: analysisBoard };
        redrawUserShapes(analysisUserShapes, drawingOptions);
        renderCoordinates(analysisBoard, $('#analysis-room .board-wrapper'));
    },

    setupEventHandlers: function() {
        $('#ar-analysis-move-list').off('click').on('click', '.analysis-move-item', (e) => {
            this.navigateToMove(parseInt($(e.currentTarget).data('move-index')));
        }).on('click', '.deep-analysis-btn', (e) => {
            e.stopPropagation();
            this.runDeepAnalysis(parseInt($(e.currentTarget).data('move-index')));
        });

        $('#ar-retry-mistake-btn').off('click').on('click', () => {
            let tempGame = new Chess(this.startingFen);
            for (let i = 0; i < this.currentMoveIndex; i++) tempGame.move(this.gameHistory[i]);
            window.loadFenOnReturn = tempGame.fen();
            switchToMainGame();
        });

        $(document).off('keydown.analysis').on('keydown.analysis', (e) => {
            if (!isAnalysisMode) return;
            let newIndex = this.currentMoveIndex;
            let handled = true;
            switch(e.key.toLowerCase()) {
                case 'arrowleft': if (newIndex > 0) newIndex--; break;
                case 'arrowright': if (newIndex < this.gameHistory.length - 1) newIndex++; break;
                case 'arrowup': newIndex = 0; break;
                case 'arrowdown': newIndex = this.gameHistory.length - 1; break;
                case 'f': analysisBoard.flip(); this.navigateToMove(this.currentMoveIndex); break;
                default: handled = false;
            }
            if (handled) {
                e.preventDefault();
                this.navigateToMove(newIndex);
            }
        });
    }
};