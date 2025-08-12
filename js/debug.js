// ===================================================================================
//  DEBUG.JS
//  Handles the on-screen, draggable, and resizable debug log console.
// ===================================================================================

function initLogBox() {
    const logBoxContainer = $('#log-box-container');
    const logBoxContent = $('#log-box-content');
    const logBoxHeader = $('#log-box-header');
    const logBoxResizeHandle = $('#log-box-resize-handle');

    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn
    };

    const logToBox = (message, type) => {
        if (logBoxContainer.is(':hidden')) return;

        let content = '';
        const timestamp = `<span class="text-gray-500">${new Date().toLocaleTimeString()}:</span>`;
        let logClass = type;
        let prefix = '';
        let body = '';

        if (typeof message === 'object' && message !== null && message.logType) {
            logClass = `log-${message.logType}`;
            prefix = `<span class="log-prefix">[${message.logType.toUpperCase().replace('_', ' ')}]</span>`;

            switch (message.logType) {
                case 'analysis':
                    const info = CLASSIFICATION_DATA[message.classification] || {};
                    let detail = message.deep ? '(Deep)' : '';
                    if (message.hasOwnProperty('evalBefore')) {
                        detail += ` Eval: ${message.evalBefore} → ${message.evalAfter}`;
                    }
                    body = `Move <b>${message.move}</b> | CPL: ${message.cpl.toFixed(0)} | Class: <b class="${info.color || ''}">${message.classification}</b> ${detail}`;
                    break;
                case 'engine_move':
                    body = `Best move: <b>${message.move}</b> | Eval: ${message.eval}`;
                    break;
                case 'info':
                    body = message.text;
                    break;
                default:
                    body = JSON.stringify(message);
            }
            content = `${timestamp} ${prefix} ${body}`;
        } else {
            let formattedMessage = '';
            try {
                formattedMessage = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
            } catch (e) {
                formattedMessage = '[[Unserializable Object]]';
            }
            content = `${timestamp} ${formattedMessage}`;
        }

        logBoxContent.append(`<div class="log-message ${logClass}">${content}</div>`);
        logBoxContent.scrollTop(logBoxContent[0].scrollHeight);
    };

    console.log = function() { originalConsole.log.apply(console, arguments); logToBox(arguments[0], 'log-info'); };
    console.error = function() { originalConsole.error.apply(console, arguments); logToBox(arguments[0], 'log-error'); };
    console.warn = function() { originalConsole.warn.apply(console, arguments); logToBox(arguments[0], 'log-warn'); };

    // Event handlers for dragging and resizing
    let isDragging = false, isResizing = false;
    let offset = { x: 0, y: 0 };

    logBoxHeader.on('mousedown', function(e) {
        if ($(e.target).is('button') || $(e.target).parent().is('button')) return;
        isDragging = true;
        let containerOffset = logBoxContainer.offset();
        offset.x = e.clientX - containerOffset.left;
        offset.y = e.clientY - containerOffset.top;
    });

    logBoxResizeHandle.on('mousedown', function(e) {
        e.preventDefault();
        isResizing = true;
    });

    $(document).on('mousemove', function(e) {
        if (isDragging) {
            logBoxContainer.css({ top: e.clientY - offset.y, left: e.clientX - offset.x });
        }
        if (isResizing) {
            const containerOffset = logBoxContainer.offset();
            const newWidth = e.clientX - containerOffset.left;
            const newHeight = e.clientY - containerOffset.top;
            logBoxContainer.css({ width: `${newWidth}px`, height: `${newHeight}px` });
        }
    }).on('mouseup', () => {
        isDragging = false;
        isResizing = false;
    });
}