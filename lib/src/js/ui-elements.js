// src/js/ui-elements.js

// ===================================================================================
//  UI-ELEMENTS.JS
//  Contains all jQuery element references and UI-related state variables.
// ===================================================================================

// --- Element References (Declared but not assigned) ---
// These are now declared as 'let' so they can be assigned later, once the DOM is ready.
let statusElement, openingNameElement, themeSelector, pieceThemeSelector, uiThemeSelector,
    capturedByWhiteElement, capturedByBlackElement, restartButton, swapSidesButton,
    undoButton, playerNameElement, bottomPlayerNameElement, topPlayerNameElement,
    whiteAdvantageElement, blackAdvantageElement, moveHistoryLog, evalBarWhite,
    evalBarBlack, difficultySlider, eloDisplay, soundToggle, soundIcon,
    historyFirstBtn, historyPrevBtn, historyNextBtn, historyLastBtn, runAnalysisBtn,
    mainGameView, analysisRoomView, returnToGameBtn, logBoxToggle, hintButton,
    threatsToggle, fenInput, loadFenBtn, exportPgnBtn, openingExplorer,
    openingExplorerContent, focusModeToggle, analysisVisualizer, visualizerCancelBtn,
    gameSummarySection, liveGameView, summaryAccuracy, logShortcutBtn, showShortcutsBtn,
    topClockElement, bottomClockElement, timeControlSelector, showTimeControlModalToggle,
    liveEngineLogToggle;

// --- UI State (Remains global as it's not dependent on the DOM) ---
let sounds = {};
let isMuted = false;
let playerName = 'Player';
let highlightThreats = false;
let analysisStockfish = null; 
let showModalOnRestart = true;

/**
 * Initializes all jQuery element references. This function must be called after the
 * HTML templates have been loaded into the DOM to ensure the elements exist.
 */
function initElements() {
    statusElement = $('#game-status');
    openingNameElement = $('#opening-name');
    themeSelector = $('#theme-selector');
    pieceThemeSelector = $('#piece-theme-selector');
    uiThemeSelector = $('#ui-theme-selector');
    capturedByWhiteElement = $('#captured-by-white');
    capturedByBlackElement = $('#captured-by-black');
    restartButton = $('#restart-button');
    swapSidesButton = $('#swap-sides-button');
    undoButton = $('#undo-button');
    playerNameElement = $('#player-name');
    bottomPlayerNameElement = $('#bottom-player-name');
    topPlayerNameElement = $('#top-player-name');
    whiteAdvantageElement = $('#white-advantage');
    blackAdvantageElement = $('#black-advantage');
    moveHistoryLog = $('#move-history-log');
    evalBarWhite = $('#eval-bar-white');
    evalBarBlack = $('#eval-bar-black');
    difficultySlider = $('#difficulty-slider');
    eloDisplay = $('#elo-display');
    soundToggle = $('#sound-toggle');
    soundIcon = $('#sound-icon');
    historyFirstBtn = $('#history-first');
    historyPrevBtn = $('#history-prev');
    historyNextBtn = $('#history-next');
    historyLastBtn = $('#history-last');
    runAnalysisBtn = $('#run-review-btn');
    mainGameView = $('#main-game');
    analysisRoomView = $('#analysis-room');
    returnToGameBtn = $('#return-to-game-btn');
    logBoxToggle = $('#log-box-toggle');
    hintButton = $('#hint-button');
    threatsToggle = $('#threats-toggle');
    fenInput = $('#fen-input');
    loadFenBtn = $('#load-fen-btn');
    exportPgnBtn = $('#export-pgn-btn');
    openingExplorer = $('#opening-explorer');
    openingExplorerContent = $('#opening-explorer-content');
    focusModeToggle = $('#focus-mode-toggle');
    analysisVisualizer = $('#analysis-visualizer');
    visualizerCancelBtn = $('#visualizer-cancel-btn');
    gameSummarySection = $('#game-summary-section');
    liveGameView = $('#live-game-view');
    summaryAccuracy = $('#summary-accuracy');
    logShortcutBtn = $('#log-shortcut-btn');
    showShortcutsBtn = $('#show-shortcuts-btn');
    topClockElement = $('#top-clock');
    bottomClockElement = $('#bottom-clock');
    timeControlSelector = $('#time-control-selector');
    showTimeControlModalToggle = $('#show-time-control-modal-toggle');
    liveEngineLogToggle = $('#live-engine-log-toggle');
}