// src/js/ui-elements.js

// ===================================================================================
//  UI-ELEMENTS.JS
//  Contains all jQuery element references and UI-related state variables.
// ===================================================================================

// --- Element Refs ---
const statusElement = $('#game-status');
const openingNameElement = $('#opening-name');
const themeSelector = $('#theme-selector');
const pieceThemeSelector = $('#piece-theme-selector');
const uiThemeSelector = $('#ui-theme-selector');
const capturedByWhiteElement = $('#captured-by-white');
const capturedByBlackElement = $('#captured-by-black');
const restartButton = $('#restart-button');
const swapSidesButton = $('#swap-sides-button');
const undoButton = $('#undo-button');
const playerNameElement = $('#player-name');
const bottomPlayerNameElement = $('#bottom-player-name');
const topPlayerNameElement = $('#top-player-name');
const whiteAdvantageElement = $('#white-advantage');
const blackAdvantageElement = $('#black-advantage');
const moveHistoryLog = $('#move-history-log');
const evalBarWhite = $('#eval-bar-white');
const evalBarBlack = $('#eval-bar-black');
const difficultySlider = $('#difficulty-slider');
const eloDisplay = $('#elo-display');
const soundToggle = $('#sound-toggle');
const soundIcon = $('#sound-icon');
const historyFirstBtn = $('#history-first');
const historyPrevBtn = $('#history-prev');
const historyNextBtn = $('#history-next');
const historyLastBtn = $('#history-last');
const runAnalysisBtn = $('#run-review-btn');
const mainGameView = $('#main-game');
const analysisRoomView = $('#analysis-room');
const returnToGameBtn = $('#return-to-game-btn');
const logBoxToggle = $('#log-box-toggle');
const hintButton = $('#hint-button');
const threatsToggle = $('#threats-toggle');
const fenInput = $('#fen-input');
const loadFenBtn = $('#load-fen-btn');
const exportPgnBtn = $('#export-pgn-btn');
const openingExplorer = $('#opening-explorer');
const openingExplorerContent = $('#opening-explorer-content');
const focusModeToggle = $('#focus-mode-toggle');
const analysisVisualizer = $('#analysis-visualizer');
const visualizerCancelBtn = $('#visualizer-cancel-btn');
const gameSummarySection = $('#game-summary-section');
const liveGameView = $('#live-game-view');
const summaryAccuracy = $('#summary-accuracy');
const logShortcutBtn = $('#log-shortcut-btn');
const showShortcutsBtn = $('#show-shortcuts-btn');
const topClockElement = $('#top-clock');
const bottomClockElement = $('#bottom-clock');
const timeControlSelector = $('#time-control-selector');
const showTimeControlModalToggle = $('#show-time-control-modal-toggle');

// UPDATED: Added the missing variable definition that was causing the application to crash.
const liveEngineLogToggle = $('#live-engine-log-toggle');


// --- UI State ---
let sounds = {};
let isMuted = false;
let playerName = 'Player';
let highlightThreats = false;
let analysisStockfish = null; 
let showModalOnRestart = true;