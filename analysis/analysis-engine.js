// ===================================================================================
//  ANALYSIS-ENGINE.JS
//  Handles creating and communicating with the Stockfish worker for analysis.
// ===================================================================================

/**
 * Creates a new Stockfish worker for analysis and returns a promise that
 * resolves only when the engine is fully initialized and ready.
 * @param {string} stockfishPath - The URL/path to the stockfish.js file.
 * @returns {Promise<Worker>} A promise that resolves with the ready worker instance.
 */
function initAnalysisEngine(stockfishPath) {
    return new Promise((resolve, reject) => {
        try {
            const loaderScript = `self.onmessage = (e) => { importScripts(e.data); };`;
            const workerBlob = new Blob([loaderScript], { type: "application/javascript" });
            const workerUrl = URL.createObjectURL(workerBlob);

            const worker = new Worker(workerUrl);
            
            const timeout = setTimeout(() => {
                worker.terminate();
                reject(new Error('Analysis engine took too long to load.'));
            }, 30000); // UPDATED: Increased timeout to 30 seconds

            worker.onerror = (error) => {
                clearTimeout(timeout);
                reject(new Error('An error occurred in the analysis engine worker.'));
            };

            worker.onmessage = (event) => {
                if (event.data === 'uciok') {
                    worker.postMessage('isready');
                }
                if (event.data === 'readyok') {
                    clearTimeout(timeout);
                    worker.onmessage = null; 
                    resolve(worker);
                }
            };

            worker.postMessage(stockfishPath);

        } catch (error) {
            console.error('Failed to create analysis worker:', error);
            reject(new Error('Could not create the analysis engine worker.'));
        }
    });
}

/**
 * Gets a static evaluation for a given FEN from the analysis engine.
 * @param {Worker} stockfish - The Stockfish worker instance.
 * @param {string} fen - The FEN string of the position to evaluate.
 * @param {object} options - Evaluation options, e.g., { movetime: 1000 }.
 * @returns {Promise<object>} A promise that resolves with an object containing the best score, second best, and best line.
 */
function getStaticEvaluation(stockfish, fen, options = {}) {
    return new Promise((resolve) => {
        if (!stockfish) {
            return resolve({ best: 0, second: 0, best_pv: '' });
        }

        const movetime = options.movetime || 3000;
        let scores = {};
        let best_pv = '';
        let bestMoveFound = false;

        const timeout = setTimeout(() => {
            if (!bestMoveFound) {
                stockfish.onmessage = null;
                console.warn(`Evaluation timed out for FEN: ${fen}`);
                resolve({ best: scores[1] || 0, second: scores[2] || 0, best_pv });
            }
        }, movetime + 5000);

        stockfish.onmessage = (event) => {
            const message = event.data;
            const pvMatch = message.match(/multipv (\d+) .* pv (.+)/);

            if (pvMatch) {
                const pvIndex = parseInt(pvMatch[1]);
                const scoreMatch = message.match(/score (cp|mate) (-?\d+)/);
                if (scoreMatch) {
                    let score = parseInt(scoreMatch[2]);
                    if (scoreMatch[1] === 'mate') {
                        score = (score > 0 ? 1 : -1) * APP_CONFIG.MATE_SCORE;
                    }
                    scores[pvIndex] = score;
                }
                if (pvIndex === 1) {
                    best_pv = pvMatch[2];
                }
            }

            if (message.startsWith('bestmove')) {
                bestMoveFound = true;
                clearTimeout(timeout);
                stockfish.onmessage = null; 
                resolve({
                    best: scores[1] || 0,
                    second: scores[2] || scores[1] || 0,
                    best_pv
                });
            }
        };

        try {
            stockfish.postMessage('stop');
            stockfish.postMessage('setoption name MultiPV value 2');
            stockfish.postMessage(`position fen ${fen}`);
            stockfish.postMessage(`go movetime ${movetime}`);
        } catch (error) {
            clearTimeout(timeout);
            resolve({ best: 0, second: 0, best_pv: '' });
        }
    });
}