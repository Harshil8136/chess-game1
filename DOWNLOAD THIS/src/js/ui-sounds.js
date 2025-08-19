// src/js/ui-sounds.js

// ===================================================================================
//  UI-SOUNDS.JS
//  Manages the initialization and playback of all audio cues.
// ===================================================================================

function initSounds() {
    Object.keys(SOUND_PATHS).forEach(key => {
        sounds[key] = new Howl({ src: [SOUND_PATHS[key]], volume: 0.6 });
    });
    sounds['uiToggle'] = new Howl({ src: ['assets/sounds/ui-toggle.mp3'], volume: 0.4 });
}

window.playSound = function(soundName) {
    if (isMuted || !sounds[soundName]) return;
    sounds[soundName].play();
}