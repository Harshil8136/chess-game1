// ===================================================================================
//  SOUND.JS
//  Initializes and manages all audio playback for the application.
// ===================================================================================

let sounds = {};
let isMuted = false;

/**
 * Initializes all sound effects using the Howler.js library.
 */
function initSounds() {
    Object.keys(SOUND_PATHS).forEach(key => {
        sounds[key] = new Howl({ src: [SOUND_PATHS[key]] });
    });
}

/**
 * Plays a sound by its key name, if sound is not muted.
 * @param {string} soundName - The key of the sound to play (e.g., 'moveSelf').
 */
function playSound(soundName) {
    if (isMuted) return;
    if (sounds[soundName]) {
        sounds[soundName].play();
    }
}

/**
 * Determines and plays the appropriate sound for a given chess move.
 * @param {object} move - The move object from chess.js.
 */
function playMoveSound(move) {
    if (game.in_check()) {
        playSound('check');
    } else if (move.flags.includes('p')) {
        playSound('promote');
    } else if (move.flags.includes('k') || move.flags.includes('q')) {
        playSound('castle');
    } else if (move.flags.includes('c')) {
        playSound('capture');
    } else {
        playSound('moveSelf');
    }
}