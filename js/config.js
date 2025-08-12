// ===================================================================================
//  CONFIG.JS
//  Central configuration and settings for the chess application.
// ===================================================================================

// --- Main App Configuration ---

const APP_CONFIG = {
    STOCKFISH_URL: 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js',
    DEFAULT_BOARD_THEME: 'green',
    DEFAULT_PIECE_THEME: 'cburnett',
    MATE_SCORE: 10000,
    DEFAULT_TIME_CONTROL: 'unlimited'
};

const SOUND_PATHS = {
    'moveSelf': 'sounds/move-self.mp3',
    'capture': 'sounds/capture.mp3',
    'check': 'sounds/move-check.mp3',
    'gameEnd': 'sounds/game-end.mp3',
    'gameStart': 'sounds/game-start.mp3',
    'castle': 'sounds/castle.mp3',
    'promote': 'sounds/promote.mp3',
    'notify': 'sounds/notify.mp3'
};

// --- Theme Definitions ---

const UI_THEMES = [
    {
        name: 'charcoal',
        displayName: 'Charcoal 숯',
        colors: {
            '--bg-main': '#262522',
            '--bg-panel': '#312e2b',
            '--text-light': '#f5f5f4',
            '--text-dark': '#a8a29e',
            '--border': '#57534e',
            '--btn-primary-bg': '#2563eb',
            '--btn-primary-hover': '#1d4ed8',
            '--btn-secondary-bg': '#57534e',
            '--btn-secondary-hover': '#44403c',
        }
    },
    {
        name: 'midnight',
        displayName: 'Midnight 🌃',
        colors: {
            '--bg-main': '#1e293b',
            '--bg-panel': '#334155',
            '--text-light': '#f1f5f9',
            '--text-dark': '#94a3b8',
            '--border': '#475569',
            '--btn-primary-bg': '#be123c',
            '--btn-primary-hover': '#9f1239',
            '--btn-secondary-bg': '#475569',
            '--btn-secondary-hover': '#334155',
        }
    },
    {
        name: 'forest',
        displayName: 'Forest 🌲',
        colors: {
            '--bg-main': '#1a2e24',
            '--bg-panel': '#224030',
            '--text-light': '#e8f5e9',
            '--text-dark': '#a5d6a7',
            '--border': '#388e3c',
            '--btn-primary-bg': '#f59e0b',
            '--btn-primary-hover': '#d97706',
            '--btn-secondary-bg': '#388e3c',
            '--btn-secondary-hover': '#2e7d32',
        }
    }
];

const THEMES = [
    { name: 'green', displayName: 'Green 🟩', colors: { light: '#eaefd2', dark: '#769656' } },
    { name: 'brown', displayName: 'Brown 🟫', colors: { light: '#f0d9b5', dark: '#b58863' } },
    { name: 'blue',  displayName: 'Blue 🟦',  colors: { light: '#dee3e6', dark: '#8ca2ad' } },
    { name: 'stone', displayName: 'Stone 🗿', colors: { light: '#d1d1d1', dark: '#a7a7a7' } }
];

const PIECE_THEMES = {
    alpha: 'img/alpha/{piece}.png',
    cburnett: 'img/cburnett/{piece}.png',
    merida: 'img/merida/{piece}.png',
    cardinal: 'img/cardinal/{piece}.png',
    governor: 'img/governor/{piece}.png',
    horsey: 'img/horsey/{piece}.png',
    maestro: 'img/maestro/{piece}.png',
    wiki: 'img/wikipedia/{piece}.png'
};

// --- Gameplay & Analysis Constants ---

const TIME_CONTROLS = {
    'unlimited': { base: 0, inc: 0, label: 'Unlimited' },
    '1+1': { base: 1, inc: 1, label: '1 + 1' },
    '3+2': { base: 3, inc: 2, label: '3 + 2' },
    '5+3': { base: 5, inc: 3, label: '5 + 3' },
    '10+0': { base: 10, inc: 0, label: '10 + 0' },
    '15+10': { base: 15, inc: 10, label: '15 + 10' }
};

const DIFFICULTY_SETTINGS = {
    1: { elo: 450,  type: 'random' },
    2: { elo: 650,  type: 'greedy' },
    3: { elo: 850,  type: 'stockfish', depth: 2 },
    4: { elo: 1000, type: 'stockfish', depth: 4 },
    5: { elo: 1200, type: 'stockfish', depth: 6 },
    6: { elo: 1400, type: 'stockfish', depth: 8 },
    7: { elo: 1600, type: 'stockfish', movetime: 500 },
    8: { elo: 1800, type: 'stockfish', movetime: 800 },
    9: { elo: 2000, type: 'stockfish', movetime: 1200 },
    10: { elo: 2200, type: 'stockfish', movetime: 1600 },
    11: { elo: 2400, type: 'stockfish', movetime: 2000 },
    12: { elo: 2700, type: 'stockfish', movetime: 2500 }
};

const CLASSIFICATION_DATA = {
    'Brilliant': { title: 'Brilliant', comment: 'A great sacrifice or the only good move in a critical position!', color: 'classification-color-brilliant', icon: '!!' },
    'Great': { title: 'Great Move', comment: 'Finds the only good move in a complex position.', color: 'classification-color-great', icon: '!' },
    'Best': { title: 'Best Move', comment: 'The strongest move, according to the engine.', color: 'classification-color-best', icon: '★' },
    'Excellent': { title: 'Excellent', comment: 'A strong move that maintains the position\'s potential.', color: 'classification-color-excellent', icon: '✓' },
    'Good': { title: 'Good', comment: 'A solid, decent move.', color: 'classification-color-good', icon: '👍' },
    'Book': { title: 'Book Move', comment: 'A standard opening move from theory.', color: 'classification-color-book', icon: '📖' },
    'Inaccuracy': { title: 'Inaccuracy', comment: 'This move weakens your position slightly.', color: 'classification-color-inaccuracy', icon: '?!' },
    'Mistake': { title: 'Mistake', comment: 'A significant error that damages your position.', color: 'classification-color-mistake', icon: '?' },
    'Blunder': { title: 'Blunder', comment: 'A very bad move that could lead to losing the game.', color: 'classification-color-blunder', icon: '??' },
    'Miss': { title: 'Missed Opportunity', comment: 'Your opponent made a mistake, but you missed the best punishment.', color: 'classification-color-miss', icon: '...' },
    'Pending': { title: 'Analyzing...', comment: '', color: 'classification-color-pending', icon: '...' }
};

const MATERIAL_POINTS = { p: 1, n: 3, b: 3, r: 5, q: 9 };

const OPENINGS = [
    { pgn: "1. e4", name: "King's Pawn Opening" },
    { pgn: "1. d4", name: "Queen's Pawn Opening" },
    { pgn: "1. c4", name: "English Opening" },
    { pgn: "1. e4 c5", name: "Sicilian Defense" },
    { pgn: "1. e4 e5", name: "King's Pawn Game" },
    { pgn: "1. d4 d5", name: "Queen's Pawn Game" },
    { pgn: "1. d4 Nf6", name: "Indian Defense" },
    { pgn: "1. e4 e5 2. Nf3 Nc6", name: "Open Game" },
    { pgn: "1. d4 d5 2. c4", name: "Queen's Gambit" }
];