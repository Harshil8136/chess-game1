// ===================================================================================
//  MAIN.JS
//  Initializes the application, sets up event listeners, and loads the engine.
// ===================================================================================

/**
 * Initializes all application components in the correct order.
 */
function initApp() {
    // 1. Initialize core UI components like sounds and the on-screen log box.
    initSounds();
    initLogBox();
    
    // 2. Set up all the event listeners for user interaction.
    setupEventListeners();
    
    // 3. Load the chess engine, then load user settings and start the first game.
    //    This is the final step that brings the application to life.
    loadEngineAndInitGame();
}

// Start the application once the HTML document is fully loaded.
$(document).ready(initApp);