// src/js/ui-logbox.js

// ===================================================================================
//  UI-LOGBOX.JS
//  Manages the entire interactive floating console log system.
// ===================================================================================

function initLogBox() {
    // --- Configuration & State ---
    const STORAGE_KEY = 'chessLogBoxState';
    const MAX_LOG_ENTRIES = 500;
    const logState = {
        isVerbose: false, isAutoScroll: true, fontSize: 14, isComfortableSpacing: false,
        isMinimized: false, isWidgetMode: false, isStatsDrawerOpen: false,
        lastPosition: { top: '25%', left: '25%' },
        lastSize: { width: '50%', height: '50%' },
        visibleLevels: { CRITICAL: true, ERROR: true, WARNING: true, INFO: true, ANALYSIS: true, DEBUG: true }
    };

    // --- Elements ---
    const container = $('#log-box-container');
    const header = $('#log-box-header');
    const content = $('#log-box-content');
    const resizeHandle = $('#log-box-resize-handle');
    const statsDrawer = $('#log-stats-drawer');
    const controls = {
        toggle: $('#log-box-toggle'), close: $('#log-box-close'), scroll: $('#log-box-scroll-toggle'), 
        spacing: $('#log-spacing-toggle'), fontDec: $('#log-font-dec'), fontInc: $('#log-font-inc'),
        colorize: $('#log-box-colorize-btn'), copy: $('#log-box-copy'), verbose: $('#log-box-verbose-toggle'), 
        filterToggle: $('#log-filter-toggle'), filterMenu: $('#log-filter-menu'), filterOptions: $('#log-filter-options'),
        minimize: $('#log-box-minimize-toggle'), popout: $('#log-box-popout-toggle'),
        widgetRestore: $('#log-box-widget-restore'), clear: $('#log-box-clear'), resetSize: $('#log-box-reset-size'),
        statsToggle: $('#log-box-stats-toggle')
    };

    let isDragging = false, isResizing = false;
    let dragOffset = { x: 0, y: 0 };
    let advancedInfoInterval = null;
    let frameCount = 0, lastFPSTime = performance.now(), currentFPS = 0;

    // --- Core Logic ---

    function _saveState() {
        if (isDragging || isResizing) return;
        if (!logState.isWidgetMode) {
            logState.lastPosition = { top: container.css('top'), left: container.css('left') };
            logState.lastSize = { width: container.css('width'), height: container.css('height') };
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logState));
    }

    function _loadState() {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (!saved) return;
        Object.assign(logState, saved);

        // Apply loaded state to the UI
        container.css({ top: logState.lastPosition.top, left: logState.lastPosition.left, width: logState.lastSize.width, height: logState.lastSize.height });
        content.css('font-size', `${logState.fontSize}px`);
        controls.verbose.toggleClass('active', logState.isVerbose);
        controls.scroll.toggleClass('active', logState.isAutoScroll);
        controls.spacing.toggleClass('active', logState.isComfortableSpacing);
        content.toggleClass('comfortable-spacing', logState.isComfortableSpacing);
        statsDrawer.toggleClass('is-open', logState.isStatsDrawerOpen);
        controls.statsToggle.toggleClass('active', logState.isStatsDrawerOpen);

        if (logState.isWidgetMode) _enterWidgetMode(true);
        else if (logState.isMinimized) _minimize(true);
    }

    function _updateContainerClasses() {
        container.toggleClass('minimized', logState.isMinimized && !logState.isWidgetMode);
        container.toggleClass('widget-mode', logState.isWidgetMode);
        controls.minimize.find('.icon-minimize').toggleClass('hidden', logState.isMinimized);
        controls.minimize.find('.icon-maximize').toggleClass('hidden', !logState.isMinimized);
    }

    function _minimize(force = false) {
        if (!force) logState.isMinimized = !logState.isMinimized;
        _updateContainerClasses();
        _saveState();
    }

    function _enterWidgetMode(force = false) {
        if (!force) logState.isWidgetMode = true;
        container.css({ top: '', left: '', width: '', height: '' }); // Reset to CSS defaults
        _updateContainerClasses();
        _saveState();
    }

    function _exitWidgetMode() {
        logState.isWidgetMode = false;
        container.css({ top: logState.lastPosition.top, left: logState.lastPosition.left, width: logState.lastSize.width, height: logState.lastSize.height });
        _updateContainerClasses();
        _saveState();
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

    function renderFullLog() {
        content.empty();
        const session = Logger.getLogs(Logger.getCurrentSessionId());
        if (!session) return;
        const filteredLogs = session.logs.filter(log => logState.visibleLevels[log.level]);
        const logsToRender = filteredLogs.slice(-MAX_LOG_ENTRIES);
        content.html(logsToRender.map(formatLogEntry).join(''));
        if (logState.isAutoScroll) content.scrollTop(content[0].scrollHeight);
    }
    
    // --- NEW: All event listeners are now implemented ---
    function initializeEventListeners() {
        controls.close.on('click', () => controls.toggle.prop('checked', false).trigger('change'));
        controls.clear.on('click', () => { Logger.clearCurrentSession(); renderFullLog(); });
        controls.copy.on('click', () => { navigator.clipboard.writeText(content.text()); Logger.info('Filtered logs copied to clipboard.'); });
        
        controls.scroll.on('click', function() { logState.isAutoScroll = !logState.isAutoScroll; $(this).toggleClass('active', logState.isAutoScroll); _saveState(); });
        controls.verbose.on('click', function() { logState.isVerbose = !logState.isVerbose; $(this).toggleClass('active', logState.isVerbose); renderFullLog(); _saveState(); });
        controls.spacing.on('click', function() { logState.isComfortableSpacing = !logState.isComfortableSpacing; $(this).toggleClass('active'); content.toggleClass('comfortable-spacing'); _saveState(); });
        
        controls.fontInc.on('click', () => { logState.fontSize = Math.min(20, logState.fontSize + 1); content.css('font-size', `${logState.fontSize}px`); _saveState(); });
        controls.fontDec.on('click', () => { logState.fontSize = Math.max(10, logState.fontSize - 1); content.css('font-size', `${logState.fontSize}px`); _saveState(); });

        controls.colorize.on('click', () => {
            const colors = ['#0891b2', '#6d28d9', '#be185d', '#059669', '#b45309'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            header.css('background-color', randomColor);
        });
        
        controls.statsToggle.on('click', function() {
            logState.isStatsDrawerOpen = !logState.isStatsDrawerOpen;
            $(this).toggleClass('active');
            statsDrawer.toggleClass('is-open');
            if (logState.isStatsDrawerOpen) updateStatsDrawer();
             _saveState();
        });

        controls.minimize.on('click', () => _minimize());
        controls.popout.on('click', () => _enterWidgetMode());
        controls.widgetRestore.on('click', () => _exitWidgetMode());
        header.on('dblclick', (e) => { if ($(e.target).closest('button').length === 0) _enterWidgetMode(); });

        controls.resetSize.on('click', () => {
            logState.lastPosition = { top: '25%', left: '25%' };
            logState.lastSize = { width: '50%', height: '50%' };
            container.css(logState.lastPosition).css(logState.lastSize);
            _saveState();
        });

        controls.filterToggle.on('click', (e) => { e.stopPropagation(); controls.filterMenu.toggleClass('hidden'); });
        controls.filterOptions.on('change', 'input', function() {
            const level = $(this).data('level');
            logState.visibleLevels[level] = this.checked;
            renderFullLog();
            _saveState();
        });

        header.on('mousedown', (e) => {
            if ($(e.target).closest('button, a, input, label').length > 0) return;
            isDragging = true;
            dragOffset = { x: e.clientX - container.offset().left, y: e.clientY - container.offset().top };
            container.addClass('dragging');
            $('body').css('user-select', 'none');
        });

        resizeHandle.on('mousedown', (e) => { e.preventDefault(); isResizing = true; $('body').css('user-select', 'none'); });
        
        $(document).on('mousemove', (e) => {
            if (isDragging) container.css({ top: e.clientY - dragOffset.y, left: e.clientX - dragOffset.x });
            if (isResizing) container.css({ width: e.clientX - container.offset().left, height: e.clientY - container.offset().top });
        }).on('mouseup', () => {
            if (isDragging || isResizing) {
                container.removeClass('dragging');
                $('body').css('user-select', '');
                isDragging = false; isResizing = false;
                _saveState();
            }
        }).on('click', (e) => {
            if (!controls.filterMenu.hasClass('hidden') && !$(e.target).closest('#log-filter-menu, #log-filter-toggle').length) {
                controls.filterMenu.addClass('hidden');
            }
        }).on('keydown', (e) => {
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'v') controls.verbose.click();
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'r') controls.resetSize.click();
        });

        $(document).on('newLogEntry', (event, logEntry) => { if (container.is(':visible')) appendNewLog(logEntry); });
    }
    
    // --- Public and Initialization ---

    window.toggleLogBox = function(show) {
        container.toggleClass('hidden', !show);
        if (show) {
            Logger.info('Floating debug log opened.');
            populateFilterMenu(); renderFullLog();
            if (advancedInfoInterval) clearInterval(advancedInfoInterval);
            advancedInfoInterval = setInterval(updateStatsDrawer, 2000);
            updateStatsDrawer();
        } else {
            clearInterval(advancedInfoInterval);
        }
    };
    
    // --- Helper functions for rendering, stats, etc. ---
    
    function appendNewLog(log) {
        if (!logState.visibleLevels[log.level]) return;
        const el = content[0];
        const isScrolledToBottom = el.scrollHeight - el.clientHeight <= el.scrollTop + 50;
        content.append(formatLogEntry(log));
        if (content.children().length > MAX_LOG_ENTRIES) {
            content.children().slice(0, content.children().length - MAX_LOG_ENTRIES).remove();
        }
        if (logState.isAutoScroll && isScrolledToBottom) {
            content.scrollTop(el.scrollHeight);
        }
    }

    function populateFilterMenu() {
        controls.filterOptions.html(Object.keys(logState.visibleLevels).map(level => 
            `<label><input type="checkbox" data-level="${level}" ${logState.visibleLevels[level] ? 'checked' : ''}>
            <span class="log-level-${level.toLowerCase()} capitalize ml-1">${level.toLowerCase()}</span></label>`
        ).join(''));
    }

    function fpsLoop() {
        frameCount++;
        if (performance.now() - lastFPSTime >= 1000) {
            currentFPS = frameCount; frameCount = 0; lastFPSTime = performance.now();
        }
        requestAnimationFrame(fpsLoop);
    }

    async function updateStatsDrawer() {
        const session = Logger.getLogs(Logger.getCurrentSessionId());
        $('#log-fps-panel').html(`<img src="assets/icon/bars-4.png" alt="FPS"><span><b>FPS:</b> ${currentFPS}</span>`);
        if (performance.memory) $('#log-memory-panel').html(`<img src="assets/icon/chip.png" alt="Memory"><span><b>Heap:</b> ${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)}MB</span>`);
        if (session) $('#log-session-panel').html(`<img src="assets/icon/document-text.png" alt="Session"><span><b>Logs:</b> ${session.logs.length} | <b>Up:</b> ${Math.floor((new Date() - new Date(session.startTime)) / 1000)}s</span>`);
        $('#log-ai-panel').html(`<img src="assets/icon/academic-cap.png" alt="AI"><span><b>AI ELO:</b> ${eloDisplay.text()}</span>`);
    }

    // --- INITIALIZE THE MODULE ---
    _loadState();
    initializeEventListeners();
    requestAnimationFrame(fpsLoop);
}