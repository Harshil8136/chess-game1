// ===================================================================================
//  ANALYSIS-LOGIC.JS
//  Core data processing for game review and move classification.
// ===================================================================================

(function(controller) {
    if (!controller) {
        console.error("Analysis Controller must be initialized before loading logic.");
        return;
    }

    const logicMethods = {
        runGameReview: async function() {
            if (this.gameHistory.length === 0) {
                this.showError("No moves to analyze.");
                return;
            }
            
            try {
                let tempGame = new Chess();
                // Load starting FEN if it exists
                if (this.startingFen && this.startingFen !== 'start') {
                    tempGame.load(this.startingFen);
                }
                
                let opponentCpl = 0;

                for (let i = 0; i < this.gameHistory.length && this.isAnalyzing; i++) {
                    const move = this.gameHistory[i];
                    const progressPercent = ((i + 1) / this.gameHistory.length) * 100;

                    this.visualizerStatusElement.text(`Analyzing move ${i + 1} of ${this.gameHistory.length}...`);
                    this.visualizerProgressBar.css('width', `${progressPercent}%`);
                    this.visualizerBoard.position(tempGame.fen());
                    
                    const positionEval = await this.getStaticEvaluation(tempGame.fen(), { movetime: 500 });
                    const evalBeforeMove = (move.color === 'w') ? positionEval.best : -positionEval.best;
                    
                    tempGame.move(move);
                    
                    const evalAfterMove = await this.getStaticEvaluation(tempGame.fen(), { movetime: 500 });
                    const evalAfterFromPlayerPerspective = (move.color === 'w') ? evalAfterMove.best : -evalAfterMove.best;
                    const cpl = Math.max(0, evalBeforeMove - evalAfterFromPlayerPerspective);
                    const bestMoveAdvantage = Math.abs(positionEval.best - positionEval.second);
                    const classification = this.classifyMove(cpl, opponentCpl, bestMoveAdvantage, tempGame.pgn(), i);

                    this.visualizerMoveNumberElement.text(`${Math.floor(i / 2) + 1}${move.color === 'w' ? '.' : '...'}`);
                    this.visualizerMovePlayedElement.text(move.san);
                    const classificationInfo = CLASSIFICATION_DATA[classification];
                    this.visualizerMoveAssessmentElement.text(classificationInfo.title).attr('class', `font-bold ${classificationInfo.color}`);
                    
                    this.reviewData.push({
                        move: move.san,
                        score: evalAfterMove.best,
                        classification: classification,
                        bestLineUci: positionEval.best_pv,
                        cpl: cpl
                    });

                    opponentCpl = cpl;
                }

                if (this.isAnalyzing) {
                    this.recalculateStats();
                    
                    if (typeof switchToAnalysisRoom === 'function') {
                        switchToAnalysisRoom();
                    } else {
                        console.error('switchToAnalysisRoom function not found.');
                    }

                    this.initializeBoard();
                    this.setupEventHandlers();
                    this.renderFinalReview();
                }
            } catch (error) {
                this.showError(`Analysis failed during move review. Error: ${error.message}`);
            } finally {
                this.isAnalyzing = false;
            }
        },

        runDeepAnalysis: async function(moveIndex) {
            if (this.isDeepAnalyzing) return;
            this.isDeepAnalyzing = true;
            this.updateMoveInUI(moveIndex, { isAnalyzing: true });

            try {
                const move = this.gameHistory[moveIndex];
                const opponentCpl = (moveIndex > 0) ? this.reviewData[moveIndex - 1].cpl : 0;

                let tempGame = new Chess();
                 if (this.startingFen && this.startingFen !== 'start') {
                    tempGame.load(this.startingFen);
                }
                for (let i = 0; i < moveIndex; i++) {
                    tempGame.move(this.gameHistory[i]);
                }
                
                const positionEval = await this.getStaticEvaluation(tempGame.fen(), { movetime: 5000 });
                const evalBeforeMove = (move.color === 'w') ? positionEval.best : -positionEval.best;
                
                tempGame.move(move);
                
                const evalAfterMove = await this.getStaticEvaluation(tempGame.fen(), { movetime: 5000 });
                const evalAfterFromPlayerPerspective = (move.color === 'w') ? evalAfterMove.best : -evalAfterMove.best;

                const cpl = Math.max(0, evalBeforeMove - evalAfterFromPlayerPerspective);
                const bestMoveAdvantage = Math.abs(positionEval.best - positionEval.second);
                const classification = this.classifyMove(cpl, opponentCpl, bestMoveAdvantage, tempGame.pgn(), moveIndex);
                
                this.reviewData[moveIndex] = {
                    move: move.san,
                    score: evalAfterMove.best,
                    classification: classification,
                    bestLineUci: positionEval.best_pv,
                    cpl: cpl
                };
                
                this.recalculateStats();
                this.renderReviewSummary();
                this.drawEvalChart();
                this.updateMoveInUI(moveIndex, { isAnalyzing: false });
                this.showMoveAssessmentDetails(moveIndex);
            } catch (error) {
                console.error("Deep analysis failed:", error);
                this.updateMoveInUI(moveIndex, { isAnalyzing: false, hasError: true });
            } finally {
                this.isDeepAnalyzing = false;
            }
        },

        getStaticEvaluation: function(fen, options = {}) {
            return new Promise((resolve) => {
                const movetime = options.movetime || 3000;
                if (!this.stockfish) return resolve({ best: 0, second: 0, best_pv: '' });
                
                let scores = {}; let best_pv = ''; let bestMoveFound = false;

                const timeout = setTimeout(() => {
                    if (!bestMoveFound) {
                        this.stockfish.onmessage = null; 
                        resolve({ best: scores[1] || 0, second: scores[2] || 0, best_pv });
                    }
                }, movetime + 5000);

                const onMessage = (event) => {
                    // Stop listening if analysis was cancelled
                    if (!this.isAnalyzing && !this.isDeepAnalyzing) {
                        clearTimeout(timeout);
                        this.stockfish.onmessage = null;
                        return resolve({ best: 0, second: 0, best_pv: '' });
                    }
                    const message = event.data;
                    const pvMatch = message.match(/multipv (\d+) .* pv (.+)/);
                    if (pvMatch) {
                        const pvIndex = parseInt(pvMatch[1]);
                        const scoreMatch = message.match(/score (cp|mate) (-?\d+)/);
                        if (scoreMatch) {
                            let score = parseInt(scoreMatch[2]);
                            if (scoreMatch[1] === 'mate') score = (score > 0 ? 1 : -1) * APP_CONFIG.MATE_SCORE;
                            scores[pvIndex] = score;
                        }
                        if (pvIndex === 1) best_pv = pvMatch[2];
                    }
                    if (message.startsWith('bestmove')) {
                        bestMoveFound = true;
                        clearTimeout(timeout);
                        this.stockfish.onmessage = null; 
                        try { this.stockfish.postMessage('setoption name MultiPV value 1'); } catch(e) { console.warn(e); }
                        resolve({ best: scores[1] || 0, second: scores[2] || scores[1] || 0, best_pv });
                    }
                };
                
                try {
                    this.stockfish.onmessage = onMessage;
                    this.stockfish.postMessage('setoption name MultiPV value 2');
                    this.stockfish.postMessage(`position fen ${fen}`);
                    this.stockfish.postMessage(`go movetime ${movetime}`);
                } catch (error) {
                    clearTimeout(timeout);
                    resolve({ best: 0, second: 0, best_pv: '' });
                }
            });
        },
        
        recalculateStats: function() {
            this.cpl = { w: [], b: [] };
            this.moveCounts = { w: {}, b: {} };
            for (const key in CLASSIFICATION_DATA) {
                this.moveCounts.w[key] = 0;
                this.moveCounts.b[key] = 0;
            }

            this.reviewData.forEach((data, index) => {
                const player = this.gameHistory[index].color;
                if (data.cpl > 0) {
                    this.cpl[player].push(Math.min(data.cpl, 350));
                }
                if (this.moveCounts[player] && data.classification in this.moveCounts[player]) {
                    this.moveCounts[player][data.classification]++;
                }
            });

            this.calculateAccuracy();
        },
        
        classifyMove: function(cpl, opponentCpl, bestMoveAdvantage, pgn, moveIndex) {
            if (moveIndex < 20 && OPENINGS.some(o => pgn.trim().startsWith(o.pgn))) return 'Book';
            if (opponentCpl > 150 && cpl > 70) return 'Miss';
            if (cpl < 10 && bestMoveAdvantage > 250) return 'Brilliant';
            if (cpl < 10 && bestMoveAdvantage > 100) return 'Great';
            if (cpl >= 300) return 'Blunder';
            if (cpl >= 120) return 'Mistake';
            if (cpl >= 50) return 'Inaccuracy';
            if (cpl < 10) return 'Best';
            if (cpl < 30) return 'Excellent';
            return 'Good';
        },

        calculateAccuracy: function() {
            const calculate = (cpl_array) => {
                if (cpl_array.length === 0) return 100;
                const avg_cpl = cpl_array.reduce((a, b) => a + b, 0) / cpl_array.length;
                // Formula derived from chess.com's model approximation
                return Math.max(0, Math.min(100, Math.round(103.16 * Math.exp(-0.04354 * avg_cpl))));
            };
            this.accuracy.w = calculate(this.cpl.w);
            this.accuracy.b = calculate(this.cpl.b);
        },
        
        uciToSanLine: function(fen, uciLine) {
            try {
                const tempGame = new Chess(fen);
                const moves = uciLine.split(' ');
                let sanMoves = [];
                for (let i = 0; i < Math.min(moves.length, 5); i++) {
                    const move = tempGame.move(moves[i], { sloppy: true });
                    if (move) sanMoves.push(move.san); else break;
                }
                return sanMoves.join(' ');
            } catch(e) {
                return uciLine;
            }
        },
    };

    Object.assign(controller, logicMethods);

})(window.AnalysisController);