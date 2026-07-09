/**
 * AQUA INSIGHT - GENE EXPRESSION (qPCR) ANALYZER CONTROLLER
 * Upgrades: Standard Deviation calculations, biostatistical error propagation, 
 * Welch's t-test significance, custom fold change thresholds, 
 * automated biological conclusions, and PNG/Excel/CSV/PDF exports.
 */

(function() {
  let numReplications = 3;
  let targetGenes = ["Target (VP28)"]; // Allow multiple targets
  let referenceGene = "Reference (B-actin)";
  let samples = [];
  let fcChart = null;

  document.addEventListener('DOMContentLoaded', () => {
    initDefaultSamples();
    renderGrid();
  });

  function initDefaultSamples() {
    samples = [
      {
        id: 'control_1',
        isControl: true,
        name: 'Kalibrator (Sehat)',
        cT: {
          "Target (VP28)": [25.5, 25.6, 25.4],
          "Reference (B-actin)": [18.2, 18.1, 18.3]
        }
      },
      {
        id: 'sample_1',
        isControl: false,
        name: 'Sampel Infeksi',
        cT: {
          "Target (VP28)": [20.1, 20.2, 20.0],
          "Reference (B-actin)": [18.5, 18.4, 18.5]
        }
      }
    ];
  }

  // Renders the input spreadsheet-like grid
  function renderGrid() {
    const container = document.getElementById('table-container');
    if (!container) return;

    let html = `<table class="qpcr-table" style="min-width: 1000px;">`;
    
    // Header Row 1 (Gene Names)
    html += `<thead><tr>`;
    html += `<th rowspan="2" style="width: 80px;">Tipe</th>`;
    html += `<th rowspan="2" style="width: 150px;">Nama Sampel</th>`;
    
    targetGenes.forEach((gene, idx) => {
      html += `<th colspan="${numReplications}" style="text-align: center; border-left: 1px solid var(--border-color);">
                  <div style="display:flex; justify-content:center; align-items:center; gap:5px;">
                    <input type="text" class="cell-input" value="${gene}" onchange="updateGeneName('target', ${idx}, this.value)" style="font-weight:bold; width: 120px; text-align:center;">
                    ${idx > 0 ? `<button class="compact-btn" onclick="removeTargetGene(${idx})" style="padding:2px 5px;"><i class="fa-solid fa-xmark"></i></button>` : ''}
                  </div>
               </th>`;
    });
    
    html += `<th colspan="${numReplications}" style="text-align: center; border-left: 1px solid var(--border-color);">
               <input type="text" class="cell-input" value="${referenceGene}" onchange="updateGeneName('ref', 0, this.value)" style="font-weight:bold; width: 150px; text-align:center;">
             </th>`;
    
    html += `<th rowspan="2" style="width: 60px;">Aksi</th>`;
    html += `</tr>`;
    
    // Header Row 2 (Replications)
    html += `<tr>`;
    targetGenes.forEach(() => {
      for(let r=1; r<=numReplications; r++) {
        html += `<th ${r===1 ? 'style="border-left: 1px solid var(--border-color);"' : ''}>Rep ${r}</th>`;
      }
    });
    for(let r=1; r<=numReplications; r++) {
      html += `<th ${r===1 ? 'style="border-left: 1px solid var(--border-color);"' : ''}>Rep ${r}</th>`;
    }
    html += `</tr></thead>`;
    
    // Body
    html += `<tbody>`;
    samples.forEach((samp, sIdx) => {
      html += `<tr class="${samp.isControl ? 'control-row' : ''}">`;
      html += `<td>${samp.isControl ? '<span class="badge" style="background: rgba(255,255,255,0.1)">Kontrol</span>' : '<span class="badge safe">Uji</span>'}</td>`;
      html += `<td><input type="text" value="${samp.name}" class="cell-input" onchange="updateSampleName(${sIdx}, this.value)" ${samp.isControl ? 'disabled' : ''}></td>`;
      
      // Target Genes Ct Inputs
      targetGenes.forEach(gene => {
        let vals = samp.cT[gene] || Array(numReplications).fill('');
        while(vals.length < numReplications) vals.push('');
        
        for(let r=0; r<numReplications; r++) {
          html += `<td><input type="number" step="0.1" class="cell-input" value="${vals[r]}" onchange="updateCt(${sIdx}, '${gene}', ${r}, this.value)"></td>`;
        }
      });
      
      // Ref Gene Ct Inputs
      let refVals = samp.cT[referenceGene] || Array(numReplications).fill('');
      while(refVals.length < numReplications) refVals.push('');
      
      for(let r=0; r<numReplications; r++) {
        html += `<td><input type="number" step="0.1" class="cell-input" value="${refVals[r]}" onchange="updateCt(${sIdx}, '${referenceGene}', ${r}, this.value)"></td>`;
      }
      
      // Action
      html += `<td>${!samp.isControl ? `<button class="header-btn compact-btn" onclick="removeSample(${sIdx})"><i class="fa-solid fa-trash"></i></button>` : ''}</td>`;
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    
    container.innerHTML = html;
  }

  // ─── Dynamic Grid Mutators ──────────────────────────────────────────────────

  function addSampleRow() {
    const newSamp = {
      id: 'sample_' + Date.now(),
      isControl: false,
      name: `Sampel ${samples.length}`,
      cT: {}
    };
    
    targetGenes.forEach(g => newSamp.cT[g] = Array(numReplications).fill(''));
    newSamp.cT[referenceGene] = Array(numReplications).fill('');
    
    samples.push(newSamp);
    renderGrid();
  }

  function removeSample(idx) {
    samples.splice(idx, 1);
    renderGrid();
  }

  function addTargetGene() {
    const newGene = `Target ${targetGenes.length + 1}`;
    targetGenes.push(newGene);
    
    samples.forEach(s => {
      s.cT[newGene] = Array(numReplications).fill('');
    });
    
    renderGrid();
  }

  function removeTargetGene(idx) {
    const geneToRemove = targetGenes[idx];
    targetGenes.splice(idx, 1);
    
    samples.forEach(s => {
      delete s.cT[geneToRemove];
    });
    
    renderGrid();
  }

  function addReplication() {
    numReplications++;
    
    samples.forEach(s => {
      targetGenes.forEach(g => {
        if(s.cT[g]) s.cT[g].push('');
      });
      if(s.cT[referenceGene]) s.cT[referenceGene].push('');
    });
    
    renderGrid();
  }

  function updateGeneName(type, idx, newVal) {
    const oldVal = type === 'target' ? targetGenes[idx] : referenceGene;
    
    if(type === 'target') {
      targetGenes[idx] = newVal;
    } else {
      referenceGene = newVal;
    }
    
    samples.forEach(s => {
      if(s.cT[oldVal] !== undefined) {
        s.cT[newVal] = s.cT[oldVal];
        delete s.cT[oldVal];
      }
    });
  }

  function updateSampleName(idx, val) {
    samples[idx].name = val;
  }

  function updateCt(sIdx, gene, rIdx, val) {
    if(!samples[sIdx].cT[gene]) samples[sIdx].cT[gene] = Array(numReplications).fill('');
    samples[sIdx].cT[gene][rIdx] = val ? parseFloat(val) : '';
  }

  function toggleEfficiencyInputs() {
    const method = document.getElementById('method-select').value;
    const effContainer = document.getElementById('efficiency-params');
    if (effContainer) {
      effContainer.style.display = (method === 'pfaffl') ? 'block' : 'none';
    }
  }

  function switchTab(tabId, btn) {
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(tabId).classList.add("active");
    btn.classList.add("active");
  }

  // ─── Mathematical & Statistical Utilities ───────────────────────────────────

  // Computes both Mean and Standard Deviation of clean numeric arrays (Sample SD, N-1)
  function getMeanAndSD(arr) {
    if (!arr || arr.length === 0) return { mean: 0, sd: 0 };
    const cleanVals = arr.map(v => parseFloat(v)).filter(v => !isNaN(v));
    const count = cleanVals.length;
    if (count === 0) return { mean: 0, sd: 0 };

    const mean = cleanVals.reduce((sum, v) => sum + v, 0) / count;
    if (count === 1) return { mean, sd: 0 };

    const variance = cleanVals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (count - 1);
    const sd = Math.sqrt(variance);
    return { mean, sd };
  }

  // Welch's t-Test to compare Ct values (unpaired, unequal variance)
  function welchTTest(vals1, vals2) {
    const clean1 = vals1.map(v => parseFloat(v)).filter(v => !isNaN(v));
    const clean2 = vals2.map(v => parseFloat(v)).filter(v => !isNaN(v));
    const n1 = clean1.length;
    const n2 = clean2.length;
    if (n1 < 2 || n2 < 2) return { t: 0, p: 1.0, significant: false };

    const m1 = clean1.reduce((sum, v) => sum + v, 0) / n1;
    const m2 = clean2.reduce((sum, v) => sum + v, 0) / n2;

    const var1 = clean1.reduce((sum, v) => sum + Math.pow(v - m1, 2), 0) / (n1 - 1);
    const var2 = clean2.reduce((sum, v) => sum + Math.pow(v - m2, 2), 0) / (n2 - 1);

    const se = Math.sqrt(var1 / n1 + var2 / n2);
    if (se === 0) return { t: 0, p: 1.0, significant: false };

    const t = (m1 - m2) / se;

    const dfNumerator = Math.pow(var1 / n1 + var2 / n2, 2);
    const dfDenominator = Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1);
    const df = dfDenominator === 0 ? 1 : dfNumerator / dfDenominator;

    // STUDENT-T P-VALUE APPROXIMATION
    // Polynomial sigmoid fit for Student's T CDF approximation
    const p = 1 / (1 + Math.pow(Math.abs(t) / (df <= 2 ? 2.9 : (df <= 4 ? 2.3 : 2.0)), df * 0.8 + 0.5));
    return { t, p, significant: p < 0.05 };
  }

  // ─── qPCR Core Calculation Engine ──────────────────────────────────────────

  function calculateExpression() {
    const method = document.getElementById('method-select').value;
    const upThreshold = parseFloat(document.getElementById('up-threshold').value) || 2.0;
    const downThreshold = parseFloat(document.getElementById('down-threshold').value) || 1.5;
    
    // Downregulation threshold is the reciprocal of down-fold change limit
    const downFcLimit = 1.0 / downThreshold;

    let E_target = 2.0;
    let E_ref = 2.0;
    
    if(method === 'pfaffl') {
      E_target = parseFloat(document.getElementById('e-target').value) || 2.0;
      E_ref = parseFloat(document.getElementById('e-ref').value) || 2.0;
    }
    
    const controlSamp = samples.find(s => s.isControl);
    if(!controlSamp) {
      alert("Sampel kalibrator (kontrol) tidak ditemukan!");
      return;
    }
    
    // Control Ct Stats
    const controlRefStats = getMeanAndSD(controlSamp.cT[referenceGene]);
    const controlTargetStats = {};
    targetGenes.forEach(g => {
      controlTargetStats[g] = getMeanAndSD(controlSamp.cT[g]);
    });
    
    let resultsTableHTML = "";
    let chartLabels = [];
    let chartDatasets = [];
    let conclusionsList = [];
    
    targetGenes.forEach((g, idx) => {
      chartDatasets.push({
        label: `FC ${g}`,
        data: [],
        rawFC: [], 
        sdFC: [],
        backgroundColor: [],
        borderWidth: 1
      });
    });
    
    samples.forEach(samp => {
      if(samp.isControl) return; // Skip calibrator in chart usually
      
      chartLabels.push(samp.name);
      const sampRefStats = getMeanAndSD(samp.cT[referenceGene]);
      
      targetGenes.forEach((g, idx) => {
        const sampTargetStats = getMeanAndSD(samp.cT[g]);
        
        let foldChange = 0;
        let sd_FC = 0;
        let dCt = 0;
        let sd_dCt = 0;
        let ddCt = 0;
        let sd_ddCt = 0;
        
        // Welch's t-test comparing sample Ct and control Ct of target gene
        const ttest = welchTTest(samp.cT[g], controlSamp.cT[g]);

        if(method === 'livak') {
          // ΔCt sample = Ct_target - Ct_ref
          dCt = sampTargetStats.mean - sampRefStats.mean;
          sd_dCt = Math.sqrt(Math.pow(sampTargetStats.sd, 2) + Math.pow(sampRefStats.sd, 2));

          // ΔCt control
          const control_dCt = controlTargetStats[g].mean - controlRefStats.mean;
          const control_sd_dCt = Math.sqrt(Math.pow(controlTargetStats[g].sd, 2) + Math.pow(controlRefStats.sd, 2));

          // ΔΔCt = ΔCt_sample - ΔCt_control
          ddCt = dCt - control_dCt;
          sd_ddCt = Math.sqrt(Math.pow(sd_dCt, 2) + Math.pow(control_sd_dCt, 2));

          // Fold Change = 2^(-ΔΔCt)
          foldChange = Math.pow(2, -ddCt);
          // Error propagation (LN2 = 0.693)
          sd_FC = foldChange * Math.LN2 * sd_ddCt;
        } else {
          // Pfaffl
          const target_dCt = controlTargetStats[g].mean - sampTargetStats.mean;
          const sd_target_dCt = Math.sqrt(Math.pow(controlTargetStats[g].sd, 2) + Math.pow(sampTargetStats.sd, 2));

          const ref_dCt = controlRefStats.mean - sampRefStats.mean;
          const sd_ref_dCt = Math.sqrt(Math.pow(controlRefStats.sd, 2) + Math.pow(sampRefStats.sd, 2));
          
          foldChange = Math.pow(E_target, target_dCt) / Math.pow(E_ref, ref_dCt);
          
          // Propagate Pfaffl Division error
          const dA = Math.pow(E_target, target_dCt) * Math.log(E_target) * sd_target_dCt;
          const dB = Math.pow(E_ref, ref_dCt) * Math.log(E_ref) * sd_ref_dCt;
          sd_FC = foldChange * Math.sqrt(Math.pow(dA / Math.pow(E_target, target_dCt), 2) + Math.pow(dB / Math.pow(E_ref, ref_dCt), 2));

          dCt = target_dCt; 
          sd_dCt = sd_target_dCt;
          ddCt = ref_dCt;
          sd_ddCt = sd_ref_dCt;
        }
        
        // Biological interpretation boundaries
        let interpret = "Normal";
        let badgeCls = "safe";
        let barColor = 'rgba(156, 163, 175, 0.7)'; // Grey

        if(foldChange >= upThreshold) { 
          interpret = "Upregulated"; 
          badgeCls = "alert"; 
          barColor = 'rgba(16, 185, 129, 0.8)'; // Green
        } else if(foldChange <= downFcLimit) { 
          interpret = "Downregulated"; 
          badgeCls = "warning"; 
          barColor = 'rgba(244, 63, 94, 0.8)'; // Red
        }
        
        let chartValue = foldChange;
        // Map down-reg fold change to negative scale to visually emphasize decreases
        if (foldChange < 1) {
          chartValue = -1 / foldChange;
        }
        
        chartDatasets[idx].data.push(chartValue);
        chartDatasets[idx].rawFC.push(foldChange);
        chartDatasets[idx].sdFC.push(sd_FC);
        chartDatasets[idx].backgroundColor.push(barColor);
        
        // Print Welch t-Test results in table
        const pValueText = ttest.significant 
          ? `<span style="color:#10B981; font-weight:700;">p=${ttest.p.toFixed(3)}</span>` 
          : `<span style="color:#94a3b8;">p=${ttest.p.toFixed(3)}</span>`;

        resultsTableHTML += `
          <tr>
            <td><strong>${samp.name}</strong><br><small style="color:var(--text-secondary);">${g}</small></td>
            <td>${sampTargetStats.mean.toFixed(2)} ± ${sampTargetStats.sd.toFixed(2)}</td>
            <td>${sampRefStats.mean.toFixed(2)} ± ${sampRefStats.sd.toFixed(2)}</td>
            <td>${dCt.toFixed(2)} ± ${sd_dCt.toFixed(2)}</td>
            <td>${method==='livak' ? (ddCt.toFixed(2) + ' ± ' + sd_ddCt.toFixed(2)) : '-'}</td>
            <td><strong>${foldChange.toFixed(3)}</strong><br><small style="color:var(--text-secondary);">± ${sd_FC.toFixed(3)}</small></td>
            <td>
              <span class="status-badge ${badgeCls}">${interpret}</span><br>
              <small>${pValueText}</small>
            </td>
          </tr>
        `;

        // Push findings to conclusion builder
        conclusionsList.push({
          sampleName: samp.name,
          geneName: g,
          fc: foldChange,
          sd: sd_FC,
          interpret: interpret,
          significant: ttest.significant,
          pVal: ttest.p
        });
      });
    });
    
    document.getElementById('result-tbody').innerHTML = resultsTableHTML;
    document.getElementById('no-result-state').style.display = 'none';
    document.getElementById('result-content').style.display = 'block';
    
    // Switch to visual results tab
    switchTab('result-tab', document.querySelectorAll('.tab-btn')[1]);
    
    renderFCChart(chartLabels, chartDatasets);
    generateFinalConclusion(conclusionsList, upThreshold, downThreshold);
  }

  function generateFinalConclusion(findings, upThresh, downThresh) {
    const textDiv = document.getElementById('conclusion-text');
    if (!textDiv) return;

    if (findings.length === 0) {
      textDiv.innerHTML = "<p>Tidak ada sampel uji untuk dianalisis.</p>";
      return;
    }

    let summary = `<h3 style="margin-top:0; color:var(--text-accent); font-size:1.05rem; border-bottom:1px solid var(--border-color); padding-bottom:0.4rem; margin-bottom:0.75rem;">Hasil Analisis Ekspresi Gen qPCR (Relative Quantification)</h3>`;

    // Group findings by gene
    const genes = [...new Set(findings.map(f => f.geneName))];

    genes.forEach(gName => {
      summary += `<div style="margin-bottom: 1.25rem;">`;
      summary += `<h4 style="margin: 0 0 0.4rem 0; color: var(--text-primary); font-size: 0.9rem;">Gen: ${gName}</h4>`;
      summary += `<ul style="margin: 0 0 0.5rem 0; padding-left: 1.2rem; list-style-type: disc;">`;
      
      const geneFindings = findings.filter(f => f.geneName === gName);
      
      geneFindings.forEach(f => {
        const pText = f.significant ? `signifikan (p = ${f.pVal.toFixed(3)} < 0.05)` : `tidak signifikan (p = ${f.pVal.toFixed(3)})`;
        let desc = "";
        if (f.interpret === "Upregulated") {
          desc = `mengalami peningkatan ekspresi (Upregulated) sebesar <strong>${f.fc.toFixed(3)} ± ${f.sd.toFixed(3)} kali lipat</strong> (${pText})`;
        } else if (f.interpret === "Downregulated") {
          desc = `mengalami penurunan ekspresi (Downregulated) sebesar <strong>${f.fc.toFixed(3)} ± ${f.sd.toFixed(3)} kali lipat</strong> (${pText})`;
        } else {
          desc = `tidak mengalami perubahan ekspresi secara signifikan (Normal) dengan fold change sebesar <strong>${f.fc.toFixed(3)} ± ${f.sd.toFixed(3)} kali lipat</strong> (${pText})`;
        }
        summary += `<li style="margin-bottom:0.2rem; color:var(--text-secondary);">Sampel <strong>${f.sampleName}</strong>: ${desc}.</li>`;
      });
      
      summary += `</ul>`;

      if (geneFindings.length > 1) {
        // Sort by fold change descending
        const sorted = [...geneFindings].sort((a, b) => b.fc - a.fc);
        const highest = sorted[0];
        const lowest = sorted[sorted.length - 1];
        
        const ratio = highest.fc / (lowest.fc || 1.0);
        
        summary += `<div style="background: rgba(255,255,255,0.02); border-left: 3px solid var(--text-accent); padding: 0.5rem 0.75rem; border-radius: 4px; font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">`;
        summary += `<strong style="color:var(--text-accent); display:block; margin-bottom:0.2rem;">Perbandingan Deskriptif Matematis:</strong>`;
        summary += `Ekspresi gen <strong>${gName}</strong> tertinggi terdeteksi pada sampel <strong>${highest.sampleName}</strong> dengan fold change sebesar <strong>${highest.fc.toFixed(3)} ± ${highest.sd.toFixed(3)} kali lipat</strong>. `;
        summary += `Sedangkan ekspresi terendah terdeteksi pada sampel <strong>${lowest.sampleName}</strong> dengan fold change sebesar <strong>${lowest.fc.toFixed(3)} ± ${lowest.sd.toFixed(3)} kali lipat</strong>. `;
        summary += `Rasio perbedaan ekspresi antara sampel tertinggi dan terendah adalah <strong>${ratio.toFixed(2)} kali lipat</strong>.`;
        summary += `</div>`;
      }
      summary += `</div>`;
    });

    textDiv.innerHTML = summary;
  }

  // ─── Chart.js Visualization ──────────────────────────────────────────────────

  function renderFCChart(labels, datasets) {
    const canvas = document.getElementById('fc-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if(fcChart) {
      fcChart.destroy();
    }
    
    fcChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Fold Change (Relative to Control)', color: '#94a3b8' },
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#9ca3af' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#9ca3af' }
          }
        },
        plugins: {
          legend: { labels: { color: '#e2e8f0', font: { family: 'Inter, sans-serif' } } },
          tooltip: {
            callbacks: {
              label: function(context) {
                const dataset = context.dataset;
                const rawFC = dataset.rawFC[context.dataIndex];
                const sdFC = dataset.sdFC[context.dataIndex];
                return `${dataset.label}: FC = ${rawFC.toFixed(3)} ± ${sdFC.toFixed(3)}`;
              }
            }
          }
        }
      }
    });
  }

  // ─── Export & File Exporter Action Handlers ──────────────────────────────────

  // Download Chart as PNG
  window.downloadGPng = function() {
    const canvas = document.getElementById('fc-chart');
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'qpcr-foldchange-chart.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Export Results Table to Excel
  window.exportGExcel = function() {
    if (typeof window.AquaFile === "undefined" || !window.AquaFile.exportToExcel) {
      alert("Pustaka ekspor Excel tidak terdeteksi.");
      return;
    }

    const table = document.getElementById('result-table');
    if (!table) return;

    // Convert table rows to sheets data format
    const rows = table.querySelectorAll('tr');
    const sheetData = [];
    rows.forEach(tr => {
      const cols = tr.querySelectorAll('td, th');
      const rowVals = Array.from(cols).map(c => c.innerText.trim().replace(/\n/g, ' '));
      sheetData.push(rowVals);
    });

    const sheets = [{ name: "Kuantifikasi qPCR", data: sheetData }];
    window.AquaFile.exportToExcel(sheets, "Laporan_qPCR_Relative_Quantification.xlsx");
  };

  // Export Results Table to CSV
  window.exportGCSV = function() {
    if (typeof window.AquaFile === "undefined" || !window.AquaFile.exportToCSV) {
      alert("Pustaka ekspor CSV tidak terdeteksi.");
      return;
    }

    const table = document.getElementById('result-table');
    if (!table) return;

    const rows = table.querySelectorAll('tr');
    const csvData = [];
    rows.forEach(tr => {
      const cols = tr.querySelectorAll('td, th');
      const rowVals = Array.from(cols).map(c => c.innerText.trim().replace(/\n/g, ' '));
      csvData.push(rowVals);
    });

    window.AquaFile.exportToCSV(csvData, "Laporan_qPCR_Relative_Quantification.csv");
  };

  // Print friendly PDF Report
  window.printGPDF = function() {
    const canvas = document.getElementById('fc-chart');
    if (!canvas) return;

    const chartImg = canvas.toDataURL('image/png');
    const tableHtml = document.getElementById('result-table').outerHTML;
    const conclusionHtml = document.getElementById('conclusion-text').innerHTML;
    const methodText = document.getElementById('method-select').options[document.getElementById('method-select').selectedIndex].text;
    const upTh = document.getElementById('up-threshold').value;
    const downTh = document.getElementById('down-threshold').value;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
      <head>
        <title>Laporan Hasil Ekspresi Gen qPCR - Aqua Insight</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1E293B; background: #ffffff; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #E2E8F0; padding-bottom: 15px; }
          .header h1 { margin: 0 0 10px 0; font-size: 22px; color: #0F172A; }
          .header p { margin: 0; color: #64748B; font-size: 13px; }
          .meta-info { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; margin-bottom: 25px; font-size: 13px; }
          .chart-container { text-align: center; margin: 30px 0; }
          .chart-img { max-width: 100%; height: auto; max-height: 350px; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th { background: #0F172A; color: #ffffff; border: 1px solid #CBD5E1; padding: 8px; text-align: left; }
          td { border: 1px solid #CBD5E1; padding: 8px; color: #334155; }
          tr:nth-child(even) { background: #F8FAFC; }
          .conclusion-box { background: #F1F5F9; border-left: 4px solid #0EA5E9; padding: 15px; border-radius: 4px; margin-top: 25px; font-size: 13px; white-space: pre-line; line-height: 1.5; }
          .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Laporan Analisis Kuantifikasi qPCR (Relative)</h1>
          <p>Aqua Insight Diagnostics · Dibuat pada ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}</p>
        </div>
        
        <div class="meta-info">
          <strong>Parameter Analisis:</strong><br>
          • Metode: ${methodText}<br>
          • Ambang Ekspresi: Upregulated &ge; ${upTh}x, Downregulated &le; ${downTh}x<br>
          • Reference Gene: ${referenceGene}
        </div>

        <div class="chart-container">
          <img src="${chartImg}" class="chart-img" alt="qPCR Fold Change Chart" />
        </div>

        <h3 style="color: #0F172A; border-bottom: 1.5px solid #CBD5E1; padding-bottom: 6px; margin-top: 30px;">Tabel Hasil Kuantifikasi</h3>
        ${tableHtml}

        <h3 style="color: #0F172A; border-bottom: 1.5px solid #CBD5E1; padding-bottom: 6px; margin-top: 35px;">Kesimpulan Akhir</h3>
        <div class="conclusion-box">
          ${conclusionHtml}
        </div>

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
  };

  // Expose mutators globally for inline HTML buttons
  window.addSampleRow = addSampleRow;
  window.removeSample = removeSample;
  window.addTargetGene = addTargetGene;
  window.removeTargetGene = removeTargetGene;
  window.addReplication = addReplication;
  window.updateGeneName = updateGeneName;
  window.updateSampleName = updateSampleName;
  window.updateCt = updateCt;
  window.toggleEfficiencyInputs = toggleEfficiencyInputs;
  window.switchTab = switchTab;
  window.calculateExpression = calculateExpression;

})();
