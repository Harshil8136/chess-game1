// ===================================================================================
//  ANALYSIS-CHART.JS
//  Manages the creation and rendering of the evaluation chart using Chart.js.
// ===================================================================================

let evalChart = null;

/**
 * Draws or redraws the game evaluation chart.
 * @param {Array} reviewData - The array of move analysis objects.
 */
function drawEvalChart(reviewData) {
    const evalChartCanvas = $('#ar-eval-chart');
    if (!evalChartCanvas || !evalChartCanvas.length) return;

    try {
        if (evalChart) evalChart.destroy();

        const labels = ['Start'];
        const data = [20]; // Starting eval is slightly positive for White
        
        reviewData.forEach((item, index) => {
            const moveNum = Math.floor(index / 2) + 1;
            const isWhite = index % 2 === 0;
            labels.push(`${moveNum}${isWhite ? '.' : '...'} ${item.move}`);
            data.push(item.score);
        });

        const ctx = evalChartCanvas[0].getContext('2d');
        evalChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Position Evaluation',
                    data: data,
                    borderColor: 'rgba(200, 200, 200, 0.8)',
                    borderWidth: 2,
                    pointRadius: 1,
                    pointHoverRadius: 4,
                    tension: 0.1,
                    fill: {
                        target: 'origin',
                        above: 'rgba(255, 255, 255, 0.1)',
                        below: 'rgba(0, 0, 0, 0.1)'
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        suggestedMin: -500,
                        suggestedMax: 500,
                        grid: {
                            color: 'rgba(255,255,255,0.1)',
                            zeroLineColor: 'rgba(255,255,255,0.4)'
                        },
                        ticks: {
                            color: 'var(--text-dark)',
                            callback: (value) => (value / 100).toFixed(1)
                        }
                    },
                    x: {
                        display: false
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: 'white',
                        bodyColor: 'white'
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                }
            }
        });
    } catch (error) {
        console.error('Error creating evaluation chart:', error);
    }
}