// src/js/ui-interactions.js

// ===================================================================================
//  UI-INTERACTIONS.JS
//  Manages core view switching and miscellaneous UI state.
// ===================================================================================

function showTab(tabId) {
    $('.tab-content').removeClass('active');
    $('.tab-button').removeClass('active');
    $(`#${tabId}-tab`).addClass('active');
    $(`[data-tab="${tabId}"]`).addClass('active');
}

function showLiveGameView() {
    liveGameView.removeClass('hidden');
    gameSummarySection.addClass('hidden');
}

function showGameOverView() {
    liveGameView.addClass('hidden');
    gameSummarySection.removeClass('hidden');
    runAnalysisBtn.prop('disabled', game.history().length === 0);
}

function switchToMainGame() {
    isAnalysisMode = false;
    analysisRoomView.addClass('hidden');
    mainGameView.removeClass('hidden');
    analysisVisualizer.addClass('hidden'); 
    
    if (window.AnalysisController && typeof window.AnalysisController.stop === 'function') {
        window.AnalysisController.stop();
    }
    
    if (window.loadFenOnReturn) {
        initGameFromFen(window.loadFenOnReturn);
        delete window.loadFenOnReturn;
    }
}

window.switchToAnalysisRoom = function() {
    isAnalysisMode = true;
    mainGameView.addClass('hidden');
    analysisVisualizer.addClass('hidden');
    analysisRoomView.removeClass('hidden').css('display', 'flex');
};

function updateGameSummary() {
    summaryAccuracy.find('div:first-child .font-bold').text('--%');
    summaryAccuracy.find('div:last-child .font-bold').text('--%');
}

function initConsoleTab() {
    const selectors = {
        display: $('#console-log-display'), sessionSelect: $('#log-session-selector'),
        searchInput: $('#log-search-input'), exportJsonBtn: $('#export-log-json'),
        exportTxtBtn: $('#export-log-txt'), clearBtn: $('#clear-current-log'), indicator: $('#log-indicator')
    };
    function renderLogsForSession(sessionId) {
        const session = Logger.getLogs(sessionId);
        if (!session) { selectors.display.html(''); return; }
        const searchTerm = selectors.searchInput.val().toLowerCase();
        const html = session.logs.filter(log => !searchTerm || log.message.toLowerCase().includes(searchTerm))
            .map(log => `<div class="log-entry">${log.time} <span class="log-level-${log.level.toLowerCase()}">[${log.level}]</span> ${$('<div/>').text(log.message).html()}</div>`)
            .join('');
        selectors.display.html(html).scrollTop(selectors.display[0].scrollHeight);
    }
    function populateSessionSelector() {
        const allSessions = Logger.getLogs();
        const currentSessionId = Logger.getCurrentSessionId();
        selectors.sessionSelect.empty().append(allSessions.reverse().map(session => {
            const date = new Date(session.startTime);
            const isCurrent = session.id === currentSessionId;
            return `<option value="${session.id}" ${isCurrent ? 'selected' : ''}>${date.toLocaleDateString()} ${date.toLocaleTimeString()} ${isCurrent ? '(Current)' : ''}</option>`;
        }).join(''));
        renderLogsForSession(selectors.sessionSelect.val());
    }
    selectors.sessionSelect.on('change', () => renderLogsForSession(selectors.sessionSelect.val()));
    selectors.searchInput.on('input', () => renderLogsForSession(selectors.sessionSelect.val()));
    selectors.exportJsonBtn.on('click', () => Logger.exportLogs('json'));
    selectors.exportTxtBtn.on('click', () => Logger.exportLogs('txt'));
    selectors.clearBtn.on('click', () => { Logger.clearCurrentSession(); populateSessionSelector(); });
    $(document).on('newLogEntry', () => { if(selectors.sessionSelect.val() === Logger.getCurrentSessionId()) renderLogsForSession(Logger.getCurrentSessionId()); });
    $(document).on('newGameStarted', populateSessionSelector);
    populateSessionSelector();
}

function initCollapsiblePanels() {
    const panels = $('details.summary-panel');
    panels.each(function() {
        const panelId = $(this).attr('id');
        if (panelId) {
            const savedState = localStorage.getItem(`panel-state-${panelId}`);
            if (savedState) $(this).prop('open', savedState === 'true');
        }
    });
    panels.on('toggle', function() {
        const panelId = $(this).attr('id');
        if (panelId) localStorage.setItem(`panel-state-${panelId}`, $(this).prop('open'));
    });
}