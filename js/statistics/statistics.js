/* ==========================================================================
   AQUA INSIGHT - STATISTICS ANALYZER MAIN CONTROLLER
   Manages interactive spreadsheet grids, clipboard paste interceptors,
   preset loading, statistical runners, and analytical report card builds.
   ========================================================================== */

let gridHeaders = ["Perlakuan", "Hasil"];
let gridRowsCount = 15;
let gridData = []; // 2D array of numbers/strings matching gridRowsCount x gridHeaders.length
let activeTest = "descriptive";
let statsChart = null;
let selectedCols = new Set();
let selectedRows = new Set();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initSpreadsheet();
    setupCellNavigation();
  });
} else {
  initSpreadsheet();
  setupCellNavigation();
}

// Setup Enter and Tab key navigation on table
function setupCellNavigation() {
  const table = document.getElementById("data-grid");
  if (!table) return;
  
  table.addEventListener("keydown", function(e) {
    if (e.key === "Enter" || e.key === "Tab") {
      const td = e.target.closest("td");
      if (!td || !td.classList.contains("editable-cell")) return;
      
      e.preventDefault();
      
      const tr = td.parentElement;
      const rowIndex = tr.rowIndex; // 0 is header
      const cellIndex = td.cellIndex;
      
      const tbody = table.querySelector("tbody");
      const rows = tbody.querySelectorAll("tr");
      
      if (e.key === "Enter") {
        // Move Down
        const nextRow = rows[rowIndex]; // rowIndex is 1-based from table, so rows[rowIndex] is the next row in tbody
        if (nextRow) {
          const nextTd = nextRow.cells[cellIndex];
          if (nextTd) nextTd.focus();
        } else {
          // Add new row if at bottom
          addGridRow();
          setTimeout(() => {
            const newRow = table.querySelector("tbody").lastElementChild;
            newRow.cells[cellIndex].focus();
          }, 50);
        }
      } else if (e.key === "Tab") {
        // Move Right
        const nextTd = tr.cells[cellIndex + 1];
        if (nextTd && nextTd.classList.contains("editable-cell")) {
          nextTd.focus();
        } else {
          // Wrap to next row
          const nextRow = rows[rowIndex];
          if (nextRow) {
            nextRow.cells[1].focus(); // cell 0 is row number
          }
        }
      }
    }
  });
}

// 1. Spreadsheet Initialization
function initSpreadsheet() {
  // Initialize with empty rows
  gridData = [];
  for (let r = 0; r < gridRowsCount; r++) {
    const row = new Array(gridHeaders.length).fill("");
    gridData.push(row);
  }
  
  renderSpreadsheet();
  setupPasteInterceptor();
}

function renderSpreadsheet() {
  const table = document.getElementById("data-grid");
  if (!table) return;
  
  let html = `<thead><tr><th class="row-number-header">#</th>`;
  
  // Render Editable Headers (clickable for column selection)
  gridHeaders.forEach((h, hIdx) => {
    const isSelected = selectedCols.has(hIdx);
    html += `<th
      contenteditable="true"
      class="col-header-editable${isSelected ? ' col-selected' : ''}"
      onblur="renameHeader(${hIdx}, this.textContent)"
      onclick="toggleColSelect(${hIdx})"
      style="user-select: none;"
    >${h}</th>`;
  });
  html += `</tr></thead><tbody>`;
  
  // Render Editable Cells
  for (let r = 0; r < gridData.length; r++) {
    const isRowSelected = selectedRows.has(r);
    html += `<tr><td class="row-num${isRowSelected ? ' row-selected' : ''}" onclick="toggleRowSelect(${r})">${r + 1}</td>`;
    for (let c = 0; c < gridHeaders.length; c++) {
      const val = gridData[r][c] !== undefined ? gridData[r][c] : "";
      const isCellColSelected = selectedCols.has(c);
      html += `<td contenteditable="true" class="editable-cell${isCellColSelected ? ' col-selected' : ''}" onblur="updateCell(${r}, ${c}, this.textContent)">${val}</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody>`;
  
  table.innerHTML = html;
}

window.renameHeader = function(hIdx, newText) {
  const clean = newText.trim().replace(/\s+/g, "_"); // replace spaces with underscores for var naming
  gridHeaders[hIdx] = clean || `Var_${hIdx + 1}`;
  // Avoid re-rendering completely during blur to maintain cursor focus, just update array
};

window.updateCell = function(r, c, val) {
  const cleanVal = val.trim();
  if (cleanVal === "") {
    gridData[r][c] = "";
  } else {
    // Save as number if numeric, otherwise string
    gridData[r][c] = isNaN(cleanVal) ? cleanVal : parseFloat(cleanVal);
  }
};

// 2. Spreadsheet Toolbar Functions
window.addGridRow = function(initData = null) {
  const newRow = initData || new Array(gridHeaders.length).fill("");
  gridData.push(newRow);
  renderSpreadsheet();
};

window.addGridCol = function(headerName = null) {
  const newHeader = headerName || `Variabel_${gridHeaders.length + 1}`;
  gridHeaders.push(newHeader);
  gridData.forEach(row => {
    row.push("");
  });
  renderSpreadsheet();
};

window.removeGridCol = function() {
  if (gridHeaders.length <= 1) return;
  gridHeaders.pop();
  gridData.forEach(row => {
    row.pop();
  });
  renderSpreadsheet();
};

window.clearSpreadsheet = function() {
  gridHeaders = ["Perlakuan", "Hasil"];
  gridData = [];
  for (let r = 0; r < 15; r++) {
    gridData.push(new Array(2).fill(""));
  }
  renderSpreadsheet();
  // Clearpreset select value
  document.getElementById("dataset-preset").value = "";
};

// 3. Clipboard Excel Paste Interceptor
function setupPasteInterceptor() {
  const table = document.getElementById("data-grid");
  if (!table) return;
  
  table.addEventListener("paste", (e) => {
    e.preventDefault();
    
    // Get text from clipboard
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedText = clipboardData.getData("Text");
    
    if (!pastedText) return;
    
    // Parse tab-delimited text (TSV format from Excel)
    const rows = pastedText.split(/\r?\n/).filter(line => line.trim() !== "");
    if (rows.length === 0) return;
    
    const parsedGrid = rows.map(row => row.split("\t"));
    
    // Find target cell where paste started
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const targetCell = selection.anchorNode.closest("td.editable-cell");
    if (!targetCell) return;
    
    const tr = targetCell.parentElement;
    const startRow = tr.rowIndex - 1; // 1-indexed (thead row is 0)
    const startCol = targetCell.cellIndex - 1; // first column is Row Num
    
    // Resize grid if pasted data exceeds current bounds
    const requiredRows = startRow + parsedGrid.length;
    const requiredCols = startCol + parsedGrid[0].length;
    
    while (gridData.length < requiredRows) {
      gridData.push(new Array(gridHeaders.length).fill(""));
    }
    
    while (gridHeaders.length < requiredCols) {
      addGridCol();
    }
    
    // Write pasted values into gridData array
    for (let r = 0; r < parsedGrid.length; r++) {
      for (let c = 0; c < parsedGrid[r].length; c++) {
        const val = parsedGrid[r][c].trim();
        const targetRow = startRow + r;
        const targetCol = startCol + c;
        
        gridData[targetRow][targetCol] = isNaN(val) || val === "" ? val : parseFloat(val);
      }
    }
    
    renderSpreadsheet();
    alert("Data Excel berhasil ditempel (pasted) ke lembar grid!");
  });
}

// 4. CSV Import Loader
window.triggerCSVImport = function() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,.txt";
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
      const text = evt.target.result;
      const lines = window.AquaFile.parseCSV(text);
      if (lines.length === 0) return;
      
      // Load first row as headers, rest as data
      gridHeaders = lines[0];
      gridData = lines.slice(1).map(row => {
        return row.map(val => isNaN(val) || val === "" ? val : parseFloat(val));
      });
      
      renderSpreadsheet();
      alert("Berkas CSV berhasil diimpor!");
    };
    reader.readAsText(file);
  };
  input.click();
};

// 5. Preset Datasets Loader
window.loadPresetDataset = function(presetName) {
  if (presetName === "") {
    clearSpreadsheet();
    return;
  }
  
  if (presetName === "feed_trials") {
    // One-Way ANOVA Feed trials: 4 columns of fish weights (grams)
    gridHeaders = ["Kontrol", "Pakan_Artemia", "Pakan_Pelet_A", "Pakan_Pelet_B"];
    gridData = [
      [45.2, 55.4, 48.9, 50.1],
      [42.8, 58.1, 46.2, 52.3],
      [46.1, 54.9, 49.5, 49.8],
      [44.0, 56.2, 47.8, 51.5],
      [43.5, 59.0, 48.1, 53.0],
      [45.9, 53.5, 46.9, 50.9],
      [44.8, 57.3, 49.0, 52.1],
      [42.1, 55.0, 47.2, 48.9],
      [46.5, 58.6, 48.5, 51.8],
      [43.9, 56.8, 47.9, 50.5]
    ];
    document.getElementById("analysis-type").value = "anova_1";
  } 
  else if (presetName === "temp_salinity") {
    // Two-Way ANOVA: 3 columns: Suhu (Factor A: Rendah/Tinggi), Salinitas (Factor B: 15/30 ppt), Laju_Pertumbuhan (% per hari)
    gridHeaders = ["Suhu", "Salinitas", "Laju_Pertumbuhan"];
    gridData = [
      ["Rendah", "15_ppt", 1.8], ["Rendah", "15_ppt", 2.0], ["Rendah", "15_ppt", 1.9],
      ["Rendah", "30_ppt", 2.5], ["Rendah", "30_ppt", 2.3], ["Rendah", "30_ppt", 2.4],
      ["Tinggi", "15_ppt", 3.2], ["Tinggi", "15_ppt", 3.4], ["Tinggi", "15_ppt", 3.1],
      ["Tinggi", "30_ppt", 3.9], ["Tinggi", "30_ppt", 4.1], ["Tinggi", "30_ppt", 3.8]
    ];
    document.getElementById("analysis-type").value = "anova_2";
  }
  else if (presetName === "growth_curve") {
    // Growth curve: Hari (X), Kepadatan_Alga (Y in millions/mL) representing exponential growth
    gridHeaders = ["Hari", "Kepadatan_Alga"];
    gridData = [
      [1, 1.2],
      [2, 2.3],
      [3, 4.5],
      [4, 8.9],
      [5, 17.8],
      [6, 35.2],
      [7, 71.0],
      [8, 142.5]
    ];
    document.getElementById("analysis-type").value = "regression";
    setTimeout(() => {
      document.getElementById("regression-model-type").value = "exponential";
    }, 10);
  }
  else if (presetName === "salinity_survival") {
    // Salinity vs Survival: Salinitas (X, ppt), Kelangsungan_Hidup (Y, %)
    gridHeaders = ["Salinitas", "Kelangsungan_Hidup"];
    gridData = [
      [5, 95],
      [10, 92],
      [15, 88],
      [20, 85],
      [25, 78],
      [30, 72],
      [35, 65],
      [40, 52]
    ];
    document.getElementById("analysis-type").value = "regression";
    setTimeout(() => {
      document.getElementById("regression-model-type").value = "linear";
    }, 10);
  }
  else if (presetName === "ttest_paired_sample") {
    gridHeaders = ["Berat_Sebelum", "Berat_Sesudah"];
    gridData = [
      [10.2, 12.5],
      [9.8, 12.1],
      [10.5, 13.0],
      [10.0, 12.8],
      [10.3, 12.6]
    ];
    document.getElementById("analysis-type").value = "ttest_paired";
  }
  else if (presetName === "chisquare_indep_preset") {
    gridHeaders = ["Kolam_A", "Kolam_B", "Kolam_C"];
    gridData = [
      [45, 30, 52],
      [5, 15, 8]
    ];
    document.getElementById("analysis-type").value = "chisquare_indep";
  }
  else if (presetName === "chisquare_gof_preset") {
    gridHeaders = ["Observed", "Expected_Proportion"];
    gridData = [
      [85, 9],
      [32, 3],
      [28, 3],
      [15, 1]
    ];
    document.getElementById("analysis-type").value = "chisquare_gof";
  }
  
  renderSpreadsheet();
  switchAnalysisSettings(document.getElementById("analysis-type").value);
};

// 5. Test Parameter Switch UI visibility
window.switchAnalysisSettings = function(testType) {
  activeTest = testType;
  
  // Hide all parameter panels first
  document.getElementById("param-ttest-1").style.display = "none";
  document.getElementById("param-anova-2").style.display = "none";
  document.getElementById("param-regression").style.display = "none";
  document.getElementById("param-design").style.display = "none";
  document.getElementById("param-sample-size").style.display = "none";
  document.getElementById("general-stat-settings").style.display = "block";
  
  // Show active panel
  if (testType === "ttest_1") {
    document.getElementById("param-ttest-1").style.display = "block";
  } else if (testType === "anova_2") {
    document.getElementById("param-anova-2").style.display = "block";
  } else if (testType === "regression") {
    document.getElementById("param-regression").style.display = "block";
  } else if (testType.startsWith("design_")) {
    document.getElementById("param-design").style.display = "block";
    document.getElementById("general-stat-settings").style.display = "none";
  } else if (testType === "sample_size") {
    document.getElementById("param-sample-size").style.display = "block";
    document.getElementById("general-stat-settings").style.display = "none";
  }
};

window.switchDesignMode = function(val) {
  const lbl = document.getElementById("lbl-reps-blocks");
  lbl.textContent = val === "crd" ? "Ulangan (Reps)" : "Jumlah Blok";
};

window.switchSampleCalc = function(val) {
  const groupSd = document.getElementById("group-sample-sd");
  const groupMargin = document.getElementById("group-sample-margin");
  const groupEffect = document.getElementById("group-sample-effect");
  
  if (val === "single") {
    groupSd.style.display = "block";
    groupMargin.style.display = "block";
    groupEffect.style.display = "none";
  } else {
    groupSd.style.display = "none";
    groupMargin.style.display = "none";
    groupEffect.style.display = "block";
  }
};

// 6. Quantitative Analysis Runner
window.executeAnalysis = function() {
  const reportContainer = document.getElementById("analysis-report-container");
  if (!reportContainer) return;
  
  // Clean charts
  const activeCharts = Object.values(Chart.instances);
  activeCharts.forEach(chart => chart.destroy());
  statsChart = null;
  
  // Handle Design & Sample size calculators separately since they don't require grid data
  if (activeTest.startsWith("design_")) {
    runExperimentalDesign();
    return;
  }
  if (activeTest === "sample_size") {
    runSampleSizePower();
    return;
  }
  
  // Check if grid data is valid
  // Read and clean columns, filtering empty values
  const columnsData = [];
  for (let c = 0; c < gridHeaders.length; c++) {
    const colName = gridHeaders[c];
    const vals = [];
    for (let r = 0; r < gridData.length; r++) {
      const val = gridData[r][c];
      if (val !== undefined && val !== null && val !== "") {
        vals.push(val);
      }
    }
    columnsData.push({ name: colName, values: vals });
  }
  
  const nonEmptyCols = columnsData.filter(col => col.values.length > 0);
  if (nonEmptyCols.length === 0) {
    alert("Tabel data kosong. Silakan isi angka ke dalam tabel sebelum menjalankan analisis.");
    return;
  }
  
  // Run tests
  if (activeTest === "descriptive") {
    runDescriptives(nonEmptyCols);
  } else if (activeTest === "ttest_1") {
    runTTest1(nonEmptyCols);
  } else if (activeTest === "ttest_2") {
    runTTest2(nonEmptyCols);
  } else if (activeTest === "ttest_paired") {
    runTTestPaired(nonEmptyCols);
  } else if (activeTest === "ttest_wilcoxon") {
    runTTestWilcoxon(nonEmptyCols);
  } else if (activeTest === "anova_1") {
    runANOVA1(nonEmptyCols);
  } else if (activeTest === "anova_2") {
    runANOVA2(columnsData); // pass all columns including categories
  } else if (activeTest === "chisquare_indep") {
    runChiSquareIndependence(nonEmptyCols);
  } else if (activeTest === "chisquare_gof") {
    runChiSquareGoodnessOfFit(nonEmptyCols);
  } else if (activeTest === "regression") {
    runRegression(nonEmptyCols);
  }
};

// 6a. Descriptive Statistics Report builder
function runDescriptives(cols) {
  const reportContainer = document.getElementById("analysis-report-container");
  
  let html = `
    <div class="glass-panel report-card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 class="report-section-title" style="border: 0; margin: 0; padding: 0;"><i class="fa-solid fa-square-poll-vertical"></i> Laporan Statistik Deskriptif</h3>
        <button class="header-btn compact-btn" onclick="exportReportXLSX('descriptive')"><i class="fa-solid fa-file-excel"></i> Ekspor Excel</button>
      </div>
      <hr class="panel-divider">
      
      <table class="report-table">
        <thead>
          <tr>
            <th>Parameter Deskriptif</th>
  `;
  
  cols.forEach(col => {
    html += `<th>${col.name}</th>`;
  });
  
  html += `</tr></thead><tbody>`;
  
  // Define descriptive rows
  const params = [
    { label: "Jumlah Data (N)", fn: (vals) => vals.length },
    { label: "Rata-rata (Mean)", fn: (vals) => window.AquaMath.mean(vals).toFixed(4) },
    { label: "Median", fn: (vals) => window.AquaMath.median(vals).toFixed(4) },
    { label: "Modus", fn: (vals) => {
        const m = window.AquaMath.mode(vals);
        return Array.isArray(m) ? m.slice(0, 3).join(", ") + (m.length > 3 ? "..." : "") : m.toFixed(4);
      }
    },
    { label: "Standar Deviasi (SD)", fn: (vals) => window.AquaMath.stdDev(vals, true).toFixed(4) },
    { label: "Standar Error (SE)", fn: (vals) => window.AquaMath.stdErr(vals).toFixed(4) },
    { label: "Varian (Variance)", fn: (vals) => window.AquaMath.variance(vals, true).toFixed(4) },
    { label: "Nilai Minimum (Min)", fn: (vals) => Math.min(...vals).toFixed(4) },
    { label: "Nilai Maksimum (Max)", fn: (vals) => Math.max(...vals).toFixed(4) },
    { label: "Rentang (Range)", fn: (vals) => (Math.max(...vals) - Math.min(...vals)).toFixed(4) },
    { label: "Skewness (Kemiringan)", fn: (vals) => window.AquaMath.skewness(vals).toFixed(4) },
    { label: "Kurtosis (Keruncingan)", fn: (vals) => window.AquaMath.kurtosis(vals).toFixed(4) },
    { label: "Selang Kepercayaan 95% (CI)", fn: (vals) => {
        const ci = window.AquaMath.confidenceInterval95(vals);
        return `± ${ci.margin.toFixed(4)} [${ci.lower.toFixed(2)} - ${ci.upper.toFixed(2)}]`;
      }
    }
  ];
  
  params.forEach(p => {
    html += `<tr><td><strong>${p.label}</strong></td>`;
    cols.forEach(col => {
      // check if numeric values
      const numericVals = col.values.filter(v => typeof v === 'number');
      if (numericVals.length === 0) {
        html += `<td>- (Bukan Numerik)</td>`;
      } else {
        html += `<td>${p.fn(numericVals)}</td>`;
      }
    });
    html += `</tr>`;
  });
  
  html += `</tbody></table>`;
  
  // Add Boxplot and Q-Q Plot side-by-side
  html += `
      <hr class="panel-divider">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 280px;">
          <h4 class="viewport-title" style="margin-bottom: 1rem;"><i class="fa-solid fa-chart-simple"></i> Visualisasi Sebaran Data (Box Plot)</h4>
          <div id="boxplot-svg-container" style="width: 100%; display: flex; justify-content: center; background: rgba(0,0,0,0.15); border-radius: 12px; padding: 1rem; border: 1px solid var(--border-color);"></div>
        </div>
        <div style="flex: 1; min-width: 280px;">
          <h4 class="viewport-title" style="margin-bottom: 1rem;"><i class="fa-solid fa-chart-line"></i> Uji Normalitas Visual (Q-Q Plot)</h4>
          <div class="chart-container" style="position: relative; height: 300px; background: rgba(0,0,0,0.15); border-radius: 12px; padding: 1rem; border: 1px solid var(--border-color);">
            <canvas id="descriptive-qq-chart"></canvas>
          </div>
        </div>
      </div>
    </div>
  `;
  
  reportContainer.innerHTML = html;
  
  // Render SVG Box Plot and Q-Q Plot
  const numericCols = cols.map(col => ({
    label: col.name,
    values: col.values.filter(v => typeof v === 'number')
  })).filter(g => g.values.length >= 4);
  
  if (numericCols.length > 0) {
    setTimeout(() => {
      window.AquaChart.drawBoxPlotSVG("boxplot-svg-container", numericCols);
      
      const qqCtx = document.getElementById("descriptive-qq-chart");
      if (qqCtx) {
        statsChart = window.AquaChart.createQQPlot(qqCtx, numericCols[0].values, "Normal Q-Q Plot: " + numericCols[0].label);
      }
    }, 50);
  }
}

// 6b. t-Test 1 Sample Report
function runTTest1(cols) {
  const reportContainer = document.getElementById("analysis-report-container");
  const target = parseFloat(document.getElementById("ttest-1-target").value) || 0;
  
  const col = cols[0];
  const vals = col.values.filter(v => typeof v === 'number');
  if (vals.length < 2) {
    alert("Diperlukan minimal 2 baris data numerik di kolom pertama.");
    return;
  }
  
  // Check normality
  const normRes = checkNormalityAndGetHTML([vals], [col.name]);
  
  const res = window.AquaMath.oneSampleTTest(vals, target);
  if (!res) return;
  
  const sigText = res.isSignificant ? "Signifikan (H0 Ditolak)" : "Tidak Signifikan (H0 Diterima)";
  const interpretation = res.isSignificant 
    ? `Rata-rata kelompok <strong>${col.name}</strong> (${res.mean.toFixed(3)}) berbeda secara signifikan dengan rata-rata acuan ${target} (p-value = ${res.pValue.toFixed(5)} &lt; 0.05).`
    : `Tidak terdapat cukup bukti untuk menyatakan rata-rata kelompok <strong>${col.name}</strong> (${res.mean.toFixed(3)}) berbeda dengan nilai acuan ${target} (p-value = ${res.pValue.toFixed(5)} &ge; 0.05).`;
    
  reportContainer.innerHTML = `
    <div class="glass-panel report-card">
      <h3 class="report-section-title"><i class="fa-solid fa-calculator"></i> Laporan Uji-t Satu Sampel</h3>
      
      ${normRes.html}
      
      <table class="report-table">
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Hasil Kalkulasi</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Variabel Pengujian</td><td><strong>${col.name}</strong></td></tr>
          <tr><td>Nilai Acuan Hipotesis (H0)</td><td>${target}</td></tr>
          <tr><td>Rata-rata Sampel (Mean)</td><td>${res.mean.toFixed(4)}</td></tr>
          <tr><td>Nilai Statistik t (t-stat)</td><td>${res.tStat.toFixed(4)}</td></tr>
          <tr><td>Derajat Kebebasan (df)</td><td>${res.df}</td></tr>
          <tr><td>Signifikansi (p-value)</td><td>${res.pValue.toFixed(5)}</td></tr>
          <tr><td>Keputusan Uji (α = 0.05)</td><td><span class="sig-label ${res.isSignificant ? 'significant' : 'not-significant'}">${sigText}</span></td></tr>
        </tbody>
      </table>
      
      <div class="glass-panel" style="background: rgba(0,0,0,0.1); border-color: rgba(255,255,255,0.05); font-size: 0.9rem; line-height: 1.5; padding: 1rem; margin-bottom: 1.5rem;">
        <strong>Kesimpulan Ilmiah:</strong><br>${interpretation}
      </div>
      
      <h4 class="viewport-title" style="margin-bottom: 1rem;"><i class="fa-solid fa-chart-line"></i> Normal Q-Q Plot</h4>
      <div class="chart-container" style="position: relative; height: 240px; background: rgba(0,0,0,0.15); border-radius: 12px; padding: 1rem; border: 1px solid var(--border-color);">
        <canvas id="ttest1-qq-chart"></canvas>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    const qqCtx = document.getElementById("ttest1-qq-chart");
    if (qqCtx) {
      statsChart = window.AquaChart.createQQPlot(qqCtx, vals, "Normal Q-Q Plot: " + col.name);
    }
  }, 50);
}

// 6c. t-Test 2 Independent Samples Report
function runTTest2(cols) {
  if (cols.length < 2) {
    alert("Diperlukan minimal 2 kolom data numerik.");
    return;
  }
  
  const reportContainer = document.getElementById("analysis-report-container");
  const col1 = cols[0];
  const col2 = cols[1];
  
  const vals1 = col1.values.filter(v => typeof v === 'number');
  const vals2 = col2.values.filter(v => typeof v === 'number');
  
  if (vals1.length < 2 || vals2.length < 2) {
    alert("Tiap kelompok harus memiliki minimal 2 baris data numerik.");
    return;
  }
  
  // 1. Check Normality
  const normRes = checkNormalityAndGetHTML([vals1, vals2], [col1.name, col2.name]);
  
  // 2. Check Assumption: Levene's Test
  const isLeveneCheck = document.getElementById("toggle-levene-assumption").classList.contains("active");
  let leveneRes = null;
  let equalVars = true;
  
  if (isLeveneCheck) {
    leveneRes = window.AquaMath.leveneTest([vals1, vals2]);
    equalVars = leveneRes.isHomogeneous;
  }
  
  const v1 = window.AquaMath.variance(vals1, true);
  const v2 = window.AquaMath.variance(vals2, true);
  
  // 3. Perform T-Test
  const res = window.AquaMath.independentTTest(vals1, vals2, equalVars);
  if (!res) return;
  
  const sigText = res.isSignificant ? "Signifikan (H0 Ditolak)" : "Tidak Signifikan (H0 Diterima)";
  const interpretation = res.isSignificant
    ? `Terdapat perbedaan rata-rata yang signifikan secara statistik antara <strong>${col1.name}</strong> (${res.mean1.toFixed(3)}) dan <strong>${col2.name}</strong> (${res.mean2.toFixed(3)}) (t = ${res.tStat.toFixed(3)}, p = ${res.pValue.toFixed(5)} &lt; 0.05).`
    : `Tidak terdapat perbedaan rata-rata yang signifikan secara statistik antara kelompok <strong>${col1.name}</strong> dan <strong>${col2.name}</strong> (p = ${res.pValue.toFixed(5)} &ge; 0.05).`;
    
  // 4. Fallback Non-Parametric Mann-Whitney U test if Levene or Normality fails
  let mwHTML = "";
  const assumptionFailed = (leveneRes && !leveneRes.isHomogeneous) || normRes.violated;
  if (assumptionFailed) {
    const mwRes = window.AquaMath.mannWhitneyUTest(vals1, vals2);
    let reason = "";
    if (normRes.violated && leveneRes && !leveneRes.isHomogeneous) {
      reason = "asumsi normalitas dan homogenitas varians dilanggar";
    } else if (normRes.violated) {
      reason = "asumsi normalitas dilanggar";
    } else {
      reason = "asumsi homogenitas varians tidak terpenuhi (p Levene < 0.05)";
    }
    
    mwHTML = `
      <hr class="panel-divider">
      <h4 class="viewport-title" style="color: #F43F5E; margin-bottom: 0.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> Deteksi Pelanggaran Asumsi (Uji Alternatif Non-Parametrik)</h4>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem; line-height: 1.4;">
        Karena ${reason}, Uji Non-Parametrik <strong>Mann-Whitney U</strong> dijalankan sebagai konfirmasi validitas ilmiah:
      </p>
      <table class="report-table" style="margin-bottom: 0;">
        <thead>
          <tr>
            <th>Metrik Mann-Whitney U</th>
            <th>Hasil Uji</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Statistik U</td><td>${mwRes.uStat} (U1 = ${mwRes.u1}, U2 = ${mwRes.u2})</td></tr>
          <tr><td>Nilai Z-Approximation</td><td>${mwRes.zStat.toFixed(4)}</td></tr>
          <tr><td>Signifikansi (p-value)</td><td><strong>${mwRes.pValue.toFixed(5)}</strong></td></tr>
          <tr><td>Keputusan (α = 0.05)</td><td><span class="sig-label ${mwRes.isSignificant ? 'significant' : 'not-significant'}">${mwRes.isSignificant ? 'Signifikan' : 'Tidak Signifikan'}</span></td></tr>
        </tbody>
      </table>
    `;
  }
  
  reportContainer.innerHTML = `
    <div class="glass-panel report-card">
      <h3 class="report-section-title"><i class="fa-solid fa-calculator"></i> Laporan Uji-t Dua Sampel Independen</h3>
      
      ${normRes.html}
      
      ${leveneRes ? `
        <div class="glass-panel" style="background: rgba(255,255,255,0.01); border-color: rgba(255,255,255,0.05); margin-bottom: 1.25rem; font-size: 0.8rem; line-height: 1.4; padding: 0.75rem 1rem;">
          <strong>Uji Asumsi Homogenitas Varians (Levene's Test):</strong><br>
          F-stat = ${leveneRes.fStat.toFixed(3)}, p-value = ${leveneRes.pValue.toFixed(4)} -> 
          <span style="color: ${leveneRes.isHomogeneous ? '#10b981' : '#f43f5e'}; font-weight: 700;">
            ${leveneRes.isHomogeneous ? 'Asumsi Homogen Terpenuhi (Uji-t Varians Sama)' : 'Asumsi Homogen Dilanggar (Uji-t Varians Berbeda / Welch T-Test)'}
          </span>
        </div>
      ` : ""}
      
      <table class="report-table">
        <thead>
          <tr>
            <th>Parameter</th>
            <th>${col1.name}</th>
            <th>${col2.name}</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Ukuran Sampel (N)</td><td>${vals1.length}</td><td>${vals2.length}</td></tr>
          <tr><td>Rata-rata Kelompok</td><td>${res.mean1.toFixed(4)}</td><td>${res.mean2.toFixed(4)}</td></tr>
          <tr><td>Varians (Variance)</td><td>${v1.toFixed(4)}</td><td>${v2.toFixed(4)}</td></tr>
          <tr><td colspan="3" style="background: rgba(255,255,255,0.01); font-weight: 700; color: var(--text-accent);">Statistik Uji-t</td></tr>
          <tr><td>Nilai t-stat</td><td colspan="2">${res.tStat.toFixed(4)}</td></tr>
          <tr><td>Derajat Kebebasan (df)</td><td colspan="2">${res.df.toFixed(2)}</td></tr>
          <tr><td>Signifikansi (p-value)</td><td colspan="2"><strong>${res.pValue.toFixed(5)}</strong></td></tr>
          <tr><td>Keputusan (α = 0.05)</td><td colspan="2"><span class="sig-label ${res.isSignificant ? 'significant' : 'not-significant'}">${sigText}</span></td></tr>
        </tbody>
      </table>
      
      <div class="glass-panel" style="background: rgba(0,0,0,0.1); border-color: rgba(255,255,255,0.05); font-size: 0.9rem; line-height: 1.5; padding: 1rem; margin-bottom: 1.5rem;">
        <strong>Kesimpulan Ilmiah:</strong><br>${interpretation}
      </div>
      
      <h4 class="viewport-title" style="margin-bottom: 1rem;"><i class="fa-solid fa-chart-line"></i> Normal Q-Q Plots</h4>
      <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
        <div style="flex: 1; min-width: 250px;" class="chart-container">
          <canvas id="ttest2-qq1-chart" style="height: 200px;"></canvas>
        </div>
        <div style="flex: 1; min-width: 250px;" class="chart-container">
          <canvas id="ttest2-qq2-chart" style="height: 200px;"></canvas>
        </div>
      </div>
      
      ${mwHTML}
    </div>
  `;
  
  setTimeout(() => {
    const qqCtx1 = document.getElementById("ttest2-qq1-chart");
    const qqCtx2 = document.getElementById("ttest2-qq2-chart");
    if (qqCtx1) window.AquaChart.createQQPlot(qqCtx1, vals1, "Q-Q Plot: " + col1.name);
    if (qqCtx2) window.AquaChart.createQQPlot(qqCtx2, vals2, "Q-Q Plot: " + col2.name);
  }, 50);
}

// 6d. Paired t-Test Report
function runTTestPaired(cols) {
  if (cols.length < 2) {
    alert("Diperlukan minimal 2 kolom data numerik.");
    return;
  }
  
  const reportContainer = document.getElementById("analysis-report-container");
  const col1 = cols[0];
  const col2 = cols[1];
  
  const vals1 = col1.values.filter(v => typeof v === 'number');
  const vals2 = col2.values.filter(v => typeof v === 'number');
  
  if (vals1.length !== vals2.length || vals1.length < 2) {
    alert("Untuk uji berpasangan, ukuran sampel kelompok 1 dan kelompok 2 harus sama persis (N1 = N2).");
    return;
  }
  
  // Compute differences
  const diffs = vals1.map((val, idx) => val - vals2[idx]);
  
  // Check normality of differences
  const normRes = checkNormalityAndGetHTML([diffs], ["Perbedaan/Selisih (Before - After)"]);
  
  const res = window.AquaMath.pairedTTest(vals1, vals2);
  if (!res) return;
  
  const sigText = res.isSignificant ? "Signifikan (H0 Ditolak)" : "Tidak Signifikan (H0 Diterima)";
  const interpretation = res.isSignificant
    ? `Terdapat perbedaan berpasangan yang signifikan secara statistik antara perlakuan <strong>${col1.name}</strong> dan <strong>${col2.name}</strong> (Rata-rata Selisih = ${res.meanDifference.toFixed(3)}, t = ${res.tStat.toFixed(3)}, p = ${res.pValue.toFixed(5)} &lt; 0.05).`
    : `Tidak terdapat perbedaan berpasangan yang signifikan secara statistik antara perlakuan <strong>${col1.name}</strong> dan <strong>${col2.name}</strong> (p = ${res.pValue.toFixed(5)} &ge; 0.05).`;
    
  // Wilcoxon Signed Rank fallback
  let wilcoxonHTML = "";
  if (normRes.violated) {
    const wxRes = window.AquaMath.wilcoxonSignedRankTest(vals1, vals2);
    if (wxRes) {
      wilcoxonHTML = `
        <hr class="panel-divider">
        <h4 class="viewport-title" style="color: #F43F5E; margin-bottom: 0.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> Deteksi Pelanggaran Asumsi Normalitas (Uji Wilcoxon Signed-Rank)</h4>
        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem; line-height: 1.4;">
          Karena asumsi normalitas untuk selisih dilanggar (p KS < 0.05), Uji peringkat non-parametrik <strong>Wilcoxon Signed-Rank</strong> dijalankan sebagai konfirmasi:
        </p>
        <table class="report-table" style="margin-bottom: 0;">
          <thead>
            <tr>
              <th>Metrik Wilcoxon</th>
              <th>Hasil Uji</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Statistik W</td><td>${wxRes.wStat} (W+ = ${wxRes.wPlus}, W- = ${wxRes.wMinus})</td></tr>
            <tr><td>Pasangan Efektif</td><td>${wxRes.nEffective} (N-nol: ${wxRes.nZero})</td></tr>
            <tr><td>Signifikansi (p-value)</td><td><strong>${wxRes.pValue.toFixed(5)}</strong></td></tr>
            <tr><td>Keputusan (α = 0.05)</td><td><span class="sig-label ${wxRes.isSignificant ? 'significant' : 'not-significant'}">${wxRes.isSignificant ? 'Signifikan' : 'Tidak Signifikan'}</span></td></tr>
          </tbody>
        </table>
      `;
    }
  }
  
  reportContainer.innerHTML = `
    <div class="glass-panel report-card">
      <h3 class="report-section-title"><i class="fa-solid fa-calculator"></i> Laporan Uji-t Berpasangan</h3>
      
      ${normRes.html}
      
      <table class="report-table">
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Hasil Uji</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Variabel Sebelum (Before)</td><td><strong>${col1.name}</strong> (Mean: ${window.AquaMath.mean(vals1).toFixed(3)})</td></tr>
          <tr><td>Variabel Sesudah (After)</td><td><strong>${col2.name}</strong> (Mean: ${window.AquaMath.mean(vals2).toFixed(3)})</td></tr>
          <tr><td>Ukuran Pasangan Sampel (N)</td><td>${vals1.length}</td></tr>
          <tr><td>Rata-rata Selisih (Mean Difference)</td><td>${res.meanDifference.toFixed(4)}</td></tr>
          <tr><td>Nilai t-stat</td><td>${res.tStat.toFixed(4)}</td></tr>
          <tr><td>Derajat Kebebasan (df)</td><td>${res.df}</td></tr>
          <tr><td>Signifikansi (p-value)</td><td><strong>${res.pValue.toFixed(5)}</strong></td></tr>
          <tr><td>Keputusan (α = 0.05)</td><td><span class="sig-label ${res.isSignificant ? 'significant' : 'not-significant'}">${sigText}</span></td></tr>
        </tbody>
      </table>
      
      <div class="glass-panel" style="background: rgba(0,0,0,0.1); border-color: rgba(255,255,255,0.05); font-size: 0.9rem; line-height: 1.5; padding: 1rem; margin-bottom: 1.5rem;">
        <strong>Kesimpulan Ilmiah:</strong><br>${interpretation}
      </div>
      
      <h4 class="viewport-title" style="margin-bottom: 1rem;"><i class="fa-solid fa-chart-line"></i> Normal Q-Q Plot dari Selisih</h4>
      <div class="chart-container" style="position: relative; height: 220px; background: rgba(0,0,0,0.15); border-radius: 12px; padding: 1rem; border: 1px solid var(--border-color);">
        <canvas id="ttestpaired-qq-chart"></canvas>
      </div>
      
      ${wilcoxonHTML}
    </div>
  `;
  
  setTimeout(() => {
    const qqCtx = document.getElementById("ttestpaired-qq-chart");
    if (qqCtx) {
      statsChart = window.AquaChart.createQQPlot(qqCtx, diffs, "Q-Q Plot Selisih (Before - After)");
    }
  }, 50);
}

// 6e. One-Way ANOVA & Tukey HSD Report
function runANOVA1(cols) {
  if (cols.length < 2) {
    alert("Diperlukan minimal 2 kolom perlakuan numerik untuk ANOVA.");
    return;
  }
  
  const reportContainer = document.getElementById("analysis-report-container");
  const groups = cols.map(c => c.values.filter(v => typeof v === 'number'));
  const labels = cols.map(c => c.name);
  
  // 1. Check Normality
  const normRes = checkNormalityAndGetHTML(groups, labels);
  
  // 2. Check Assumption: Levene's Test
  const isLeveneCheck = document.getElementById("toggle-levene-assumption").classList.contains("active");
  let leveneRes = null;
  
  if (isLeveneCheck) {
    leveneRes = window.AquaMath.leveneTest(groups);
  }
  
  // 3. Perform ANOVA
  const res = window.AquaANOVA.oneWayANOVA(groups, labels);
  if (!res) return;
  
  // 4. Fallback Non-Parametric Kruskal-Wallis if Levene or Normality fails
  let kwHTML = "";
  const assumptionFailed = (leveneRes && !leveneRes.isHomogeneous) || normRes.violated;
  if (assumptionFailed) {
    const kwRes = window.AquaMath.kruskalWallisTest(groups);
    let reason = "";
    if (normRes.violated && leveneRes && !leveneRes.isHomogeneous) {
      reason = "asumsi normalitas dan homogenitas varians dilanggar";
    } else if (normRes.violated) {
      reason = "asumsi normalitas dilanggar";
    } else {
      reason = "asumsi homogenitas varians tidak terpenuhi (p Levene < 0.05)";
    }
    
    kwHTML = `
      <hr class="panel-divider">
      <h4 class="viewport-title" style="color: #F43F5E; margin-bottom: 0.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> Deteksi Pelanggaran Asumsi (Uji Kruskal-Wallis)</h4>
      <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem; line-height: 1.4;">
        Karena ${reason}, Uji peringkat non-parametrik <strong>Kruskal-Wallis H-test</strong> dijalankan untuk memastikan validitas:
      </p>
      <table class="report-table">
        <thead>
          <tr>
            <th>Parameter Kruskal-Wallis</th>
            <th>Hasil Uji</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Statistik H (Chi-Square)</td><td>${kwRes.hStat.toFixed(4)}</td></tr>
          <tr><td>Derajat Kebebasan (df)</td><td>${kwRes.df}</td></tr>
          <tr><td>Signifikansi (p-value)</td><td><strong>${kwRes.pValue.toFixed(5)}</strong></td></tr>
          <tr><td>Keputusan (α = 0.05)</td><td><span class="sig-label ${kwRes.isSignificant ? 'significant' : 'not-significant'}">${kwRes.isSignificant ? 'Signifikan' : 'Tidak Signifikan'}</span></td></tr>
        </tbody>
      </table>
    `;
  }
  
  // 5. Build Tukey HSD pairwise comparison table
  let tukeyHTML = "";
  if (res.isSignificant && res.tukey) {
    tukeyHTML = `
      <hr class="panel-divider">
      <h4 class="viewport-title" style="margin-bottom: 0.75rem;"><i class="fa-solid fa-scale-balanced"></i> Uji Lanjutan Tukey HSD (Post-Hoc Pairwise, q-crit: ${res.tukey.qCritical.toFixed(3)})</h4>
      <table class="report-table" style="font-size: 0.8rem;">
        <thead>
          <tr>
            <th>Perbandingan Kelompok</th>
            <th>Beda Rata-rata (Diff)</th>
            <th>Nilai q-stat</th>
            <th>Batas Kritis (Diff Kritis)</th>
            <th>Signifikan?</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    res.tukey.comparisons.forEach(comp => {
      tukeyHTML += `
        <tr>
          <td><strong>${comp.group1}</strong> vs <strong>${comp.group2}</strong></td>
          <td style="color: ${comp.difference > 0 ? '#10b981' : '#f43f5e'}; font-weight: 600;">${comp.difference.toFixed(4)}</td>
          <td>${comp.qStat.toFixed(3)}</td>
          <td>± ${comp.criticalDifference.toFixed(4)}</td>
          <td><span class="sig-label ${comp.isSignificant ? 'significant' : 'not-significant'}">${comp.isSignificant ? 'Ya' : 'Tidak'}</span></td>
        </tr>
      `;
    });
    
    tukeyHTML += `</tbody></table>`;
  }
  
  const interpretation = res.isSignificant
    ? "Terdapat perbedaan rata-rata yang signifikan secara statistik antara setidaknya satu pasang perlakuan (p-value &lt; 0.05). Jalankan peninjauan pada uji Tukey HSD di bawah untuk melihat perbedaan spesifik."
    : "Tidak terdapat perbedaan rata-rata yang signifikan secara statistik di antara semua perlakuan kelompok (p-value &ge; 0.05).";
    
  reportContainer.innerHTML = `
    <div class="glass-panel report-card">
      <h3 class="report-section-title"><i class="fa-solid fa-square-poll-horizontal"></i> Laporan Uji ANOVA Satu Arah (One-Way ANOVA)</h3>
      
      ${normRes.html}
      
      ${leveneRes ? `
        <div class="glass-panel" style="background: rgba(255,255,255,0.01); border-color: rgba(255,255,255,0.05); margin-bottom: 1.25rem; font-size: 0.8rem; line-height: 1.4; padding: 0.75rem 1rem;">
          <strong>Uji Asumsi Homogenitas Varians (Levene's Test):</strong><br>
          F-stat = ${leveneRes.fStat.toFixed(3)}, p-value = ${leveneRes.pValue.toFixed(4)} -> 
          <span style="color: ${leveneRes.isHomogeneous ? '#10b981' : '#f43f5e'}; font-weight: 700;">
            ${leveneRes.isHomogeneous ? 'Asumsi Homogen Terpenuhi (ANOVA Valid)' : 'Asumsi Homogen Dilanggar (Rekomendasi Uji Kruskal-Wallis)'}
          </span>
        </div>
      ` : ""}
      
      <h4 class="viewport-title" style="margin-bottom: 0.5rem;">Tabel Ringkasan ANOVA</h4>
      <table class="report-table">
        <thead>
          <tr>
            <th>Sumber Variansi</th>
            <th>Sum of Squares (SS)</th>
            <th>df</th>
            <th>Mean Square (MS)</th>
            <th>F-stat</th>
            <th>p-value</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Antar Perlakuan (Between)</td><td>${res.ssBetween.toFixed(4)}</td><td>${res.dfBetween}</td><td>${res.msBetween.toFixed(4)}</td><td rowspan="2" style="vertical-align: middle; text-align: center; font-weight: 700; font-size: 1.1rem; color: var(--text-accent);">${res.fStat.toFixed(4)}</td><td rowspan="2" style="vertical-align: middle; text-align: center; font-weight: 700; font-size: 1.1rem; color: var(--text-accent);">${res.pValue.toFixed(5)}</td></tr>
          <tr><td>Dalam Kelompok (Within/Error)</td><td>${res.ssWithin.toFixed(4)}</td><td>${res.dfWithin}</td><td>${res.msWithin.toFixed(4)}</td></tr>
          <tr style="font-weight: 700;"><td>Total</td><td>${res.ssTotal.toFixed(4)}</td><td>${res.dfTotal}</td><td></td><td></td><td>Keputusan: <span class="sig-label ${res.isSignificant ? 'significant' : 'not-significant'}">${res.isSignificant ? 'Signifikan' : 'Tidak Signifikan'}</span></td></tr>
        </tbody>
      </table>
      
      <div class="glass-panel" style="background: rgba(0,0,0,0.1); border-color: rgba(255,255,255,0.05); font-size: 0.9rem; line-height: 1.5; padding: 1rem; margin-bottom: 1.5rem;">
        <strong>Kesimpulan Ilmiah:</strong><br>${interpretation}
      </div>
      
      <!-- ANOVA Bar Chart container -->
      <h4 class="viewport-title" style="margin-bottom: 1rem;"><i class="fa-solid fa-chart-bar"></i> Visualisasi Rata-rata & Simpangan Baku (SD)</h4>
      <div class="chart-container" style="position: relative; height: 220px; background: rgba(0,0,0,0.1); border-radius: 12px; padding: 1rem; border: 1px solid var(--border-color); margin-bottom: 1rem;">
        <canvas id="anova-chart"></canvas>
      </div>
      
      ${tukeyHTML}
      ${kwHTML}
    </div>
  `;
  
  // Render Bar chart with SD error bars using Chart.js helper
  setTimeout(() => {
    const barCtx = document.getElementById("anova-chart");
    if (barCtx) {
      statsChart = window.AquaChart.createBarChartWithError(
        barCtx,
        res.groups.map(g => g.label),
        res.groups.map(g => g.mean),
        res.groups.map(g => g.sd),
        "Hasil Perbandingan Rata-rata Kelompok",
        "Rata-rata ± SD"
      );
    }
  }, 50);
}

// 6f. Two-Way ANOVA Report (Factorial design analysis)
function runANOVA2(cols) {
  // Two-Way ANOVA expects:
  // Column 0: Factor A values (categories/strings)
  // Column 1: Factor B values (categories/strings)
  // Column 2: Outcomes (numbers)
  if (cols.length < 3) {
    alert("Diperlukan minimal 3 kolom untuk ANOVA Dua Arah:\nKolom 1: Faktor A (Baris), Kolom 2: Faktor B (Kolom), Kolom 3: Variabel Respon (Numerik).");
    return;
  }
  
  const reportContainer = document.getElementById("analysis-report-container");
  
  const factorA = cols[0].values.map(String);
  const factorB = cols[1].values.map(String);
  const outcomes = cols[2].values.map(Number);
  
  // Exclude non-numeric outcomes check
  const validIndices = [];
  for (let i = 0; i < outcomes.length; i++) {
    if (!isNaN(outcomes[i])) {
      validIndices.push(i);
    }
  }
  
  if (validIndices.length < 4) {
    alert("Diperlukan minimal 4 baris data lengkap.");
    return;
  }
  
  const cleanA = validIndices.map(idx => factorA[idx]);
  const cleanB = validIndices.map(idx => factorB[idx]);
  const cleanOutcomes = validIndices.map(idx => outcomes[idx]);
  
  const includeInteraction = document.getElementById("toggle-anova-2-interaction").classList.contains("active");
  
  const res = window.AquaANOVA.twoWayANOVA(cleanA, cleanB, cleanOutcomes, includeInteraction);
  if (!res) {
    alert("Gagal melakukan kalkulasi ANOVA Dua Arah. Pastikan jumlah level faktor minimal 2 untuk masing-masing Faktor.");
    return;
  }
  
  // Format report output
  let html = `
    <div class="glass-panel report-card">
      <h3 class="report-section-title"><i class="fa-solid fa-square-poll-horizontal"></i> Laporan Uji ANOVA Dua Arah (Two-Way ANOVA)</h3>
      <table class="report-table">
        <thead>
          <tr>
            <th>Sumber Variansi</th>
            <th>Sum of Squares (SS)</th>
            <th>df</th>
            <th>Mean Square (MS)</th>
            <th>F-stat</th>
            <th>p-value</th>
            <th>Keputusan (α = 0.05)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Faktor A (${cols[0].name})</strong></td>
            <td>${res.factorA.ss.toFixed(4)}</td>
            <td>${res.factorA.df}</td>
            <td>${res.factorA.ms.toFixed(4)}</td>
            <td>${res.factorA.fStat.toFixed(4)}</td>
            <td><strong>${res.factorA.pValue.toFixed(5)}</strong></td>
            <td><span class="sig-label ${res.factorA.isSignificant ? 'significant' : 'not-significant'}">${res.factorA.isSignificant ? 'Signifikan' : 'Tidak Signifikan'}</span></td>
          </tr>
          <tr>
            <td><strong>Faktor B (${cols[1].name})</strong></td>
            <td>${res.factorB.ss.toFixed(4)}</td>
            <td>${res.factorB.df}</td>
            <td>${res.factorB.ms.toFixed(4)}</td>
            <td>${res.factorB.fStat.toFixed(4)}</td>
            <td><strong>${res.factorB.pValue.toFixed(5)}</strong></td>
            <td><span class="sig-label ${res.factorB.isSignificant ? 'significant' : 'not-significant'}">${res.factorB.isSignificant ? 'Signifikan' : 'Tidak Signifikan'}</span></td>
          </tr>
  `;
  
  if (res.hasInteraction && res.interaction) {
    html += `
          <tr>
            <td><strong>Interaksi (A x B)</strong></td>
            <td>${res.interaction.ss.toFixed(4)}</td>
            <td>${res.interaction.df}</td>
            <td>${res.interaction.ms.toFixed(4)}</td>
            <td>${res.interaction.fStat.toFixed(4)}</td>
            <td><strong>${res.interaction.pValue.toFixed(5)}</strong></td>
            <td><span class="sig-label ${res.interaction.isSignificant ? 'significant' : 'not-significant'}">${res.interaction.isSignificant ? 'Signifikan' : 'Tidak Signifikan'}</span></td>
          </tr>
    `;
  }
  
  html += `
          <tr>
            <td>Galat (Error / Within)</td>
            <td>${res.error.ss.toFixed(4)}</td>
            <td>${res.error.df}</td>
            <td>${res.error.ms.toFixed(4)}</td>
            <td></td><td></td><td></td>
          </tr>
          <tr style="font-weight: 700; background: rgba(255,255,255,0.02)">
            <td>Total</td>
            <td>${res.total.ss.toFixed(4)}</td>
            <td>${res.total.df}</td>
            <td></td><td></td><td></td><td></td>
          </tr>
        </tbody>
      </table>
      
      <div class="glass-panel" style="background: rgba(0,0,0,0.1); border-color: rgba(255,255,255,0.05); font-size: 0.85rem; line-height: 1.5; padding: 1rem;">
        <strong>Interpretasi Ilmiah:</strong><br>
        1. Efek Utama Faktor <strong>${cols[0].name}</strong>: ${res.factorA.isSignificant ? 'Berpengaruh signifikan terhadap hasil respon.' : 'Tidak berpengaruh signifikan terhadap hasil respon.'}<br>
        2. Efek Utama Faktor <strong>${cols[1].name}</strong>: ${res.factorB.isSignificant ? 'Berpengaruh signifikan terhadap hasil respon.' : 'Tidak berpengaruh signifikan terhadap hasil respon.'}<br>
        ${res.hasInteraction && res.interaction ? `3. Interaksi <strong>(${cols[0].name} x ${cols[1].name})</strong>: ${res.interaction.isSignificant ? '<span style="color: var(--text-accent);">Terjadi interaksi signifikan. Pengaruh satu faktor bergantung pada level faktor lainnya.</span>' : 'Tidak terjadi interaksi yang signifikan.'}` : '3. Interaksi tidak dihitung (asumsi additif atau replikasi tidak cukup).'}
      </div>
    </div>
  `;
  
  reportContainer.innerHTML = html;
}

// 6g. Regression and Correlation matrix Report
function runRegression(cols) {
  if (cols.length < 2) {
    alert("Diperlukan minimal 2 kolom data numerik.");
    return;
  }
  
  const reportContainer = document.getElementById("analysis-report-container");
  const modelType = document.getElementById("regression-model-type").value;
  
  const colX = cols[0];
  const colY = cols[1];
  
  const xs = colX.values.filter(v => typeof v === 'number');
  const ys = colY.values.filter(v => typeof v === 'number');
  
  if (xs.length !== ys.length || xs.length < 3) {
    alert("Ukuran sampel X dan Y harus sama dan memiliki minimal 3 pasang baris data numerik.");
    return;
  }
  
  // 1. Solve Regression
  const res = window.AquaRegression.fitModel(xs, ys, modelType);
  if (!res) {
    alert("Gagal memproses model regresi. Pastikan data tidak bernilai negatif jika memilih model Eksponensial atau Logaritmik.");
    return;
  }
  
  // 2. Compute Correlation Matrices
  const datasetArrays = cols.map(c => c.values.filter(v => typeof v === 'number'));
  const labels = cols.map(c => c.name);
  const pearson = window.AquaRegression.pearsonMatrix(datasetArrays, labels);
  const spearman = window.AquaRegression.spearmanMatrix(datasetArrays, labels);
  
  // 3. Render Correlation Matrix HTML
  let corrHTML = `
    <hr class="panel-divider">
    <div class="form-row">
      <div style="flex: 1;">
        <h4 class="viewport-title" style="font-size: 0.95rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-table-cells"></i> Matriks Korelasi Pearson</h4>
        <table class="report-table" style="font-size: 0.75rem;">
          <thead><tr><th>Variabel</th>${labels.map(l => `<th>${l}</th>`).join("")}</tr></thead>
          <tbody>
  `;
  for (let i = 0; i < labels.length; i++) {
    corrHTML += `<tr><td><strong>${labels[i]}</strong></td>`;
    for (let j = 0; j < labels.length; j++) {
      const val = pearson.matrix[i][j];
      corrHTML += `<td style="color: ${Math.abs(val) > 0.7 ? 'var(--text-accent)' : 'inherit'}; font-weight: ${i===j ? 'bold' : 'normal'}">${val.toFixed(4)}</td>`;
    }
    corrHTML += `</tr>`;
  }
  corrHTML += `</tbody></table></div>`;
  
  // Add Spearman
  corrHTML += `
      <div style="flex: 1;">
        <h4 class="viewport-title" style="font-size: 0.95rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-table-cells"></i> Matriks Korelasi Spearman</h4>
        <table class="report-table" style="font-size: 0.75rem;">
          <thead><tr><th>Variabel</th>${labels.map(l => `<th>${l}</th>`).join("")}</tr></thead>
          <tbody>
  `;
  for (let i = 0; i < labels.length; i++) {
    corrHTML += `<tr><td><strong>${labels[i]}</strong></td>`;
    for (let j = 0; j < labels.length; j++) {
      const val = spearman.matrix[i][j];
      corrHTML += `<td style="color: ${Math.abs(val) > 0.7 ? 'var(--accent-secondary)' : 'inherit'}; font-weight: ${i===j ? 'bold' : 'normal'}">${val.toFixed(4)}</td>`;
    }
    corrHTML += `</tr>`;
  }
  corrHTML += `</tbody></table></div></div>`;
  
  const sigText = res.isSignificant ? "Signifikan (H0 Ditolak)" : "Tidak Signifikan (H0 Diterima)";
  
  // Calculate fitted values and residuals
  const fitted = xs.map(xVal => res.predict(xVal));
  const residuals = ys.map((yVal, idx) => yVal - fitted[idx]);
  
  reportContainer.innerHTML = `
    <div class="glass-panel report-card">
      <h3 class="report-section-title"><i class="fa-solid fa-chart-line"></i> Laporan Analisis Regresi & Pemodelan Kurva</h3>
      <table class="report-table">
        <thead>
          <tr>
            <th>Parameter Regresi</th>
            <th>Hasil Pemodelan</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Jenis Model Kurva</td><td><strong>Regresi ${res.type}</strong></td></tr>
          <tr><td>Persamaan Matematika</td><td style="color: var(--text-accent); font-weight: 700; font-family: monospace; font-size: 1rem;">${res.formula}</td></tr>
          <tr><td>Koefisien Determinasi (R²)</td><td style="font-weight: 700; font-size: 1rem;">${res.r2.toFixed(5)}</td></tr>
          <tr><td>Statistik Signifikansi (t-stat / F-stat)</td><td>${res.tStat.toFixed(4)}</td></tr>
          <tr><td>Derajat Kebebasan (df)</td><td>${res.df}</td></tr>
          <tr><td>Signifikansi Uji (p-value)</td><td><strong>${res.pValue.toFixed(5)}</strong></td></tr>
          <tr><td>Status Signifikansi Kemiringan (α = 0.05)</td><td><span class="sig-label ${res.isSignificant ? 'significant' : 'not-significant'}">${sigText}</span></td></tr>
        </tbody>
      </table>
      
      <!-- Regression Line Chart + Residual Plot side-by-side -->
      <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
        <div style="flex: 1; min-width: 280px;">
          <h4 class="viewport-title" style="margin-bottom: 1rem;"><i class="fa-solid fa-chart-scatter"></i> Visualisasi Kurva Regresi</h4>
          <div class="chart-container" style="position: relative; height: 260px; background: rgba(0,0,0,0.1); border-radius: 12px; padding: 1rem; border: 1px solid var(--border-color);">
            <canvas id="regression-chart"></canvas>
          </div>
        </div>
        <div style="flex: 1; min-width: 280px;">
          <h4 class="viewport-title" style="margin-bottom: 1rem;"><i class="fa-solid fa-chart-line"></i> Analisis Sisaan (Residual Plot)</h4>
          <div class="chart-container" style="position: relative; height: 260px; background: rgba(0,0,0,0.15); border-radius: 12px; padding: 1rem; border: 1px solid var(--border-color);">
            <canvas id="residual-chart"></canvas>
          </div>
        </div>
      </div>
      
      ${corrHTML}
    </div>
  `;
  
  // Render Chart.js scatter + actual curve points (not linear approximation)
  setTimeout(() => {
    const chartCtx = document.getElementById("regression-chart");
    const residualCtx = document.getElementById("residual-chart");
    
    if (chartCtx) {
      const points = xs.map((xVal, idx) => ({ x: xVal, y: ys[idx] }));

      // Generate actual curve points based on model type
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const numPoints = 100;
      const curvePoints = [];

      for (let i = 0; i <= numPoints; i++) {
        const xVal = minX + (maxX - minX) * (i / numPoints);
        let yVal = null;

        const mt = modelType.toLowerCase();
        switch (mt) {
          case 'linear':
            yVal = res.parameters.slope * xVal + res.parameters.intercept;
            break;
          case 'logarithmic':
            if (xVal > 0) yVal = res.parameters.a * Math.log(xVal) + res.parameters.b;
            break;
          case 'quadratic':
          case 'polynomial':
            yVal = res.parameters.a * xVal * xVal + res.parameters.b * xVal + res.parameters.c;
            break;
          case 'exponential':
            if (res.parameters.a !== undefined) yVal = res.parameters.a * Math.exp(res.parameters.b * xVal);
            break;
          case 'power':
            if (xVal > 0 && res.parameters.a !== undefined) yVal = res.parameters.a * Math.pow(xVal, res.parameters.b);
            break;
          default:
            yVal = res.parameters.slope * xVal + res.parameters.intercept;
        }

        if (yVal !== null && isFinite(yVal)) {
          curvePoints.push({ x: xVal, y: yVal });
        }
      }

      new Chart(chartCtx, {
        type: 'scatter',
        data: {
          datasets: [
            {
              type: 'line',
              label: `Kurva Regresi ${res.type}`,
              data: curvePoints,
              borderColor: 'rgba(0, 242, 254, 0.8)',
              borderWidth: 2,
              pointRadius: 0,
              fill: false,
              tension: 0.1,
              order: 2
            },
            {
              type: 'scatter',
              label: 'Data Observasi',
              data: points,
              backgroundColor: 'rgba(245, 158, 11, 0.8)',
              pointRadius: 5,
              order: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              title: { display: true, text: colX.name, color: '#9ca3af' },
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#9ca3af' }
            },
            y: {
              title: { display: true, text: colY.name, color: '#9ca3af' },
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#9ca3af' }
            }
          },
          plugins: {
            legend: { labels: { color: '#9ca3af' } },
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  return `(${ctx.raw.x.toFixed(3)}, ${ctx.raw.y.toFixed(3)})`;
                }
              }
            }
          }
        }
      });
    }
    
    if (residualCtx) {
      window.AquaChart.createResidualPlot(residualCtx, fitted, residuals, "Plot Sisaan vs Nilai Prediksi", "Nilai Prediksi / Fitted Value");
    }
  }, 50);
}

// 6h. Column / Row Selection Toggles & Deletion
window.toggleColSelect = function(colIdx) {
  if (selectedCols.has(colIdx)) selectedCols.delete(colIdx);
  else selectedCols.add(colIdx);
  renderSpreadsheet();
};

window.toggleRowSelect = function(rowIdx) {
  if (selectedRows.has(rowIdx)) selectedRows.delete(rowIdx);
  else selectedRows.add(rowIdx);
  renderSpreadsheet();
};

window.deleteSelectedCols = function() {
  if (selectedCols.size === 0) { alert('Pilih kolom terlebih dahulu dengan mengklik header kolom.'); return; }
  if (gridHeaders.length - selectedCols.size < 1) { alert('Tidak bisa menghapus semua kolom.'); return; }

  const toDelete = [...selectedCols].sort((a, b) => b - a); // delete from right to left
  toDelete.forEach(colIdx => {
    gridHeaders.splice(colIdx, 1);
    gridData.forEach(row => row.splice(colIdx, 1));
  });
  selectedCols.clear();
  renderSpreadsheet();
};

window.deleteSelectedRows = function() {
  if (selectedRows.size === 0) { alert('Pilih baris terlebih dahulu dengan mengklik nomor baris.'); return; }

  const toDelete = [...selectedRows].sort((a, b) => b - a); // delete from bottom to top
  toDelete.forEach(rowIdx => {
    gridData.splice(rowIdx, 1);
  });
  selectedRows.clear();
  renderSpreadsheet();
};

// 7. Experimental Layout Generator Runner
function runExperimentalDesign() {
  const reportContainer = document.getElementById("analysis-report-container");
  const mode = document.getElementById("design-mode").value;
  const treatmentsInput = document.getElementById("design-treatments").value;
  const reps = parseInt(document.getElementById("design-reps").value) || 3;
  const cols = parseInt(document.getElementById("design-cols").value) || 4;
  
  // Parse treatments
  const treatments = treatmentsInput.split(",").map(t => t.trim()).filter(t => t !== "");
  if (treatments.length < 2) {
    alert("Silakan masukkan minimal 2 perlakuan (pisahkan dengan koma).");
    return;
  }
  
  let res;
  let summaryText = "";
  
  if (mode === "crd") {
    const rows = Math.ceil((treatments.length * reps) / cols);
    res = window.AquaDesign.generateCRD(treatments, reps, rows, cols);
    summaryText = `Rancangan Acak Lengkap (CRD): ${treatments.length} Perlakuan dengan ${reps} Ulangan (Total Unit = ${treatments.length * reps})`;
  } else {
    // RCBD
    const rows = Math.ceil((treatments.length * reps) / cols);
    res = window.AquaDesign.generateRCBD(treatments, reps, rows, cols);
    summaryText = `Rancangan Acak Kelompok (RCBD): ${treatments.length} Perlakuan di dalam ${reps} Blok/Kelompok (Total Unit = ${treatments.length * reps})`;
  }
  
  if (res.error) {
    alert(res.error);
    return;
  }
  
  // Generate Grid layout HTML
  const rowsCount = res.grid.length;
  const colsCount = cols;
  
  let gridHTML = `
    <div class="design-grid-viewport" style="grid-template-columns: repeat(${colsCount}, 1fr);">
  `;
  
  for (let r = 0; r < rowsCount; r++) {
    for (let c = 0; c < colsCount; c++) {
      const cell = res.grid[r][c];
      const isFilled = cell && cell.tIdx !== -1;
      
      gridHTML += `
        <div class="design-tank-unit ${isFilled ? 'filled' : ''}">
          <div class="tank-treatment-label">${isFilled ? cell.treatment : "KOSONG"}</div>
          <div class="tank-meta-label">
            ${isFilled ? (mode === "crd" ? `Reps: ${cell.replication}` : `Blok: ${cell.block}`) : ""}
            [Grid ${r+1},${c+1}]
          </div>
        </div>
      `;
    }
  }
  gridHTML += `</div>`;
  
  // Export Excel function wrapper for visual layouts
  window.exportDesignExcel = function() {
    const sheetData = [
      ["AQUA INSIGHT - RANCANGAN EXPERIMEN ACAK", ""],
      ["Jenis Rancangan", mode === "crd" ? "RAL / CRD (Acak Lengkap)" : "RAK / RCBD (Acak Kelompok)"],
      ["Jumlah Perlakuan", treatments.length],
      ["Replikasi / Blok", reps],
      ["Tanggal Pembuatan", new Date().toLocaleString("id-ID")],
      ["", ""],
      ["TATA LETAK UNIT PERCOBAAN (GRID)", ""]
    ];
    
    // Add grid as 2D layout in Excel
    res.grid.forEach((row, rIdx) => {
      const rowLabels = row.map(cell => cell.tIdx !== -1 ? `${cell.treatment} (${mode === "crd" ? "R" : "B"}${mode === "crd" ? cell.replication : cell.block})` : "KOSONG");
      sheetData.push(rowLabels);
    });
    
    window.AquaFile.exportToExcel([{ name: "Layout Percobaan", data: sheetData }], "aqua_insight_experimental_layout.xlsx");
  };
  
  reportContainer.innerHTML = `
    <div class="glass-panel report-card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3 class="report-section-title" style="border: 0; margin: 0; padding: 0;"><i class="fa-solid fa-network-wired"></i> Tata Letak Rancangan Eksperimen</h3>
        <button class="header-btn compact-btn" onclick="exportDesignExcel()"><i class="fa-solid fa-file-excel"></i> Ekspor Excel</button>
      </div>
      <hr class="panel-divider">
      
      <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
        Tata letak unit percobaan (kolam/bak/akuarium) di bawah dihasilkan secara acak sesuai dengan model <strong>${mode.toUpperCase()}</strong>. Gunakan grid layout ini untuk menata akuarium/pond di laboratorium secara fisik guna meminimalkan kesalahan sistemik (bias).
      </p>
      
      ${gridHTML}
      
      <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 1rem; text-align: center; font-style: italic;">
        * ${summaryText}
      </p>
    </div>
  `;
}

// 8. Sample Size and Power analysis runner
function runSampleSizePower() {
  const reportContainer = document.getElementById("analysis-report-container");
  const type = document.getElementById("sample-calc-type").value;
  const alpha = parseFloat(document.getElementById("sample-alpha").value);
  const power = parseFloat(document.getElementById("sample-power").value);
  
  let resHTML = "";
  
  if (type === "single") {
    const sd = parseFloat(document.getElementById("sample-sd").value) || 10;
    const margin = parseFloat(document.getElementById("sample-margin").value) || 2;
    
    const res = window.AquaDesign.calculateSampleSize("mean", { alpha, power, sd, margin });
    resHTML = `
      <table class="report-table">
        <thead><tr><th>Parameter Estimasi Mean</th><th>Nilai Input / Hasil</th></tr></thead>
        <tbody>
          <tr><td>Taraf Nyata (Alpha α)</td><td>${alpha} (Daya Kepercayaan ${(1-alpha)*100}%)</td></tr>
          <tr><td>Daya Uji (Power 1-β)</td><td>${power} (${power*100}%)</td></tr>
          <tr><td>Standar Deviasi Populasi (σ)</td><td>${sd}</td></tr>
          <tr><td>Batas Toleransi Error Terpilih (E)</td><td>${margin}</td></tr>
          <tr style="background: rgba(0,242,254,0.05); font-weight: 700; color: var(--text-accent); font-size: 1.1rem;">
            <td>Ukuran Sampel Minimum (n)</td>
            <td>${res.sampleSize} sampel / ulangan</td>
          </tr>
        </tbody>
      </table>
      <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">
        <strong>Interpretasi:</strong> Untuk mengestimasi nilai rata-rata dengan tingkat kepercayaan ${(1-alpha)*100}% dan tingkat toleransi kesalahan maksimal ± ${margin}, Anda memerlukan sampel minimal sebanyak <strong>${res.sampleSize}</strong> unit percobaan.
      </p>
    `;
  } else {
    // comparison of two means
    const effectSize = parseFloat(document.getElementById("sample-effect").value) || 0.5;
    
    const res = window.AquaDesign.calculateSampleSize("twomeans", { alpha, power, effectSize });
    resHTML = `
      <table class="report-table">
        <thead><tr><th>Parameter Uji Perbandingan</th><th>Nilai Input / Hasil</th></tr></thead>
        <tbody>
          <tr><td>Taraf Nyata (Alpha α)</td><td>${alpha}</td></tr>
          <tr><td>Daya Uji (Power 1-β)</td><td>${power}</td></tr>
          <tr><td>Ukuran Efek Terpilih (Cohen's d)</td><td>${effectSize} (Efek sedang)</td></tr>
          <tr><td>Rasio Alokasi Kelompok (n2/n1)</td><td>1.0 (Seimbang)</td></tr>
          <tr style="background: rgba(0,242,254,0.05); font-weight: 700; color: var(--text-accent); font-size: 1.1rem;">
            <td>Ukuran Sampel per Kelompok</td>
            <td>n1 = ${res.sampleSizeGroup1}, n2 = ${res.sampleSizeGroup2}</td>
          </tr>
          <tr style="font-weight: 700;">
            <td>Total Ukuran Sampel</td>
            <td>N = ${res.totalSampleSize} sampel</td>
          </tr>
        </tbody>
      </table>
      <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">
        <strong>Interpretasi:</strong> Dalam uji-t perbandingan dua kelompok untuk mendeteksi ukuran efek $d = ${effectSize}$ dengan daya uji ${power*100}%, Anda memerlukan minimal <strong>${res.sampleSizeGroup1}</strong> sampel di masing-masing kelompok (Total N = ${res.totalSampleSize}).
      </p>
    `;
  }
  
  reportContainer.innerHTML = `
    <div class="glass-panel report-card">
      <h3 class="report-section-title"><i class="fa-solid fa-chart-pie"></i> Laporan Perhitungan Ukuran Sampel (Power Analysis)</h3>
      ${resHTML}
    </div>
  `;
}

// 9. XLSX report sheets exporter wrapper
window.exportReportXLSX = function(testType) {
  // Collect data in arrays
  const sheetData = [
    ["AQUA INSIGHT - DETAIL EXCEL HASIL REPORT STATISTIK", ""],
    ["Tanggal Pengujian", new Date().toLocaleString("id-ID")],
    ["Uji Analisis", testType === 'descriptive' ? "Statistik Deskriptif" : "Uji Statistik Parametrik/Non-Parametrik"],
    ["", ""]
  ];
  
  // Format based on testType
  if (testType === 'descriptive') {
    // Headers
    const headers = ["Parameter Deskriptif", ...gridHeaders];
    sheetData.push(headers);
    
    // Add data rows programmatically
    const params = [
      { label: "Jumlah Data (N)", fn: (vals) => vals.length },
      { label: "Mean", fn: (vals) => window.AquaMath.mean(vals) },
      { label: "Median", fn: (vals) => window.AquaMath.median(vals) },
      { label: "SD", fn: (vals) => window.AquaMath.stdDev(vals, true) },
      { label: "Varian", fn: (vals) => window.AquaMath.variance(vals, true) },
      { label: "Min", fn: (vals) => Math.min(...vals) },
      { label: "Max", fn: (vals) => Math.max(...vals) }
    ];
    
    params.forEach(p => {
      const row = [p.label];
      for (let c = 0; c < gridHeaders.length; c++) {
        const vals = [];
        for (let r = 0; r < gridData.length; r++) {
          const val = gridData[r][c];
          if (val !== undefined && val !== null && val !== "" && typeof val === 'number') vals.push(val);
        }
        row.push(vals.length > 0 ? p.fn(vals) : "-");
      }
      sheetData.push(row);
    });
  }
  
  window.AquaFile.exportToExcel([{ name: "Laporan Statistika", data: sheetData }], "aqua_insight_statistics_report.xlsx");
};

// Helper for Normality Check and Alerts
function checkNormalityAndGetHTML(groups, labels) {
  let fail = false;
  let html = `<div class="glass-panel" style="background: rgba(255,255,255,0.01); border-color: rgba(255,255,255,0.05); margin-bottom: 1.25rem; font-size: 0.8rem; line-height: 1.4; padding: 0.75rem 1rem;">`;
  html += `<h4 class="viewport-title" style="margin-bottom: 0.5rem; margin-top: 0;"><i class="fa-solid fa-scale-unbalanced"></i> Uji Asumsi Normalitas (Kolmogorov-Smirnov & Lilliefors)</h4>`;
  
  groups.forEach((g, idx) => {
    const res = window.AquaMath.kolmogorovSmirnovNormalityTest(g);
    const name = labels[idx];
    if (!res.isNormal) {
      fail = true;
    }
    html += `- Kelompok <strong>${name}</strong>: D = ${res.dStat.toFixed(4)} (Kritis = ${res.dCritical.toFixed(4)}, p ≈ ${res.pValue.toFixed(3)}) -> 
    <span style="color: ${res.isNormal ? '#10b981' : '#f43f5e'}; font-weight: 700;">
      ${res.isNormal ? 'Normal' : 'Tidak Normal'}
    </span><br>`;
  });
  
  if (fail) {
    html += `<span style="color: #f43f5e; font-weight: 700; display: block; margin-top: 0.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> Peringatan: Asumsi Normalitas Dilanggar. Hasil uji parametrik mungkin bias. Silakan tinjau uji non-parametrik konfirmasi di bawah.</span>`;
  } else {
    html += `<span style="color: #10b981; font-weight: 700; display: block; margin-top: 0.5rem;"><i class="fa-solid fa-circle-check"></i> Asumsi Normalitas Terpenuhi untuk seluruh kelompok.</span>`;
  }
  html += `</div>`;
  return { html, violated: fail };
}

// Wilcoxon Signed-Rank Test Runner
function runTTestWilcoxon(cols) {
  if (cols.length < 2) {
    alert("Diperlukan minimal 2 kolom data numerik.");
    return;
  }
  
  const reportContainer = document.getElementById("analysis-report-container");
  const col1 = cols[0];
  const col2 = cols[1];
  
  const vals1 = col1.values.filter(v => typeof v === 'number');
  const vals2 = col2.values.filter(v => typeof v === 'number');
  
  if (vals1.length !== vals2.length || vals1.length < 3) {
    alert("Untuk uji berpasangan Wilcoxon, ukuran sampel kelompok 1 dan kelompok 2 harus sama persis (N1 = N2).");
    return;
  }
  
  const res = window.AquaMath.wilcoxonSignedRankTest(vals1, vals2);
  if (!res) return;
  
  const sigText = res.isSignificant ? "Signifikan (H0 Ditolak)" : "Tidak Signifikan (H0 Diterima)";
  const interpretation = res.isSignificant
    ? `Terdapat perbedaan berpasangan yang signifikan secara statistik (non-parametrik) antara perlakuan <strong>${col1.name}</strong> dan <strong>${col2.name}</strong> (W = ${res.wStat}, p = ${res.pValue.toFixed(5)} &lt; 0.05).`
    : `Tidak terdapat perbedaan berpasangan yang signifikan secara statistik antara perlakuan <strong>${col1.name}</strong> dan <strong>${col2.name}</strong> (p = ${res.pValue.toFixed(5)} &ge; 0.05).`;
    
  reportContainer.innerHTML = `
    <div class="glass-panel report-card">
      <h3 class="report-section-title"><i class="fa-solid fa-calculator"></i> Laporan Uji Wilcoxon Signed-Rank</h3>
      <table class="report-table">
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Hasil Uji</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Variabel Kelompok 1</td><td><strong>${col1.name}</strong> (Mean: ${window.AquaMath.mean(vals1).toFixed(3)})</td></tr>
          <tr><td>Variabel Kelompok 2</td><td><strong>${col2.name}</strong> (Mean: ${window.AquaMath.mean(vals2).toFixed(3)})</td></tr>
          <tr><td>Total Sampel Pasangan (N)</td><td>${vals1.length}</td></tr>
          <tr><td>Ukuran Sampel Efektif (Beda non-nol)</td><td>${res.nEffective} (N-nol: ${res.nZero})</td></tr>
          <tr><td>Statistik W</td><td>${res.wStat} (W+ = ${res.wPlus}, W- = ${res.wMinus})</td></tr>
          <tr><td>Z-stat (Approximation)</td><td>${res.zStat.toFixed(4)}</td></tr>
          <tr><td>Signifikansi (p-value)</td><td><strong>${res.pValue.toFixed(5)}</strong></td></tr>
          <tr><td>Keputusan (α = 0.05)</td><td><span class="sig-label ${res.isSignificant ? 'significant' : 'not-significant'}">${sigText}</span></td></tr>
        </tbody>
      </table>
      
      <div class="glass-panel" style="background: rgba(0,0,0,0.1); border-color: rgba(255,255,255,0.05); font-size: 0.9rem; line-height: 1.5; padding: 1rem;">
        <strong>Kesimpulan Ilmiah:</strong><br>${interpretation}
      </div>
    </div>
  `;
}

// Chi-Square Test of Independence (Contingency Table from Spreadsheet Grid)
function runChiSquareIndependence(cols) {
  const firstColVals = cols[0].values;
  const isFirstColCategories = firstColVals.some(v => typeof v === 'string');
  
  let startColIdx = 0;
  let rowLabels = [];
  if (isFirstColCategories) {
    startColIdx = 1;
    rowLabels = firstColVals.map(String);
  } else {
    const numRows = cols[0].values.length;
    for (let r = 0; r < numRows; r++) {
      rowLabels.push(`Baris_${r + 1}`);
    }
  }
  
  const observedCols = cols.slice(startColIdx);
  if (observedCols.length < 2) {
    alert("Uji Independensi Chi-Square membutuhkan minimal 2 kolom data numerik (selain kolom nama baris).");
    return;
  }
  
  const colLabels = observedCols.map(c => c.name);
  const numRows = observedCols[0].values.length;
  const matrix = [];
  
  for (let r = 0; r < numRows; r++) {
    const row = [];
    for (let c = 0; c < observedCols.length; c++) {
      const val = parseFloat(observedCols[c].values[r]);
      if (isNaN(val) || val < 0) {
        alert(`Data kontingensi pada baris ${r+1}, kolom ${colLabels[c]} harus berupa angka positif.`);
        return;
      }
      row.push(val);
    }
    matrix.push(row);
  }
  
  const res = window.AquaMath.chiSquareIndependenceTest(matrix);
  if (!res) return;
  
  const reportContainer = document.getElementById("analysis-report-container");
  const sigText = res.isSignificant ? "Signifikan (H0 Ditolak)" : "Tidak Signifikan (H0 Diterima)";
  const interpretation = res.isSignificant
    ? `Terdapat hubungan asosiasi yang signifikan secara statistik antara variabel baris dan variabel kolom (χ² = ${res.chi2Stat.toFixed(3)}, p = ${res.pValue.toFixed(5)} &lt; 0.05).`
    : `Tidak terdapat cukup bukti untuk menyatakan adanya hubungan antara variabel baris dan variabel kolom. Kedua faktor saling bebas (p = ${res.pValue.toFixed(5)} &ge; 0.05).`;
    
  let tableHTML = `
    <table class="report-table" style="font-size: 0.8rem;">
      <thead>
        <tr>
          <th>Kategori (Baris \\ Kolom)</th>
          ${colLabels.map(l => `<th>${l} (Obs / Exp)</th>`).join("")}
          <th>Total Baris</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  for (let r = 0; r < numRows; r++) {
    tableHTML += `<tr><td><strong>${rowLabels[r]}</strong></td>`;
    for (let c = 0; c < observedCols.length; c++) {
      tableHTML += `<td>${matrix[r][c]} / <span style="color: var(--text-accent);">${res.expected[r][c].toFixed(2)}</span></td>`;
    }
    tableHTML += `<td><strong>${res.rowTotals[r]}</strong></td></tr>`;
  }
  
  tableHTML += `
        <tr style="font-weight: 700; background: rgba(255,255,255,0.02)">
          <td>Total Kolom</td>
          ${res.colTotals.map(ct => `<td>${ct}</td>`).join("")}
          <td>${res.grandTotal}</td>
        </tr>
      </tbody>
    </table>
  `;
  
  reportContainer.innerHTML = `
    <div class="glass-panel report-card">
      <h3 class="report-section-title"><i class="fa-solid fa-calculator"></i> Laporan Uji Chi-Square Independensi (Tabel Kontingensi)</h3>
      
      ${tableHTML}
      
      <table class="report-table" style="margin-top: 1.5rem;">
        <thead>
          <tr>
            <th>Metode Uji Asosiasi</th>
            <th>Nilai Statistik</th>
            <th>df</th>
            <th>Asymp. Sig. (2-sided)</th>
            <th>Keputusan (α = 0.05)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Pearson Chi-Square</strong></td>
            <td><strong>${res.chi2Stat.toFixed(4)}</strong></td>
            <td>${res.df}</td>
            <td><strong>${res.pValue.toFixed(5)}</strong></td>
            <td><span class="sig-label ${res.isSignificant ? 'significant' : 'not-significant'}">${res.isSignificant ? 'Signifikan' : 'Tidak Signifikan'}</span></td>
          </tr>
          ${res.is2x2 ? `
          <tr>
            <td><strong>Continuity Correction (Yates)</strong></td>
            <td><strong>${res.yatesChi2.toFixed(4)}</strong></td>
            <td>1</td>
            <td><strong>${res.yatesPValue.toFixed(5)}</strong></td>
            <td><span class="sig-label ${res.yatesPValue < 0.05 ? 'significant' : 'not-significant'}">${res.yatesPValue < 0.05 ? 'Signifikan' : 'Tidak Signifikan'}</span></td>
          </tr>
          <tr>
            <td><strong>Likelihood Ratio</strong></td>
            <td><strong>${res.likRatio.toFixed(4)}</strong></td>
            <td>1</td>
            <td><strong>${res.likRatioPValue.toFixed(5)}</strong></td>
            <td><span class="sig-label ${res.likRatioPValue < 0.05 ? 'significant' : 'not-significant'}">${res.likRatioPValue < 0.05 ? 'Signifikan' : 'Tidak Signifikan'}</span></td>
          </tr>
          <tr>
            <td><strong>Fisher's Exact Test</strong></td>
            <td>—</td>
            <td>—</td>
            <td><strong>${res.fisherPValue.toFixed(5)}</strong></td>
            <td><span class="sig-label ${res.fisherPValue < 0.05 ? 'significant' : 'not-significant'}">${res.fisherPValue < 0.05 ? 'Signifikan' : 'Tidak Signifikan'}</span></td>
          </tr>
          ` : ''}
        </tbody>
      </table>
      
      <div class="glass-panel" style="background: rgba(0,0,0,0.1); border-color: rgba(255,255,255,0.05); font-size: 0.9rem; line-height: 1.5; padding: 1rem;">
        <strong>Kesimpulan Ilmiah:</strong><br>${interpretation}
      </div>
    </div>
  `;
}

// Chi-Square Goodness-of-Fit Test Runner
function runChiSquareGoodnessOfFit(cols) {
  if (cols.length < 2) {
    alert("Uji Goodness-of-Fit membutuhkan minimal 2 kolom numerik (Kolom 1: Observed, Kolom 2: Expected/Proportion).");
    return;
  }
  
  const reportContainer = document.getElementById("analysis-report-container");
  const obs = cols[0].values.filter(v => typeof v === 'number');
  const exp = cols[1].values.filter(v => typeof v === 'number');
  
  if (obs.length !== exp.length || obs.length < 2) {
    alert("Jumlah kategori Observed dan Expected harus sama dan minimal 2.");
    return;
  }
  
  const res = window.AquaMath.chiSquareGoodnessOfFitTest(obs, exp);
  if (!res) return;
  
  const sigText = res.isSignificant ? "Signifikan (Tidak Cocok/H0 Ditolak)" : "Tidak Signifikan (Cocok/H0 Diterima)";
  const interpretation = res.isSignificant
    ? `Frekuensi observasi tidak cocok secara signifikan dengan distribusi teoritis yang diharapkan (χ² = ${res.chi2Stat.toFixed(3)}, p = ${res.pValue.toFixed(5)} &lt; 0.05).`
    : `Frekuensi observasi cocok (fit) dengan distribusi teoritis yang diharapkan (p = ${res.pValue.toFixed(5)} &ge; 0.05).`;
    
  let tableHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>Kategori</th>
          <th>Observed (O)</th>
          <th>Expected (E)</th>
          <th>(O - E)² / E</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  for (let i = 0; i < obs.length; i++) {
    const diffTerm = res.expected[i] > 0 ? Math.pow(obs[i] - res.expected[i], 2) / res.expected[i] : 0;
    tableHTML += `
      <tr>
        <td>Kategori ${i+1}</td>
        <td>${obs[i]}</td>
        <td>${res.expected[i].toFixed(3)}</td>
        <td>${diffTerm.toFixed(4)}</td>
      </tr>
    `;
  }
  
  tableHTML += `
      <tr style="font-weight: 700; background: rgba(255,255,255,0.02)">
        <td>Total</td>
        <td>${res.grandTotal}</td>
        <td>${res.grandTotal}</td>
        <td>${res.chi2Stat.toFixed(4)}</td>
      </tr>
    </tbody>
  </table>
  `;
  
  reportContainer.innerHTML = `
    <div class="glass-panel report-card">
      <h3 class="report-section-title"><i class="fa-solid fa-calculator"></i> Laporan Uji Chi-Square Goodness-of-Fit</h3>
      
      ${tableHTML}
      
      <table class="report-table" style="margin-top: 1.5rem;">
        <thead>
          <tr>
            <th>Parameter Uji</th>
            <th>Hasil Kalkulasi</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Statistik Chi-Square (χ²)</td><td><strong>${res.chi2Stat.toFixed(4)}</strong></td></tr>
          <tr><td>Derajat Kebebasan (df)</td><td>${res.df}</td></tr>
          <tr><td>Signifikansi (p-value)</td><td><strong>${res.pValue.toFixed(5)}</strong></td></tr>
          <tr><td>Keputusan (α = 0.05)</td><td><span class="sig-label ${res.isSignificant ? 'significant' : 'not-significant'}">${sigText}</span></td></tr>
        </tbody>
      </table>
      
      <div class="glass-panel" style="background: rgba(0,0,0,0.1); border-color: rgba(255,255,255,0.05); font-size: 0.9rem; line-height: 1.5; padding: 1rem;">
        <strong>Kesimpulan Ilmiah:</strong><br>${interpretation}
      </div>
    </div>
  `;
}

// Print Exporter PDF
window.exportReportPDF = function() {
  const reportContainer = document.getElementById("analysis-report-container");
  if (!reportContainer) return;
  
  const report = reportContainer.cloneNode(true);
  
  const originalCanvases = reportContainer.querySelectorAll("canvas");
  const clonedCanvases = report.querySelectorAll("canvas");
  
  originalCanvases.forEach((orig, idx) => {
    const img = document.createElement("img");
    try {
      img.src = orig.toDataURL("image/png");
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.display = "block";
      img.style.margin = "1.5rem auto";
      img.style.border = "1px solid #cbd5e1";
      img.style.borderRadius = "8px";
      img.style.padding = "10px";
      img.style.background = "#f8fafc";
    } catch (err) {
      console.warn("PDF export canvas render error:", err);
    }
    const clone = clonedCanvases[idx];
    if (clone) {
      clone.parentNode.replaceChild(img, clone);
    }
  });
  
  const printWin = window.open("", "_blank", "width=850,height=950");
  if (!printWin) {
    alert("Pop-up diblokir. Izinkan pop-up untuk mencetak laporan.");
    return;
  }
  
  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Laporan Hasil Analisis Statistika - Aqua Insight</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          background-color: #ffffff !important;
          color: #0f172a !important;
          font-family: 'Inter', sans-serif;
          margin: 30px;
          font-size: 13px;
          line-height: 1.5;
        }
        .glass-panel {
          background: #f8fafc !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 10px !important;
          padding: 20px !important;
          margin-bottom: 25px !important;
          box-shadow: none !important;
        }
        .report-section-title {
          font-family: 'Outfit', sans-serif;
          font-size: 1.35rem;
          color: #0f172a !important;
          border-bottom: 2px solid #cbd5e1 !important;
          padding-bottom: 8px;
          margin-top: 0;
          margin-bottom: 15px;
        }
        .viewport-title {
          font-family: 'Outfit', sans-serif;
          font-size: 1.1rem;
          color: #1e293b !important;
          margin-top: 20px;
          margin-bottom: 10px;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 12px;
        }
        .report-table th, .report-table td {
          border: 1px solid #cbd5e1 !important;
          padding: 10px;
          text-align: left;
        }
        .report-table th {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
          font-weight: 700;
        }
        .sig-label {
          padding: 3px 8px;
          border-radius: 5px;
          font-weight: 700;
          font-size: 11px;
        }
        .sig-label.significant {
          background-color: #d1fae5 !important;
          color: #065f46 !important;
        }
        .sig-label.not-significant {
          background-color: #fee2e2 !important;
          color: #991b1b !important;
        }
        .panel-divider {
          border: 0;
          border-top: 1px solid #cbd5e1;
          margin: 20px 0;
        }
        .chart-container {
          border: 1px solid #cbd5e1 !important;
          border-radius: 8px;
          padding: 15px;
          background-color: #f8fafc !important;
          height: auto !important;
        }
        button, .header-btn {
          display: none !important;
        }
        @media print {
          body { margin: 1.5cm; }
          .glass-panel { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px double #cbd5e1; padding-bottom: 15px; margin-bottom: 25px;">
        <div>
          <h2 style="font-family: 'Outfit', sans-serif; color: #0f172a; margin: 0; font-size: 1.8rem; letter-spacing: -0.5px;">AQUA INSIGHT</h2>
          <div style="font-size: 0.8rem; color: #64748b; font-weight: 600;">Ecosystem Analitik Akuakultur Berpresisi Tinggi</div>
        </div>
        <div style="text-align: right; font-size: 0.8rem; color: #64748b;">
          <strong>PT Central Proteina Prima Tbk.</strong><br>
          Technology Division / R&D Unit
        </div>
      </div>
      
      <div id="print-content"></div>
      
      <div style="text-align: center; font-size: 0.75rem; color: #94a3b8; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        Laporan Hasil Uji Statistika ini digenerasikan secara otomatis oleh Aqua Insight Platform.<br>
        © 2026 PT Central Proteina Prima Tbk. Hak Cipta Dilindungi.
      </div>
    </body>
    </html>
  `);
  printWin.document.close();
  
  const doc = printWin.document;
  const container = doc.getElementById("print-content");
  container.appendChild(doc.importNode(report, true));
  
  const btns = container.querySelectorAll("button, .header-btn");
  btns.forEach(b => b.remove());
  
  setTimeout(() => {
    printWin.print();
  }, 600);
};
