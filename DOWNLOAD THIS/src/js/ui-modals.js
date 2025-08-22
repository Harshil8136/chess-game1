// src/js/ui-modals.js

// ===================================================================================
//  UI-MODALS.JS
//  Manages all SweetAlert2 pop-up dialogs for the application.
// ===================================================================================

/**
 * Shows the promotion selection dialog to the user.
 * @param {string} color - The color of the pawn being promoted ('w' or 'b').
 * @returns {Promise<string>} A promise that resolves with the chosen piece ('q', 'r', 'b', or 'n').
 */
function showPromotionDialog(color) {
    return new Promise((resolve) => {
        const pieceThemePath = PIECE_THEMES[pieceThemeSelector.val()];
        Swal.fire({
            title: 'Promote Pawn',
            html: `
                <div class="flex justify-around p-4">
                    <img src="${pieceThemePath.replace('{piece}', color + 'Q')}" data-piece="q" class="promotion-piece">
                    <img src="${pieceThemePath.replace('{piece}', color + 'R')}" data-piece="r" class="promotion-piece">
                    <img src="${pieceThemePath.replace('{piece}', color + 'B')}" data-piece="b" class="promotion-piece">
                    <img src="${pieceThemePath.replace('{piece}', color + 'N')}" data-piece="n" class="promotion-piece">
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            willOpen: () => {
                const popup = Swal.getPopup();
                $(popup).on('click', '.promotion-piece', function() {
                    const piece = $(this).data('piece');
                    resolve(piece);
                    Swal.close();
                });
            }
        });
    });
}

/**
 * Shows the time control selection modal for a new game.
 */
function showTimeControlModal() {
    let optionsHtml = '';
    for (const key in TIME_CONTROLS) {
        optionsHtml += `<option value="${key}">${TIME_CONTROLS[key].label}</option>`;
    }

    Swal.fire({
        title: 'Start a New Game',
        html: `
            <div class="p-4">
                <label for="swal-time-control" class="block text-left font-bold mb-2">Select Time Control:</label>
                <select id="swal-time-control" class="w-full p-2 rounded-md themed-select">
                    ${optionsHtml}
                </select>
            </div>
        `,
        confirmButtonText: 'Start Game',
        focusConfirm: false,
        preConfirm: () => {
            return $('#swal-time-control').val();
        },
        allowOutsideClick: false
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            const selectedKey = result.value;
            timeControlSelector.val(selectedKey); // Sync main UI
            const tc = TIME_CONTROLS[selectedKey];
            Logger.info(`Starting new game with selected time control: ${tc.label}`);
            startNewGameWithTime(tc.base, tc.inc);
        } else {
            Logger.info("New game modal dismissed. Starting with default time control.");
            const defaultKey = timeControlSelector.val() || APP_CONFIG.DEFAULT_TIME_CONTROL;
            const tc = TIME_CONTROLS[defaultKey];
            startNewGameWithTime(tc.base, tc.inc);
        }
    });
}

/**
 * Displays a modal with a list of keyboard shortcuts.
 */
function showShortcutsModal() {
    Swal.fire({
        title: 'Keyboard Shortcuts',
        html: `
            <div class="text-left p-4 space-y-2">
                <p><b>N</b> - New Game</p>
                <p><b>U</b> - Undo Last Turn</p>
                <p><b>F</b> - Flip Board</p>
                <p><b>S</b> - Swap Sides (at start of game)</p>
                <p><b>H</b> - Show Hint</p>
                <p><b>M</b> - Toggle Mute</p>
                <p><b>L</b> - Toggle Floating Log</p>
                <p><b>&larr; / &rarr;</b> - Previous / Next Move (in history)</p>
                <p><b>&uarr; / &darr;</b> - First / Last Move (in history)</p>
                <p><b>Esc</b> - Exit Focus Mode</p>
            </div>
        `,
        confirmButtonText: 'Got it!'
    });
}

/**
 * Initializes event listeners for interactive elements within modals.
 * This is now a separate function to be called after the main UI elements are ready.
 */
function initModalEventListeners() {
    // Event listener for changing the player name
    playerNameElement.on('click', function() {
        Swal.fire({
            title: 'Enter Your Name',
            input: 'text',
            inputValue: playerName,
            showCancelButton: true,
            confirmButtonText: 'Save',
            inputValidator: (value) => {
                if (!value) {
                    return 'Name cannot be empty!';
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                playerName = result.value.trim();
                playerNameElement.text(playerName);
                updatePlayerLabels();
                localStorage.setItem('chessPlayerName', playerName);
                Logger.info(`Player name changed to: ${playerName}`);
            }
        });
    });
}