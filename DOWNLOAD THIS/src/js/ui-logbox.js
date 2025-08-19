// src/js/ui-logbox.js

// ===================================================================================
//  UI-LOGBOX.JS
//  Manages the entire interactive floating console log system.
// ===================================================================================

function initLogBox() {
    // --- Configuration ---
    const MAX_LOG_ENTRIES = 500; // Cap the number of log lines in the DOM for performance

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
    let advancedInfoInterval = null;

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

    // --- NEW: Core Rendering and Scrolling Engine ---
    
    function formatLogEntry(log) {
        const sanitizedMessage = $('<div/>').text(log.message).html().replace(/\n/g, '<br>');
        let dataHtml = '';
        if (logState.isVerbose && log.data && Object.keys(log.data).length > 0) {
            const formattedJson = JSON.stringify(log.data, null, 2);
            dataHtml = `<pre class="log-data-pre">${$('<div/>').text(formattedJson).html()}</pre>`;
        }
        return `<div class="log-message" data-log-id="${log.id}"><span class="log-prefix log-level-${log.level.toLowerCase()}">[${log.level}]</span><span class="log-text">${sanitizedMessage}</span>${dataHtml}</div>`;
    }

    function renderFullLog() {
        content.empty();
        const session = Logger.getLogs(Logger.getCurrentSessionId());
        if (!session) return;

        const filteredLogs = session.logs.filter(log => logState.visibleLevels[log.level]);
        const logsToRender = filteredLogs.slice(-MAX_LOG_ENTRIES); // Only render the last N entries
        
        content.html(logsToRender.map(formatLogEntry).join(''));
        
        if (logState.isAutoScroll) {
            content.scrollTop(content[0].scrollHeight);
        }
    }

    function appendNewLog(log) {
        if (!logState.visibleLevels[log.level]) return;

        const el = content[0];
        const isScrolledToBottom = el.scrollHeight - el.clientHeight <= el.scrollTop + 50;

        // Add the new log
        content.append(formatLogEntry(log));

        // Trim old logs if over the limit
        const childCount = content.children().length;
        if (childCount > MAX_LOG_ENTRIES) {
            content.children().slice(0, childCount - MAX_LOG_ENTRIES).remove();
        }

        // Auto-scroll if appropriate
        if (logState.isAutoScroll && isScrolledToBottom) {
            content.scrollTop(el.scrollHeight);
        }
    }

    // --- Advanced Features Logic ---
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
                $('#log-github-panel').html(`<img src="assets/icon/star.png" alt="GitHub"><span><b>GitHub:</b> N/A locally</span>`);
            } else if (!$('#log-github-panel').data('loaded')) {
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
        // New 5th stat for AI Difficulty
        $('#log-ai-panel').html(`<img src="assets/icon/academic-cap.png" alt="AI"><span><b>AI ELO:</b> ${eloDisplay.text()}</span>`);
    }
    
    function populateFilterMenu() {
        const levels = ["CRITICAL", "ERROR", "WARNING", "INFO", "ANALYSIS", "DEBUG"];
        controls.filterOptions.html(levels.map(level => `<label><input type="checkbox" data-level="${level}" ${logState.visibleLevels[level] ? 'checked' : ''}><span class="log-level-${level.toLowerCase()} capitalize ml-1">${level.toLowerCase()}</span></label>`).join(''));
    }

    window.toggleLogBox = function(show) {
        container.toggleClass('hidden', !show);
        if (show) {
            Logger.info('Floating debug log opened.');
            populateFilterMenu();
            renderFullLog();
            if (advancedInfoInterval) clearInterval(advancedInfoInterval);
            advancedInfoInterval = setInterval(updateStatsDrawer, 2000);
            updateStatsDrawer();
        } else {
            clearInterval(advancedInfoInterval);
        }
    };

    // --- Internal Event Listeners ---
    (function initialize() {
        controls.close.on('click', () => logBoxToggle.prop('checked', false).trigger('change'));
        controls.verbose.on('click', function() { playSound('uiToggle'); logState.isVerbose = !logState.isVerbose; $(this).toggleClass('active', logState.isVerbose); renderFullLog(); });
        controls.filterToggle.on('click', (e) => { e.stopPropagation(); playSound('uiToggle'); populateFilterMenu(); controls.filterMenu.toggleClass('hidden'); });
        controls.filterOptions.on('change', 'input', function() { logState.visibleLevels[$(this).data('level')] = this.checked; renderFullLog(); });
        controls.clear.on('click', () => { Logger.clearCurrentSession(); renderFullLog(); });
        controls.copy.on('click', () => { navigator.clipboard.writeText(Logger.getLogs(Logger.getCurrentSessionId()).logs.map(l => `[${l.level}] ${l.message}`).join('\n')); Logger.info('All session logs copied.'); });
        controls.statsToggle.on('click', () => { playSound('uiToggle'); statsDrawer.toggleClass('is-open'); if (statsDrawer.hasClass('is-open')) updateStatsDrawer(); });
        controls.scroll.on('click', function() { logState.isAutoScroll = !logState.isAutoScroll; $(this).toggleClass('active', logState.isAutoScroll); });
        
        $(document).on('newLogEntry', (event, logEntry) => {
            if (container.is(':visible')) {
                appendNewLog(logEntry);
            }
        });

        // Simplified interaction listeners
        header.on('mousedown', function(e) { if ($(e.target).closest('button, a, input, label').length === 0) { isDragging = true; dragOffset = { x: e.clientX - container.offset().left, y: e.clientY - container.offset().top }; container.addClass('dragging'); }});
        resizeHandle.on('mousedown', (e) => { e.preventDefault(); isResizing = true; });
        $(document).on('mousemove', function(e) { if (isDragging) { container.css({ top: e.clientY - dragOffset.y, left: e.clientX - dragOffset.x }); } if (isResizing) { container.css({ width: e.clientX - container.offset().left, height: e.clientY - container.offset().top }); }});
        $(document).on('mouseup', () => { if (isDragging) container.removeClass('dragging'); isDragging = false; isResizing = false; });
    })();
}