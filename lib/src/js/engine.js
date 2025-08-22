// src/js/engine.js

// ===================================================================================
//  ENGINE.JS
//  Manages the creation and configuration of Stockfish Web Worker instances.
// ===================================================================================

/**
 * Applies a set of UCI options to a Stockfish worker instance.
 * @param {object} workerWrapper - The wrapped Stockfish worker object.
 * @param {object} options - An object containing UCI options, e.g., { Threads: 4, Hash: 512 }.
 */
function configureEngine(workerWrapper, options = {}) {
    if (!workerWrapper) return;

    Logger.info(`Configuring engine with options:`, options);

    for (const name in options) {
        if (Object.prototype.hasOwnProperty.call(options, name)) {
            const value = options[name];
            workerWrapper.postMessage(`setoption name ${name} value ${value}`);
        }
    }
}

/**
 * Creates a new Stockfish worker instance from the configured URL.
 * This now returns an object with a wrapped postMessage for logging.
 * @returns {Promise<object>} A promise that resolves with the initialized Stockfish worker object.
 */
function createStockfishWorker() {
    return new Promise((resolve, reject) => {
        fetch(APP_CONFIG.STOCKFISH_URL)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch Stockfish: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(text => {
                try {
                    const worker = new Worker(URL.createObjectURL(new Blob([text], { type: 'application/javascript' })));
                    
                    const workerWrapper = {
                        _worker: worker,
                        onmessage: null,
                        postMessage: function(command) {
                            Logger.debug(`Engine command sent: ${command}`);
                            this._worker.postMessage(command);
                        },
                        terminate: function() {
                            this._worker.terminate();
                        }
                    };

                    // --- UPDATED: This handler now conditionally logs high-frequency messages ---
                    worker.onmessage = (event) => {
                        const message = event.data;
                        
                        // Check if the message is a high-frequency analysis string
                        if (message.startsWith('info')) {
                            // Only log it if the performance toggle is enabled
                            if (window.enableLiveEngineLogging) {
                                Logger.analysis(message);
                            }
                        } else {
                            // Log all other important, low-frequency messages as debug
                            // so they are still captured without causing lag.
                            Logger.debug(`Engine response received: ${message}`);
                        }
                        
                        // After logging (or not logging), pass the event to the specific handler
                        if (workerWrapper.onmessage) {
                            workerWrapper.onmessage(event);
                        }
                    };
                    
                    worker.onerror = (error) => {
                        Logger.critical('Stockfish Worker Error', error);
                        reject(new Error('Stockfish worker encountered an error.'));
                    };

                    let isReady = false;
                    const readyTimeout = setTimeout(() => {
                        if (!isReady) {
                            worker.terminate();
                            reject(new Error('Stockfish worker timed out during initialization.'));
                        }
                    }, 10000);

                    // Use a temporary handler on the wrapper for setup
                    workerWrapper.onmessage = (event) => {
                        const msg = event.data;
                        
                        // The raw message is already logged by the main onmessage handler above.
                        
                        if (msg === 'uciok') {
                            workerWrapper.postMessage('setoption name UCI_Variant value chess');
                        } else if (msg === 'readyok') {
                            isReady = true;
                            clearTimeout(readyTimeout);
                            workerWrapper.onmessage = null; // Clear this temporary handler
                            Logger.info('Stockfish worker is ready.');
                            resolve(workerWrapper);
                        }
                    };

                    workerWrapper.postMessage('uci');
                    workerWrapper.postMessage('isready');

                } catch (workerError) {
                    Logger.critical('Failed to create Stockfish worker', workerError);
                    reject(workerError);
                }
            })
            .catch(error => {
                Logger.critical('Failed to load Stockfish script', error);
                reject(error);
            });
    });
}