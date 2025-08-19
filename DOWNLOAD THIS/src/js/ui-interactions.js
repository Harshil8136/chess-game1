// src/js/ui-interactions.js

// ===================================================================================
//  UI-INTERACTIONS.JS
//  Manages interactive components like modals, sounds, the log box, and view switching.
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

window.switchToAnalysisRoom = function() {
    isAnalysisMode = true;
    mainGameView.addClass('hidden');
    analysisVisualizer.addClass('hidden');
    analysisRoomView.removeClass('hidden').css('display', 'flex');
};

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

function updateGameSummary() {
    summaryAccuracy.find('div:first-child .font-bold').text('--%');
    summaryAccuracy.find('div:last-child .font-bold').text('--%');
}

function initLogBox() {
    // --- Elements ---
    const container = $('#log-box-container');
    const header = $('#log-box-header');
    const content = $('#log-box-content');
    const resizeHandle = $('#log-box-resize-handle');
    const statsDrawer = $('#log-stats-drawer');
    const controls = {
        toggle: $('#log-box-toggle'), close: $('#log-box-close'),
        scroll: $('#log-box-scroll-toggle'), spacing: $('#log-spacing-toggle'),
        fontDec: $('#log-font-dec'), fontInc: $('#log-font-inc'),
        colorize: $('#log-box-colorize-btn'), copy: $('#log-box-copy'),
        verbose: $('#log-box-verbose-toggle'), filterToggle: $('#log-filter-toggle'),
        filterMenu: $('#log-filter-menu'), filterOptions: $('#log-filter-options'),
        minimize: $('#log-box-minimize-toggle'), popout: $('#log-box-popout-toggle'),
        widgetRestore: $('#log-box-widget-restore'), clear: $('#log-box-clear'),
        resetSize: $('#log-box-reset-size'),
        statsToggle: $('#log-box-stats-toggle')
    };

    // --- State ---
    const logState = {
        isVerbose: false, isAutoScroll: true, fontSize: 14, isMinimized: false,
        lastSize: { width: '50vw', height: '50vh' },
        visibleLevels: { CRITICAL: true, ERROR: true, WARNING: true, INFO: true, ANALYSIS: true, DEBUG: true }
    };
    let isDragging = false, isResizing = false;
    let dragOffset = { x: 0, y: 0 };
    let lastFilteredLogs = [];
    let scrollTimeout = null;
    let advancedInfoInterval = null;
    let isProgrammaticScroll = false;

    // --- FPS Counter ---
    let frameCount = 0;
    let lastFPSTime = performance.now();
    let currentFPS = 0;
    function fpsLoop() {
        frameCount++;
        if (performance.now() - lastFPSTime >= 1000) {
            currentFPS = frameCount;
            frameCount = 0;
            lastFPSTime = performance.now();
        }
        requestAnimationFrame(fpsLoop);
    }
    requestAnimationFrame(fpsLoop);

    // --- Log Virtualization ---
    const VIRTUAL_ROW_HEIGHT = 22;
    function renderVisibleLogs() {
        const session = Logger.getLogs(Logger.getCurrentSessionId());
        if (!session) { content.html(''); return; }
        lastFilteredLogs = session.logs.filter(log => logState.visibleLevels[log.level]);
        const scrollTop = content.scrollTop();
        const containerHeight = content.height();
        const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - 10);
        const endIndex = Math.min(lastFilteredLogs.length, startIndex + Math.ceil(containerHeight / VIRTUAL_ROW_HEIGHT) + 20);
        content.html(
            `<div style="height: ${startIndex * VIRTUAL_ROW_HEIGHT}px;"></div>` +
            lastFilteredLogs.slice(startIndex, endIndex).map(formatLogEntry).join('') +
            `<div style="height: ${(lastFilteredLogs.length - endIndex) * VIRTUAL_ROW_HEIGHT}px;"></div>`
        );
    }
    
    function formatLogEntry(log) {
        const sanitizedMessage = $('<div/>').text(log.message).html().replace(/\n/g, '<br>');
        let dataHtml = '';
        if (logState.isVerbose && log.data && Object.keys(log.data).length > 0) {
            const formattedJson = JSON.stringify(log.data, null, 2);
            dataHtml = `<pre class="log-data-pre">${$('<div/>').text(formattedJson).html()}</pre>`;
        }
        return `<div class="log-message" data-log-id="${log.id}"><span class="log-prefix log-level-${log.level.toLowerCase()}">[${log.level}]</span><span class="log-text">${sanitizedMessage}</span>${dataHtml}</div>`;
    }

    // UPDATED: Logic to populate stats drawer is now more robust to fix the empty 4th column
    async function updateStatsDrawer() {
        const session = Logger.getLogs(Logger.getCurrentSessionId());
        $('#log-fps-panel').html(`<img src="assets/icon/bars-4.png" alt="FPS"><span><b>FPS:</b> ${currentFPS}</span>`);
        if (performance.memory) {
            const mem = performance.memory;
            $('#log-memory-panel').html(`<img src="assets/icon/chip.png" alt="Memory"><span><b>Heap:</b> ${(mem.usedJSHeapSize / 1048576).toFixed(1)}MB</span>`);
        }
        if (session) {
             const duration = Math.floor((new Date() - new Date(session.startTime)) / 1000);
            $('#log-session-panel').html(`<img src="assets/icon/document-text.png" alt="Session"><span><b>Logs:</b> ${session.logs.length} | <b>Up:</b> ${duration}s</span>`);
        }
        
        if (ADVANCED_FEATURES_CONFIG.enableGitHubIntegration) {
            if (window.location.protocol === 'file:') {
                // Always show the 'N/A' message if running locally
                $('#log-github-panel').html(`<img src="assets/icon/star.png" alt="GitHub"><span><b>GitHub:</b> N/A locally</span>`);
            } else if (!$('#log-github-panel').data('loaded')) {
                // Only fetch from the API once if hosted online
                try {
                    const repo = ADVANCED_FEATURES_CONFIG.gitHubRepo;
                    const response = await fetch(`https://api.github.com/repos/${repo}`);
                    if (!response.ok) throw new Error('Repo not found');
                    const data = await response.json();
                    $('#log-github-panel').html(`<img src="assets/icon/star.png" alt="GitHub Stars"><a href="${data.html_url}" target="_blank" class="flex items-center gap-2"><span><b>${data.stargazers_count}</b> Stars</span></a>`);
                } catch (error) { 
                    Logger.warn('Failed to fetch GitHub repo info', { e: error.message });
                    $('#log-github-panel').html(`<img src="assets/icon/star.png" alt="GitHub"><span>GitHub: Error</span>`);
                }
                $('#log-github-panel').data('loaded', true);
            }
        }
    }

    // --- UI Logic & Event Listeners ---
    function resetPanelSize() {
        const newWidth = $(window).width() * 0.5;
        const newHeight = $(window).height() * 0.5;
        container.removeClass('minimized');
        container.css({
            width: `${newWidth}px`, height: `${newHeight}px`,
            top: `${($(window).height() - newHeight) / 2}px`,
            left: `${($(window).width() - newWidth) / 2}px`,
            transition: 'all 0.3s ease'
        });
        setTimeout(() => container.css('transition', 'none'), 300);
        renderVisibleLogs();
    }
    
    // --- Full Initialization ---
    (function initialize() {
        controls.toggle.on('change', function() {
            container.toggleClass('hidden', !this.checked);
            if (this.checked) {
                Logger.info('Floating debug log opened.');
                populateFilterMenu(); renderVisibleLogs();
                if (advancedInfoInterval) clearInterval(advancedInfoInterval);
                advancedInfoInterval = setInterval(updateStatsDrawer, 2000);
                updateStatsDrawer();
            } else { clearInterval(advancedInfoInterval); }
        });

        controls.close.on('click', () => controls.toggle.prop('checked', false).trigger('change'));
        controls.verbose.on('click', function() { playSound('uiToggle'); logState.isVerbose = !logState.isVerbose; $(this).toggleClass('active', logState.isVerbose); renderVisibleLogs(); });
        
        controls.filterToggle.on('click', (e) => { 
            e.stopPropagation(); 
            playSound('uiToggle');
            populateFilterMenu();
            controls.filterMenu.toggleClass('hidden'); 
        });

        controls.filterOptions.on('change', 'input', function() { logState.visibleLevels[$(this).data('level')] = this.checked; renderVisibleLogs(); });
        controls.clear.on('click', () => { Logger.clearCurrentSession(); renderVisibleLogs(); });
        controls.copy.on('click', () => { navigator.clipboard.writeText(lastFilteredLogs.map(l => `[${l.level}] ${l.message}`).join('\n')); Logger.info('Filtered logs copied.'); });
        controls.resetSize.on('click', resetPanelSize);

        controls.statsToggle.on('click', () => { 
            playSound('uiToggle'); 
            statsDrawer.toggleClass('is-open');
            if (statsDrawer.hasClass('is-open')) {
                updateStatsDrawer();
            }
        });

        controls.scroll.on('click', function() { logState.isAutoScroll = !logState.isAutoScroll; $(this).toggleClass('active', logState.isAutoScroll); });
        controls.spacing.on('click', function() { $(this).toggleClass('active'); content.toggleClass('comfortable-spacing'); });
        controls.fontInc.on('click', () => { logState.fontSize++; content.css('font-size', `${logState.fontSize}px`); });
        controls.fontDec.on('click', () => { logState.fontSize = Math.max(10, logState.fontSize - 1); content.css('font-size', `${logState.fontSize}px`); });
        controls.colorize.on('click', () => header.css('background-color', ['#1a2e24', '#0a2342', '#2d182e', '#4a1d1d', '#1e293b'][Math.floor(Math.random() * 5)]));
        
        controls.minimize.on('click', function() {
            if (!logState.isMinimized) logState.lastSize = { width: container.css('width'), height: container.css('height') };
            logState.isMinimized = !logState.isMinimized;
            container.toggleClass('minimized', logState.isMinimized);
            if (logState.isMinimized) container.css({ width: 'auto', height: 'auto' }); else container.css(logState.lastSize);
            $(this).find('.icon-minimize').toggleClass('hidden', logState.isMinimized);
            $(this).find('.icon-maximize').toggleClass('hidden', !logState.isMinimized);
        });

        header.on('mousedown', function(e) { if ($(e.target).closest('button, a, input, label').length) return; isDragging = true; dragOffset = { x: e.clientX - container.offset().left, y: e.clientY - container.offset().top }; container.addClass('dragging'); });
        resizeHandle.on('mousedown', (e) => { e.preventDefault(); isResizing = true; });
        $(document).on('mousemove', function(e) { if (isDragging) container.css({ top: e.clientY - dragOffset.y, left: e.clientX - dragOffset.x }); if (isResizing) container.css({ width: e.clientX - container.offset().left, height: e.clientY - container.offset().top }); }).on('mouseup', () => { if (isDragging) container.removeClass('dragging'); if (isResizing) renderVisibleLogs(); isDragging = false; isResizing = false; });
        
        header.on('dblclick', (e) => { if ($(e.target).closest('button, a, input, label').length) return; container.toggleClass('widget-mode'); playSound('uiToggle'); });
        controls.widgetRestore.on('dblclick', (e) => { e.stopPropagation(); container.removeClass('widget-mode'); playSound('uiToggle'); });
        
        $(document).on('click', (e) => { if (!controls.filterMenu.is(e.target) && controls.filterMenu.has(e.target).length === 0 && !controls.filterToggle.is(e.target)) controls.filterMenu.addClass('hidden'); });
        
        $(document).on('newLogEntry', (event, logEntry) => {
            if (container.is(':hidden')) return;
            
            const el = content[0];
            const isScrolledToBottom = el.scrollHeight - el.clientHeight <= el.scrollTop + 50; // 50px buffer

            if (logState.visibleLevels[logEntry.level]) {
                renderVisibleLogs();
                if (logState.isAutoScroll && isScrolledToBottom) {
                    content.scrollTop(el.scrollHeight);
                }
            }
        });
        
        content.on('scroll', () => { 
            if (isProgrammaticScroll) {
                isProgrammaticScroll = false;
                return;
            }
            if (scrollTimeout) clearTimeout(scrollTimeout); 
            scrollTimeout = setTimeout(renderVisibleLogs, 50); 
        });
        
        function populateFilterMenu() {
            const levels = ["CRITICAL", "ERROR", "WARNING", "INFO", "ANALYSIS", "DEBUG"];
            controls.filterOptions.html(levels.map(level => `<label><input type="checkbox" data-level="${level}" ${logState.visibleLevels[level] ? 'checked' : ''}>${level}</label>`).join(''));
        }
    })();
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