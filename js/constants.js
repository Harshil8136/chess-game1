// ===================================================================================
//  CONSTANTS.JS
//  Defines gameplay constants like difficulty, time controls, and piece values.
// ===================================================================================

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