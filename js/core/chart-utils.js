/* ==========================================================================
   AQUA INSIGHT CHART UTILITIES & VISUALIZATIONS
   Wrapper around Chart.js and Custom SVG Box-Plot Generator.
   ========================================================================== */

window.AquaChart = {
  // Theme Color Configurations
  getColors: function() {
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    return {
      text: isDark ? "#9ca3af" : "#475569",
      grid: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)",
      accent1: "#00F2FE", // Cyan
      accent2: "#10B981", // Emerald
      accent3: "#F43F5E", // Coral / Red
      bgCard: isDark ? "rgba(19, 38, 68, 0.8)" : "rgba(255, 255, 255, 0.9)",
      border: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(15, 23, 42, 0.15)"
    };
  },

  // 1. Create Scatter Plot (Chart.js) with optional Regression Line
  createScatterPlot: function(ctx, points, title, xLabel, yLabel, regressionLine = null) {
    // points: Array of {x, y}
    const colors = this.getColors();
    
    const datasets = [{
      label: "Data Eksperimen",
      data: points,
      backgroundColor: colors.accent1,
      borderColor: colors.accent1,
      pointRadius: 6,
      pointHoverRadius: 8,
      type: 'scatter'
    }];
    
    // Add regression line if provided
    if (regressionLine && points.length > 0) {
      // Calculate start and end points for the line
      const xs = points.map(p => p.x);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const startY = regressionLine.slope * minX + regressionLine.intercept;
      const endY = regressionLine.slope * maxX + regressionLine.intercept;
      
      datasets.push({
        label: `Garis Tren (R² = ${regressionLine.r2.toFixed(4)})`,
        data: [{ x: minX, y: startY }, { x: maxX, y: endY }],
        type: 'line',
        borderColor: colors.accent2,
        borderWidth: 3,
        fill: false,
        pointRadius: 0,
        borderDash: [5, 5]
      });
    }
    
    return new Chart(ctx, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: title, color: colors.text, font: { family: 'Outfit', size: 14, weight: '600' } },
          legend: { labels: { color: colors.text, font: { family: 'Inter' } } }
        },
        scales: {
          x: {
            title: { display: true, text: xLabel, color: colors.text, font: { family: 'Outfit', weight: '600' } },
            grid: { color: colors.grid },
            ticks: { color: colors.text }
          },
          y: {
            title: { display: true, text: yLabel, color: colors.text, font: { family: 'Outfit', weight: '600' } },
            grid: { color: colors.grid },
            ticks: { color: colors.text }
          }
        }
      }
    });
  },

  // 2. Create Bar Chart with SD/SE Error Bars (Chart.js with Custom Plugin)
  createBarChartWithError: function(ctx, categories, values, errors, title, yLabel) {
    const colors = this.getColors();
    
    // Register custom plugin to draw error bars in Chart.js
    const errorBarPlugin = {
      id: 'errorBarPlugin',
      afterDatasetsDraw: function(chart, args, options) {
        const { ctx, data, chartArea: { top, bottom, left, right } } = chart;
        
        chart.data.datasets.forEach((dataset, datasetIdx) => {
          const meta = chart.getDatasetMeta(datasetIdx);
          if (!meta.visible) return;
          
          meta.data.forEach((bar, index) => {
            const val = dataset.data[index];
            const err = dataset.errorBars ? dataset.errorBars[index] : 0;
            if (err <= 0) return;
            
            const x = bar.x;
            const y = bar.y;
            const yScale = chart.scales.y;
            
            // Calculate top and bottom coordinates of error bars
            const yTop = yScale.getPixelForValue(val + err);
            const yBottom = yScale.getPixelForValue(val - err);
            
            ctx.save();
            ctx.strokeStyle = colors.text;
            ctx.lineWidth = 2;
            
            // Draw vertical line
            ctx.beginPath();
            ctx.moveTo(x, yTop);
            ctx.lineTo(x, yBottom);
            ctx.stroke();
            
            // Draw caps
            const capWidth = 6;
            ctx.beginPath();
            ctx.moveTo(x - capWidth, yTop);
            ctx.lineTo(x + capWidth, yTop);
            ctx.moveTo(x - capWidth, yBottom);
            ctx.lineTo(x + capWidth, yBottom);
            ctx.stroke();
            
            ctx.restore();
          });
        });
      }
    };
    
    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categories,
        datasets: [{
          label: "Rata-rata Kelompok",
          data: values,
          errorBars: errors, // custom field read by plugin
          backgroundColor: colors.accent1,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      plugins: [errorBarPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: title, color: colors.text, font: { family: 'Outfit', size: 14, weight: '600' } },
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text }
          },
          y: {
            title: { display: true, text: yLabel, color: colors.text, font: { family: 'Outfit', weight: '600' } },
            grid: { color: colors.grid },
            ticks: { color: colors.text }
          }
        }
      }
    });
  },

  // 3. Create Histogram (Chart.js Bar representing grouped frequencies)
  createHistogram: function(ctx, bins, frequencies, title, xLabel, yLabel) {
    const colors = this.getColors();
    
    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels: bins.map(b => typeof b === 'number' ? b.toFixed(2) : b),
        datasets: [{
          label: "Frekuensi",
          data: frequencies,
          backgroundColor: colors.accent2,
          borderColor: colors.border,
          borderWidth: 1,
          barPercentage: 1.0, // remove gap between bars for histograms
          categoryPercentage: 1.0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: title, color: colors.text, font: { family: 'Outfit', size: 14, weight: '600' } },
          legend: { display: false }
        },
        scales: {
          x: {
            title: { display: true, text: xLabel, color: colors.text, font: { family: 'Outfit', weight: '600' } },
            grid: { display: false },
            ticks: { color: colors.text }
          },
          y: {
            title: { display: true, text: yLabel, color: colors.text, font: { family: 'Outfit', weight: '600' } },
            grid: { color: colors.grid },
            ticks: { color: colors.text }
          }
        }
      }
    });
  },

  // 4. Custom SVG Box Plot Generator
  // Karena Chart.js tidak mensupport boxplot secara native, menggambar SVG adalah solusi
  // yang sangat elegan, responsif, dan 100% cocok dengan glassmorphism.
  // containerId: ID dari DOM element tempat SVG akan dirender
  // groupsData: Array of { label: String, values: Array of Numbers }
  drawBoxPlotSVG: function(containerId, groupsData) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const colors = this.getColors();
    const width = container.clientWidth || 500;
    const height = 300;
    const padding = { top: 30, right: 30, bottom: 50, left: 60 };
    
    // Find min and max across all groups to set Y scale
    const allValues = groupsData.flatMap(g => g.values);
    if (allValues.length === 0) return;
    
    const globalMin = Math.min(...allValues);
    const globalMax = Math.max(...allValues);
    const margin = (globalMax - globalMin) * 0.1 || 1.0;
    const yMin = globalMin - margin;
    const yMax = globalMax + margin;
    
    // Y pixel mapping function
    const getY = (val) => {
      const scale = (height - padding.top - padding.bottom) / (yMax - yMin);
      return height - padding.bottom - (val - yMin) * scale;
    };
    
    // X pixel mapping
    const numGroups = groupsData.length;
    const plotWidth = width - padding.left - padding.right;
    const colWidth = plotWidth / numGroups;
    
    let svgHTML = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="font-family: var(--font-body); overflow: visible;">`;
    
    // 1. Draw Gridlines and Y-axis Labels
    const numTicks = 5;
    for (let i = 0; i < numTicks; i++) {
      const tickVal = yMin + (i * (yMax - yMin) / (numTicks - 1));
      const yPix = getY(tickVal);
      svgHTML += `
        <line x1="${padding.left}" y1="${yPix}" x2="${width - padding.right}" y2="${yPix}" stroke="${colors.grid}" stroke-width="1" />
        <text x="${padding.left - 10}" y="${yPix + 4}" fill="${colors.text}" font-size="11" text-anchor="end">${tickVal.toFixed(2)}</text>
      `;
    }
    
    // Draw Y axis line
    svgHTML += `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="${colors.border}" stroke-width="1" />`;
    
    // 2. Draw Box and Whiskers for each group
    groupsData.forEach((g, gIdx) => {
      const sorted = [...g.values].sort((a,b)=>a-b);
      const n = sorted.length;
      if (n < 4) return;
      
      // Calculate Stats
      const min = sorted[0];
      const max = sorted[n - 1];
      
      // Quartiles calculation
      const getPercentile = (p) => {
        const pos = (n - 1) * p;
        const base = Math.floor(pos);
        const rest = pos - base;
        if (sorted[base + 1] !== undefined) {
          return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
        } else {
          return sorted[base];
        }
      };
      
      const q1 = getPercentile(0.25);
      const median = getPercentile(0.50);
      const q3 = getPercentile(0.75);
      
      // Outliers logic (1.5 IQR)
      const iqr = q3 - q1;
      const lowerFence = q1 - 1.5 * iqr;
      const upperFence = q3 + 1.5 * iqr;
      
      // Filter non-outlier min/max (whiskers)
      const nonOutliers = sorted.filter(v => v >= lowerFence && v <= upperFence);
      const whiskerMin = nonOutliers[0] || min;
      const whiskerMax = nonOutliers[nonOutliers.length - 1] || max;
      
      const outliers = sorted.filter(v => v < lowerFence || v > upperFence);
      
      // Calculate X positions
      const groupCenterX = padding.left + (gIdx * colWidth) + (colWidth / 2);
      const boxWidth = Math.min(colWidth * 0.5, 60);
      
      const pxMin = getY(whiskerMin);
      const pxMax = getY(whiskerMax);
      const pxQ1 = getY(q1);
      const pxQ3 = getY(q3);
      const pxMed = getY(median);
      
      // Draw Whiskers (dashed vertical lines and solid caps)
      svgHTML += `
        <!-- Whisker lines -->
        <line x1="${groupCenterX}" y1="${pxMin}" x2="${groupCenterX}" y2="${pxQ1}" stroke="${colors.text}" stroke-width="1.5" stroke-dasharray="3,3" />
        <line x1="${groupCenterX}" y1="${pxMax}" x2="${groupCenterX}" y2="${pxQ3}" stroke="${colors.text}" stroke-width="1.5" stroke-dasharray="3,3" />
        <!-- Whisker Caps -->
        <line x1="${groupCenterX - 8}" y1="${pxMin}" x2="${groupCenterX + 8}" y2="${pxMin}" stroke="${colors.text}" stroke-width="1.5" />
        <line x1="${groupCenterX - 8}" y1="${pxMax}" x2="${groupCenterX + 8}" y2="${pxMax}" stroke="${colors.text}" stroke-width="1.5" />
      `;
      
      // Draw Box
      svgHTML += `
        <rect x="${groupCenterX - boxWidth/2}" y="${pxQ3}" width="${boxWidth}" height="${pxQ1 - pxQ3}" 
              fill="rgba(0, 242, 254, 0.15)" stroke="url(#aquaBoxGrad)" stroke-width="2" rx="4" />
      `;
      
      // Draw Median Line (Highlighted in coral/emerald)
      svgHTML += `
        <line x1="${groupCenterX - boxWidth/2}" y1="${pxMed}" x2="${groupCenterX + boxWidth/2}" y2="${pxMed}" stroke="${colors.accent2}" stroke-width="3" stroke-linecap="round" />
      `;
      
      // Draw Outliers as small red dots
      outliers.forEach(outVal => {
        const pxOut = getY(outVal);
        svgHTML += `
          <circle cx="${groupCenterX}" cy="${pxOut}" r="4" fill="${colors.accent3}" stroke="${colors.border}" stroke-width="1" />
        `;
      });
      
      // Draw Group Labels on X Axis
      svgHTML += `
        <text x="${groupCenterX}" y="${height - padding.bottom + 25}" fill="${colors.text}" font-size="11" font-weight="600" text-anchor="middle">${g.label}</text>
      `;
    });
    
    // Add Gradients definitions to SVG
    svgHTML += `
      <defs>
        <linearGradient id="aquaBoxGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#00F2FE" />
          <stop offset="100%" stop-color="#4FACFE" />
        </linearGradient>
      </defs>
    `;
    
    svgHTML += `</svg>`;
    container.innerHTML = svgHTML;
  },

  // 5. Normal Q-Q Plot (Scatter + 45-degree diagonal reference line)
  createQQPlot: function(ctx, values, title) {
    const colors = this.getColors();
    const sorted = [...values].sort((a,b)=>a-b);
    const n = sorted.length;
    if (n === 0) return null;
    
    const mean = window.AquaMath.mean(sorted);
    const sd = window.AquaMath.stdDev(sorted, true);
    
    const points = [];
    for (let i = 0; i < n; i++) {
      const zObs = sd === 0 ? 0 : (sorted[i] - mean) / sd;
      const p = (i + 0.5) / n;
      const qTheo = window.AquaMath.normalZCritical(p);
      points.push({ x: qTheo, y: zObs });
    }
    
    const minTheo = Math.min(...points.map(p => p.x));
    const maxTheo = Math.max(...points.map(p => p.x));
    
    const refLinePoints = [
      { x: minTheo, y: minTheo },
      { x: maxTheo, y: maxTheo }
    ];
    
    return new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            type: 'line',
            label: 'Garis Referensi (Normal)',
            data: refLinePoints,
            borderColor: colors.accent3,
            borderWidth: 1.5,
            fill: false,
            pointRadius: 0,
            borderDash: [5, 5],
            order: 2
          },
          {
            type: 'scatter',
            label: 'Data Observasi',
            data: points,
            backgroundColor: colors.accent1,
            borderColor: colors.border,
            pointRadius: 4,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: title || "Normal Q-Q Plot", color: colors.text, font: { family: 'Outfit', size: 13, weight: '600' } },
          legend: { display: true, labels: { color: colors.text, font: { size: 10 } } }
        },
        scales: {
          x: {
            title: { display: true, text: "Kuantil Teoretis (Z)", color: colors.text, font: { size: 10, weight: '600' } },
            grid: { color: colors.grid },
            ticks: { color: colors.text }
          },
          y: {
            title: { display: true, text: "Kuantil Sampel Terstandardisasi", color: colors.text, font: { size: 10, weight: '600' } },
            grid: { color: colors.grid },
            ticks: { color: colors.text }
          }
        }
      }
    });
  },

  // 6. Residual Plot (Scatter + y=0 reference line)
  createResidualPlot: function(ctx, fitted, residuals, title, xLabel) {
    const colors = this.getColors();
    const points = fitted.map((f, idx) => ({ x: f, y: residuals[idx] }));
    
    const minFit = Math.min(...fitted);
    const maxFit = Math.max(...fitted);
    
    const refLinePoints = [
      { x: minFit, y: 0 },
      { x: maxFit, y: 0 }
    ];
    
    return new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            type: 'line',
            label: 'Garis Nol (No Bias)',
            data: refLinePoints,
            borderColor: colors.accent2,
            borderWidth: 1.5,
            fill: false,
            pointRadius: 0,
            order: 2
          },
          {
            type: 'scatter',
            label: 'Sisaan (Residual)',
            data: points,
            backgroundColor: colors.accent3,
            borderColor: colors.border,
            pointRadius: 5,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: title || "Residual Plot", color: colors.text, font: { family: 'Outfit', size: 13, weight: '600' } },
          legend: { display: true, labels: { color: colors.text, font: { size: 10 } } }
        },
        scales: {
          x: {
            title: { display: true, text: xLabel || "Nilai Prediksi / Fitted Value", color: colors.text, font: { size: 10, weight: '600' } },
            grid: { color: colors.grid },
            ticks: { color: colors.text }
          },
          y: {
            title: { display: true, text: "Sisaan (Residual)", color: colors.text, font: { size: 10, weight: '600' } },
            grid: { color: colors.grid },
            ticks: { color: colors.text }
          }
        }
      }
    });
  }
};
