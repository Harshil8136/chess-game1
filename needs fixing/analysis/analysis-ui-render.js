// ===================================================================================
//  ANALYSIS-UI-RENDER.JS
//  Renders all analysis UI components (chart, move list, etc.).
// ===================================================================================

(function(controller) {
    if (!controller) {
        console.error("Analysis Controller must be initialized before loading UI components.");
        return;
    }

    const uiRenderMethods = {
        updateMoveInUI: function(moveIndex, state = {}) {
            const moveItem = this.moveListElement.find(`.analysis-move-item[data-move-index="${moveIndex}"]`);
            const button = moveItem.find('.deep-analysis-btn');

            if (state.isAnalyzing) {
                button.text('...').prop('disabled', true);
                // Use a placeholder or spinner class, assuming one is defined in CSS
                moveItem.find('.classification-icon').html('...').removeClass().addClass('classification-icon pending');
            } else {
                const review = this.reviewData[moveIndex];
                const info = CLASSIFICATION_DATA[review.classification];
                moveItem.find('.classification-icon').html(info.icon).attr('class', `classification-icon font-bold text-lg w-6 text-center ${info.color}`);
                moveItem.attr('title', info.title);
                button.text('Deep').prop('disabled', false);
                
                if (state.hasError) {
                    button.text('Error');
                }
                
                // Flash a color to indicate the update
                moveItem.css('transition', 'background-color 0.5s ease')
                        .css('background-color', 'var(--text-accent)');
                setTimeout(() => {
                    if (!moveItem.hasClass('current-move-analysis')) {
                        moveItem.css('background-color', '');
                    }
                }, 1000);
            }
        },

        renderReviewedMoveList: function() {
            if (!this.moveListElement) return;
            let html = '';
            for (let i = 0; i < this.gameHistory.length; i++) {
                const moveNum = Math.floor(i / 2) + 1;
                const move = this.gameHistory[i];
                const review = this.reviewData[i];
                if (!review) continue;
                const info = CLASSIFICATION_DATA[review.classification];
                
                html += `<div class="analysis-move-item flex items-center justify-between gap-3" data-move-index="${i}" title="${info.title}">`;
                html += `<div class="flex items-center gap-3 flex-grow">`;
                if (move.color === 'w') {
                    html += `<span class="w-8 text-right font-bold text-dark">${moveNum}.</span>`;
                } else {
                    html += `<span class="w-8"></span>`;
                }
                html += `<span class="flex-grow font-mono">${move.san}</span>`;
                html += `<span class="classification-icon font-bold text-lg w-6 text-center ${info.color}">${info.icon}</span>`;
                html += `</div>`;
                html += `<button class="deep-analysis-btn text-xs px-2 py-0.5 rounded btn-secondary flex-shrink-0" data-move-index="${i}">Deep</button>`;
                html += `</div>`;
            }
            this.moveListElement.html(html);
        },

        renderReviewSummary: function() {
            this.whiteAccuracyElement.text(this.accuracy.w + '%');
            this.blackAccuracyElement.text(this.accuracy.b + '%');
            let countsHtml = '';
            const displayOrder = ['Brilliant', 'Great', 'Best', 'Miss', 'Blunder', 'Mistake', 'Inaccuracy'];
            
            displayOrder.forEach(key => {
                const w_count = this.moveCounts.w[key] || 0;
                const b_count = this.moveCounts.b[key] || 0;
                if (w_count > 0 || b_count > 0) {
                    const info = CLASSIFICATION_DATA[key];
                    countsHtml += `<div class="text-right">${w_count}</div><div class="text-center font-bold ${info.color}" title="${info.title}">${info.icon} ${key}</div><div class="text-left">${b_count}</div>`;
                }
            });
            this.moveCountsContainer.html(countsHtml);
            this.reviewSummaryContainer.removeClass('hidden');
            this.renderGameSummaryAccuracies();
        },
        
        renderGameSummaryAccuracies: function() {
            // Update the accuracy on the main game tab as well
            if (summaryAccuracy) {
                summaryAccuracy.find('div:first-child .font-bold').text(this.accuracy.w + '%');
                summaryAccuracy.find('div:last-child .font-bold').text(this.accuracy.b + '%');
            }
        },

        renderFinalReview: function() {
            this.renderReviewSummary();
            this.renderReviewedMoveList();
            this.drawEvalChart();
            this.navigateToMove(0);
        },
        
        navigateToMove: function(moveIndex) {
            if (moveIndex < -1 || moveIndex >= this.gameHistory.length) return;
            
            this.currentMoveIndex = moveIndex;
            let tempGame = new Chess(this.startingFen);
            for (let i = 0; i <= moveIndex; i++) tempGame.move(this.gameHistory[i]);
            if (this.analysisBoard) this.analysisBoard.position(tempGame.fen());
            
            this.moveListElement.find('.current-move-analysis').removeClass('current-move-analysis').css('background-color', '');
            if(moveIndex > -1) {
                const moveItem = this.moveListElement.find(`[data-move-index="${moveIndex}"]`);
                moveItem.addClass('current-move-analysis');
                
                // Scroll the move into view
                const container = this.moveListElement;
                if(container[0] && moveItem[0]) {
                    const containerRect = container[0].getBoundingClientRect();
                    const itemRect = moveItem[0].getBoundingClientRect();
                    if (itemRect.top < containerRect.top || itemRect.bottom > containerRect.bottom) {
                        moveItem[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }
            
            this.showMoveAssessmentDetails(moveIndex);
            this.redrawUserShapes();
        },

        showMoveAssessmentDetails: function(moveIndex) {
            if(moveIndex < 0) {
                 this.assessmentDetailsElement.addClass('hidden');
                 return;
            }
            const data = this.reviewData[moveIndex];
            if (!data) return;
            const info = CLASSIFICATION_DATA[data.classification];
            if (info) {
                this.assessmentTitleElement.text(info.title).attr('class', `text-lg font-bold ${info.color}`);
                this.assessmentCommentElement.text(info.comment);
                this.assessmentDetailsElement.removeClass('hidden');
                
                const isBadMove = data.classification === 'Mistake' || data.classification === 'Blunder';
                this.retryMistakeBtn.toggleClass('hidden', !isBadMove);

                if (data.bestLineUci && ['Mistake', 'Blunder', 'Inaccuracy', 'Miss'].includes(data.classification)) {
                    let tempGame = new Chess(this.startingFen);
                    for(let i=0; i < moveIndex; i++) tempGame.move(this.gameHistory[i]);
                    const sanLine = this.uciToSanLine(tempGame.fen(), data.bestLineUci);
                    this.bestLineMoves.text(sanLine);
                    this.bestLineDisplay.removeClass('hidden');
                } else {
                    this.bestLineDisplay.addClass('hidden');
                }
            }
        },
        
        drawEvalChart: function() {
            if (!this.evalChartCanvas || !this.evalChartCanvas.length) return;
            try {
                if (this.evalChart) this.evalChart.destroy();
                const labels = ['Start'];
                const data = [20]; // Start with a slight edge for white
                this.reviewData.forEach((item, index) => {
                    const moveNum = Math.floor(index / 2) + 1;
                    const isWhite = index % 2 === 0;
                    labels.push(`${moveNum}${isWhite ? '.' : '...'} ${item.move}`);
                    data.push(item.score);
                });
                const ctx = this.evalChartCanvas[0].getContext('2d');
                this.evalChart = new Chart(ctx, {
                    type: 'line', data: { labels, datasets: [{
                        label: 'Position Evaluation', data, borderColor: 'rgba(200, 200, 200, 0.8)',
                        backgroundColor: (context) => {
                            const {ctx, chartArea} = context.chart;
                            if (!chartArea) return;
                            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                            gradient.addColorStop(0.5, 'rgba(100, 100, 100, 0.2)');
                            gradient.addColorStop(0.51, 'rgba(255, 255, 255, 0.3)');
                            gradient.addColorStop(0.49, 'rgba(0, 0, 0, 0.3)');
                            return gradient;
                        },
                        fill: { target: 'origin', above: 'rgba(255, 255, 255, 0.1)', below: 'rgba(0, 0, 0, 0.1)' },
                        borderWidth: 2, pointRadius: 1, pointHoverRadius: 4, tension: 0.1
                    }]},
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        scales: {
                            y: { suggestedMin: -500, suggestedMax: 500, grid: { color: 'rgba(255,255,255,0.1)', zeroLineColor: 'rgba(255,255,255,0.4)' }, ticks: { color: 'var(--text-dark)', callback: (v) => (v / 100).toFixed(1) } },
                            x: { display: false }
                        },
                        plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, backgroundColor: 'rgba(0,0,0,0.8)', titleColor: 'white', bodyColor: 'white' } },
                        interaction: { mode: 'index', intersect: false }
                    }
                });
            } catch (error) { console.error('Error creating evaluation chart:', error); }
        },
        
        applyTheme: function() {
            try {
                const themeName = localStorage.getItem('chessBoardTheme') || 'green';
                const selectedTheme = THEMES && THEMES.find ? THEMES.find(t => t.name === themeName) : null;
                if (selectedTheme) {
                    document.documentElement.style.setProperty('--light-square-color', selectedTheme.colors.light);
                    document.documentElement.style.setProperty('--dark-square-color', selectedTheme.colors.dark);
                }
            } catch (error) { console.warn('Error applying theme:', error); }
        },

        renderCoordinates: function() {
            // Re-use the global renderCoordinates function, specifying the 'analysis' target
            if (this.analysisBoard) {
                renderCoordinates(this.analysisBoard.orientation(), 'analysis');
            }
        },

        clearUserShapes: function() {
            this.userShapes = [];
            this.redrawUserShapes();
        },

        redrawUserShapes: function() {
            if (!this.analysisBoardSvgOverlay) return;
            this.analysisBoardSvgOverlay.empty();
            if (this.analysisBoardElement) {
                this.analysisBoardElement.find('.square-55d63').removeClass('highlight-user-green highlight-user-red highlight-user-yellow highlight-user-blue');
            }
            
            if (!this.analysisBoard || this.currentMoveIndex < 0) return;
            
            const data = this.reviewData[this.currentMoveIndex];
            const move = this.gameHistory[this.currentMoveIndex];
            if (data && move) {
                // Draw arrow for the move that was actually played
                this.drawArrow(move.from, move.to, 'rgba(59, 130, 246, 0.7)');
                
                // If it was a mistake/blunder, draw the arrow for the best move
                if (data.bestLineUci && ['Mistake', 'Blunder', 'Inaccuracy', 'Miss'].includes(data.classification)) {
                    const bestMoveUci = data.bestLineUci.split(' ')[0];
                    const from = bestMoveUci.substring(0, 2);
                    const to = bestMoveUci.substring(2, 4);
                    if (from !== move.from || to !== move.to) {
                        this.drawArrow(from, to, 'rgba(22, 163, 74, 0.7)'); // Green for best move
                    }
                }
            }
            
            this.userShapes.forEach(shape => {
                if (shape.type === 'highlight') {
                    this.analysisBoardElement.find(`.square-${shape.square}`).addClass(`highlight-user-${shape.color}`);
                } else if (shape.type === 'arrow') {
                    this.drawArrow(shape.from, shape.to, shape.color);
                }
            });
        },

        drawArrow: function(from, to, color = 'rgba(42, 122, 42, 0.7)') {
            if (!this.analysisBoardSvgOverlay || !this.analysisBoard) return;
            
            const boardWidth = this.analysisBoardElement.width();
            if (!boardWidth || boardWidth === 0) return;
            const squareSize = boardWidth / 8;
            const isFlipped = this.analysisBoard.orientation() === 'black';

            const getCoords = (square) => {
                let col = square.charCodeAt(0) - 'a'.charCodeAt(0);
                let row = parseInt(square.charAt(1)) - 1;
                if (isFlipped) { col = 7 - col; row = 7 - row; }
                return { x: col * squareSize + squareSize / 2, y: (7 - row) * squareSize + squareSize / 2 };
            };

            const fromCoords = getCoords(from);
            const toCoords = getCoords(to);
            const markerId = `arrowhead-analysis-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

            if (!this.analysisBoardSvgOverlay.find(`#${markerId}`).length) {
                const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                marker.setAttribute('id', markerId);
                marker.setAttribute('viewBox', '0 0 10 10');
                marker.setAttribute('refX', '5'); marker.setAttribute('refY', '5');
                marker.setAttribute('markerWidth', '3.5'); marker.setAttribute('markerHeight', '3.5');
                marker.setAttribute('orient', 'auto-start-reverse');
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
                path.style.fill = color;
                marker.appendChild(path);
                this.analysisBoardSvgOverlay.append(marker);
            }

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', fromCoords.x); line.setAttribute('y1', fromCoords.y);
            line.setAttribute('x2', toCoords.x); line.setAttribute('y2', toCoords.y);
            line.style.stroke = color;
            line.style.strokeWidth = '14px';
            line.setAttribute('marker-end', `url(#${markerId})`);
            this.analysisBoardSvgOverlay.append(line);
        }
    };

    Object.assign(controller, uiRenderMethods);

})(window.AnalysisController);