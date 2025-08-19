// src/js/debugger.js

// ===================================================================================
//  DEBUGGER.JS
//  A professional-grade, persistent logging system for the application.
// ===================================================================================

(function(window) {
    'use strict';

    // --- Configuration ---
    const STORAGE_KEY = 'chessGameLogHistory';
    const MAX_HISTORY_SESSIONS = 10;
    const SAVE_THROTTLE_MS = 2000;

    const LOG_LEVELS = {
        CRITICAL: 'CRITICAL',
        ERROR: 'ERROR',
        WARNING: 'WARNING',
        INFO: 'INFO',
        ANALYSIS: 'ANALYSIS',
        DEBUG: 'DEBUG'
    };

    const STYLES = {
        [LOG_LEVELS.CRITICAL]: 'color: #fff; background-color: #dc2626; font-weight: bold; padding: 2px 4px; border-radius: 2px;',
        [LOG_LEVELS.ERROR]: 'color: #ef4444; font-weight: bold;',
        [LOG_LEVELS.WARNING]: 'color: #f59e0b;',
        [LOG_LEVELS.INFO]: 'color: #3b82f6;',
        [LOG_LEVELS.ANALYSIS]: 'color: #14b8a6;',
        [LOG_LEVELS.DEBUG]: 'color: #a78bfa;',
        RESET: 'color: inherit; background-color: inherit; font-weight: normal;'
    };

    // --- Private State ---
    let currentSession = null;
    let logHistory = [];
    let saveTimeout = null;
    let isSavePending = false;

    // --- Private Helper Functions ---
    function _getTimestamp() {
        return new Date().toISOString();
    }
    
    function _getFormattedTime() {
        return new Date().toLocaleTimeString('en-US', { hour12: false });
    }

    function _saveState() {
        try {
            const allSessions = [...logHistory];
            if (currentSession && currentSession.logs.length > 0) {
                allSessions.push(currentSession);
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(allSessions));
            isSavePending = false;
        } catch (e) {
            console.log("%c[CRITICAL]%c Failed to save log history to localStorage. It may be full.", STYLES.CRITICAL, STYLES.RESET);
        }
    }

    function _throttleSave() {
        isSavePending = true;
        if (!saveTimeout) {
            saveTimeout = setTimeout(() => {
                _saveState();
                saveTimeout = null;
            }, SAVE_THROTTLE_MS);
        }
    }

    function _loadState() {
        try {
            const savedHistory = localStorage.getItem(STORAGE_KEY);
            logHistory = savedHistory ? JSON.parse(savedHistory) : [];
        } catch (e) {
            logHistory = [];
            console.log("%c[CRITICAL]%c Failed to parse log history from localStorage. It may be corrupt.", STYLES.CRITICAL, STYLES.RESET);
        }
    }
    
    function _pruneHistory() {
        if (logHistory.length > MAX_HISTORY_SESSIONS) {
            logHistory.splice(0, logHistory.length - MAX_HISTORY_SESSIONS);
        }
    }

    function _outputToConsole(logEntry) {
        const { time, level, message, data } = logEntry;
        const style = STYLES[level] || STYLES.RESET;
        
        console.log(`%c[${time}] [${level}]%c ${message}`, style, STYLES.RESET);
        
        if (data && Object.keys(data).length > 0) {
            console.log(data);
        }
    }
    
    // --- Public Logger Module ---
    const Logger = {
        init: function() {
            _loadState();
            this.startNewSession();
            
            window.onerror = (message, source, lineno, colno, error) => {
                this.critical('Uncaught Error', { 
                    message: error ? error.message : message, 
                    source: source.split('/').pop(), 
                    line: lineno, 
                    column: colno, 
                    stack: error ? error.stack : 'N/A' 
                });
            };
            window.onunhandledrejection = (event) => {
                this.critical('Unhandled Promise Rejection', { reason: event.reason });
            };

            window.addEventListener('beforeunload', () => {
                if (isSavePending) {
                    _saveState();
                }
            });

            this.info('Logger initialized.');
            this.systemInfo();
        },

        startNewSession: function() {
            if (currentSession && currentSession.logs.length > 0) {
                logHistory.push(currentSession);
                _pruneHistory();
            }
            
            // UPDATED: Added a logCounter for unique IDs within the session.
            currentSession = {
                id: `session-${_getTimestamp()}`,
                startTime: _getTimestamp(),
                logs: [],
                logCounter: 0 
            };
            
            _saveState();
            $(document).trigger('newGameStarted');
        },
        
        clearCurrentSession: function() {
            if (currentSession) {
                currentSession.logs = [];
                currentSession.logCounter = 0;
            }
            _saveState();
            this.info('Current session log cleared.');
        },

        log: function(level, message, data = {}) {
            if (!currentSession) return;
            
            // UPDATED: Added a unique ID for log virtualization.
            const logEntry = {
                id: currentSession.logCounter++,
                time: _getFormattedTime(),
                level: level,
                message: message,
                data: data
            };
            
            currentSession.logs.push(logEntry);
            _outputToConsole(logEntry);
            _throttleSave();
            
            $(document).trigger('newLogEntry', [logEntry]);
        },
        
        critical: function(message, data) { this.log(LOG_LEVELS.CRITICAL, message, data); },
        error: function(message, data) { this.log(LOG_LEVELS.ERROR, message, data); },
        warn: function(message, data) { this.log(LOG_LEVELS.WARNING, message, data); },
        info: function(message, data) { this.log(LOG_LEVELS.INFO, message, data); },
        analysis: function(message, data) { this.log(LOG_LEVELS.ANALYSIS, message, data); },
        debug: function(message, data) { this.log(LOG_LEVELS.DEBUG, message, data); },
        
        systemInfo: function() {
            this.info('System Information', {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                cpuCores: navigator.hardwareConcurrency || 'N/A',
                screenResolution: `${window.screen.width}x${window.screen.height}`,
                storage: (() => {
                    try {
                        const usage = (JSON.stringify(localStorage).length / 1024).toFixed(2);
                        return `${usage} KB used`;
                    } catch (e) { return 'N/A'; }
                })()
            });
        },
        
        getLogs: function(sessionId = null) {
            const allSessions = [...logHistory, currentSession];
            if (sessionId) {
                return allSessions.find(s => s.id === sessionId);
            }
            return allSessions;
        },

        getCurrentSessionId: function() {
            return currentSession ? currentSession.id : null;
        },
        
        exportLogs: function(format = 'json') {
            const logs = this.getLogs(this.getCurrentSessionId()).logs;
            const date = new Date().toISOString().slice(0, 10);
            let content, mimeType, fileName;

            if (format === 'txt') {
                content = logs.map(log => `[${log.time}] [${log.level}] ${log.message}` + 
                        (log.data && Object.keys(log.data).length > 0 ? `\n${JSON.stringify(log.data, null, 2)}` : '')
                    ).join('\n');
                mimeType = 'text/plain';
                fileName = `chess_logs_${date}.txt`;
            } else { // JSON
                content = JSON.stringify(logs, null, 2);
                mimeType = 'application/json';
                fileName = `chess_logs_${date}.json`;
            }

            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            Logger.info(`Logs for current session exported as ${fileName}`);
        }
    };

    window.Logger = Logger;
    window.Logger.init();

})(window);