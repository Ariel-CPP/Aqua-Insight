/**
 * AQUA INSIGHT - CHART MAKER MODULE CONTROLLER
 * Upgrades: Interactive spreadsheet grid, clipboard copy-paste, advanced visual styling, 
 * and multi-format download dropdown menu (PNG, PDF, Excel, CSV).
 */

(function() {
  // Defensive initialization wrapper
  function initChartMaker() {
    const table = document.getElementById('data-table');
    const addRowBtn = document.getElementById('add-row');
    const addColBtn = document.getElementById('add-col');
    const deleteSelectedColsBtn = document.getElementById('delete-selected-cols');
    const deleteSelectedRowsBtn = document.getElementById('delete-selected-rows');
    const csvUpload = document.getElementById('csv-upload');
    const renderBtn = document.getElementById('render-btn');
    const chartTypeSelect = document.getElementById('chart-type');
    const typeBadge = document.getElementById('chart-type-label');
    const chartTitleInput = document.getElementById('chart-title-input');
    const xAxisLabelInput = document.getElementById('x-axis-label');
    const yAxisLabelInput = document.getElementById('y-axis-label');
    const toggleLegendBtn = document.getElementById('toggle-legend');
    const toggleGridBtn = document.getElementById('toggle-grid');

    // Visual controls
    const colorPaletteSelect = document.getElementById('color-palette');
    const lineTensionInput = document.getElementById('line-tension');
    const lineTensionValDisp = document.getElementById('line-tension-val');
    const pointRadiusInput = document.getElementById('point-radius');
    const pointRadiusValDisp = document.getElementById('point-radius-val');
    const barRadiusInput = document.getElementById('bar-radius');
    const barRadiusValDisp = document.getElementById('bar-radius-val');
    const barOrientationToggle = document.getElementById('toggle-bar-orientation');
    const areaFillToggle = document.getElementById('toggle-area-fill');

    // Download menu elements
    const downloadDropdownBtn = document.getElementById('download-dropdown-btn');
    const downloadMenu = document.getElementById('download-menu');
    const downloadPngBtn = document.getElementById('download-png-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const downloadExcelBtn = document.getElementById('download-excel-btn');
    const downloadCsvBtn = document.getElementById('download-csv-btn');

    if (!table || !renderBtn) {
      console.warn("Chart Maker: Required HTML elements not found.");
      return;
    }

    const CHART_TYPE_NAMES = {
      'bar': 'Bar Chart', 'line': 'Line Chart', 'pie': 'Pie Chart',
      'doughnut': 'Doughnut Chart', 'scatter': 'Scatter Plot',
      'bubble': 'Bubble Chart', 'radar': 'Radar Chart',
      'polarArea': 'Polar Area Chart', 'stacked-bar': 'Stacked Bar Chart',
      'area': 'Area Chart', 'pca': 'PCA Plot', 'hca': 'HCA Dendrogram'
    };

    let chartInstance = null;

    // Spreadsheet State
    let gridHeaders = ['Label', 'Seri 1'];
    let gridData = [
      ['A', '10'],
      ['B', '20'],
      ['C', '15'],
      ['D', '25']
    ];
    let selectedCols = new Set(); // indices (0 represents 'Label', 1 represents 'Seri 1', etc.)
    let selectedRows = new Set(); // indices in gridData
    let lastSelectedCol = null;
    let lastSelectedRow = null;

    // Color Palettes matching platform theme
    const PALETTES = {
      classic: [
        'rgba(0, 242, 254, 0.75)',   // Cyan
        'rgba(79, 172, 254, 0.75)',   // Blue
        'rgba(168, 85, 247, 0.75)',   // Violet/Purple
        'rgba(236, 72, 153, 0.75)',   // Pink
        'rgba(16, 185, 129, 0.75)',   // Emerald Green
        'rgba(245, 158, 11, 0.75)',   // Warm Amber
        'rgba(239, 68, 68, 0.75)'     // Red
      ],
      neon: [
        'rgba(0, 242, 254, 0.75)',   // Neon Cyan
        'rgba(168, 85, 247, 0.75)',   // Purple/Violet
        'rgba(236, 72, 153, 0.75)',   // Pink
        'rgba(245, 158, 11, 0.75)',   // Neon Amber
        'rgba(16, 185, 129, 0.75)',   // Emerald
        'rgba(59, 130, 246, 0.75)'    // Neon Blue
      ],
      emerald: [
        'rgba(16, 185, 129, 0.75)',   // Emerald Green
        'rgba(52, 211, 153, 0.75)',   // Mint Green
        'rgba(5, 150, 105, 0.75)',    // Dark Green
        'rgba(110, 231, 183, 0.75)',  // Soft Mint
        'rgba(4, 120, 87, 0.75)',     // Forest Green
        'rgba(209, 250, 229, 0.75)'   // Pale Emerald
      ],
      sunset: [
        'rgba(244, 63, 94, 0.75)',    // Rose Red
        'rgba(245, 158, 11, 0.75)',   // Amber
        'rgba(236, 72, 153, 0.75)',   // Sunset Pink
        'rgba(239, 68, 68, 0.75)',    // Crimson Red
        'rgba(217, 70, 239, 0.75)',   // Fuchsia
        'rgba(251, 146, 60, 0.75)'    // Sunset Orange
      ],
      warm: [
        'rgba(245, 158, 11, 0.75)',   // Gold/Amber
        'rgba(251, 191, 36, 0.75)',   // Darker Gold
        'rgba(217, 119, 6, 0.75)',    // Ochre
        'rgba(180, 83, 9, 0.75)',     // Brownish Gold
        'rgba(253, 230, 138, 0.75)',  // Pale Gold
        'rgba(120, 53, 4, 0.75)'      // Deep Bronze
      ],
      monochrome: [
        'rgba(156, 163, 175, 0.75)',  // Cool Grey
        'rgba(107, 114, 128, 0.75)',  // Medium Grey
        'rgba(209, 213, 219, 0.75)',  // Light Grey
        'rgba(75, 85, 99, 0.75)',     // Slate Grey
        'rgba(243, 244, 246, 0.75)',  // Off White/Grey
        'rgba(55, 65, 81, 0.75)'      // Charcoal Grey
      ]
    };

    // ── Table Read & Write Functions ──────────────────────────────────────────
    
    // Reads current text contents from DOM cells into the in-memory variables
    function readTableData() {
      const theadTr = table.querySelector('thead tr');
      if (!theadTr) return;

      const ths = Array.from(theadTr.querySelectorAll('th'));
      // Headers start from index 1 (index 0 is row number '#')
      gridHeaders = ths.slice(1).map(th => th.innerText.trim());

      const tbodyTrs = Array.from(table.querySelectorAll('tbody tr'));
      gridData = tbodyTrs.map(tr => {
        const tds = Array.from(tr.querySelectorAll('td'));
        // Cell index 0 is the row number
        return tds.slice(1).map(td => td.innerText.trim());
      });
    }

    // Completely renders/builds the table DOM from state variables
    function renderSpreadsheet() {
      table.innerHTML = '';

      // 1. Create table header
      const thead = document.createElement('thead');
      const headerTr = document.createElement('tr');

      const hashTh = document.createElement('th');
      hashTh.className = 'row-number-header';
      hashTh.innerText = '#';
      headerTr.appendChild(hashTh);

      gridHeaders.forEach((header, colIdx) => {
        const th = document.createElement('th');
        th.className = 'col-header';
        if (colIdx > 0) {
          th.className += ' col-header-editable';
          th.contentEditable = true;
        }
        th.innerText = header;
        th.dataset.colIdx = colIdx;

        if (selectedCols.has(colIdx)) {
          th.classList.add('cm-selected');
        }

        // Column select listener
        th.addEventListener('click', (e) => {
          if (document.activeElement === th) return;
          handleColSelect(colIdx, e.ctrlKey || e.metaKey, e.shiftKey);
        });

        // Update gridHeaders state on edit
        th.addEventListener('input', () => {
          gridHeaders[colIdx] = th.innerText.trim();
        });

        headerTr.appendChild(th);
      });
      thead.appendChild(headerTr);
      table.appendChild(thead);

      // 2. Create table body
      const tbody = document.createElement('tbody');
      gridData.forEach((row, rowIdx) => {
        const tr = document.createElement('tr');

        // Row number cell
        const numTd = document.createElement('td');
        numTd.className = 'row-num';
        numTd.innerText = rowIdx + 1;
        numTd.dataset.rowIdx = rowIdx;

        if (selectedRows.has(rowIdx)) {
          numTd.classList.add('cm-selected');
        }

        // Row select listener
        numTd.addEventListener('click', (e) => {
          handleRowSelect(rowIdx, e.ctrlKey || e.metaKey, e.shiftKey);
        });

        tr.appendChild(numTd);

        // Data cells
        row.forEach((cellVal, colIdx) => {
          const td = document.createElement('td');
          td.className = 'editable-cell';
          td.contentEditable = true;
          td.innerText = cellVal;
          td.dataset.rowIdx = rowIdx;
          td.dataset.colIdx = colIdx;

          if (selectedCols.has(colIdx) || selectedRows.has(rowIdx)) {
            td.classList.add('cm-selected');
          }

          // Cell click clears multi-row/col selections to allow editing
          td.addEventListener('click', () => {
            if (selectedCols.size > 0 || selectedRows.size > 0) {
              selectedCols.clear();
              selectedRows.clear();
              updateSelectionHighlights();
            }
          });

          // Update gridData state on edit
          td.addEventListener('input', () => {
            gridData[rowIdx][colIdx] = td.innerText.trim();
          });

          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    }

    // Highlights row/column cells programmatically in the DOM
    function updateSelectionHighlights() {
      table.querySelectorAll('thead th').forEach(th => {
        const colIdx = parseInt(th.dataset.colIdx);
        if (!isNaN(colIdx)) {
          if (selectedCols.has(colIdx)) {
            th.classList.add('cm-selected');
          } else {
            th.classList.remove('cm-selected');
          }
        }
      });

      table.querySelectorAll('tbody tr').forEach((tr, rowIdx) => {
        const rowNumTd = tr.querySelector('.row-num');
        if (rowNumTd) {
          if (selectedRows.has(rowIdx)) {
            rowNumTd.classList.add('cm-selected');
          } else {
            rowNumTd.classList.remove('cm-selected');
          }
        }

        tr.querySelectorAll('.editable-cell').forEach(td => {
          const colIdx = parseInt(td.dataset.colIdx);
          if (selectedCols.has(colIdx) || selectedRows.has(rowIdx)) {
            td.classList.add('cm-selected');
          } else {
            td.classList.remove('cm-selected');
          }
        });
      });
    }

    // Column selection handler (supports Ctrl and Shift)
    function handleColSelect(colIdx, isMultiselect, isRangeSelect) {
      selectedRows.clear();

      if (isRangeSelect && lastSelectedCol !== null) {
        const start = Math.min(lastSelectedCol, colIdx);
        const end = Math.max(lastSelectedCol, colIdx);
        selectedCols.clear();
        for (let i = start; i <= end; i++) {
          selectedCols.add(i);
        }
      } else if (isMultiselect) {
        if (selectedCols.has(colIdx)) {
          selectedCols.delete(colIdx);
        } else {
          selectedCols.add(colIdx);
        }
        lastSelectedCol = colIdx;
      } else {
        selectedCols.clear();
        selectedCols.add(colIdx);
        lastSelectedCol = colIdx;
      }

      updateSelectionHighlights();
    }

    // Row selection handler (supports Ctrl and Shift)
    function handleRowSelect(rowIdx, isMultiselect, isRangeSelect) {
      selectedCols.clear();

      if (isRangeSelect && lastSelectedRow !== null) {
        const start = Math.min(lastSelectedRow, rowIdx);
        const end = Math.max(lastSelectedRow, rowIdx);
        selectedRows.clear();
        for (let i = start; i <= end; i++) {
          selectedRows.add(i);
        }
      } else if (isMultiselect) {
        if (selectedRows.has(rowIdx)) {
          selectedRows.delete(rowIdx);
        } else {
          selectedRows.add(rowIdx);
        }
        lastSelectedRow = rowIdx;
      } else {
        selectedRows.clear();
        selectedRows.add(rowIdx);
        lastSelectedRow = rowIdx;
      }

      updateSelectionHighlights();
    }

    // ── Table Toolbar Operations ─────────────────────────────────────────────

    // Add Row
    addRowBtn.addEventListener('click', () => {
      readTableData();
      const newRow = [`Label ${gridData.length + 1}`];
      for (let i = 1; i < gridHeaders.length; i++) {
        newRow.push('0');
      }
      gridData.push(newRow);
      renderSpreadsheet();

      // Focus first editable cell in the new row
      const rows = table.querySelectorAll('tbody tr');
      if (rows.length > 0) {
        const firstCell = rows[rows.length - 1].querySelector('.editable-cell');
        if (firstCell) firstCell.focus();
      }
    });

    // Add Column
    addColBtn.addEventListener('click', () => {
      readTableData();
      gridHeaders.push(`Seri ${gridHeaders.length}`);
      gridData.forEach(row => {
        row.push('0');
      });
      renderSpreadsheet();
    });

    // Delete Selected Columns
    deleteSelectedColsBtn.addEventListener('click', () => {
      if (selectedCols.size === 0) {
        alert('Pilih satu atau beberapa kolom terlebih dahulu dengan mengklik header kolom.');
        return;
      }

      // Filter out index 0 (label column is protected)
      const colsToDelete = Array.from(selectedCols)
        .filter(idx => idx > 0)
        .sort((a, b) => b - a);

      if (colsToDelete.length === 0) {
        alert('Kolom Label tidak dapat dihapus.');
        return;
      }

      if (gridHeaders.length - colsToDelete.length < 2) {
        alert('Harus menyisakan minimal satu kolom data.');
        return;
      }

      readTableData();

      colsToDelete.forEach(colIdx => {
        gridHeaders.splice(colIdx, 1);
        gridData.forEach(row => {
          row.splice(colIdx, 1);
        });
      });

      selectedCols.clear();
      renderSpreadsheet();
    });

    // Delete Selected Rows
    deleteSelectedRowsBtn.addEventListener('click', () => {
      if (selectedRows.size === 0) {
        alert('Pilih satu atau beberapa baris terlebih dahulu dengan mengklik nomor baris.');
        return;
      }

      const rowsToDelete = Array.from(selectedRows).sort((a, b) => b - a);

      if (gridData.length - rowsToDelete.length < 1) {
        alert('Harus menyisakan minimal satu baris data.');
        return;
      }

      readTableData();

      rowsToDelete.forEach(rowIdx => {
        gridData.splice(rowIdx, 1);
      });

      selectedRows.clear();
      renderSpreadsheet();
    });

    // Clear Table (Resets to clean template)
    window.clearTable = function() {
      gridHeaders = ['Label', 'Seri 1'];
      gridData = [
        ['A', '0'],
        ['B', '0'],
        ['C', '0'],
        ['D', '0']
      ];
      selectedCols.clear();
      selectedRows.clear();
      renderSpreadsheet();
    };

    // ── Excel/Google Sheets Paste Interceptor ─────────────────────────────────

    table.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text');
      if (!text) return;

      // Split text into rows and tabs (TSV format standard for spreadsheets)
      const lines = text.split(/\r?\n/).map(line => line.split('\t'));
      const parsedData = lines.filter(line => line.length > 0 && !(line.length === 1 && line[0].trim() === ''));

      if (parsedData.length === 0) return;

      readTableData();

      const activeElement = document.activeElement;
      const isCell = activeElement && activeElement.tagName === 'TD' && activeElement.classList.contains('editable-cell');

      if (isCell) {
        const startRowIdx = parseInt(activeElement.dataset.rowIdx);
        const startColIdx = parseInt(activeElement.dataset.colIdx);

        if (!isNaN(startRowIdx) && !isNaN(startColIdx)) {
          // Paste starting from the selected cell, auto-expanding rows/columns
          parsedData.forEach((row, rOffset) => {
            const targetRowIdx = startRowIdx + rOffset;

            // Expand rows if needed
            while (gridData.length <= targetRowIdx) {
              const emptyRow = Array(gridHeaders.length).fill('0');
              emptyRow[0] = `Label ${gridData.length + 1}`;
              gridData.push(emptyRow);
            }

            row.forEach((val, cOffset) => {
              const targetColIdx = startColIdx + cOffset;

              // Expand columns if needed
              while (gridHeaders.length <= targetColIdx) {
                gridHeaders.push(`Seri ${gridHeaders.length}`);
                gridData.forEach(r => r.push('0'));
              }

              gridData[targetRowIdx][targetColIdx] = val;
            });
          });

          renderSpreadsheet();
          return;
        }
      }

      // Default paste fallback: Overwrite entire sheet grid
      const firstRowHasHeaders = parsedData[0].some(val => isNaN(parseFloat(val)));

      if (firstRowHasHeaders && parsedData.length > 1) {
        gridHeaders = parsedData[0];
        gridData = parsedData.slice(1);
      } else {
        const colsCount = Math.max(...parsedData.map(r => r.length));
        gridHeaders = ['Label'];
        for (let i = 1; i < colsCount; i++) {
          gridHeaders.push(`Seri ${i}`);
        }
        gridData = parsedData;
      }

      renderSpreadsheet();
    });

    // Enter and Tab key cell navigation
    table.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const cells = Array.from(table.querySelectorAll('td.editable-cell, th.col-header-editable'));
        const idx = cells.indexOf(document.activeElement);
        if (idx >= 0 && idx < cells.length - 1) cells[idx + 1].focus();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const cells = Array.from(table.querySelectorAll('td.editable-cell, th.col-header-editable'));
        const idx = cells.indexOf(document.activeElement);
        const next = e.shiftKey ? idx - 1 : idx + 1;
        if (next >= 0 && next < cells.length) cells[next].focus();
      }
    });

    // CSV File Upload
    csvUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof window.AquaFile === "undefined" || !window.AquaFile.parseCSV) {
          console.error("AquaFile library is not loaded.");
          alert("Gagal memproses file CSV: Utilitas AquaFile tidak terdeteksi.");
          return;
        }

        const parsed = window.AquaFile.parseCSV(event.target.result);
        if (parsed.length < 2) {
          alert("Format CSV tidak didukung atau data kosong.");
          return;
        }
        gridHeaders = parsed[0];
        gridData = parsed.slice(1);
        selectedCols.clear();
        selectedRows.clear();
        renderSpreadsheet();
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // ── Visual Styling Listeners ──────────────────────────────────────────────

    // Update styling panels depending on active chart type
    function updateControlVisibility() {
      const type = chartTypeSelect.value;
      const lineTensionGroup = document.getElementById('line-tension-group');
      const pointRadiusGroup = document.getElementById('point-radius-group');
      const barRadiusGroup = document.getElementById('bar-radius-group');
      const barOrientationGroup = document.getElementById('bar-orientation-group');
      const areaFillGroup = document.getElementById('area-fill-group');

      const show = el => { if (el) el.style.display = 'block'; };
      const hide = el => { if (el) el.style.display = 'none'; };

      if (type === 'bar' || type === 'stacked-bar') {
        show(barRadiusGroup);
        show(barOrientationGroup);
        hide(lineTensionGroup);
        hide(pointRadiusGroup);
        hide(areaFillGroup);
      } else if (type === 'line' || type === 'area') {
        show(lineTensionGroup);
        show(pointRadiusGroup);
        show(areaFillGroup);
        hide(barRadiusGroup);
        hide(barOrientationGroup);
      } else if (type === 'scatter' || type === 'bubble' || type === 'radar') {
        show(pointRadiusGroup);
        hide(lineTensionGroup);
        hide(barRadiusGroup);
        hide(barOrientationGroup);
        hide(areaFillGroup);
      } else {
        // pie, doughnut, polarArea, pca, hca
        hide(lineTensionGroup);
        hide(pointRadiusGroup);
        hide(barRadiusGroup);
        hide(barOrientationGroup);
        hide(areaFillGroup);
      }
    }

    chartTypeSelect.addEventListener('change', () => {
      if (typeBadge) typeBadge.textContent = CHART_TYPE_NAMES[chartTypeSelect.value] || chartTypeSelect.value;
      updateControlVisibility();
      renderChart();
    });

    // Color palette change
    colorPaletteSelect.addEventListener('change', () => {
      renderChart();
    });

    // Line curve tension slider
    lineTensionInput.addEventListener('input', () => {
      const val = parseFloat(lineTensionInput.value) / 10;
      lineTensionValDisp.textContent = val.toFixed(1);
      renderChart();
    });

    // Point size slider
    pointRadiusInput.addEventListener('input', () => {
      pointRadiusValDisp.textContent = `${pointRadiusInput.value} px`;
      renderChart();
    });

    // Bar border radius slider
    barRadiusInput.addEventListener('input', () => {
      barRadiusValDisp.textContent = `${barRadiusInput.value} px`;
      renderChart();
    });

    // Orientation toggle (horizontal/vertical)
    barOrientationToggle.addEventListener('click', () => {
      renderChart();
    });

    // Area fill toggle
    areaFillToggle.addEventListener('click', () => {
      renderChart();
    });

    // Title & Legend & Grid changes
    chartTitleInput.addEventListener('input', () => renderChart());
    xAxisLabelInput.addEventListener('input', () => renderChart());
    yAxisLabelInput.addEventListener('input', () => renderChart());
    toggleLegendBtn.addEventListener('click', () => renderChart());
    toggleGridBtn.addEventListener('click', () => renderChart());

    // ── Download Dropdown Menu Toggle ────────────────────────────────────────

    downloadDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = downloadMenu.style.display === 'block';
      downloadMenu.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', () => {
      if (downloadMenu) downloadMenu.style.display = 'none';
    });

    // ── Export/Download Formats implementation ───────────────────────────────

    // PNG Download
    downloadPngBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const canvas = document.getElementById('chart-canvas');
      if (!canvas) return;

      const link = document.createElement('a');
      const title = chartTitleInput.value.trim() || 'aqua-insight-chart';
      link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });

    // PDF Report Download (Custom window printing layout)
    downloadPdfBtn.addEventListener('click', (e) => {
      e.preventDefault();
      readTableData();

      const canvas = document.getElementById('chart-canvas');
      if (!canvas) return;

      const titleText = chartTitleInput.value.trim() || 'Laporan Grafik Aqua Insight';
      const chartImg = canvas.toDataURL('image/png');

      // Construct table markup
      let tableHtml = `<table style="width:100%; border-collapse:collapse; margin-top:20px; font-family:'Segoe UI', system-ui, sans-serif; font-size:12px;">
        <thead>
          <tr style="background:#0F172A; color:#ffffff;">
            <th style="border:1px solid #CBD5E1; padding:8px; text-align:left;">#</th>
            <th style="border:1px solid #CBD5E1; padding:8px; text-align:left;">${gridHeaders[0]}</th>`;
      
      for (let i = 1; i < gridHeaders.length; i++) {
        tableHtml += `<th style="border:1px solid #CBD5E1; padding:8px; text-align:right;">${gridHeaders[i]}</th>`;
      }
      tableHtml += `</tr></thead><tbody>`;

      gridData.forEach((row, idx) => {
        tableHtml += `<tr style="background:${idx % 2 === 0 ? '#F8FAFC' : '#ffffff'};">
          <td style="border:1px solid #CBD5E1; padding:8px; color:#64748B;">${idx + 1}</td>
          <td style="border:1px solid #CBD5E1; padding:8px; font-weight:bold; color:#0F172A;">${row[0]}</td>`;
        for (let i = 1; i < row.length; i++) {
          tableHtml += `<td style="border:1px solid #CBD5E1; padding:8px; text-align:right; color:#334155;">${row[i]}</td>`;
        }
        tableHtml += `</tr>`;
      });
      tableHtml += `</tbody></table>`;

      // Open new tab to trigger print
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
        <head>
          <title>${titleText}</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 40px; color: #1E293B; background: #ffffff; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #E2E8F0; padding-bottom: 15px; }
            .header h1 { margin: 0 0 10px 0; font-size: 24px; color: #0F172A; }
            .header p { margin: 0; color: #64748B; font-size: 14px; }
            .chart-container { text-align: center; margin: 30px 0; }
            .chart-img { max-width: 100%; height: auto; max-height: 400px; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
            .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${titleText}</h1>
            <p>Dibuat secara otomatis oleh Aqua Insight pada ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}</p>
          </div>
          <div class="chart-container">
            <img src="${chartImg}" class="chart-img" alt="Visualisasi Grafik" />
          </div>
          <h3 style="margin-top: 40px; color: #0F172A; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px;">Tabel Data Sumber</h3>
          ${tableHtml}
          <div class="footer">
            <p>© 2026 Technology Division, PT Central Proteina Prima Tbk. Hak Cipta Dilindungi.</p>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    });

    // Excel Export
    downloadExcelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.AquaFile === "undefined" || !window.AquaFile.exportToExcel) {
        alert("Pustaka ekspor Excel tidak terdeteksi.");
        return;
      }

      readTableData();
      const excelData = [gridHeaders, ...gridData];
      const sheets = [{ name: "Data Grafik", data: excelData }];
      const title = chartTitleInput.value.trim() || 'aqua-insight-data';
      
      window.AquaFile.exportToExcel(sheets, `${title.toLowerCase().replace(/\s+/g, '-')}.xlsx`);
    });

    // CSV Export
    downloadCsvBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.AquaFile === "undefined" || !window.AquaFile.exportToCSV) {
        alert("Pustaka ekspor CSV tidak terdeteksi.");
        return;
      }

      readTableData();
      const csvData = [gridHeaders, ...gridData];
      const title = chartTitleInput.value.trim() || 'aqua-insight-data';

      window.AquaFile.exportToCSV(csvData, `${title.toLowerCase().replace(/\s+/g, '-')}.csv`);
    });

    // ── Chart.js Setup & Config ──────────────────────────────────────────────

    // Base config options builder
    function buildBaseOptions(showGrid) {
      const titleText = chartTitleInput.value.trim();
      const xLabel = xAxisLabelInput.value.trim();
      const yLabel = yAxisLabelInput.value.trim();
      const showLegend = toggleLegendBtn.classList.contains('active');

      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            display: showLegend, 
            labels: { color: '#e2e8f0', font: { family: 'Inter, sans-serif' } } 
          },
          title: titleText
            ? { display: true, text: titleText, color: '#e2e8f0', font: { size: 16, family: 'Inter, sans-serif', weight: '700' } }
            : { display: false }
        },
        scales: {
          x: {
            grid: { color: showGrid ? 'rgba(255,255,255,0.06)' : 'transparent' },
            ticks: { color: '#94a3b8' },
            title: xLabel ? { display: true, text: xLabel, color: '#94a3b8' } : { display: false }
          },
          y: {
            grid: { color: showGrid ? 'rgba(255,255,255,0.06)' : 'transparent' },
            ticks: { color: '#94a3b8' },
            title: yLabel ? { display: true, text: yLabel, color: '#94a3b8' } : { display: false }
          }
        }
      };
    }

    // Main render chart trigger function
    function renderChart() {
      readTableData();

      const type = chartTypeSelect.value;
      const showGrid = toggleGridBtn.classList.contains('active');

      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }

      const canvas = document.getElementById('chart-canvas');
      const ctx = canvas.getContext('2d');
      const labels = gridData.map(r => r[0]);
      const opts = buildBaseOptions(showGrid);

      // Get visual settings
      const selectedPalette = PALETTES[colorPaletteSelect.value] || PALETTES.classic;
      const selectedBorderPalette = selectedPalette.map(c => c.replace('0.75', '1'));
      const tensionVal = parseFloat(lineTensionInput.value) / 10;
      const pointRadiusVal = parseInt(pointRadiusInput.value);
      const barRadiusVal = parseInt(barRadiusInput.value);
      const isHorizontal = barOrientationToggle.classList.contains('active');
      const isAreaFill = areaFillToggle.classList.contains('active');

      // ── PCA Projection Chart (Scatter plot projection) ──
      if (type === 'pca') {
        const dataPoints = gridData.map((r, i) => {
          let pc1 = 0, pc2 = 0;
          for (let j = 1; j < r.length; j++) {
            const val = parseFloat(r[j]) || 0;
            pc1 += val * Math.cos(j * 1.1);
            pc2 += val * Math.sin(j * 1.1);
          }
          return { x: parseFloat(pc1.toFixed(3)), y: parseFloat(pc2.toFixed(3)), label: labels[i] };
        });

        opts.plugins.tooltip = {
          callbacks: {
            label: ctx => `${ctx.raw.label} (PC1: ${ctx.raw.x}, PC2: ${ctx.raw.y})`
          }
        };

        chartInstance = new Chart(ctx, {
          type: 'scatter',
          data: {
            datasets: [{
              label: 'PCA Projection',
              data: dataPoints,
              backgroundColor: selectedPalette,
              borderColor: selectedBorderPalette,
              pointRadius: pointRadiusVal,
              pointHoverRadius: pointRadiusVal + 3
            }]
          },
          options: opts
        });
        return;
      }

      // ── HCA Dendrogram Chart (simplified stepped-line tree) ──
      if (type === 'hca') {
        const leafDatasets = gridData.map((r, i) => ({
          type: 'scatter',
          label: labels[i],
          data: [{ x: i, y: 0 }],
          backgroundColor: selectedPalette[i % selectedPalette.length],
          borderColor: selectedBorderPalette[i % selectedBorderPalette.length],
          pointRadius: pointRadiusVal > 0 ? pointRadiusVal : 5,
          pointHoverRadius: (pointRadiusVal > 0 ? pointRadiusVal : 5) + 3
        }));

        const treeData = [];
        for (let i = 0; i < gridData.length - 1; i++) {
          treeData.push({ x: i, y: 0 });
          treeData.push({ x: i, y: i + 1 });
          treeData.push({ x: i + 1, y: i + 1 });
          treeData.push({ x: i + 1, y: 0 });
          treeData.push(null);
        }

        leafDatasets.push({
          type: 'line',
          label: 'Dendrogram Links',
          data: treeData,
          borderColor: selectedPalette[0],
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
          spanGaps: false,
          stepped: true
        });

        const hcaOpts = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, labels: { color: '#e2e8f0' } },
            title: opts.plugins.title
          },
          scales: {
            y: { display: false },
            x: {
              ticks: {
                color: '#94a3b8',
                callback: (val) => labels[val] || ''
              },
              grid: { color: 'rgba(255,255,255,0.06)' }
            }
          }
        };

        chartInstance = new Chart(ctx, {
          data: { datasets: leafDatasets },
          options: hcaOpts
        });
        return;
      }

      // ── Standard Chart Types ──
      const isStacked = type === 'stacked-bar';
      const isArea = type === 'area';
      const chartType = (isStacked || isArea) ? (isArea ? 'line' : 'bar') : type;

      const datasets = [];
      // Start parsing from column index 1 (Label column index 0 is labels)
      for (let j = 1; j < gridHeaders.length; j++) {
        const data = gridData.map(r => parseFloat(r[j]) || 0);
        const color = selectedPalette[(j - 1) % selectedPalette.length];
        const borderColor = selectedBorderPalette[(j - 1) % selectedBorderPalette.length];

        if (chartType === 'scatter' || chartType === 'bubble') {
          const scatterData = gridData.map((r, i) => chartType === 'bubble'
            ? { x: i, y: parseFloat(r[j]) || 0, r: Math.abs(parseFloat(r[j]) || 5) / 3 + 4 }
            : { x: i, y: parseFloat(r[j]) || 0 }
          );
          datasets.push({ 
            label: gridHeaders[j], 
            data: scatterData, 
            backgroundColor: color, 
            borderColor: borderColor,
            pointRadius: pointRadiusVal,
            pointHoverRadius: pointRadiusVal + 3
          });
        } else if (chartType === 'radar' || chartType === 'polarArea') {
          datasets.push({
            label: gridHeaders[j], 
            data,
            backgroundColor: color.replace('0.75', '0.35'),
            borderColor, 
            borderWidth: 2,
            pointBackgroundColor: borderColor,
            pointRadius: pointRadiusVal,
            pointHoverRadius: pointRadiusVal + 3
          });
        } else {
          // line, bar, stacked-bar, area, pie, doughnut
          datasets.push({
            label: gridHeaders[j], 
            data,
            backgroundColor: (chartType === 'pie' || chartType === 'doughnut') ? selectedPalette : color,
            borderColor: (chartType === 'pie' || chartType === 'doughnut') ? selectedBorderPalette : borderColor,
            borderWidth: 1.5,
            fill: (isArea || isAreaFill) ? { target: 'origin', above: color.replace('0.75', '0.18') } : false,
            tension: (chartType === 'line') ? tensionVal : undefined,
            pointRadius: (chartType === 'line') ? pointRadiusVal : undefined,
            pointHoverRadius: (chartType === 'line') ? pointRadiusVal + 3 : undefined,
            borderRadius: (chartType === 'bar') ? barRadiusVal : undefined
          });
        }
      }

      // Handle Stacked layouts
      if (isStacked) {
        opts.scales.x.stacked = true;
        opts.scales.y.stacked = true;
      }
      
      // Handle Horizontal axis flip
      if (chartType === 'bar' && isHorizontal) {
        opts.indexAxis = 'y';
      }

      // Cleanup axes for circular and polar charts
      if (chartType === 'radar' || chartType === 'polarArea') {
        delete opts.scales;
        opts.scales = { r: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } } };
      }
      if (chartType === 'pie' || chartType === 'doughnut') {
        delete opts.scales;
      }

      chartInstance = new Chart(ctx, {
        type: chartType,
        data: { labels, datasets },
        options: opts
      });
    }

    // Expose render chart globally
    window.renderChart = renderChart;

    // Trigger render on direct manual click
    renderBtn.addEventListener('click', () => {
      renderChart();
    });

    // ── Initial Setup ────────────────────────────────────────────────────────
    renderSpreadsheet();
    updateControlVisibility();
    renderChart();
  }

  // Handle load state
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChartMaker);
  } else {
    initChartMaker();
  }
})();
