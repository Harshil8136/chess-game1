// src/js/ui-html.js

// ===================================================================================
//  UI-HTML.JS
//  Contains the complete and final HTML structure for all UI components.
// ===================================================================================

const MAIN_GAME_HTML = `
<div id="main-game" class="w-full max-w-screen-xl mx-auto flex flex-col lg:flex-row items-stretch justify-center gap-4 lg:h-screen p-4">
    <div id="board-area-container" class="flex justify-center items-center">
        <main id="board-main-content" class="w-full flex flex-col gap-2">
            <header class="header-footer flex justify-between items-center p-2 rounded-md gap-4">
                <div class="flex items-center gap-3 flex-grow min-w-0">
                    <span id="top-player-name" class="font-bold text-lg truncate">AI (Black)</span>
                    <div class="captured-pieces-tray">
                        <div id="captured-by-black" class="captured-pieces-container"></div>
                        <span id="black-advantage" class="font-semibold text-gray-400 pl-2 self-center flex-shrink-0"></span>
                    </div>
                </div>
                <div id="top-clock" class="player-clock flex-shrink-0">--:--</div>
            </header>
            <div class="board-wrapper">
                <div id="top-files" class="coordinates files"></div><div id="left-ranks" class="coordinates ranks"></div>
                <div id="board" class="w-full aspect-square"></div>
                <svg id="board-svg-overlay" class="board-svg-overlay"></svg>
                <div id="right-ranks" class="coordinates ranks"></div><div id="bottom-files" class="coordinates files"></div>
            </div>
            <footer class="header-footer flex justify-between items-center p-2 rounded-md gap-4">
                <div class="flex items-center gap-3 flex-grow min-w-0">
                    <span id="bottom-player-name" class="font-bold text-lg truncate">Player (White)</span>
                    <div class="captured-pieces-tray">
                        <div id="captured-by-white" class="captured-pieces-container"></div>
                        <span id="white-advantage" class="font-semibold text-gray-400 pl-2 self-center flex-shrink-0"></span>
                    </div>
                </div>
                <div id="bottom-clock" class="player-clock flex-shrink-0">--:--</div>
            </footer>
        </main>
    </div>
    <aside class="w-full lg:w-96 p-4 rounded-lg flex flex-col">
        <section class="text-center pb-4 border-b themed-border flex-shrink-0">
            <div class="flex justify-between items-center">
                <h1 id="game-status" class="text-2xl font-bold h-8 text-left">White's Turn</h1>
                <p id="opening-name" class="text-sm text-dark h-6 text-right truncate"></p>
            </div>
             <div class="flex justify-end items-center gap-2 mt-2 flex-wrap">
                <button id="focus-mode-toggle" class="top-action-icon-btn btn-secondary" title="Focus Mode (Esc)"><img src="assets/icon/eye.png" alt="Focus Mode"/></button>
                <button id="hint-button" class="top-action-icon-btn btn-secondary" title="Show Hint (H)"><img src="assets/icon/light-bulb.png" alt="Show Hint"/></button>
                <button id="log-shortcut-btn" class="top-action-icon-btn btn-secondary" title="Toggle Debug Log (L)"><img src="assets/icon/bug.png" alt="Toggle Log"/></button>
                <button id="undo-button" class="top-action-icon-btn btn-secondary" title="Undo (U)"><img src="assets/icon/arrow-uturn-left.png" alt="Undo"></button>
                <button id="sound-toggle" class="top-action-icon-btn" title="Toggle Sound (M)"><img id="sound-icon" src="assets/icon/speaker-wave.png" alt="Sound On"></button>
                <button id="restart-button" class="top-action-btn btn-primary flex-shrink-0" title="New Game (N)">New Game</button>
             </div>
        </section>
        <nav class="flex border-b themed-border flex-shrink-0">
            <button data-tab="moves" class="tab-button flex-1 p-2 text-base font-bold active">Game</button>
            <button data-tab="settings" class="tab-button flex-1 p-2 text-base font-bold">Settings</button>
            <button data-tab="console" class="tab-button flex-1 p-2 text-base font-bold relative">
                Console <span id="log-indicator" class="hidden absolute top-1 right-2 w-3 h-3 rounded-full"></span>
            </button>
        </nav>
        <div class="flex-grow pt-4 flex flex-col min-h-0">
            <div id="moves-tab" class="tab-content active h-full flex-col gap-4">
                <div id="game-summary-section" class="p-3 bg-inset rounded-md space-y-4 hidden flex-shrink-0">
                      <h3 class="text-xl font-bold text-center">Game Over</h3>
                      <div id="summary-accuracy" class="flex justify-around text-center">
                            <div><div class="font-bold text-lg">--%</div><div class="text-dark">White Accuracy</div></div>
                            <div><div class="font-bold text-lg">--%</div><div class="text-dark">Black Accuracy</div></div>
                      </div>
                      <button id="run-review-btn" class="w-full px-4 py-2 font-bold rounded-lg shadow-md btn-primary">Run Full Game Review</button>
                </div>
                <div id="live-game-view" class="h-full flex flex-col gap-4">
                    <div class="flex justify-center items-center gap-4 flex-shrink-0">
                        <button id="history-first" class="history-nav-btn" title="First Move (↑)"><img src="assets/icon/backward.png" alt="First"></button>
                        <button id="history-prev" class="history-nav-btn" title="Previous Move (←)"><img src="assets/icon/chevron-left.png" alt="Previous"></button>
                        <button id="history-next" class="history-nav-btn" title="Next Move (→)"><img src="assets/icon/chevron-right.png" alt="Next"></button>
                        <button id="history-last" class="history-nav-btn" title="Current Position (↓)"><img src="assets/icon/forward.png" alt="Last"></button>
                    </div>
                    <div id="opening-explorer" class="p-2 bg-inset rounded-md hidden flex-shrink-0">
                        <h4 class="font-bold text-sm text-center border-b themed-border pb-1 mb-1">Opening Explorer</h4>
                        <div id="opening-explorer-content" class="text-sm text-dark"></div>
                    </div>
                    <div class="move-history-container rounded-md flex-grow flex flex-col min-h-0">
                        <div class="grid grid-cols-3 gap-x-2 p-2 border-b themed-border text-center font-bold text-dark flex-shrink-0">
                            <span>#</span>
                            <span>White</span>
                            <span>Black</span>
                        </div>
                        <div id="move-history-log" class="overflow-y-auto p-2"></div>
                    </div>
                </div>
            </div>
            <div id="settings-tab" class="tab-content h-full flex-col gap-2">
                <div class="setting-group">
                    <div class="flex justify-between items-center"><span class="font-bold text-lg">Player Name:</span><span id="player-name" class="text-lg text-dark cursor-pointer hover:text-light" title="Click to edit name">Player</span></div>
                </div>
                <div class="setting-group">
                    <h4 class="setting-group-title">Game & AI</h4>
                    <div class="flex justify-between items-center">
                        <label for="time-control-selector" class="font-bold">Time Control</label>
                        <select id="time-control-selector" class="w-36 p-2 rounded-md themed-select"></select>
                    </div>
                    <div class="flex justify-between items-center">
                        <label for="show-time-control-modal-toggle" class="font-bold">Ask on New Game</label>
                        <input type="checkbox" id="show-time-control-modal-toggle" class="h-5 w-5 rounded-sm themed-border text-blue-600 focus:ring-blue-500">
                    </div>
                    <div>
                        <label for="difficulty-slider" class="font-bold mb-1 block text-center">AI ELO: <span id="elo-display">1200</span></label>
                        <input type="range" id="difficulty-slider" min="1" max="12" value="4" step="1" class="w-full"/>
                    </div>
                </div>
                <div class="setting-group">
                    <h4 class="setting-group-title">Appearance</h4>
                    <div class="flex justify-between items-center">
                        <label for="ui-theme-selector" class="font-bold">UI Theme</label>
                        <select id="ui-theme-selector" class="w-36 p-2 rounded-md themed-select"></select>
                    </div>
                    <div class="flex justify-between items-center">
                        <label for="theme-selector" class="font-bold">Board Theme</label>
                        <select id="theme-selector" class="w-36 p-2 rounded-md themed-select"></select>
                    </div>
                    <div class="flex justify-between items-center">
                        <label for="piece-theme-selector" class="font-bold">Piece Theme</label>
                        <select id="piece-theme-selector" class="w-36 p-2 rounded-md themed-select"></select>
                    </div>
                </div>
                <div class="setting-group">
                     <h4 class="setting-group-title">Options</h4>
                    <div class="flex justify-between items-center">
                        <label for="threats-toggle" class="font-bold">Highlight Threats</label>
                        <input type="checkbox" id="threats-toggle" class="h-5 w-5 rounded-sm themed-border text-blue-600 focus:ring-blue-500">
                    </div>
                    <div class="flex justify-between items-center">
                        <label for="log-box-toggle" class="font-bold">Show Floating Log</label>
                        <input type="checkbox" id="log-box-toggle" class="h-5 w-5 rounded-sm themed-border text-blue-600 focus:ring-blue-500">
                    </div>
                    <div class="flex justify-between items-center">
                        <label for="live-engine-log-toggle" class="font-bold">Live Engine Logging</label>
                        <input type="checkbox" id="live-engine-log-toggle" class="h-5 w-5 rounded-sm themed-border text-blue-600 focus:ring-blue-500">
                    </div>
                </div>
                <div class="pt-2 grid grid-cols-2 gap-2">
                    <button id="swap-sides-button" class="w-full px-4 py-2 font-bold rounded-lg shadow-md btn-secondary" title="Swap Sides (S)"><img src="assets/icon/arrows-right-left.png" class="inline-block w-5 h-5 mr-2 -mt-1"/>Swap Sides</button>
                    <button id="export-pgn-btn" class="w-full px-4 py-2 font-bold rounded-lg shadow-md btn-secondary"><img src="assets/icon/document-arrow-down.png" class="inline-block w-5 h-5 mr-2 -mt-1"/>Export PGN</button>
                </div>
                <div class="pt-2">
                    <label for="fen-input" class="font-bold mb-2 block">Load Position from FEN</label>
                    <div class="flex gap-2">
                        <input type="text" id="fen-input" class="w-full p-2 rounded-md themed-select font-mono text-sm" placeholder="Paste FEN string here...">
                        <button id="load-fen-btn" class="px-4 font-bold rounded-lg shadow-md btn-primary"><img src="assets/icon/document-arrow-up.png" class="inline-block w-5 h-5 mr-1"/> Load</button>
                    </div>
                </div>
                <div class="pt-2 mt-auto">
                    <button id="show-shortcuts-btn" class="w-full px-4 py-2 font-bold rounded-lg shadow-md btn-secondary">Show Shortcuts</button>
                </div>
            </div>
            <div id="console-tab" class="tab-content h-full flex-col gap-2">
                <div id="console-header" class="flex flex-wrap items-center gap-2 p-2 border-b themed-border flex-shrink-0">
                    <div class="flex items-center gap-2">
                        <label for="log-session-selector" class="text-sm font-bold">Session:</label>
                        <select id="log-session-selector" class="p-1 rounded-md themed-select text-sm"></select>
                    </div>
                    <div class="flex-grow min-w-[100px]">
                        <input type="text" id="log-search-input" class="w-full p-1 rounded-md themed-select text-sm" placeholder="Search logs...">
                    </div>
                    <div class="flex gap-2">
                         <button id="export-log-json" class="text-xs btn-secondary px-2 py-1 rounded" title="Export as JSON"><img src="assets/icon/document-arrow-down.png" alt="Export JSON"></button>
                         <button id="export-log-txt" class="text-xs btn-secondary px-2 py-1 rounded" title="Export as TXT"><img src="assets/icon/document-text.png" alt="Export TXT"></button>
                         <button id="clear-current-log" class="text-xs btn-secondary px-2 py-1 rounded" title="Clear Current Session Log"><img src="assets/icon/trash.png" alt="Clear Log"></button>
                    </div>
                </div>
                <div id="console-log-display" class="overflow-y-auto p-2 font-mono text-xs flex-grow bg-inset-deep rounded-md"></div>
            </div>
        </div>
    </aside>
</div>
`;

const ANALYSIS_ROOM_HTML = `
<div id="analysis-room" class="w-full max-w-screen-2xl mx-auto flex-col lg:flex-row items-stretch justify-center gap-4 hidden lg:h-screen p-4">
    <div class="flex justify-center items-center">
        <main class="w-full flex flex-col gap-2">
            <header class="header-footer p-3 rounded-lg flex justify-between items-center text-light">
                <div class="flex items-center gap-3">
                    <img src="assets/icon/bug.png" class="w-8 h-8">
                    <div>
                        <div class="font-bold">Game Review</div>
                        <div id="ar-player-names" class="text-sm text-dark">Player vs Computer</div>
                    </div>
                </div>
                <button id="return-to-game-btn" class="top-action-icon-btn" title="Exit Review"><img src="assets/icon/x-mark.png" class="w-6 h-6"></button>
            </header>
            <div class="board-wrapper">
                <div id="analysis-top-files" class="coordinates files"></div>
                <div id="analysis-left-ranks" class="coordinates ranks"></div>
                <div id="analysis-board" class="w-full aspect-square"></div>
                <svg id="analysis-board-svg-overlay" class="board-svg-overlay"></svg>
                <div id="analysis-right-ranks" class="coordinates ranks"></div>
                <div id="analysis-bottom-files" class="coordinates files"></div>
            </div>
            <footer class="header-footer p-3 rounded-lg text-light bg-inset">
                <div id="ar-move-assessment-details" class="hidden">
                     <div id="ar-assessment-title" class="text-lg font-bold flex items-center"></div>
                     <p id="ar-assessment-comment" class="text-sm text-dark mt-1"></p>
                </div>
                <div id="ar-best-line-display" class="hidden mt-2">
                    <span class="text-sm font-bold text-accent">Best Line:</span>
                    <span id="ar-best-line-moves" class="font-mono ml-2"></span>
                </div>
                <button id="ar-retry-mistake-btn" class="hidden btn-primary w-full mt-3 py-2">Retry this move</button>
            </footer>
        </main>
    </div>
    <aside class="w-full lg:w-1/3 xl:w-2/5 flex-shrink-0 flex flex-col gap-4">
        <details id="review-summary-container" class="summary-panel" open>
            <summary class="summary-panel-title">Review Summary</summary>
            <div id="analysis-dashboard">
                <div class="dashboard-grid">
                    <div class="dashboard-item text-center">
                        <div class="label">White Accuracy</div>
                        <div id="ar-white-accuracy" class="value">--%</div>
                        <div class="accuracy-bar-container"><div id="ar-white-accuracy-bar" class="accuracy-bar"></div></div>
                    </div>
                    <div class="dashboard-item text-center">
                        <div class="label">Black Accuracy</div>
                        <div id="ar-black-accuracy" class="value">--%</div>
                        <div class="accuracy-bar-container"><div id="ar-black-accuracy-bar" class="accuracy-bar"></div></div>
                    </div>
                </div>
                <div id="ar-move-counts" class="grid grid-cols-2 gap-x-4"></div>
            </div>
        </details>
        <details id="estimated-elo-panel" class="summary-panel" open>
            <summary class="summary-panel-title">Estimated ELO</summary>
            <div class="dashboard-grid">
                <div class="dashboard-item text-center"><div class="elo-badge">White: <span id="ar-white-elo">----</span></div></div>
                <div class="dashboard-item text-center"><div class="elo-badge">Black: <span id="ar-black-elo">----</span></div></div>
            </div>
        </details>
        <details id="game-phase-panel" class="summary-panel">
            <summary class="summary-panel-title">Game Phase Performance</summary>
            <div id="ar-phase-display" class="space-y-2"></div>
        </details>
        <div class="flex-grow flex flex-col min-h-0 bg-inset rounded-lg p-4">
            <div class="flex justify-between items-center mb-2">
                <h3 class="text-xl font-bold">Moves</h3>
                <div id="key-moments-toggle-container" class="key-moments-toggle-group hidden">
                    <button data-filter="all" class="key-moments-toggle active">All Moves</button>
                    <button data-filter="key" class="key-moments-toggle">Key Moments</button>
                </div>
            </div>
            <div id="ar-analysis-move-list" class="flex-grow overflow-y-auto pr-2"></div>
        </div>
        <div id="eval-chart-container" class="summary-panel h-40">
            <canvas id="ar-eval-chart"></canvas>
        </div>
    </aside>
</div>
`;

const MODALS_HTML = `
<div id="analysis-visualizer" class="hidden absolute inset-0 z-40 flex flex-col items-center justify-center p-8">
    <div class="w-full max-w-sm bg-bg-panel rounded-lg shadow-2xl p-4 flex flex-col items-center gap-4">
        <div class="text-center">
            <h2 class="text-3xl font-bold mb-1">Analyzing Game</h2>
            <p id="visualizer-status" class="text-lg text-dark">Initializing engine...</p>
        </div>
        <div id="visualizer-board-wrapper" class="w-64 h-64"></div>
        <div class="w-full text-center space-y-1 text-sm">
            <p>Move: <span id="visualizer-move-number" class="font-bold">--</span></p>
            <p>Played: <span id="visualizer-move-played" class="font-bold font-mono">--</span></p>
            <p>Assessment: <span id="visualizer-move-assessment" class="font-bold">--</span></p>
        </div>
        <div class="w-full">
            <div id="visualizer-progress-bar-container" class="w-full bg-bg-inset-deep rounded-full h-2.5">
                <div id="visualizer-progress-bar" class="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style="width: 0%"></div>
            </div>
        </div>
        <button id="visualizer-cancel-btn" class="mt-2 px-4 py-2 font-bold rounded-lg shadow-md btn-secondary">Cancel</button>
    </div>
</div>

<div id="log-box-container" class="hidden fixed top-1/4 left-1/4 w-1/2 h-1/2 border rounded-lg shadow-2xl flex flex-col z-50 bg-panel themed-border">
    <div id="log-box-header" class="bg-inset p-2 rounded-t-lg cursor-move flex justify-between items-center">
        <span class="font-bold">Console Log</span>
        <div id="log-box-controls" class="flex items-center gap-x-2 w-full">
            <button id="log-box-scroll-toggle" class="log-control-btn active" title="Toggle Auto-Scroll"><img src="assets/icon/arrow-down-circle.png" alt="Auto-Scroll"></button>
            <button id="log-spacing-toggle" class="log-control-btn" title="Toggle Line Spacing"><img src="assets/icon/bars-3-bottom-left.png" alt="Line Spacing"></button>
            <button id="log-font-dec" class="log-control-btn" title="Decrease Font Size"><img src="assets/icon/minus.png" alt="Decrease Font"></button>
            <button id="log-font-inc" class="log-control-btn" title="Increase Font Size"><img src="assets/icon/plus.png" alt="Increase Font"></button>
            <div class="control-divider"></div>
            
            <div class="relative">
                <button id="log-filter-toggle" class="log-control-btn" title="Filter Log Levels"><img src="assets/icon/funnel.png" alt="Filter"></button>
                <div id="log-filter-menu" class="hidden absolute left-0 mt-2 w-48 rounded-md shadow-lg z-10 p-2">
                    <h4 class="text-sm font-bold mb-1 px-2 text-light">Visible Log Types</h4>
                    <div id="log-filter-options" class="space-y-1"></div>
                </div>
            </div>

            <button id="log-box-colorize-btn" class="log-control-btn" title="Randomize Header Color"><img src="assets/icon/paint-brush.png" alt="Randomize Color"></button>
            <button id="log-box-verbose-toggle" class="log-control-btn" title="Toggle Verbose Logs (Ctrl+Alt+V)"><img src="assets/icon/code-bracket.png" alt="Verbose"></button>
            <div class="control-divider"></div>
            <button id="log-box-copy" class="log-control-btn" title="Copy Filtered Logs"><img src="assets/icon/clipboard-document.png" alt="Copy"></button>
            <button id="log-box-clear" class="log-control-btn" title="Clear Session Log"><img src="assets/icon/trash.png" alt="Clear"></button>
            <div class="flex-grow"></div>
            <button id="log-box-stats-toggle" class="log-control-btn" title="Toggle Stats Drawer"><img src="assets/icon/light-bulb.png" alt="Stats"></button>
            <button id="log-box-reset-size" class="log-control-btn" title="Reset Size & Position (Ctrl+Alt+R)"><img src="assets/icon/arrows-right-left.png" alt="Reset Size"></button>
            <button id="log-box-minimize-toggle" class="log-control-btn" title="Minimize/Maximize">
                <img class="icon-minimize" src="assets/icon/minimize.png" alt="Minimize">
                <img class="icon-maximize hidden" src="assets/icon/maximize.png" alt="Maximize">
            </button>
            <button id="log-box-popout-toggle" class="log-control-btn" title="Widget Mode (Double-click header)"><img src="assets/icon/arrow-top-right-on-square.png" alt="Pop-out"></button>
            <button id="log-box-close" class="log-control-btn" title="Close Log"><img src="assets/icon/x-mark.png" alt="Close"></button>
        </div>
        <div id="log-box-widget-restore" class="hidden"><img src="assets/icon/bug.png" alt="Restore Log" class="w-8 h-8"/></div>
    </div>
    <div id="log-stats-drawer">
        <div class="stats-grid p-2 border-b themed-border text-xs">
            <div id="log-fps-panel" class="stat-item"></div>
            <div id="log-memory-panel" class="stat-item"></div>
            <div id="log-session-panel" class="stat-item"></div>
            <div id="log-github-panel" class="stat-item"></div>
            <div id="log-ai-panel" class="stat-item"></div>
        </div>
    </div>
    <div id="log-box-content" class="p-2 text-sm font-mono flex-grow"></div>
    <div id="log-box-resize-handle" class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"></div>
</div>

<div id="eval-bar" class="fixed left-2 top-1/2 transform -translate-y-1/2 w-6 h-80 bg-gray-800 rounded-full overflow-hidden border border-gray-600 hidden lg:block">
    <div id="eval-bar-black" class="bg-gray-900 transition-all duration-700 ease-out" style="height: 50%;"></div>
    <div id="eval-bar-white" class="bg-gray-100 transition-all duration-700 ease-out" style="height: 50%;"></div>
</div>
`;