// src/analysis/analysis-chart.js

// ===================================================================================
//  ANALYSIS-CHART.JS
//  Manages the Chart.js evaluation graph for the Analysis Room.
// ===================================================================================

(function(controller) {
    'use strict';

    if (!controller) {
        if (window.Logger) {
            Logger.critical("Analysis Core module must be loaded before the Chart module.", new Error("Module loading dependency failed"));
        }
        return;
    }

    const chartMethods = {

        /**
         * Draws the evaluation line chart using Chart.js.
         */
        drawEvalChart: function() {
            if (!this.evalChartCanvas || !this.evalChartCanvas.length) return;
            try {
                if (this.evalChart) this.evalChart.destroy();

                const labels = ['Start'];
                const data = [20]; // Starting eval is slightly positive for white
                const blunderPoints = [];
                const brilliantPoints = [];

                this.reviewData.forEach((item, index) => {
                    labels.push(`${Math.floor(index / 2) + 1}${index % 2 === 0 ? '.' : '...'} ${item.move}`);
                    data.push(item.score);
                    if (item.classification === 'Blunder') blunderPoints.push({ x: index + 1, y: item.score });
                    else if (item.classification === 'Brilliant') brilliantPoints.push({ x: index + 1, y: item.score });
                });

                const ctx = this.evalChartCanvas[0].getContext('2d');
                this.evalChart = new Chart(ctx, {
                    type: 'line', 
                    data: { 
                        labels, 
                        datasets: [
                            { 
                                label: 'Evaluation', 
                                data, 
                                borderColor: 'rgba(230, 230, 230, 0.9)', 
                                backgroundColor: (context) => {
                                    const {ctx, chartArea} = context.chart;
                                    if (!chartArea) return;
                                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                                    const zeroY = context.chart.scales.y.getPixelForValue(0);
                                    const zeroPoint = (zeroY - chartArea.top) / (chartArea.bottom - chartArea.top);
                                    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
                                    gradient.addColorStop(Math.max(0, zeroPoint - 0.01), 'rgba(0, 0, 0, 0.4)');
                                    gradient.addColorStop(Math.min(1, zeroPoint + 0.01), 'rgba(255, 255, 255, 0.2)');
                                    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
                                    return gradient;
                                }, 
                                fill: 'origin', 
                                borderWidth: 2, 
                                pointRadius: 1, 
                                pointHoverRadius: 5, 
                                tension: 0.1 
                            },
                            { type: 'scatter', label: 'Blunders', data: blunderPoints, backgroundColor: 'rgba(248, 113, 113, 1)', radius: 5, hoverRadius: 7 },
                            { type: 'scatter', label: 'Brilliant Moves', data: brilliantPoints, backgroundColor: 'rgba(45, 212, 191, 1)', radius: 5, hoverRadius: 7 }
                        ]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        onHover: (event, chartElement) => {
                            this.moveListElement.find('.chart-hover').removeClass('chart-hover');
                            if (chartElement.length) {
                                const index = chartElement[0].index;
                                if (index > 0) {
                                    this.moveListElement.find(`[data-move-index="${index - 1}"], [data-second-move-index="${index - 1}"]`).first().addClass('chart-hover');
                                }
                            }
                        },
                        onClick: (e) => {
                            const activePoints = this.evalChart.getElementsAtEventForMode(e, 'index', { intersect: false }, true);
                            if (activePoints.length > 0) {
                                const moveIndex = activePoints[0].index - 1;
                                this.navigateToMove(moveIndex);
                                window.playSound('moveSelf');
                            }
                        },
                        scales: { 
                            y: { 
                                suggestedMin: -600, suggestedMax: 600, 
                                grid: { color: 'rgba(255,255,255,0.05)', zeroLineColor: 'rgba(255,255,255,0.4)', zeroLineWidth: 2 }, 
                                ticks: { color: 'var(--text-dark)', callback: (v) => (v / 100).toFixed(1) } 
                            }, 
                            x: { display: false } 
                        },
                        plugins: { 
                            legend: { display: false }, 
                            tooltip: { 
                                mode: 'index', intersect: false, backgroundColor: 'rgba(0,0,0,0.8)', titleFont: { weight: 'bold'}, 
                                callbacks: {
                                    label: function(context) {
                                        let label = ' Eval: '; let score = context.parsed.y / 100;
                                        if (Math.abs(score) > 95) label += (score > 0 ? 'M' : '-M') + Math.abs(100 - Math.abs(score)).toFixed(0);
                                        else label += score.toFixed(2);
                                        return label;
                                    }
                                }
                            }
                        },
                        interaction: { mode: 'index', intersect: false }
                    }
                });
            } catch (error) { Logger.error('Error creating evaluation chart', error); }
        },

        /**
         * Highlights a specific point on the chart corresponding to the move index.
         * @param {number} moveIndex - The index of the move to highlight.
         */
        highlightChartPoint: function(moveIndex) {
            if (!this.evalChart) return;

            const chart = this.evalChart;
            const pointCount = chart.data.datasets[0].data.length;
            const radii = new Array(pointCount).fill(1);
            const colors = new Array(pointCount).fill('rgba(230, 230, 230, 0.9)');

            // The chart has a "Start" point at index 0, so moves are offset by +1
            const chartIndex = moveIndex + 1;

            if (chartIndex >= 0 && chartIndex < pointCount) {
                radii[chartIndex] = 6;
                colors[chartIndex] = '#ffca28'; // A bright yellow color for highlighting
            }

            chart.data.datasets[0].pointRadius = radii;
            chart.data.datasets[0].pointBackgroundColor = colors;
            chart.update('none'); // Use 'none' for no animation
        }
    };

    // Attach all the chart-related methods to the main AnalysisController
    Object.assign(controller, chartMethods);

})(window.AnalysisController);