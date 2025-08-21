// src/js/ui-modals.js

// ===================================================================================
//  UI-MODALS.JS
//  Manages all SweetAlert2 modals for user interaction.
// ===================================================================================

function showShortcutsModal() {
    Logger.info('Shortcuts modal opened.');
    const shortcutsHtml = `
        <div class="text-left text-lg space-y-2 text-light">
            <h3 class="text-2xl font-bold text-center mb-4">Keyboard Shortcuts</h3>
            <div class="grid grid-cols-2 gap-x-4 gap-y-2">
                <div class="font-semibold">New Game:</div><div class="font-mono bg-inset p-1 rounded text-center">N</div>
                <div class="font-semibold">Undo Move:</div><div class="font-mono bg-inset p-1 rounded text-center">U</div>
                <div class="font-semibold">Flip Board:</div><div class="font-mono bg-inset p-1 rounded text-center">F</div>
                <div class="font-semibold">History Navigation:</div><div class="font-mono bg-inset p-1 rounded text-center">← → ↑ ↓</div>
                <div class="font-semibold">Toggle Sound:</div><div class="font-mono bg-inset p-1 rounded text-center">M</div>
                <div class="font-semibold">Toggle Debug Log:</div><div class="font-mono bg-inset p-1 rounded text-center">L</div>
                <div class="font-semibold">Toggle Log Verbose:</div><div class="font-mono bg-inset p-1 rounded text-center">Ctrl + Alt + V</div>
                <div class="font-semibold">Reset Log Size:</div><div class="font-mono bg-inset p-1 rounded text-center">Ctrl + Alt + R</div>
            </div>
        </div>
    `;
    Swal.fire({
        html: shortcutsHtml,
        showConfirmButton: true,
        confirmButtonText: 'Got it!',
        customClass: {
            popup: '!bg-bg-panel',
            confirmButton: '!btn-primary !px-6 !py-2'
        }
    });
}

function showTimeControlModal() {
    const timeOptions = Object.keys(TIME_CONTROLS).map(key => {
        const tc = TIME_CONTROLS[key];
        return `<button class="time-control-btn" data-key="${key}">${tc.label}</button>`;
    }).join('');

    Swal.fire({
        title: 'Choose Time Control',
        html: `<div class="grid grid-cols-2 gap-4 my-4">${timeOptions}</div>`,
        showConfirmButton: false,
        customClass: { popup: '!bg-bg-panel', title: '!text-white' },
        didOpen: () => {
            $('.time-control-btn').on('click', function() {
                const key = $(this).data('key');
                const tc = TIME_CONTROLS[key];
                timeControlSelector.val(key);
                timeControlSelector.trigger('change');
                Logger.info(`New game started with time control: ${tc.label}`);
                startNewGameWithTime(tc.base, tc.inc);
                Swal.close();
            });
            $('.time-control-btn').addClass('w-full px-4 py-3 font-bold rounded-lg shadow-md btn-secondary');
        }
    });
}

function showPromotionDialog(color) {
    Logger.info('Opening promotion dialog.');
    const pieceThemePath = PIECE_THEMES[pieceThemeSelector.val()];
    const pieces = ['q', 'r', 'b', 'n'];
    const promotion_choices_html = pieces.map(p => `<img src="${pieceThemePath.replace('{piece}', `${color}${p.toUpperCase()}`)}" data-piece="${p}" class="promotion-piece" />`).join('');
    Swal.fire({
        title: 'Promote to:', html: `<div class="flex justify-around">${promotion_choices_html}</div>`,
        showConfirmButton: false, allowOutsideClick: false, customClass: { popup: '!bg-stone-700', title: '!text-white' },
        willOpen: () => {
            $(Swal.getPopup()).on('click', '.promotion-piece', function() {
                if (pendingMove) {
                    pendingMove.promotion = $(this).data('piece');
                    Logger.info(`Piece promoted to ${pendingMove.promotion.toUpperCase()}`);
                    performMove(pendingMove);
                    pendingMove = null;
                    Swal.close();
                }
            });
        }
    });
}