// src/js/game-review.js

// ===================================================================================
//  GAME-REVIEW.JS
//  A dedicated, sandboxed engine for performing deep, post-game analysis.
// ===================================================================================

(function(window) {
    'use strict';

    // --- Configuration Constants ---
    const REVIEW_ENGINE_OPTIONS = {
        movetime: 1500,
        multiPV: 3,
    };
    const RETRY_MOVETIME = 3000;
    const EVALUATION_TIMEOUT_MS = 8000; 
    const RESET_TIMEOUT_MS = 3000;
    const KEY_MOMENT_THRESHOLD = 150; 
    const CPL_CAP = 1500;
    
    // --- Private Helper Functions (Sandboxed for Independence) ---

    function _normalizeEvalForCpl(score) {
        return Math.max(-CPL_CAP, Math.min(CPL_CAP, score));
    }

    function _classifyMove(params) {
        const { cpl, opponentCpl, evalBefore, pgn, moveNumber, isCheckmate } = params;
        
        // UPDATED: A checkmating move is always the best possible move.
        if (isCheckmate) {
            return 'Best';
        }
        if (moveNumber <= 10 && OPENINGS.some(o => pgn.trim().startsWith(o.pgn))) {
            return 'Book';
        }
        if (opponentCpl >= 300 && cpl >= 120 && Math.abs(evalBefore) < 800) {
            return 'Miss';
        }
        if (cpl >= 300) return 'Blunder';
        if (cpl >= 120) return 'Mistake';
        if (cpl >= 50) return 'Inaccuracy';
        if (cpl < 10) return 'Best';
        if (cpl < 25) return 'Excellent';
        return 'Good';
    }
    
    function _calculateAccuracy(cplArray) {
        if (cplArray.length === 0) return 100;
        const avgCpl = cplArray.reduce((a, b) => a + b, 0) / cplArray.length;
        return Math.max(0, Math.min(100, Math.round(103.16 * Math.exp(-0.04354 * avgCpl))));
    }

    function _cplToElo(averageCpl) {
        if (averageCpl < 15) return 2600;
        if (averageCpl < 20) return 2400;
        if (averageCpl < 25) return 2200;
        if (averageCpl < 35) return 2000;
        if (averageCpl < 50) return 1800;
        if (averageCpl < 70) return 1600;
        if (averageCpl < 90) return 1400;
        if (averageCpl < 120) return 1200;
        if (averageCpl < 150) return 1000;
        return 800;
    }
    
    function _calculatePhaseCpl(allPlayerMoves, startMove, endMove) {
        const phaseMoves = allPlayerMoves.filter(move => move.moveNum >= startMove && move.moveNum <= endMove);
        if (phaseMoves.length === 0) {
            return -1;
        }
        const totalCpl = phaseMoves.reduce((sum, move) => sum + move.cpl, 0);
        return totalCpl / phaseMoves.length;
    }

    function _resetEngine(stockfish) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Engine did not become ready after 'stop' command."));
            }, RESET_TIMEOUT_MS);

            stockfish.onmessage = (event) => {
                if (event.data === 'readyok') {
                    clearTimeout(timeout);
                    stockfish.onmessage = null; 
                    resolve();
                }
            };
            stockfish.postMessage('stop');
            stockfish.postMessage('isready');
        });
    }

    // --- The Main GameReviewer Object ---
    const GameReviewer = {
        
        analyze: async function(pgn, stockfish, progressCallback) {
            const game = new Chess();
            if (!game.load_pgn(pgn)) {
                throw new Error("Invalid PGN provided to GameReviewer.");
            }
            const history = game.history({ verbose: true });
            
            let rawReviewData = [];
            let lastEval = 20;

            stockfish.postMessage(`setoption name MultiPV value ${REVIEW_ENGINE_OPTIONS.multiPV}`);

            const tempGame = new Chess();
            for (let i = 0; i < history.length; i++) {
                const move = history[i];
                tempGame.move(move);
                
                if (progressCallback) {
                    progressCallback({ moveNumber: i + 1, totalMoves: history.length, moveSan: move.san });
                }

                let positionEval;
                // UPDATED: Check for game-ending moves BEFORE calling the engine.
                if (tempGame.game_over()) {
                    Logger.info(`Game-ending move found: ${move.san}. Bypassing engine evaluation.`);
                    let finalScore = 0;
                    if (tempGame.in_checkmate()) {
                        finalScore = (move.color === 'w') ? APP_CONFIG.MATE_SCORE : -APP_CONFIG.MATE_SCORE;
                    }
                    positionEval = { best: finalScore, second: finalScore, best_pv: '' };
                } else {
                    // Only call the engine if the game is still ongoing.
                    positionEval = await this._getEvaluationWithRetry(stockfish, tempGame.fen(), lastEval);
                }
                
                rawReviewData.push({ move: move, score: positionEval.best, bestLineUci: positionEval.best_pv });
                
                lastEval = positionEval.best;
            }
            
            let finalReview = [];
            let cplByPlayerFull = { w: [], b: [] };
            let moveCounts = { w: {}, b: {} };
            let keyMoments = [];
            let opponentCpl = 0;

            for (let i = 0; i < rawReviewData.length; i++) {
                const currentMoveData = rawReviewData[i];
                const evalAfter = currentMoveData.score;
                const evalBefore = (i === 0) ? 20 : rawReviewData[i-1].score;
                
                const playerColor = currentMoveData.move.color;
                const evalBeforePlayer = (playerColor === 'w') ? evalBefore : -evalAfter;
                const evalAfterPlayer = (playerColor === 'w') ? evalAfter : -evalBefore;
                
                const cpl = Math.max(0, _normalizeEvalForCpl(evalBeforePlayer) - _normalizeEvalForCpl(evalAfterPlayer));
                const moveNum = Math.floor(i / 2) + 1;
                cplByPlayerFull[playerColor].push({cpl, moveNum});

                // Check if the current move was a checkmate to pass to the classifier
                const tempGameForCheck = new Chess();
                for(let j=0; j<=i; j++) tempGameForCheck.move(history[j].san);
                const isCheckmate = tempGameForCheck.in_checkmate();

                const classification = _classifyMove({ cpl, opponentCpl, evalBefore: evalBeforePlayer, pgn: tempGame.pgn().substring(0, tempGame.pgn().indexOf(currentMoveData.move.san)), moveNumber: moveNum, isCheckmate: isCheckmate });

                if (Math.abs(evalAfter - evalBefore) > KEY_MOMENT_THRESHOLD && classification !== 'Book') {
                    keyMoments.push(i);
                }

                // This could throw the error if classification is undefined for some reason, so we protect it.
                if (classification) {
                    moveCounts[playerColor][classification] = (moveCounts[playerColor][classification] || 0) + 1;
                }

                finalReview.push({ move: currentMoveData.move.san, score: evalAfter, classification: classification, bestLineUci: currentMoveData.bestLineUci, cpl: cpl });

                opponentCpl = cpl;
            }

            const whiteCplArray = cplByPlayerFull.w.map(m => m.cpl);
            const blackCplArray = cplByPlayerFull.b.map(m => m.cpl);
            const whiteAvgCpl = whiteCplArray.length > 0 ? whiteCplArray.reduce((a, b) => a + b, 0) / whiteCplArray.length : 0;
            const blackAvgCpl = blackCplArray.length > 0 ? blackCplArray.reduce((a, b) => a + b, 0) / blackCplArray.length : 0;
            const OPENING_END = 12, MIDGAME_END = 40;

            return {
                accuracy: { w: _calculateAccuracy(whiteCplArray), b: _calculateAccuracy(blackCplArray) },
                elo: { w: _cplToElo(whiteAvgCpl), b: _cplToElo(blackAvgCpl) },
                moveCounts: moveCounts,
                keyMoments: keyMoments,
                moves: finalReview,
                phaseAnalysis: {
                    w: { opening: _calculatePhaseCpl(cplByPlayerFull.w, 1, OPENING_END), middlegame: _calculatePhaseCpl(cplByPlayerFull.w, OPENING_END + 1, MIDGAME_END), endgame: _calculatePhaseCpl(cplByPlayerFull.w, MIDGAME_END + 1, 999) },
                    b: { opening: _calculatePhaseCpl(cplByPlayerFull.b, 1, OPENING_END), middlegame: _calculatePhaseCpl(cplByPlayerFull.b, OPENING_END + 1, MIDGAME_END), endgame: _calculatePhaseCpl(cplByPlayerFull.b, MIDGAME_END + 1, 999) }
                }
            };
        },

        _getEvaluationWithRetry: async function(stockfish, fen, lastEval) {
            try {
                return await this._singleEvaluationAttempt(stockfish, fen, REVIEW_ENGINE_OPTIONS.movetime);
            } catch (error) {
                Logger.warn(`Evaluation timed out. Resetting engine and retrying...`, { fen });
                await _resetEngine(stockfish);
                try {
                    return await this._singleEvaluationAttempt(stockfish, fen, RETRY_MOVETIME);
                } catch (retryError) {
                    Logger.error(`Evaluation failed on retry. Using fallback.`, { fen });
                    await _resetEngine(stockfish);
                    return { best: lastEval, second: lastEval, best_pv: '' };
                }
            }
        },

        _singleEvaluationAttempt: function(stockfish, fen, movetime) {
            const evaluationPromise = new Promise((resolve) => {
                let scores = {};
                let best_pv = '';

                const handler = (event) => {
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
                        stockfish.onmessage = null;
                        resolve({ best: scores[1] || 0, second: scores[2] || scores[1] || 0, best_pv: best_pv });
                    }
                };
                stockfish.onmessage = handler;
                stockfish.postMessage(`position fen ${fen}`);
                stockfish.postMessage(`go movetime ${movetime}`);
            });

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    stockfish.onmessage = null;
                    reject(new Error(`Evaluation timed out for FEN: ${fen}`));
                }, EVALUATION_TIMEOUT_MS);
            });

            return Promise.race([evaluationPromise, timeoutPromise]);
        }
    };
    
    window.GameReviewer = GameReviewer;

})(window);