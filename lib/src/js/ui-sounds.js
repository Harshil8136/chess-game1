// src/js/ui-sounds.js

// ===================================================================================
//  UI-SOUNDS.JS
//  Manages the initialization and playback of all audio cues.
// ===================================================================================

/**
 * Initializes the sound system. This function is kept for structural consistency,
 * as the new system creates audio objects on demand and does not require pre-loading.
 */
function initSounds() {
    // Sound objects are now created on-the-fly in playSound().
}

/**
 * Plays a sound by its name.
 * UPDATED: This function no longer uses Howler.js. It now uses the browser's native
 * Audio constructor, which is fully compatible with the file:/// protocol and
 * avoids all CORS policy errors.
 * @param {string} soundName - The name of the sound to play (e.g., 'moveSelf', 'capture').
 */
window.playSound = function(soundName) {
    if (isMuted) return;

    const soundPath = SOUND_PATHS[soundName];
    if (!soundPath) {
        console.warn(`Sound not found: ${soundName}`);
        return;
    }

    try {
        const audio = new Audio(soundPath);
        audio.volume = 0.5; // Set a default volume
        
        // The play() method returns a Promise, which we should handle
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                // Autoplay was prevented. This is common in browsers before a user interaction.
                // We can safely ignore this error as it doesn't break the application.
                console.warn(`Could not play sound "${soundName}":`, error.message);
            });
        }
    } catch (error) {
        console.error(`Error playing sound "${soundName}":`, error);
    }
}