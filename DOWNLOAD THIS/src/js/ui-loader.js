// src/js/ui-loader.js

// ===================================================================================
//  UI-LOADER.JS
//  Injects HTML content stored in ui-html.js into the main document.
//  This method is synchronous and avoids all browser security issues with fetch().
// ===================================================================================

/**
 * Initializes the application's UI by injecting all HTML content from the
 * globally defined template variables. This function must be called before any
 * other script attempts to access the DOM elements.
 */
function initTemplates() {
    // Check if the required HTML content variables exist.
    if (typeof MAIN_GAME_HTML === 'undefined' || 
        typeof ANALYSIS_ROOM_HTML === 'undefined' || 
        typeof MODALS_HTML === 'undefined') {
        
        document.body.innerHTML = `<div style="font-family: sans-serif; color: #ff4d4d; background-color: #2b2b2b; border: 2px solid #ff4d4d; border-radius: 8px; margin: 50px; padding: 20px; text-align: center;">
            <h1 style="margin-bottom: 10px;">Critical Application Error</h1>
            <p>Could not find the required HTML content variables.</p>
            <p>Please ensure 'ui-html.js' is loaded correctly before this script.</p>
        </div>`;

        // Stop execution to prevent further errors.
        throw new Error("UI HTML content not found. Halting application.");
    }

    // Inject the HTML into the document's body in the correct order.
    // This is a direct, synchronous operation and is guaranteed to work.
    document.body.insertAdjacentHTML('beforeend', MAIN_GAME_HTML);
    document.body.insertAdjacentHTML('beforeend', ANALYSIS_ROOM_HTML);
    document.body.insertAdjacentHTML('beforeend', MODALS_HTML);

    Logger.info("UI templates successfully injected into the DOM.");
}