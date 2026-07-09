/* =============================================================
   Risk Analysis Dashboard - Complete Engine
   Mendukung data monitoring tambak lengkap (32+ kolom)
   ============================================================= */

// ── State ──────────────────────────────────────────────────────
let parsedData    = [];   // Array of row objects keyed by column header
let headers       = [];   // Column header names
let trendChart    = null;
let prodChart     = null;
let microChart    = null;
let radarChart    = null;
let activeTrendParams = [];
let currentDoc    = 1;
let diseaseEvents = [];   // Logged disease events: { doc: Number, disease: String, severity: String }
let activeTab     = 'hasil-tab';

// Load disease events from LocalStorage
try {
  diseaseEvents = JSON.parse(localStorage.getItem('ra_disease_events')) || [];
} catch (e) {
  diseaseEvents = [];
}

// ── Column mappings (fuzzy match to canonical keys) ───────────
const COL_MAP = {
  doc:          ['doc'],
  plankton:     ['total plankton', 'plankton'],
  chl:          ['chl'],
  cyano:        ['cyano'],
  bac:          ['bac'],
  dino:         ['dino'],
  proto:        ['proto'],
  plankton_pos: ['plankton menguntungkan', 'beneficial'],
  plankton_neg: ['plankton merugikan', 'merugikan'],
  suhu:         ['suhu'],
  kecerahan:    ['kecerahan'],
  tss:          ['tss'],
  salinitas:    ['salinitas'],
  kedalaman:    ['kedalaman'],
  turbidity:    ['turbidity'],
  do_pagi:      ['do pagi'],
  do_sore:      ['do sore'],
  ph_pagi:      ['ph pagi'],
  ph_sore:      ['ph sore'],
  tan:          ['tan'],
  no2:          ['no2'],
  no3:          ['no3'],
  alkalinitas:  ['alkalinitas'],
  tbc:          ['tbc'],
  tvc:          ['tvc'],
  vibrio_green: ['vibrio green'],
  rasio_vibrio: ['rasio vibrio'],
  mbw:          ['mbw'],
  populasi:     ['populasi'],
  biomassa:     ['biomassa'],
  pakan:        ['pakan (kg)', 'pakan'],
  pakan_kum:    ['pakan kum'],
  fcr:          ['fcr']
};

// ── Reference thresholds for shrimp pond (literature) ────────
const THRESHOLDS = {
  suhu:         { min: 27, max: 31,   unit: '°C',     label: 'Suhu Air' },
  do_pagi:      { min: 4,  max: null, unit: 'mg/L',   label: 'DO Pagi' },
  do_sore:      { min: 5,  max: null, unit: 'mg/L',   label: 'DO Sore' },
  ph_pagi:      { min: 7.5, max: 8.5, unit: '',       label: 'pH Pagi' },
  ph_sore:      { min: 7.5, max: 9.0, unit: '',       label: 'pH Sore' },
  tan:          { min: null, max: 0.5, unit: 'ppm',   label: 'TAN (Amonia)' },
  no2:          { min: null, max: 0.25, unit: 'ppm',  label: 'Nitrit (NO₂)' },
  salinitas:    { min: 15,  max: 35,   unit: 'ppt',   label: 'Salinitas' },
  alkalinitas:  { min: 100, max: 150,  unit: 'mg/L',  label: 'Alkalinitas' },
  turbidity:    { min: null, max: 60,  unit: 'NTU',   label: 'Turbidity' },
  tss:          { min: null, max: 200, unit: 'mg/L',  label: 'TSS' },
  rasio_vibrio: { min: null, max: 0.1, unit: '%',     label: 'Rasio Vibrio/TBC' },
  plankton_neg: { min: null, max: 30,  unit: '%',     label: 'Plankton Merugikan' },
  fcr:          { min: null, max: 1.6, unit: '',      label: 'FCR' },
};

// ── Trend params offered in the UI ───────────────────────────
const TREND_OPTIONS = [
  { key: 'suhu_avg',     label: 'Suhu (Rata-rata)', color: '#F59E0B' },
  { key: 'do_avg',       label: 'DO (Rata-rata)',   color: '#00F2FE' },
  { key: 'ph_avg',       label: 'pH (Rata-rata)',   color: '#A855F7' },
  { key: 'tan',          label: 'TAN',              color: '#EF4444' },
  { key: 'no2',          label: 'NO₂',              color: '#F97316' },
  { key: 'salinitas',    label: 'Salinitas',        color: '#06B6D4' },
  { key: 'turbidity',    label: 'Turbidity',        color: '#8B5CF6' },
  { key: 'plankton_neg', label: 'Plankton⁻',        color: '#F43F5E' },
  { key: 'fcr',          label: 'FCR',              color: '#10B981' },
];

// ── Utility ───────────────────────────────────────────────────
function resolveCol(header) {
  const h = header.toLowerCase().trim();
  for (const [key, aliases] of Object.entries(COL_MAP)) {
    if (aliases.some(a => h.includes(a))) return key;
  }
  return null;
}

function getVal(row, key) {
  return row[key] !== undefined ? parseFloat(row[key]) : NaN;
}

function mean(arr) {
  const v = arr.filter(x => !isNaN(x));
  return v.length ? v.reduce((a,b) => a+b, 0) / v.length : NaN;
}

function pearson(xArr, yArr) {
  const n = Math.min(xArr.length, yArr.length);
  if (n < 3) return NaN;
  const mx = mean(xArr), my = mean(yArr);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const a = xArr[i] - mx, b = yArr[i] - my;
    num += a * b; dx2 += a*a; dy2 += b*b;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? 0 : num / den;
}

function corrColor(r) {
  if (isNaN(r)) return 'rgba(255,255,255,0.04)';
  const v = Math.round(Math.abs(r) * 255);
  return r > 0
    ? `rgba(244, 63, 94, ${Math.abs(r).toFixed(2)})`
    : `rgba(0, 242, 254, ${Math.abs(r).toFixed(2)})`;
}

function fmtNum(v, dec = 2) {
  if (isNaN(v) || v === null || v === undefined) return '—';
  if (Math.abs(v) >= 1e6) return (v/1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e3) return (v/1e3).toFixed(1) + 'K';
  return v.toFixed(dec);
}

function getGenericStress(val, threshDef) {
  if (isNaN(val) || !threshDef) return 0;
  const { min, max } = threshDef;
  let stress = 0;
  
  if (min !== null && max !== null) {
    if (val < min) {
      const criticalLow = min * 0.8;
      stress = clamp((min - val) / (min - criticalLow) * 100, 0, 100);
    } else if (val > max) {
      const criticalHigh = max * 1.2;
      stress = clamp((val - max) / (criticalHigh - max) * 100, 0, 100);
    }
  } else if (min !== null) {
    if (val < min) {
      const criticalLow = min * 0.8;
      stress = clamp((min - val) / (min - criticalLow) * 100, 0, 100);
    }
  } else if (max !== null) {
    if (val > max) {
      const criticalHigh = max * 1.2;
      stress = clamp((val - max) / (criticalHigh - max) * 100, 0, 100);
    }
  }
  return stress;
}

function preprocessAverages(data) {
  data.forEach(row => {
    // 1. DO average
    const doPg = getVal(row, 'do_pagi');
    const doSr = getVal(row, 'do_sore');
    if (!isNaN(doPg) && !isNaN(doSr)) row.do_avg = (doPg + doSr) / 2;
    else if (!isNaN(doPg)) row.do_avg = doPg;
    else if (!isNaN(doSr)) row.do_avg = doSr;
    else row.do_avg = NaN;

    // 2. pH average
    const phPg = getVal(row, 'ph_pagi');
    const phSr = getVal(row, 'ph_sore');
    if (!isNaN(phPg) && !isNaN(phSr)) row.ph_avg = (phPg + phSr) / 2;
    else if (!isNaN(phPg)) row.ph_avg = phPg;
    else if (!isNaN(phSr)) row.ph_avg = phSr;
    else row.ph_avg = NaN;

    // 3. Suhu average
    const suhuPg = getVal(row, 'suhu_pagi');
    const suhuSr = getVal(row, 'suhu_sore');
    if (!isNaN(suhuPg) && !isNaN(suhuSr)) row.suhu_avg = (suhuPg + suhuSr) / 2;
    else if (!isNaN(suhuPg)) row.suhu_avg = suhuPg;
    else if (!isNaN(suhuSr)) row.suhu_avg = suhuSr;
    else row.suhu_avg = getVal(row, 'suhu');
  });
}

// ── Parse TSV/CSV text → array of {canonicalKey: value} ──────
function parseText(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;

  // Detect delimiter
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const rawHeaders = lines[0].split(delim).map(h => h.trim().replace(/"/g, ''));

  // Map raw headers to canonical keys (keep originals for unmapped)
  const colKeys = rawHeaders.map(h => resolveCol(h) || h.toLowerCase().replace(/[^a-z0-9]/g,'_'));

  headers = rawHeaders;
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map(c => c.trim().replace(/"/g, ''));
    if (cells.every(c => c === '')) continue;
    const row = {};
    colKeys.forEach((k, j) => {
      row[k] = cells[j] !== undefined ? cells[j] : '';
    });
    rows.push(row);
  }
  return rows;
}

// ── Column helpers ─────────────────────────────────────────────
function col(key) {
  return parsedData.map(r => getVal(r, key));
}

function colDocs() {
  return parsedData.map(r => getVal(r, 'doc'));
}

function hasRealData() {
  if (!parsedData || parsedData.length === 0) return false;
  return parsedData.some(row => {
    return Object.keys(row).some(key => {
      if (key === 'doc') return false;
      const val = row[key];
      return val !== undefined && val !== null && val.toString().trim() !== '';
    });
  });
}

// ── File Upload ───────────────────────────────────────────────
document.getElementById('ra-file-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const rows = parseText(ev.target.result);
    if (rows && rows.length) {
      parsedData = rows;
      onDataLoaded();
    } else {
      alert('Gagal membaca file. Pastikan format CSV atau TSV dengan header.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ── Paste Modal ───────────────────────────────────────────────
function showPasteModal() {
  document.getElementById('paste-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('paste-area').focus(), 100);
}

function closePasteModal(e) {
  if (!e || e.target.id === 'paste-modal') {
    document.getElementById('paste-modal').style.display = 'none';
  }
}

function processPasteData() {
  const text = document.getElementById('paste-area').value.trim();
  if (!text) { alert('Area paste masih kosong.'); return; }
  const rows = parseText(text);
  if (!rows || rows.length < 2) { alert('Data tidak valid. Pastikan ada header dan minimal 2 baris data.'); return; }
  parsedData = rows;
  closePasteModal();
  onDataLoaded();
}

// ── Preview Modal ─────────────────────────────────────────────
function showDataPreview() {
  if (!parsedData.length) return;
  const preview = parsedData.slice(0, 20);
  const keys = Object.keys(parsedData[0]);
  let html = '<table class="ra-preview-table"><thead><tr><th>DOC</th>';
  // Show DOC + up to 15 most important cols
  const showKeys = keys.filter(k => k !== 'doc').slice(0, 15);
  showKeys.forEach(k => { html += `<th>${k}</th>`; });
  html += '</tr></thead><tbody>';
  preview.forEach(row => {
    html += `<tr><td>${row.doc || '—'}</td>`;
    showKeys.forEach(k => { html += `<td>${fmtNum(parseFloat(row[k]), 3)}</td>`; });
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('preview-table-wrap').innerHTML = html;
  document.getElementById('preview-modal').style.display = 'flex';
}

function closePreviewModal(e) {
  if (!e || e.target.id === 'preview-modal') {
    document.getElementById('preview-modal').style.display = 'none';
  }
}

// ── Demo Data ─────────────────────────────────────────────────
window.loadDemoRiskData = function() {
  const demo = `DOC\tTotal Plankton (sel/mL)\tChl (%)\tCyano (%)\tBac (%)\tDino (%)\tProto (%)\tPlankton Menguntungkan (%)\tPlankton Merugikan (%)\tSuhu (°C)\tKecerahan (cm)\tTSS (mg/L)\tSalinitas (ppt)\tKedalaman (cm)\tTurbidity (NTU)\tDO Pagi\tDO Sore\tpH Pagi\tpH Sore\tTAN\tNO2\tNO3\tAlkalinitas\tTBC (CFU/mL)\tTVC (CFU/mL)\tVibrio Green (CFU/mL)\tRasio Vibrio/TBC\tMBW (g)\tPopulasi\tBiomassa (kg)\tPakan (kg)\tPakan Kum (kg)\tFCR
1\t85000\t55\t20\t20\t3\t3\t85\t15\t29\t45\t60\t25\t117\t35\t5.5\t7.2\t7.8\t8.1\t0.15\t0.05\t1.2\t130\t120000\t12000\t4000\t0.10\t0.01\t99800\t1\t0.1\t0.1\t0.10
5\t110000\t59\t17\t19\t2\t4\t89\t11\t29.3\t42\t70\t25\t119\t42\t5.2\t7.6\t7.9\t8.3\t0.19\t0.07\t1.4\t130\t140000\t16000\t6000\t0.11\t0.07\t99000\t6.9\t0.69\t1.79\t0.26
10\t180000\t52\t28\t15\t3\t3\t80\t20\t30\t38\t85\t25\t113\t55\t4.7\t8.6\t8.2\t8.8\t0.28\t0.12\t2\t130\t200000\t30000\t12000\t0.15\t0.4\t98000\t39.2\t3.92\t13.1\t0.33
15\t310000\t43\t40\t12\t1\t3\t67\t33\t30.5\t33\t120\t25\t104\t80\t4\t9.6\t8.4\t9.3\t0.4\t0.22\t3.2\t130\t360000\t72000\t30000\t0.20\t1.7\t97000\t164.9\t16.49\t64.67\t0.39
20\t480000\t35\t52\t8\t1\t1\t56\t44\t31\t25\t170\t25\t104\t105\t3.4\t10.5\t8.7\t9.8\t0.52\t0.35\t4.5\t130\t600000\t160000\t70000\t0.27\t4\t96000\t384\t38.4\t213.03\t0.55
25\t630000\t29\t62\t4\t4\t2\t46\t54\t31.4\t20\t220\t26\t101\t130\t2.9\t11\t8.9\t10.2\t0.65\t0.48\t5.8\t128\t850000\t320000\t150000\t0.38\t4.8\t95250\t457.2\t45.72\t429.8\t0.94
30\t760000\t25\t68\t2\t1\t3\t40\t60\t31.9\t15\t270\t26\t114\t155\t2.4\t11.3\t9.2\t10.6\t0.78\t0.6\t7\t128\t1100000\t550000\t280000\t0.50\t5\t94500\t472.5\t47.25\t663.77\t1.40
40\t660000\t35\t52\t8\t1\t3\t56\t44\t30.9\t25\t170\t26\t91\t105\t4.2\t9.4\t8.2\t9.1\t0.52\t0.35\t4.5\t128\t1600000\t800000\t500000\t0.50\t9.2\t93500\t860.2\t43.01\t1006.99\t1.17
50\t560000\t45\t35\t15\t2\t4\t73\t27\t29.9\t35\t95\t26\t120\t55\t5.7\t7.4\t7.8\t8.1\t0.28\t0.12\t2.2\t128\t1400000\t580000\t350000\t0.41\t13.4\t92500\t1240.3\t62.01\t1541.83\t1.24
60\t460000\t55\t18\t22\t1\t2\t90\t10\t28.9\t45\t52\t26\t98\t32\t6.7\t6.6\t7.5\t7.6\t0.12\t0.03\t1\t130\t650000\t140000\t70000\t0.22\t17.6\t91500\t1613.7\t80.68\t2265.01\t1.40
70\t360000\t61\t14\t20\t3\t2\t94\t6\t27.9\t55\t32\t26\t103\t12\t7.3\t6.3\t7.3\t7.3\t0.06\t0.01\t0.5\t130\t300000\t35000\t18000\t0.12\t21.8\t90500\t1978.5\t98.93\t3172.59\t1.60
80\t260000\t51\t24\t20\t2\t2\t84\t16\t26.9\t65\t12\t26\t106\t3\t6.3\t5.9\t7.1\t7\t0.04\t0.01\t0.3\t130\t140000\t10000\t5000\t0.07\t26\t89500\t2334\t116.7\t4260\t1.83
90\t160000\t41\t34\t20\t4\t3\t74\t26\t25.9\t75\t3\t26\t116\t1\t5.3\t5.6\t6.9\t6.7\t0.03\t0.01\t0.2\t130\t70000\t3000\t1500\t0.04\t30\t88500\t2655\t133\t5521.47\t2.08`;

  const rows = parseText(demo);
  if (rows) {
    parsedData = rows;
    try {
      localStorage.setItem('ra_parsed_data', JSON.stringify(parsedData));
    } catch (e) {
      console.error("Gagal menyimpan data demo ke LocalStorage:", e);
    }
    onDataLoaded();
    const hasilBtn = document.getElementById('btn-tab-hasil');
    if (hasilBtn) {
      switchRiskTab('hasil-tab', hasilBtn);
    }
    alert("Data demo berhasil dimuat!");
  }
};

// ── On Data Loaded ────────────────────────────────────────────
function onDataLoaded() {
  preprocessAverages(parsedData);
  const n = parsedData.length;
  const docs = colDocs();
  const maxDoc = Math.max(...docs.filter(d => !isNaN(d)));
  const minDoc = Math.min(...docs.filter(d => !isNaN(d)));

  // Status bar
  document.getElementById('ra-status-text').textContent =
    `${n} baris data dimuat — DOC ${minDoc} hingga DOC ${maxDoc} — ${Object.keys(parsedData[0]).length} parameter`;
  document.getElementById('ra-status-bar').style.display = 'flex';

  // DOC slider
  const slider = document.getElementById('doc-slider');
  slider.min  = minDoc;
  slider.max  = maxDoc;
  slider.value = maxDoc;
  document.getElementById('doc-slider-max-label').textContent = `DOC ${maxDoc}`;
  
  slider.oninput = function() { 
    updateDocDisplay(this.value); 
    updateKPICards(parseInt(this.value)); 
    updateGauges(parseInt(this.value)); 
  };
  slider.onchange = function() {
    updateSensitivityTable(parseInt(this.value));
    renderAlerts(parseInt(this.value));
  };
  const docSliderPanel = document.getElementById('doc-slider-panel');
  if (docSliderPanel) docSliderPanel.style.display = 'flex';

  // Enable run button and export buttons
  document.getElementById('run-btn').disabled = false;
  document.getElementById('export-excel-btn').disabled = false;
  document.getElementById('print-pdf-btn').disabled = false;

  // Set default DOC in event form
  const eventDoc = document.getElementById('event-doc');
  if (eventDoc) eventDoc.value = maxDoc;

  // Build trend param buttons
  buildTrendButtons();

  // Render disease events table
  renderDiseaseEventsList();

  // Initial full render
  runAnalysis();
}

function updateDocDisplay(val) {
  currentDoc = parseInt(val);
  document.getElementById('doc-display').textContent = val;
}

// ── Run Full Analysis ─────────────────────────────────────────
function runAnalysis() {
  if (!parsedData.length) { alert('Belum ada data. Silakan upload atau paste terlebih dahulu.'); return; }

  document.getElementById('ra-empty').style.display = 'none';
  document.getElementById('ra-dashboard').style.display = 'block';

  const maxDoc = Math.max(...colDocs().filter(d => !isNaN(d)));
  currentDoc = parseInt(document.getElementById('doc-slider')?.value || maxDoc);

  updateKPICards(currentDoc);
  renderTrendChart();
  renderProdChart();
  renderMicroChart();
  renderRadarChart();
  updateGauges(currentDoc);
  renderCorrelationHeatmap();
  renderAlerts(currentDoc);
  updateSensitivityTable(currentDoc);
  updateProjectionsTable(maxDoc);
}

// ── Row by DOC ────────────────────────────────────────────────
function getRowByDoc(doc) {
  return parsedData.find(r => parseInt(r.doc) === doc) || parsedData[parsedData.length - 1];
}

// ── KPI Cards ─────────────────────────────────────────────────
const KPI_DEFS = [
  { key: 'suhu_avg',     label: 'Suhu Air',          unit: '°C',     dec: 1, thresh: {min:27, max:31} },
  { key: 'do_avg',       label: 'DO (Rata-rata)',    unit: 'mg/L',   dec: 1, thresh: {min:4, max:null} },
  { key: 'ph_avg',       label: 'pH (Rata-rata)',    unit: '',       dec: 2, thresh: {min:7.5, max:9.0} },
  { key: 'tan',          label: 'TAN',                unit: 'ppm',    dec: 3, thresh: {min:null, max:0.5} },
  { key: 'no2',          label: 'NO₂',               unit: 'ppm',    dec: 3, thresh: {min:null, max:0.25} },
  { key: 'turbidity',    label: 'Turbidity',          unit: 'NTU',    dec: 0, thresh: {min:null, max:60} },
  { key: 'rasio_vibrio', label: 'Rasio Vibrio/TBC',   unit: '',       dec: 2, thresh: {min:null, max:0.1} },
  { key: 'mbw',          label: 'MBW',                unit: 'g',      dec: 2, thresh: null },
  { key: 'fcr',          label: 'FCR',                unit: '',       dec: 2, thresh: {min:null, max:1.6} },
  { key: 'populasi',     label: 'Populasi',           unit: 'ekor',   dec: 0, thresh: null },
  { key: 'biomassa',     label: 'Biomassa',           unit: 'kg',     dec: 1, thresh: null },
  { key: 'plankton_neg', label: 'Plankton Merugikan', unit: '%',      dec: 0, thresh: {min:null, max:30} },
];

function updateKPICards(doc) {
  const row = getRowByDoc(doc);
  if (!row) return;
  const container = document.getElementById('ra-kpi-row');

  container.innerHTML = KPI_DEFS.map(def => {
    const v = getVal(row, def.key);
    const display = isNaN(v) ? '—' : fmtNum(v, def.dec);
    let statusClass = '', statusText = '', statusIcon = '';

    if (!isNaN(v) && def.thresh) {
      const { min, max } = def.thresh;
      if ((min !== null && v < min) || (max !== null && v > max)) {
        statusClass = 'alert'; 
        statusIcon = 'fa-triangle-exclamation'; 
        let recText = '';
        if (min !== null && max !== null) {
          recText = ` (${min} - ${max}${def.unit ? ' ' + def.unit : ''})`;
        } else if (min !== null) {
          recText = ` (>= ${min}${def.unit ? ' ' + def.unit : ''})`;
        } else if (max !== null) {
          recText = ` (<= ${max}${def.unit ? ' ' + def.unit : ''})`;
        }
        statusText = 'Kurang suitable untuk udang' + recText;
      } else {
        statusClass = 'ok'; statusIcon = 'fa-circle-check'; statusText = 'Normal';
      }
    }

    return `
      <div class="ra-kpi-card">
        <div class="ra-kpi-label">${def.label}</div>
        <div class="ra-kpi-val">${display} <span class="ra-kpi-unit">${def.unit}</span></div>
        ${statusClass ? `<span class="ra-kpi-status ${statusClass}"><i class="fa-solid ${statusIcon}"></i> ${statusText}</span>` : ''}
      </div>`;
  }).join('');
}

// ── Trend Chart ───────────────────────────────────────────────
function buildTrendButtons() {
  const container = document.getElementById('trend-param-selector');
  activeTrendParams = [TREND_OPTIONS[0].key, TREND_OPTIONS[1].key]; // defaults

  container.innerHTML = TREND_OPTIONS.map(opt => `
    <button class="trend-param-btn ${activeTrendParams.includes(opt.key) ? 'active' : ''}"
      onclick="toggleTrendParam('${opt.key}', this)">${opt.label}</button>
  `).join('');
}

function toggleTrendParam(key, btn) {
  const idx = activeTrendParams.indexOf(key);
  if (idx >= 0) {
    if (activeTrendParams.length <= 1) return;
    activeTrendParams.splice(idx, 1);
    btn.classList.remove('active');
  } else {
    activeTrendParams.push(key);
    btn.classList.add('active');
  }
  renderTrendChart();
}

function renderTrendChart() {
  const docs = colDocs();
  const datasets = activeTrendParams.map(key => {
    const opt = TREND_OPTIONS.find(o => o.key === key);
    return {
      label: opt ? opt.label : key,
      data: col(key),
      borderColor: opt ? opt.color : '#aaa',
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 3,
      tension: 0.3,
      yAxisID: key === 'fcr' ? 'yR' : 'yL'
    };
  });

  const ctx = document.getElementById('trendChart');
  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    type: 'line',
    data: { labels: docs.map(d => `DOC ${d}`), datasets },
    plugins: [{
      id: 'diseaseEventMarker',
      afterDatasetsDraw: (chart) => {
        const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
        if (!x || !diseaseEvents) return;
        ctx.save();
        diseaseEvents.forEach(ev => {
          const label = `DOC ${ev.doc}`;
          const xPos = x.getPixelForValue(label);
          if (xPos !== undefined && xPos >= chart.chartArea.left && xPos <= chart.chartArea.right) {
            ctx.beginPath();
            ctx.moveTo(xPos, top);
            ctx.lineTo(xPos, bottom);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            
            // Label background
            ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
            ctx.fillRect(xPos + 2, top + 4, 38, 12);
            
            ctx.fillStyle = '#EF4444';
            ctx.font = 'bold 8px sans-serif';
            ctx.fillText(ev.disease, xPos + 4, top + 13);
          }
        });
        ctx.restore();
      }
    }],
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      onClick: (e, elements) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          const label = trendChart.data.labels[idx]; // "DOC 30"
          const docVal = parseInt(label.replace('DOC ', ''));
          const slider = document.getElementById('doc-slider');
          if (slider) {
            slider.value = docVal;
            updateDocDisplay(docVal);
            updateKPICards(docVal);
            updateGauges(docVal);
            renderAlerts(docVal);
            updateSensitivityTable(docVal);
            updateProjectionsTable(docVal);
          }
        }
      },
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 11 } } }
      },
      scales: {
        yL: { position: 'left',  grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        yR: { position: 'right', grid: { drawOnChartArea: false },          ticks: { color: '#94a3b8' }, display: activeTrendParams.includes('fcr') },
        x:  { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', maxTicksLimit: 15 } }
      }
    }
  });
}

// ── Production Chart (MBW, Biomassa, FCR) ────────────────────
function renderProdChart() {
  const docs     = colDocs();
  const mbw      = col('mbw');
  const biomassa = col('biomassa');
  const fcr      = col('fcr');
  const ctx = document.getElementById('prodChart');
  if (prodChart) prodChart.destroy();
  prodChart = new Chart(ctx, {
    data: {
      labels: docs.map(d => `DOC ${d}`),
      datasets: [
        {
          type: 'bar',
          label: 'Biomassa (kg)',
          data: biomassa,
          backgroundColor: 'rgba(0,242,254,0.25)',
          borderColor: 'rgba(0,242,254,0.8)',
          borderWidth: 1,
          yAxisID: 'yL'
        },
        {
          type: 'line',
          label: 'MBW (g)',
          data: mbw,
          borderColor: '#A855F7',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          yAxisID: 'yL2'
        },
        {
          type: 'line',
          label: 'FCR',
          data: fcr,
          borderColor: '#F59E0B',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          yAxisID: 'yR'
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
      scales: {
        yL:  { position: 'left',  title: { display: true, text: 'Biomassa (kg)', color: '#94a3b8', font:{size:10} }, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        yL2: { position: 'left',  title: { display: false }, display: false },
        yR:  { position: 'right', title: { display: true, text: 'FCR', color: '#F59E0B', font:{size:10} }, grid: { drawOnChartArea: false }, ticks: { color: '#F59E0B' } },
        x:   { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', maxTicksLimit: 12 } }
      }
    }
  });
}

// ── Microbiology Trend Chart ──────────────────────────────────
function renderMicroChart() {
  const docs  = colDocs();
  const tbc   = col('tbc');
  const tvc   = col('tvc');
  const vibGr = col('vibrio_green');
  const ctx = document.getElementById('microChart');
  if (microChart) microChart.destroy();
  microChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: docs.map(d => `DOC ${d}`),
      datasets: [
        { label: 'TBC (CFU/mL)',         data: tbc,   borderColor: '#00F2FE', backgroundColor: 'rgba(0,242,254,0.05)', borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true },
        { label: 'TVC (CFU/mL)',         data: tvc,   borderColor: '#4FACFE', backgroundColor: 'transparent',           borderWidth: 2, pointRadius: 3, tension: 0.3 },
        { label: 'Vibrio Green (CFU/mL)',data: vibGr, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.05)', borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', callback: v => fmtNum(v, 0) } },
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', maxTicksLimit: 12 } }
      }
    }
  });
}

// ── Radar Chart (water quality profile) ──────────────────────
function renderRadarChart() {
  const ctx = document.getElementById('waterRadarChart');
  if (radarChart) radarChart.destroy();
  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Suhu', 'DO Pagi', 'pH', 'TAN', 'Turbidity', 'Vibrio Ratio'],
      datasets: [{
        label: 'Profil Risiko (%)',
        data: [0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(0, 242, 254, 0.15)',
        borderColor: 'rgba(0, 242, 254, 0.9)',
        pointBackgroundColor: '#00F2FE',
        borderWidth: 2
      }]
    },
    options: {
      scales: {
        r: {
          min: 0, max: 100,
          angleLines: { color: 'rgba(255,255,255,0.08)' },
          grid:       { color: 'rgba(255,255,255,0.08)' },
          pointLabels:{ color: '#9ca3af', font: { size: 10 } },
          ticks:      { display: false }
        }
      },
      plugins: { legend: { display: false } },
      maintainAspectRatio: false
    }
  });
  updateGauges(currentDoc);
}

// ── Fuzzy Risk Gauges + Radar ─────────────────────────────────
function normalize(v, min, max) {
  if (isNaN(v)) return 50;
  return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
}

function updateGauges(doc) {
  const row = getRowByDoc(doc);
  if (!row) return;

  let suhu = getVal(row, 'suhu_avg');
  if (isNaN(suhu)) suhu = getVal(row, 'suhu') || 29;
  let do_avg = getVal(row, 'do_avg');
  if (isNaN(do_avg)) do_avg = getVal(row, 'do_pagi') || 5;
  let ph_avg = getVal(row, 'ph_avg');
  if (isNaN(ph_avg)) ph_avg = getVal(row, 'ph_sore') || 8;

  const tan     = getVal(row, 'tan')         || 0;
  const turb    = getVal(row, 'turbidity')   || 0;
  const vibR    = getVal(row, 'rasio_vibrio')|| 0;
  const plkN    = getVal(row, 'plankton_neg')|| 0;
  const no2     = getVal(row, 'no2')         || 0;
  const sal     = getVal(row, 'salinitas')   || 25;

  // Fuzzy risk scores (0-100) using custom thresholds
  const sMin = THRESHOLDS.suhu.min || 27;
  const sMax = THRESHOLDS.suhu.max || 31;
  let riskSuhu = 10;
  if (suhu < sMin) riskSuhu = clamp(10 + (sMin - suhu) / 4 * 90, 10, 100);
  else if (suhu > sMax) riskSuhu = clamp(10 + (suhu - sMax) / 4 * 90, 10, 100);

  const doMin = THRESHOLDS.do_pagi.min || 4;
  const riskDO = clamp(10 + ((doMin + 1) - do_avg) / 2 * 90, 10, 100);

  const phMin = THRESHOLDS.ph_sore.min || 7.5;
  const phMax = THRESHOLDS.ph_sore.max || 9.0;
  let riskPH = 5;
  if (ph_avg < phMin) riskPH = clamp(5 + (phMin - ph_avg) / 1.0 * 95, 5, 100);
  else if (ph_avg > phMax) riskPH = clamp(5 + (ph_avg - phMax) / 1.0 * 95, 5, 100);

  const riskTAN   = clamp((tan / (THRESHOLDS.tan.max || 0.5)) * 100, 0, 100);
  const riskTurb  = clamp((turb / (THRESHOLDS.turbidity.max || 60)) * 100, 0, 100);
  const riskVibR  = clamp((vibR / (THRESHOLDS.rasio_vibrio.max || 0.1)) * 100, 0, 100);
  const riskPlkN  = clamp((plkN / (THRESHOLDS.plankton_neg.max || 30)) * 100, 0, 100);
  const riskNO2   = clamp((no2 / (THRESHOLDS.no2.max || 0.25)) * 100, 0, 100);

  // Salinitas risk continuous: 15-35 -> 10; < 15 -> to 60 at 5; > 35 -> to 60 at 45
  let riskSal = 10;
  if (sal < 15) riskSal = clamp(10 + (15 - sal) / (15 - 5) * 50, 10, 60);
  else if (sal > 35) riskSal = clamp(10 + (sal - 35) / (45 - 35) * 50, 10, 60);

  // Disease fuzzy scores
  let wssvRisk  = clamp(riskSuhu * 0.4 + riskDO * 0.3 + riskSal * 0.3, 0, 100);
  let ahpndRisk = clamp(riskTAN * 0.35 + riskVibR * 0.45 + riskDO * 0.2, 0, 100);
  let ehpRisk   = clamp(riskTurb * 0.3 + riskPlkN * 0.3 + riskNO2 * 0.4, 0, 100);
  let imnvRisk  = clamp(riskDO * 0.5 + riskSuhu * 0.3 + riskTAN * 0.2, 0, 100);

  // Apply disease event boosts
  let wssvBoost = 0, ahpndBoost = 0, ehpBoost = 0, imnvBoost = 0;
  diseaseEvents.forEach(ev => {
    const d = doc - ev.doc;
    if (d >= 0) {
      let decay = Math.max(0, 1 - (d / 14));
      let boost = ev.severity === 'Berat' ? 100 : (ev.severity === 'Sedang' ? 80 : 50);
      if (ev.disease === 'WSSV') wssvBoost = Math.max(wssvBoost, boost * decay);
      else if (ev.disease === 'AHPND') ahpndBoost = Math.max(ahpndBoost, boost * decay);
      else if (ev.disease === 'EHP') ehpBoost = Math.max(ehpBoost, boost * decay);
      else if (ev.disease === 'IMNV') imnvBoost = Math.max(imnvBoost, boost * decay);
    }
  });

  wssvRisk = Math.max(wssvRisk, wssvBoost);
  ahpndRisk = Math.max(ahpndRisk, ahpndBoost);
  ehpRisk = Math.max(ehpRisk, ehpBoost);
  imnvRisk = Math.max(imnvRisk, imnvBoost);

  // Calculate cumulative mortality risk
  const mortalityRisk = calculateMortalityRisk(suhu, do_avg, ph_avg, tan, no2, sal, wssvRisk, ahpndRisk, ehpRisk, imnvRisk, doc);

  setGauge('wssv',  wssvRisk);
  setGauge('ahpnd', ahpndRisk);
  setGauge('ehp',   ehpRisk);
  setGauge('imnv',  imnvRisk);
  setGauge('mortality', mortalityRisk);

  // Radar
  if (radarChart) {
    radarChart.data.datasets[0].data = [riskSuhu, riskDO, riskPH, riskTAN, riskTurb, riskVibR].map(v => Math.round(v));
    radarChart.update();
  }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function setGauge(id, value) {
  const fill = document.getElementById('gauge-' + id);
  const text = document.getElementById('val-' + id);
  if (!fill || !text) return;
  value = clamp(value, 0, 100);
  const circumference = 125.6;
  fill.style.strokeDashoffset = circumference - (value / 100) * circumference;
  text.innerText = Math.round(value) + '%';
  fill.style.stroke = value >= 70 ? '#F43F5E' : value >= 40 ? '#F59E0B' : '#10B981';
}

function renderCorrelationHeatmap() {
  const targetKey = 'populasi';
  const compKeys = ['suhu', 'do_pagi', 'ph_sore', 'tan', 'no2', 'turbidity', 'tss', 'rasio_vibrio', 'plankton_neg', 'fcr', 'mbw', 'salinitas', 'alkalinitas'];
  const targetCol = col(targetKey).map(v => isNaN(v) ? null : v).filter(v => v !== null);

  let html = '<table class="ra-corr-table"><thead><tr><th>Parameter</th><th>r (Korelasi)</th><th>Interpretasi</th></tr></thead><tbody>';

  compKeys.forEach(key => {
    let resolvedKey = key;
    if (key === 'suhu') resolvedKey = 'suhu_avg';
    else if (key === 'do_pagi') resolvedKey = 'do_avg';
    else if (key === 'ph_sore') resolvedKey = 'ph_avg';

    const pairs = parsedData.map((r, i) => ({ x: getVal(r, resolvedKey), y: getVal(r, targetKey) }))
      .filter(p => !isNaN(p.x) && !isNaN(p.y));
    if (pairs.length < 3) return;
    const r = pearson(pairs.map(p=>p.x), pairs.map(p=>p.y));
    const rAbs = Math.abs(r);
    const label = THRESHOLDS[key]?.label || key;
    const interp = rAbs > 0.7 ? (r>0 ? '🔴 Korelasi kuat (+)' : '🔵 Korelasi kuat (−)')
                 : rAbs > 0.4 ? (r>0 ? '🟡 Korelasi sedang (+)' : '🟡 Korelasi sedang (−)')
                 : '⚪ Korelasi lemah';
    html += `
      <tr>
        <td style="text-align:left; color:var(--text-secondary)">${label}</td>
        <td style="background:${corrColor(r)}; color:${rAbs>0.3?'#fff':'var(--text-secondary)'}; font-weight:700">${isNaN(r)?'—':r.toFixed(3)}</td>
        <td style="text-align:left; font-size:0.68rem; color:var(--text-secondary)">${interp}</td>
      </tr>`;
  });

  html += '</tbody></table>';
  document.getElementById('corr-heatmap').innerHTML = html;
}

function renderAlerts(doc) {
  const row = getRowByDoc(doc);
  if (!row) return;
  const alerts = [];

  const checks = [
    { key: 'do_avg',       crit: v => v < 3.0,  warn: v => v < 4.0,  crit_msg: 'DO (Rata-rata) kurang suitable untuk udang (Rekomendasi: >= 4 mg/L). Sangat kritis (<3 mg/L), nyalakan seluruh aerator!', warn_msg: 'DO (Rata-rata) kurang suitable untuk udang (Rekomendasi: >= 4 mg/L). Rendah (<4 mg/L), tambah aerasi, kurangi pakan.' },
    { key: 'ph_avg',       crit: v => v < 6.5 || v > 9.5,  warn: v => v < 7.5 || v > 9.0, crit_msg: 'pH (Rata-rata) kurang suitable untuk udang (Rekomendasi: 7.5 - 9.0). Sangat ekstrem (<6.5 atau >9.5), risiko kematian massal!', warn_msg: 'pH (Rata-rata) kurang suitable untuk udang (Rekomendasi: 7.5 - 9.0). Mendekati batas ekstrem, lakukan tindakan kontrol buffer.' },
    { key: 'tan',          crit: v => v > 1.0,  warn: v => v > 0.5, crit_msg: 'TAN kurang suitable untuk udang (Rekomendasi: <= 0.5 ppm). Kritis (>1 ppm), segera ganti air & probiotik nitrifikasi.', warn_msg: 'TAN kurang suitable untuk udang (Rekomendasi: <= 0.5 ppm). Mulai tinggi (>0.5 ppm), kurangi pakan, aplikasi probiotik.' },
    { key: 'no2',          crit: v => v > 0.5,  warn: v => v > 0.25,crit_msg: 'Nitrit (NO₂) kurang suitable untuk udang (Rekomendasi: <= 0.25 ppm). Kritis (>0.5 ppm), hindari stress udang.',      warn_msg: 'Nitrit (NO₂) kurang suitable untuk udang (Rekomendasi: <= 0.25 ppm). Meningkat, monitor siklus nitrifikasi.' },
    { key: 'rasio_vibrio', crit: v => v > 0.3,  warn: v => v > 0.1, crit_msg: 'Rasio Vibrio/TBC kurang suitable untuk udang (Rekomendasi: <= 10%). Sangat tinggi (>30%), risiko AHPND meningkat drastis, segera aplikasi desinfektan.', warn_msg: 'Rasio Vibrio/TBC kurang suitable untuk udang (Rekomendasi: <= 10%). Melewati ambang batas (>10%), aplikasi probiotik anti-Vibrio.' },
    { key: 'turbidity',    crit: v => v > 100,  warn: v => v > 60,  crit_msg: 'Turbidity kurang suitable untuk udang (Rekomendasi: <= 60 NTU). Sangat tinggi (>100 NTU), masalah sedimentasi atau bloom algae.',  warn_msg: 'Turbidity kurang suitable untuk udang (Rekomendasi: <= 60 NTU). Tinggi (>60 NTU), periksa sirkulasi dan aerasi dasar.' },
    { key: 'plankton_neg', crit: v => v > 50,   warn: v => v > 30,  crit_msg: 'Plankton merugikan kurang suitable untuk udang (Rekomendasi: <= 30%). Sangat tinggi (>50%), risiko HABs, segera aplikasi kapur & aerasi.', warn_msg: 'Plankton merugikan kurang suitable untuk udang (Rekomendasi: <= 30%). Tinggi (>30%), monitor komposisi plankton secara intensif.' },
    { key: 'fcr',          crit: v => v > 2.0,  warn: v => v > 1.6, crit_msg: 'FCR kurang suitable untuk udang (Rekomendasi: <= 1.6). Sangat tinggi (>2.0), efisiensi pakan sangat buruk.',     warn_msg: 'FCR kurang suitable untuk udang (Rekomendasi: <= 1.6). Mulai tinggi (>1.6), evaluasi kualitas pakan dan nafsu makan.' },
    { key: 'suhu_avg',     crit: v => v < 26 || v > 32, warn: v => v < 27 || v > 31, crit_msg: 'Suhu (Rata-rata) kurang suitable untuk udang (Rekomendasi: 27 - 31 °C). Berada di luar batas (<26 °C atau >32 °C).', warn_msg: 'Suhu (Rata-rata) kurang suitable untuk udang (Rekomendasi: 27 - 31 °C). Mendekati batas ekstrem (<27 °C atau >31 °C), pantau respirasi udang.' },
  ];

  checks.forEach(({ key, crit, warn, crit_msg, warn_msg }) => {
    const v = getVal(row, key);
    if (isNaN(v)) return;
    if (crit(v))      alerts.push({ level: 'crit', msg: crit_msg });
    else if (warn(v)) alerts.push({ level: 'warn', msg: warn_msg });
  });

  if (!alerts.length) {
    alerts.push({ level: 'ok', msg: `Semua parameter terpantau normal pada DOC ${doc}. Pertahankan manajemen kualitas air saat ini.` });
  }

  document.getElementById('ra-alerts-list').innerHTML = alerts.map(a => `
    <div class="ra-alert alert-${a.level}">
      <strong>${a.level === 'crit' ? '🚨 KRITIS' : a.level === 'warn' ? '⚠️ PERINGATAN' : '✅ AMAN'}</strong>
      ${a.msg}
    </div>`).join('');
}

window.applyCustomThresholds = function() {
  const suhuMin = parseFloat(document.getElementById('thresh-suhu-min').value);
  const suhuMax = parseFloat(document.getElementById('thresh-suhu-max').value);
  const doMin = parseFloat(document.getElementById('thresh-do-min').value);
  const phMin = parseFloat(document.getElementById('thresh-ph-min').value);
  const phMax = parseFloat(document.getElementById('thresh-ph-max').value);
  const tanMax = parseFloat(document.getElementById('thresh-tan-max').value);
  const no2Max = parseFloat(document.getElementById('thresh-no2-max').value);
  const fcrMax = parseFloat(document.getElementById('thresh-fcr-max').value);
  const vibrioMax = parseFloat(document.getElementById('thresh-vibrio-max').value);
  const planktonMax = parseFloat(document.getElementById('thresh-plankton-max').value);

  if ([suhuMin, suhuMax, doMin, phMin, phMax, tanMax, no2Max, fcrMax, vibrioMax, planktonMax].some(isNaN)) {
    alert("Pastikan semua ambang batas diisi dengan angka yang valid.");
    return;
  }

  // Mutate THRESHOLDS
  THRESHOLDS.suhu.min = suhuMin;
  THRESHOLDS.suhu.max = suhuMax;
  THRESHOLDS.do_pagi.min = doMin;
  THRESHOLDS.ph_pagi.min = phMin;
  THRESHOLDS.ph_sore.min = phMin;
  THRESHOLDS.ph_sore.max = phMax;
  THRESHOLDS.tan.max = tanMax;
  THRESHOLDS.no2.max = no2Max;
  THRESHOLDS.fcr.max = fcrMax;
  THRESHOLDS.rasio_vibrio.max = vibrioMax / 100;
  THRESHOLDS.plankton_neg.max = planktonMax;

  // Sync KPI_DEFS
  KPI_DEFS.forEach(def => {
    if (def.key === 'suhu_avg') { def.thresh.min = suhuMin; def.thresh.max = suhuMax; }
    else if (def.key === 'do_avg') { def.thresh.min = doMin; }
    else if (def.key === 'ph_avg') { def.thresh.min = phMin; def.thresh.max = phMax; }
    else if (def.key === 'tan') { def.thresh.max = tanMax; }
    else if (def.key === 'no2') { def.thresh.max = no2Max; }
    else if (def.key === 'fcr') { def.thresh.max = fcrMax; }
    else if (def.key === 'rasio_vibrio') { def.thresh.max = vibrioMax / 100; }
    else if (def.key === 'plankton_neg') { def.thresh.max = planktonMax; }
  });

  runAnalysis();
};

window.addDiseaseEvent = function() {
  const docInput = document.getElementById('event-doc');
  const diseaseSelect = document.getElementById('event-disease');
  const severitySelect = document.getElementById('event-severity');
  
  const docVal = parseInt(docInput.value);
  const disease = diseaseSelect.value;
  const severity = severitySelect.value;
  
  if (isNaN(docVal) || docVal < 1) {
    alert("Masukkan DOC kejadian yang valid.");
    return;
  }
  
  const exists = diseaseEvents.find(e => e.doc === docVal && e.disease === disease);
  if (exists) {
    exists.severity = severity;
  } else {
    diseaseEvents.push({ doc: docVal, disease, severity });
  }
  
  localStorage.setItem('ra_disease_events', JSON.stringify(diseaseEvents));
  renderDiseaseEventsList();
  runAnalysis();
  
  docInput.value = currentDoc;
};

window.deleteDiseaseEvent = function(idx) {
  diseaseEvents.splice(idx, 1);
  localStorage.setItem('ra_disease_events', JSON.stringify(diseaseEvents));
  renderDiseaseEventsList();
  runAnalysis();
};

function renderDiseaseEventsList() {
  const tbody = document.getElementById('disease-events-list');
  if (!tbody) return;
  
  if (diseaseEvents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-secondary); font-style:italic; padding: 0.5rem 0;">Belum ada kejadian</td></tr>';
    return;
  }
  
  diseaseEvents.sort((a,b) => a.doc - b.doc);
  
  let html = '';
  diseaseEvents.forEach((ev, idx) => {
    let sevBadge = '';
    if (ev.severity === 'Berat') sevBadge = '<span class="ra-kpi-status alert" style="font-size:0.65rem; padding: 0 4px;">Berat</span>';
    else if (ev.severity === 'Sedang') sevBadge = '<span class="ra-kpi-status warn" style="font-size:0.65rem; padding: 0 4px;">Sedang</span>';
    else sevBadge = '<span class="ra-kpi-status ok" style="font-size:0.65rem; padding: 0 4px;">Ringan</span>';
    
    html += `
      <tr>
        <td style="font-family: monospace; font-weight:700;">DOC ${ev.doc}</td>
        <td><strong style="color: var(--text-accent);">${ev.disease}</strong></td>
        <td>${sevBadge}</td>
        <td>
          <button class="header-btn compact-btn" onclick="deleteDiseaseEvent(${idx})" style="padding: 2px 6px; font-size: 0.65rem;">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

// ── Cumulative Mortality Calculations ─────────────────────────
function calculateMortalityRisk(suhu, do_avg, ph_avg, tan, no2, sal, wssv, ahpnd, ehp, imnv, doc, customOverrides = {}) {
  // Sanitize NaN inputs to prevent propagation and ensure maximum precision
  suhu   = isNaN(suhu) ? 29 : suhu;
  do_avg = isNaN(do_avg) ? 5 : do_avg;
  ph_avg = isNaN(ph_avg) ? 8 : ph_avg;
  tan    = isNaN(tan) ? 0 : tan;
  no2    = isNaN(no2) ? 0 : no2;
  sal    = isNaN(sal) ? 25 : sal;
  wssv   = isNaN(wssv) ? 0 : wssv;
  ahpnd  = isNaN(ahpnd) ? 0 : ahpnd;
  ehp    = isNaN(ehp) ? 0 : ehp;
  imnv   = isNaN(imnv) ? 0 : imnv;
  doc    = parseInt(doc) || 1;

  const doMin = THRESHOLDS.do_pagi.min || 4;
  const phMin = THRESHOLDS.ph_sore.min || 7.5;
  const phMax = THRESHOLDS.ph_sore.max || 9.0;
  const tanMax = THRESHOLDS.tan.max || 0.5;
  const no2Max = THRESHOLDS.no2.max || 0.25;
  const sMin = THRESHOLDS.suhu.min || 27;
  const sMax = THRESHOLDS.suhu.max || 31;

  // Stres DO Rata-rata
  const stressDO = clamp(((doMin + 1) - do_avg) / 2 * 100, 0, 100);

  // Stres pH Rata-rata
  const stressPH_low = clamp((phMin - ph_avg) / 1.0 * 100, 0, 100);
  const stressPH_high = clamp((ph_avg - phMax) / 1.0 * 100, 0, 100);
  const stressPH = Math.max(stressPH_low, stressPH_high);

  // Stres TAN (Amonia)
  const stressTAN = clamp((tan - tanMax * 0.2) / (tanMax * 1.8) * 100, 0, 100);

  // Stres Nitrit
  const stressNO2 = clamp((no2 - no2Max * 0.4) / (no2Max * 1.6) * 100, 0, 100);

  // Stres Suhu (Tambahan presisi tinggi)
  let stressSuhu = 0;
  if (suhu < sMin) stressSuhu = clamp((sMin - suhu) / (sMin - 22) * 100, 0, 100);
  else if (suhu > sMax) stressSuhu = clamp((suhu - sMax) / (35 - sMax) * 100, 0, 100);

  // Stres Salinitas (Tambahan presisi tinggi)
  let stressSal = 0;
  if (sal < 15) stressSal = clamp((15 - sal) / (15 - 5) * 80, 0, 100);
  else if (sal > 35) stressSal = clamp((sal - 35) / (45 - 35) * 80, 0, 100);
  
  let wqStress = Math.max(stressDO, stressPH, stressTAN, stressNO2, stressSuhu, stressSal);

  // Dynamic stress calculation for any custom parameters in THRESHOLDS
  const baseRow = getRowByDoc(doc) || {};
  const testRow = Object.assign({}, baseRow, customOverrides);

  for (const [key, thresh] of Object.entries(THRESHOLDS)) {
    if (!['suhu', 'do_pagi', 'do_sore', 'ph_pagi', 'ph_sore', 'tan', 'no2', 'salinitas', 'suhu_avg', 'do_avg', 'ph_avg'].includes(key)) {
      const val = getVal(testRow, key);
      if (!isNaN(val)) {
        const stress = getGenericStress(val, thresh);
        wqStress = Math.max(wqStress, stress);
      }
    }
  }
  
  const diseaseStress = Math.max(wssv * 0.95, ahpnd * 0.9, imnv * 0.85, ehp * 0.4);
  
  // Calculate actual mortality based on population reduction
  let actualMortality = 0;
  if (parsedData && parsedData.length > 0) {
    const firstRowWithPop = parsedData.find(r => !isNaN(getVal(r, 'populasi')) && getVal(r, 'populasi') > 0);
    const initialPop = firstRowWithPop ? getVal(firstRowWithPop, 'populasi') : NaN;
    const currentPop = getVal(baseRow, 'populasi');
    if (!isNaN(initialPop) && !isNaN(currentPop) && initialPop > 0) {
      actualMortality = ((initialPop - currentPop) / initialPop) * 100;
    }
  }
  
  let mortalityRisk = Math.max(wqStress, diseaseStress, actualMortality);
  
  diseaseEvents.forEach(ev => {
    const d = doc - ev.doc;
    if (d >= 0) {
      let decay = Math.max(0, 1 - (d / 14));
      let boost = ev.severity === 'Berat' ? 95 : (ev.severity === 'Sedang' ? 75 : 45);
      mortalityRisk = Math.max(mortalityRisk, boost * decay);
    }
  });
  
  return clamp(mortalityRisk, 0, 100);
}

function computeMortalityRiskForParams(suhu, do_avg, ph_avg, tan, no2, sal, turb, vibR, plkN, doc, customOverrides = {}) {
  // Sanitize NaN inputs
  suhu   = isNaN(suhu) ? 29 : suhu;
  do_avg = isNaN(do_avg) ? 5 : do_avg;
  ph_avg = isNaN(ph_avg) ? 8 : ph_avg;
  tan    = isNaN(tan) ? 0 : tan;
  no2    = isNaN(no2) ? 0 : no2;
  sal    = isNaN(sal) ? 25 : sal;
  turb   = isNaN(turb) ? 30 : turb;
  vibR   = isNaN(vibR) ? 0.05 : vibR;
  plkN   = isNaN(plkN) ? 10 : plkN;
  doc    = parseInt(doc) || 1;

  const sMin = THRESHOLDS.suhu.min || 27;
  const sMax = THRESHOLDS.suhu.max || 31;
  let riskSuhu = 10;
  if (suhu < sMin) riskSuhu = clamp(10 + (sMin - suhu) / 4 * 90, 10, 100);
  else if (suhu > sMax) riskSuhu = clamp(10 + (suhu - sMax) / 4 * 90, 10, 100);

  const doMin = THRESHOLDS.do_pagi.min || 4;
  const riskDO = clamp(10 + ((doMin + 1) - do_avg) / 2 * 90, 10, 100);

  const phMin = THRESHOLDS.ph_sore.min || 7.5;
  const phMax = THRESHOLDS.ph_sore.max || 9.0;
  let riskPH = 5;
  if (ph_avg < phMin) riskPH = clamp(5 + (phMin - ph_avg) / 1.0 * 95, 5, 100);
  else if (ph_avg > phMax) riskPH = clamp(5 + (ph_avg - phMax) / 1.0 * 95, 5, 100);

  const riskTAN   = clamp((tan / (THRESHOLDS.tan.max || 0.5)) * 100, 0, 100);
  const riskTurb  = clamp((turb / (THRESHOLDS.turbidity.max || 60)) * 100, 0, 100);
  const riskVibR  = clamp((vibR / (THRESHOLDS.rasio_vibrio.max || 0.1)) * 100, 0, 100);
  const riskPlkN  = clamp((plkN / (THRESHOLDS.plankton_neg.max || 30)) * 100, 0, 100);
  const riskNO2   = clamp((no2 / (THRESHOLDS.no2.max || 0.25)) * 100, 0, 100);

  let riskSal = 10;
  if (sal < 15) riskSal = clamp(10 + (15 - sal) / (15 - 5) * 50, 10, 60);
  else if (sal > 35) riskSal = clamp(10 + (sal - 35) / (45 - 35) * 50, 10, 60);

  let wssvRisk  = clamp(riskSuhu * 0.4 + riskDO * 0.3 + riskSal * 0.3, 0, 100);
  let ahpndRisk = clamp(riskTAN * 0.35 + riskVibR * 0.45 + riskDO * 0.2, 0, 100);
  let ehpRisk   = clamp(riskTurb * 0.3 + riskPlkN * 0.3 + riskNO2 * 0.4, 0, 100);
  let imnvRisk  = clamp(riskDO * 0.5 + riskSuhu * 0.3 + riskTAN * 0.2, 0, 100);

  let wssvBoost = 0, ahpndBoost = 0, ehpBoost = 0, imnvBoost = 0;
  diseaseEvents.forEach(ev => {
    const d = doc - ev.doc;
    if (d >= 0) {
      let decay = Math.max(0, 1 - (d / 14));
      let boost = ev.severity === 'Berat' ? 100 : (ev.severity === 'Sedang' ? 80 : 50);
      if (ev.disease === 'WSSV') wssvBoost = Math.max(wssvBoost, boost * decay);
      else if (ev.disease === 'AHPND') ahpndBoost = Math.max(ahpndBoost, boost * decay);
      else if (ev.disease === 'EHP') ehpBoost = Math.max(ehpBoost, boost * decay);
      else if (ev.disease === 'IMNV') imnvBoost = Math.max(imnvBoost, boost * decay);
    }
  });

  const finalWssv = Math.max(wssvRisk, wssvBoost);
  const finalAhpnd = Math.max(ahpndRisk, ahpndBoost);
  const finalEhp = Math.max(ehpRisk, ehpBoost);
  const finalImnv = Math.max(imnvRisk, imnvBoost);

  return calculateMortalityRisk(suhu, do_avg, ph_avg, tan, no2, sal, finalWssv, finalAhpnd, finalEhp, finalImnv, doc, customOverrides);
}

// ── Parameter Sensitivity Table (Global Step Search) ───────────
function findDeltaForRiskIncrease(paramKey, direction, row, baseRisk, doc) {
  doc = parseInt(doc) || 1;
  let suhu = getVal(row, 'suhu_avg');
  if (isNaN(suhu)) suhu = getVal(row, 'suhu');
  let do_avg = getVal(row, 'do_avg');
  if (isNaN(do_avg)) do_avg = getVal(row, 'do_pagi');
  let ph_avg = getVal(row, 'ph_avg');
  if (isNaN(ph_avg)) ph_avg = getVal(row, 'ph_sore');
  const tan  = getVal(row, 'tan');
  const no2  = getVal(row, 'no2');
  const sal  = getVal(row, 'salinitas');
  const turb = getVal(row, 'turbidity');
  const vibR = getVal(row, 'rasio_vibrio');
  const plkN = getVal(row, 'plankton_neg');

  let step = 0.05;
  let limit = 200;
  let currentVal = 0;

  if (paramKey === 'suhu_avg') {
    currentVal = suhu;
    step = 0.05;
    limit = 200;
  } else if (paramKey === 'do_avg') {
    currentVal = do_avg;
    step = 0.02;
    limit = 250;
  } else if (paramKey === 'ph_avg') {
    currentVal = ph_avg;
    step = 0.01;
    limit = 300;
  } else if (paramKey === 'tan') {
    currentVal = tan;
    step = 0.005;
    limit = 400;
  } else if (paramKey === 'no2') {
    currentVal = no2;
    step = 0.005;
    limit = 400;
  } else if (paramKey === 'rasio_vibrio') {
    currentVal = vibR;
    step = 0.002;
    limit = 500;
  } else if (paramKey === 'plankton_neg') {
    currentVal = plkN;
    step = 0.2;
    limit = 500;
  } else {
    currentVal = getVal(row, paramKey);
    if (isNaN(currentVal)) return NaN;
    const thresh = THRESHOLDS[paramKey];
    const safeRef = thresh ? (thresh.max || thresh.min || 1) : 1;
    step = safeRef * 0.005;
    limit = 400;
  }

  const sign = direction === 'up' ? 1 : -1;

  for (let i = 1; i <= limit; i++) {
    const delta = i * step * sign;
    const testVal = currentVal + delta;

    if (paramKey === 'do_avg' && testVal < 0) break;
    if (paramKey === 'ph_avg' && (testVal < 0 || testVal > 14)) break;
    if (paramKey === 'tan' && testVal < 0) break;
    if (paramKey === 'no2' && testVal < 0) break;
    if (paramKey === 'rasio_vibrio' && (testVal < 0 || testVal > 1)) break;
    if (paramKey === 'plankton_neg' && (testVal < 0 || testVal > 100)) break;
    if (paramKey === 'suhu_avg' && (testVal < 10 || testVal > 45)) break;
    if (testVal < 0 && THRESHOLDS[paramKey] && THRESHOLDS[paramKey].max !== null && THRESHOLDS[paramKey].min === null) break;

    let tSuhu = suhu;
    let tDO   = do_avg;
    let tPH   = ph_avg;
    let tTAN  = tan;
    let tNO2  = no2;
    let tSal  = sal;
    let tTurb = turb;
    let tVibR = vibR;
    let tPlkN = plkN;

    let overrides = {};
    if (paramKey === 'suhu_avg') tSuhu = testVal;
    else if (paramKey === 'do_avg') tDO = testVal;
    else if (paramKey === 'ph_avg') tPH = testVal;
    else if (paramKey === 'tan') tTAN = testVal;
    else if (paramKey === 'no2') tNO2 = testVal;
    else if (paramKey === 'rasio_vibrio') tVibR = testVal;
    else if (paramKey === 'plankton_neg') tPlkN = testVal;
    else {
      overrides[paramKey] = testVal;
    }

    const testRisk = computeMortalityRiskForParams(tSuhu, tDO, tPH, tTAN, tNO2, tSal, tTurb, tVibR, tPlkN, doc, overrides);

    if (testRisk - baseRisk >= 1.0) {
      return delta;
    }
  }

  return NaN;
}

function updateSensitivityTable(doc) {
  doc = parseInt(doc) || 1;
  const row = getRowByDoc(doc);
  if (!row) return;

  let suhu = getVal(row, 'suhu_avg');
  if (isNaN(suhu)) suhu = getVal(row, 'suhu');
  let do_avg = getVal(row, 'do_avg');
  if (isNaN(do_avg)) do_avg = getVal(row, 'do_pagi');
  let ph_avg = getVal(row, 'ph_avg');
  if (isNaN(ph_avg)) ph_avg = getVal(row, 'ph_sore');
  const tan  = getVal(row, 'tan');
  const no2  = getVal(row, 'no2');
  const sal  = getVal(row, 'salinitas');
  const turb = getVal(row, 'turbidity');
  const vibR = getVal(row, 'rasio_vibrio');
  const plkN = getVal(row, 'plankton_neg');

  const baseRisk = computeMortalityRiskForParams(suhu, do_avg, ph_avg, tan, no2, sal, turb, vibR, plkN, doc);

  const parameters = [
    { name: 'Suhu Air',          key: 'suhu_avg',     val: suhu,    unit: '°C' },
    { name: 'DO (Rata-rata)',    key: 'do_avg',       val: do_avg,  unit: 'mg/L' },
    { name: 'pH (Rata-rata)',    key: 'ph_avg',       val: ph_avg,  unit: '' },
    { name: 'TAN (Amonia)',      key: 'tan',          val: tan,     unit: 'ppm' },
    { name: 'Nitrit (NO₂)',      key: 'no2',          val: no2,     unit: 'ppm' },
    { name: 'Rasio Vibrio/TBC',  key: 'rasio_vibrio', val: vibR,    unit: '%' },
    { name: 'Plankton Merugik.', key: 'plankton_neg', val: plkN,    unit: '%' }
  ];

  // Append custom parameters dynamically from THRESHOLDS
  for (const [key, thresh] of Object.entries(THRESHOLDS)) {
    if (!['suhu', 'do_pagi', 'do_sore', 'ph_pagi', 'ph_sore', 'tan', 'no2', 'salinitas', 'alkalinitas', 'turbidity', 'tss', 'rasio_vibrio', 'plankton_neg', 'fcr', 'suhu_avg', 'do_avg', 'ph_avg'].includes(key)) {
      const val = getVal(row, key);
      parameters.push({ name: thresh.label, key: key, val: val, unit: thresh.unit || '' });
    }
  }

  let html = '<table class="ra-sens-table"><thead><tr><th>Parameter</th><th>Nilai Saat Ini</th><th>Kenaikan untuk +1% Risiko</th><th>Penurunan untuk +1% Risiko</th></tr></thead><tbody>';

  parameters.forEach(p => {
    const deltaUp = findDeltaForRiskIncrease(p.key, 'up', row, baseRisk, doc);
    const deltaDown = findDeltaForRiskIncrease(p.key, 'down', row, baseRisk, doc);

    let sensUp = '—';
    if (!isNaN(deltaUp)) {
      sensUp = `+${deltaUp.toFixed(2)}${p.unit ? ' ' + p.unit : ''}`;
    }

    let sensDown = '—';
    if (!isNaN(deltaDown)) {
      sensDown = `-${Math.abs(deltaDown).toFixed(2)}${p.unit ? ' ' + p.unit : ''}`;
    }

    let valFormatted = fmtNum(p.val, p.key === 'ph_avg' ? 2 : p.key === 'tan' || p.key === 'no2' ? 3 : 1);
    if (p.key === 'rasio_vibrio') valFormatted = (p.val * 100).toFixed(1) + '%';
    else if (p.key === 'plankton_neg') valFormatted = p.val.toFixed(0) + '%';

    html += `
      <tr>
        <td>${p.name}</td>
        <td><strong>${valFormatted}</strong></td>
        <td style="color:${sensUp !== '—' ? '#F43F5E' : 'var(--text-secondary)'}">${sensUp}</td>
        <td style="color:${sensDown !== '—' ? '#F43F5E' : 'var(--text-secondary)'}">${sensDown}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  document.getElementById('sensitivity-table-wrap').innerHTML = html;
}

// ── Future Risk Forecasting (Linear Regression OLS) ───────────
function fitLinearRegression(xArr, yArr) {
  const n = xArr.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += xArr[i];
    sumY += yArr[i];
    sumXY += xArr[i] * yArr[i];
    sumXX += xArr[i] * xArr[i];
  }
  const num = n * sumXY - sumX * sumY;
  const den = n * sumXX - sumX * sumX;
  if (den === 0) return { slope: 0, intercept: yArr[yArr.length - 1] };
  const slope = num / den;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function getForecastValue(key, targetDoc, historyRows) {
  const x = [];
  const y = [];
  historyRows.forEach(r => {
    const d = getVal(r, 'doc');
    const v = getVal(r, key);
    if (!isNaN(d) && !isNaN(v)) {
      x.push(d);
      y.push(v);
    }
  });

  if (x.length < 2) {
    const lastRow = historyRows[historyRows.length - 1];
    return lastRow ? getVal(lastRow, key) : NaN;
  }

  const reg = fitLinearRegression(x, y);
  return applyForecastClamp(key, reg.slope * targetDoc + reg.intercept);
}

function applyForecastClamp(key, forecasted) {
  if (key === 'suhu' || key === 'suhu_avg') return clamp(forecasted, 20, 38);
  if (key === 'do_pagi' || key === 'do_avg') return clamp(forecasted, 0, 15);
  if (key === 'ph_sore' || key === 'ph_avg') return clamp(forecasted, 5, 11);
  if (key === 'tan') return Math.max(0, forecasted);
  if (key === 'no2') return Math.max(0, forecasted);
  if (key === 'rasio_vibrio') return clamp(forecasted, 0, 1);
  if (key === 'plankton_neg') return clamp(forecasted, 0, 100);
  if (key === 'salinitas') return clamp(forecasted, 0, 50);
  if (key === 'turbidity') return Math.max(0, forecasted);
  return forecasted;
}

// Pre-compute regression coefficients for all keys at once, returns a map {key: {slope, intercept, lastVal}}
function buildRegressionCache(keys, historyRows) {
  const cache = {};
  const lastRow = historyRows[historyRows.length - 1];
  keys.forEach(key => {
    const x = [], y = [];
    historyRows.forEach(r => {
      const d = getVal(r, 'doc');
      const v = getVal(r, key);
      if (!isNaN(d) && !isNaN(v)) { x.push(d); y.push(v); }
    });
    if (x.length < 2) {
      cache[key] = { slope: 0, intercept: lastRow ? (getVal(lastRow, key) || 0) : 0, hasData: x.length >= 1 };
    } else {
      const reg = fitLinearRegression(x, y);
      cache[key] = { slope: reg.slope, intercept: reg.intercept, hasData: true };
    }
  });
  return cache;
}

function getForecastFromCache(key, targetDoc, cache, fallback) {
  const reg = cache[key];
  if (!reg || !reg.hasData) return fallback;
  return applyForecastClamp(key, reg.slope * targetDoc + reg.intercept);
}

function updateProjectionsTable(doc) {
  doc = parseInt(doc) || 1;
  const historyRows = parsedData.filter(r => parseInt(r.doc) <= doc);
  if (historyRows.length === 0) return;

  const row = getRowByDoc(doc);
  let activeSuhu = getVal(row, 'suhu_avg');
  if (isNaN(activeSuhu)) activeSuhu = getVal(row, 'suhu') || 29;
  let activeDO = getVal(row, 'do_avg');
  if (isNaN(activeDO)) activeDO = getVal(row, 'do_pagi') || 5;
  let activePH = getVal(row, 'ph_avg');
  if (isNaN(activePH)) activePH = getVal(row, 'ph_sore') || 8;
  const activeTAN = getVal(row, 'tan') || 0;
  const activeNO2 = getVal(row, 'no2') || 0;
  const activeSal = getVal(row, 'salinitas') || 25;
  const activeTurb = getVal(row, 'turbidity') || 30;
  const activeVibR = getVal(row, 'rasio_vibrio') || 0.05;
  const activePlkN = getVal(row, 'plankton_neg') || 10;

  // Custom THRESHOLD keys (user-added parameters)
  const customKeys = Object.keys(THRESHOLDS).filter(k => !['suhu', 'do_pagi', 'do_sore', 'ph_pagi', 'ph_sore', 'tan', 'no2', 'salinitas', 'alkalinitas', 'turbidity', 'tss', 'rasio_vibrio', 'plankton_neg', 'fcr', 'suhu_avg', 'do_avg', 'ph_avg'].includes(k));

  // ── PRE-COMPUTE regression coefficients once for all keys ────
  const forecastKeys = ['suhu_avg', 'suhu', 'do_avg', 'do_pagi', 'ph_avg', 'ph_sore', 'tan', 'no2', 'salinitas', 'turbidity', 'rasio_vibrio', 'plankton_neg', ...customKeys];
  const regCache = buildRegressionCache(forecastKeys, historyRows);

  const targets = [3, 7, 14];
  const lastDoc = doc; // forecasting starts from the last input DOC

  // Build header
  let html = '<table class="ra-proj-table"><thead><tr>';
  html += '<th>Proyeksi DOC</th><th>Suhu</th><th>DO Rata²</th><th>TAN</th><th>NO₂</th><th>Vibrio Ratio</th>';
  customKeys.forEach(k => { html += `<th>${THRESHOLDS[k].label}</th>`; });
  html += '<th>Risiko AHPND</th><th>Risiko Kematian</th></tr></thead><tbody>';

  targets.forEach(t => {
    const targetDoc = lastDoc + t;

    // ── Fast forecast using cached regression ──────────────────
    let suhuF = getForecastFromCache('suhu_avg', targetDoc, regCache, NaN);
    if (isNaN(suhuF)) suhuF = getForecastFromCache('suhu', targetDoc, regCache, activeSuhu);

    let doF = getForecastFromCache('do_avg', targetDoc, regCache, NaN);
    if (isNaN(doF)) doF = getForecastFromCache('do_pagi', targetDoc, regCache, activeDO);

    let phF = getForecastFromCache('ph_avg', targetDoc, regCache, NaN);
    if (isNaN(phF)) phF = getForecastFromCache('ph_sore', targetDoc, regCache, activePH);

    const tanF  = getForecastFromCache('tan',          targetDoc, regCache, activeTAN);
    const no2F  = getForecastFromCache('no2',          targetDoc, regCache, activeNO2);
    const salF  = getForecastFromCache('salinitas',    targetDoc, regCache, activeSal);
    const turbF = getForecastFromCache('turbidity',    targetDoc, regCache, activeTurb);
    const vibRF = getForecastFromCache('rasio_vibrio', targetDoc, regCache, activeVibR);
    const plkNF = getForecastFromCache('plankton_neg', targetDoc, regCache, activePlkN);

    // Forecast custom parameters
    const customForecasts = {};
    customKeys.forEach(k => {
      const fVal = getForecastFromCache(k, targetDoc, regCache, getVal(row, k));
      customForecasts[k] = fVal;
    });

    // ── Risk calculations ──────────────────────────────────────
    const sMin = THRESHOLDS.suhu.min || 27;
    const sMax = THRESHOLDS.suhu.max || 31;
    let riskSuhu = 10;
    if (suhuF < sMin) riskSuhu = clamp(10 + (sMin - suhuF) / 4 * 90, 10, 100);
    else if (suhuF > sMax) riskSuhu = clamp(10 + (suhuF - sMax) / 4 * 90, 10, 100);

    const doMin  = THRESHOLDS.do_pagi.min || 4;
    const riskDO   = clamp(10 + ((doMin + 1) - doF) / 2 * 90, 10, 100);
    const riskTAN  = clamp((tanF / (THRESHOLDS.tan.max || 0.5)) * 100, 0, 100);
    const riskPlkN = clamp((plkNF / (THRESHOLDS.plankton_neg.max || 30)) * 100, 0, 100);
    const riskNO2  = clamp((no2F / (THRESHOLDS.no2.max || 0.25)) * 100, 0, 100);
    const riskVibR = clamp((vibRF / (THRESHOLDS.rasio_vibrio.max || 0.1)) * 100, 0, 100);
    const riskTurb = clamp((turbF / (THRESHOLDS.turbidity.max || 60)) * 100, 0, 100);

    let ahpndRisk = clamp(riskTAN * 0.35 + riskVibR * 0.45 + riskDO * 0.2, 0, 100);
    let wssvRisk  = clamp(riskSuhu * 0.4 + riskDO * 0.3 + (salF < 15 || salF > 35 ? 60 : 10) * 0.3, 0, 100);
    let ehpRisk   = clamp(riskTurb * 0.3 + riskPlkN * 0.3 + riskNO2 * 0.4, 0, 100);
    let imnvRisk  = clamp(riskDO * 0.5 + riskSuhu * 0.3 + riskTAN * 0.2, 0, 100);

    let wssvBoost = 0, ahpndBoost = 0, ehpBoost = 0, imnvBoost = 0;
    diseaseEvents.forEach(ev => {
      const d = targetDoc - ev.doc;
      if (d >= 0) {
        const decay = Math.max(0, 1 - (d / 14));
        const boost = ev.severity === 'Berat' ? 100 : (ev.severity === 'Sedang' ? 80 : 50);
        if (ev.disease === 'WSSV')  wssvBoost  = Math.max(wssvBoost,  boost * decay);
        else if (ev.disease === 'AHPND') ahpndBoost = Math.max(ahpndBoost, boost * decay);
        else if (ev.disease === 'EHP')  ehpBoost  = Math.max(ehpBoost,  boost * decay);
        else if (ev.disease === 'IMNV') imnvBoost = Math.max(imnvBoost, boost * decay);
      }
    });

    ahpndRisk = Math.max(ahpndRisk, ahpndBoost);
    wssvRisk  = Math.max(wssvRisk,  wssvBoost);
    ehpRisk   = Math.max(ehpRisk,   ehpBoost);
    imnvRisk  = Math.max(imnvRisk,  imnvBoost);

    const mortRisk = calculateMortalityRisk(suhuF, doF, phF, tanF, no2F, salF, wssvRisk, ahpndRisk, ehpRisk, imnvRisk, targetDoc, customForecasts);

    const ahpndClass = ahpndRisk >= 70 ? 'style="color:#F43F5E; font-weight:700;"' : (ahpndRisk >= 40 ? 'style="color:#F59E0B; font-weight:700;"' : 'style="color:#10B981;"');
    const mortClass  = mortRisk  >= 70 ? 'style="color:#F43F5E; font-weight:700;"' : (mortRisk  >= 40 ? 'style="color:#F59E0B; font-weight:700;"' : 'style="color:#10B981;"');

    let customCellsHtml = '';
    customKeys.forEach(k => {
      const fVal = customForecasts[k];
      const displayVal = isNaN(fVal) ? '—' : fVal.toFixed(THRESHOLDS[k].max && THRESHOLDS[k].max < 1 ? 3 : 1);
      customCellsHtml += `<td>${displayVal} ${THRESHOLDS[k].unit || ''}</td>`;
    });

    html += `
      <tr>
        <td><strong>DOC ${targetDoc}</strong> <span style="color:var(--text-secondary);font-size:0.7rem;">(+${t} hari)</span></td>
        <td>${isNaN(suhuF) ? '—' : suhuF.toFixed(1)} °C</td>
        <td>${isNaN(doF)   ? '—' : doF.toFixed(1)} mg/L</td>
        <td>${isNaN(tanF)  ? '—' : tanF.toFixed(2)} ppm</td>
        <td>${isNaN(no2F)  ? '—' : no2F.toFixed(3)} ppm</td>
        <td>${isNaN(vibRF) ? '—' : (vibRF * 100).toFixed(1)}%</td>
        ${customCellsHtml}
        <td ${ahpndClass}>${Math.round(ahpndRisk)}%</td>
        <td ${mortClass}>${Math.round(mortRisk)}%</td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  document.getElementById('projections-table-wrap').innerHTML = html;
}

// ── Spreadsheet Editor Functions ──────────────────────────────
window.switchRiskTab = function(tabId, btn) {
  activeTab = tabId;
  
  const hasData = hasRealData();
  
  if (!hasData && tabId === 'hasil-tab') {
    document.getElementById('ra-dashboard').style.display = 'none';
    document.getElementById('ra-empty').style.display = 'block';
    document.getElementById('ra-status-bar').style.display = 'none';
  } else {
    document.getElementById('ra-dashboard').style.display = 'block';
    document.getElementById('ra-empty').style.display = 'none';
    
    // Tampilkan status bar jika data sudah valid
    document.getElementById('ra-status-bar').style.display = hasData ? 'flex' : 'none';
    
    document.querySelectorAll('.tab-pane').forEach(el => {
      el.style.display = 'none';
      el.classList.remove('active');
    });
    const targetPane = document.getElementById(tabId);
    if (targetPane) {
      targetPane.style.display = tabId === 'input-tab' ? 'grid' : 'flex';
      targetPane.classList.add('active');
    }
    
    if (tabId === 'input-tab') {
      renderSpreadsheet();
    } else if (tabId === 'hasil-tab') {
      runAnalysis();
    }
  }
  
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
};

function renderSpreadsheet() {
  const table = document.getElementById('ra-spreadsheet-table');
  if (!table || !parsedData.length) return;
  
  const keys = Object.keys(parsedData[0]);
  
  // Build header
  let html = '<thead><tr><th class="row-number-header">#</th>';
  keys.forEach(k => {
    html += `<th>${k.toUpperCase()}</th>`;
  });
  html += '<th style="width: 50px;">AKSI</th></tr></thead>';
  
  // Build body
  html += '<tbody>';
  parsedData.forEach((row, rowIdx) => {
    html += `<tr>`;
    // Row number column
    html += `<td class="row-num">${rowIdx + 1}</td>`;
    keys.forEach(k => {
      const val = row[k] !== undefined ? row[k] : '';
      const isDoc = k === 'doc';
      html += `<td contenteditable="true" class="spreadsheet-input editable-cell" data-row="${rowIdx}" data-col="${k}"
        style="text-align: ${isDoc ? 'center' : 'right'}; font-family: monospace; font-size: 0.8rem;"
        onblur="updateSpreadsheetCell(${rowIdx}, '${k}', this.textContent)">${val}</td>`;
    });
    html += `<td>
      <button class="header-btn compact-btn" onclick="deleteSpreadsheetRow(${rowIdx})" style="padding: 2px 6px; font-size: 0.65rem; margin: 0 auto; display: block; border-color: rgba(244,63,94,0.3); color: #F43F5E; background: rgba(244,63,94,0.05);">
        <i class="fa-solid fa-trash"></i>
      </button>
    </td></tr>`;
  });
  html += '</tbody>';
  table.innerHTML = html;
}

window.updateSpreadsheetCell = function(rowIdx, key, val) {
  if (parsedData[rowIdx]) {
    parsedData[rowIdx][key] = val.trim();
  }
};

window.deleteSpreadsheetRow = function(rowIdx) {
  if (confirm(`Apakah Anda yakin ingin menghapus baris ke-${rowIdx + 1}?`)) {
    parsedData.splice(rowIdx, 1);
    renderSpreadsheet();
  }
};

window.resetRiskData = function() {
  if (confirm("Apakah Anda yakin ingin menghapus seluruh data dan memulai dari awal?")) {
    localStorage.removeItem('ra_parsed_data');
    initDefaultTable();
    renderSpreadsheet();
    
    // Sembunyikan status bar dan slider panel
    document.getElementById('ra-status-bar').style.display = 'none';
    const docSliderPanel = document.getElementById('doc-slider-panel');
    if (docSliderPanel) docSliderPanel.style.display = 'none';
    
    // Sembunyikan dashboard dan tampilkan empty state untuk Hasil
    document.getElementById('ra-dashboard').style.display = 'none';
    document.getElementById('ra-empty').style.display = 'block';
    
    // Disable buttons
    document.getElementById('run-btn').disabled = true;
    document.getElementById('export-excel-btn').disabled = true;
    document.getElementById('print-pdf-btn').disabled = true;
    
    // Kembalikan ke input-tab
    const inputBtn = document.getElementById('btn-tab-input');
    switchRiskTab('input-tab', inputBtn);
    
    alert("Data berhasil direset!");
  }
};

window.addSpreadsheetRow = function() {
  if (!parsedData.length) {
    parsedData.push({ doc: '1' });
  } else {
    const lastRow = parsedData[parsedData.length - 1];
    const lastDoc = parseInt(lastRow.doc) || 0;
    const newRow = {};
    Object.keys(lastRow).forEach(k => {
      if (k === 'doc') {
        newRow[k] = (lastDoc + 1).toString();
      } else {
        newRow[k] = '';
      }
    });
    parsedData.push(newRow);
  }
  renderSpreadsheet();
  setTimeout(() => {
    const wrap = document.querySelector('.ra-preview-table-wrap');
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
  }, 50);
};

window.addSpreadsheetColumn = function() {
  document.getElementById('new-param-name').value = '';
  document.getElementById('new-param-unit').value = '';
  document.getElementById('new-param-min').value = '';
  document.getElementById('new-param-max').value = '';
  document.getElementById('new-param-dec').value = '3';
  
  document.getElementById('add-param-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('new-param-name').focus(), 100);
};

window.closeAddParamModal = function(e) {
  if (!e || e.target.id === 'add-param-modal') {
    document.getElementById('add-param-modal').style.display = 'none';
  }
};

window.submitNewParameter = function() {
  const nameInput = document.getElementById('new-param-name');
  const unitInput = document.getElementById('new-param-unit');
  const minInput = document.getElementById('new-param-min');
  const maxInput = document.getElementById('new-param-max');
  const decSelect = document.getElementById('new-param-dec');
  
  const colName = nameInput.value.trim();
  if (!colName) {
    alert("Masukkan nama parameter.");
    return;
  }
  
  const canonical = colName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (!canonical) {
    alert("Nama parameter tidak valid.");
    return;
  }
  
  if (parsedData.length > 0 && parsedData[0].hasOwnProperty(canonical)) {
    alert("Parameter ini sudah ada.");
    return;
  }
  
  const colUnit = unitInput.value.trim();
  const colMinVal = minInput.value.trim();
  const colMaxVal = maxInput.value.trim();
  
  const colMin = colMinVal !== "" && !isNaN(parseFloat(colMinVal)) ? parseFloat(colMinVal) : null;
  const colMax = colMaxVal !== "" && !isNaN(parseFloat(colMaxVal)) ? parseFloat(colMaxVal) : null;
  const colDec = parseInt(decSelect.value);
  
  // Save parameter definition to customParams
  let customParams = [];
  try {
    customParams = JSON.parse(localStorage.getItem('ra_custom_params')) || [];
  } catch (e) {
    customParams = [];
  }
  
  customParams.push({
    canonical,
    label: colName,
    min: colMin,
    max: colMax,
    unit: colUnit,
    dec: colDec
  });
  localStorage.setItem('ra_custom_params', JSON.stringify(customParams));
  
  // Register dynamically
  if (typeof registerCustomParameter === 'function') {
    registerCustomParameter(canonical, colName, colMin, colMax, colUnit, colDec);
  } else {
    // Fallback if defined elsewhere
    THRESHOLDS[canonical] = { min: colMin, max: colMax, unit: colUnit, label: colName };
    KPI_DEFS.push({
      key: canonical,
      label: colName,
      unit: colUnit,
      dec: colDec,
      thresh: { min: colMin, max: colMax }
    });
    TREND_OPTIONS.push({
      key: canonical,
      label: colName,
      color: '#' + Math.floor(Math.random()*16777215).toString(16)
    });
    buildTrendButtons();
  }
  
  parsedData.forEach(row => {
    row[canonical] = '';
  });
  
  document.getElementById('add-param-modal').style.display = 'none';
  renderSpreadsheet();
  alert(`Parameter kustom "${colName}" berhasil ditambahkan dan dikonfigurasi ke dalam perhitungan risiko!`);
};

window.applySpreadsheetChanges = function() {
  if (!parsedData.length) {
    alert("Data kosong. Silakan tambah baris terlebih dahulu.");
    return;
  }
  
  // Apply thresholds
  const suhuMin = parseFloat(document.getElementById('thresh-suhu-min').value);
  const suhuMax = parseFloat(document.getElementById('thresh-suhu-max').value);
  const doMin = parseFloat(document.getElementById('thresh-do-min').value);
  const phMin = parseFloat(document.getElementById('thresh-ph-min').value);
  const phMax = parseFloat(document.getElementById('thresh-ph-max').value);
  const tanMax = parseFloat(document.getElementById('thresh-tan-max').value);
  const no2Max = parseFloat(document.getElementById('thresh-no2-max').value);
  const fcrMax = parseFloat(document.getElementById('thresh-fcr-max').value);
  const vibrioMax = parseFloat(document.getElementById('thresh-vibrio-max').value);
  const planktonMax = parseFloat(document.getElementById('thresh-plankton-max').value);

  if ([suhuMin, suhuMax, doMin, phMin, phMax, tanMax, no2Max, fcrMax, vibrioMax, planktonMax].some(isNaN)) {
    alert("Pastikan semua ambang batas diisi dengan angka yang valid.");
    return;
  }

  // Mutate THRESHOLDS
  THRESHOLDS.suhu.min = suhuMin;
  THRESHOLDS.suhu.max = suhuMax;
  THRESHOLDS.do_pagi.min = doMin;
  THRESHOLDS.ph_pagi.min = phMin;
  THRESHOLDS.ph_sore.min = phMin;
  THRESHOLDS.ph_sore.max = phMax;
  THRESHOLDS.tan.max = tanMax;
  THRESHOLDS.no2.max = no2Max;
  THRESHOLDS.fcr.max = fcrMax;
  THRESHOLDS.rasio_vibrio.max = vibrioMax / 100;
  THRESHOLDS.plankton_neg.max = planktonMax;

  // Sync KPI_DEFS
  KPI_DEFS.forEach(def => {
    if (def.key === 'suhu_avg') { def.thresh.min = suhuMin; def.thresh.max = suhuMax; }
    else if (def.key === 'do_avg') { def.thresh.min = doMin; }
    else if (def.key === 'ph_avg') { def.thresh.min = phMin; def.thresh.max = phMax; }
    else if (def.key === 'tan') { def.thresh.max = tanMax; }
    else if (def.key === 'no2') { def.thresh.max = no2Max; }
    else if (def.key === 'fcr') { def.thresh.max = fcrMax; }
    else if (def.key === 'rasio_vibrio') { def.thresh.max = vibrioMax / 100; }
    else if (def.key === 'plankton_neg') { def.thresh.max = planktonMax; }
  });

  const docs = colDocs().map(d => parseInt(d)).filter(d => !isNaN(d));
  if (docs.length === 0) {
    alert("Pastikan kolom DOC terisi dengan angka.");
    return;
  }
  
  // Save to localStorage
  try {
    localStorage.setItem('ra_parsed_data', JSON.stringify(parsedData));
  } catch (e) {
    console.error("Gagal menyimpan data:", e);
  }
  
  // Call onDataLoaded to fully initialize and render dashboard
  onDataLoaded();
  
  const hasilBtn = document.getElementById('btn-tab-hasil');
  switchRiskTab('hasil-tab', hasilBtn);
  
  alert("Perubahan lembar kerja dan ambang batas berhasil diterapkan!");
};

// ── Export and Print Features ─────────────────────────────────
window.exportExcelData = function() {
  if (!parsedData.length) return;
  try {
    const ws = XLSX.utils.json_to_sheet(parsedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Monitoring");
    XLSX.writeFile(wb, `aqua_insight_risk_data_doc_${currentDoc}.xlsx`);
  } catch (err) {
    console.error("Gagal ekspor Excel:", err);
    alert("Gagal mengekspor data ke Excel.");
  }
};

window.printPdfReport = function() {
  window.print();
};

// Intersepsi Clipboard untuk Paste Langsung ke dalam Sel Tabel Spreadsheet (Mendukung Multi-Sel dan Delimiter Fleksibel)
document.addEventListener('paste', function(e) {
  if (e.target && e.target.classList.contains('spreadsheet-input')) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text) return;

    // Deteksi delimiter secara dinamis (Tab, Koma, atau Semicolon)
    const delim = text.includes('\t') ? '\t' : (text.includes(',') ? ',' : ';');
    const lines = text.split(/\r?\n/).map(line => line.split(delim));
    if (lines.length === 0 || (lines.length === 1 && lines[0].length === 1 && lines[0][0] === '')) return;

    const startRowIdx = parseInt(e.target.dataset.row);
    const startColKey = e.target.dataset.col;
    if (isNaN(startRowIdx) || !startColKey) return;

    const keys = Object.keys(parsedData[0]);
    const startColIdx = keys.indexOf(startColKey);
    if (startColIdx === -1) return;

    // Paste nilai ke dalam array parsedData, perluas baris baru jika melebihi panjang tabel
    lines.forEach((lineCells, rOffset) => {
      // Hiraukan baris kosong terakhir yang biasanya disalin dari Excel
      if (rOffset === lines.length - 1 && lineCells.length === 1 && lineCells[0] === '') return;

      const targetRowIdx = startRowIdx + rOffset;
      if (targetRowIdx >= parsedData.length) {
        // Buat baris baru dengan DOC yang berurutan
        const lastRow = parsedData[parsedData.length - 1] || {};
        const lastDoc = parseInt(lastRow.doc) || 0;
        const newRow = {};
        keys.forEach(k => {
          if (k === 'doc') {
            newRow[k] = (lastDoc + 1).toString();
          } else {
            newRow[k] = '';
          }
        });
        parsedData.push(newRow);
      }

      lineCells.forEach((cellVal, cOffset) => {
        const targetColIdx = startColIdx + cOffset;
        if (targetColIdx < keys.length) {
          const targetKey = keys[targetColIdx];
          // Bersihkan teks dari spasi berlebih dan tanda kutip ganda pembungkus
          parsedData[targetRowIdx][targetKey] = cellVal.trim().replace(/^"|"$/g, '');
        }
      });
    });

    renderSpreadsheet();
  }
});

// Navigasi Tombol Panah, Enter, dan Tab untuk Berpindah Sel di Spreadsheet
document.addEventListener('keydown', function(e) {
  if (e.target && e.target.classList.contains('spreadsheet-input')) {
    const rowIdx = parseInt(e.target.dataset.row);
    const colKey = e.target.dataset.col;
    if (isNaN(rowIdx)) return;

    const keys = Object.keys(parsedData[0]);
    const colIdx = keys.indexOf(colKey);

    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      const target = document.querySelector(`.spreadsheet-input[data-row="${rowIdx + 1}"][data-col="${colKey}"]`);
      if (target) {
        target.focus();
      } else if (e.key === 'Enter') {
        // Tambah baris baru jika di paling bawah
        addSpreadsheetRow();
        setTimeout(() => {
          const newTarget = document.querySelector(`.spreadsheet-input[data-row="${rowIdx + 1}"][data-col="${colKey}"]`);
          if (newTarget) newTarget.focus();
        }, 50);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIdx > 0) {
        const target = document.querySelector(`.spreadsheet-input[data-row="${rowIdx - 1}"][data-col="${colKey}"]`);
        if (target) target.focus();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const nextColKey = keys[colIdx + 1];
      if (nextColKey) {
        const target = document.querySelector(`.spreadsheet-input[data-row="${rowIdx}"][data-col="${nextColKey}"]`);
        if (target) target.focus();
      } else {
        // Bungkus ke baris berikutnya, kolom pertama
        const firstColKey = keys[0];
        const target = document.querySelector(`.spreadsheet-input[data-row="${rowIdx + 1}"][data-col="${firstColKey}"]`);
        if (target) {
          target.focus();
        } else {
          // Tambah baris baru jika di paling bawah dan paling kanan
          addSpreadsheetRow();
          setTimeout(() => {
            const newTarget = document.querySelector(`.spreadsheet-input[data-row="${rowIdx + 1}"][data-col="${firstColKey}"]`);
            if (newTarget) newTarget.focus();
          }, 50);
        }
      }
    }
  }
});

// Registrasi Dinamis untuk Parameter Kustom
function registerCustomParameter(canonical, label, min, max, unit, dec) {
  THRESHOLDS[canonical] = { min, max, unit, label };

  if (!KPI_DEFS.some(def => def.key === canonical)) {
    KPI_DEFS.push({
      key: canonical,
      label: label,
      unit: unit,
      dec: dec,
      thresh: { min, max }
    });
  }

  if (!TREND_OPTIONS.some(opt => opt.key === canonical)) {
    TREND_OPTIONS.push({
      key: canonical,
      label: label,
      color: '#' + Math.floor(Math.random()*16777215).toString(16)
    });
  }
}

// Inisialisasi Tabel Kualitas Air Kosong Default
function initDefaultTable() {
  const defaultKeys = [
    'doc', 'suhu', 'do_pagi', 'do_sore', 'ph_pagi', 'ph_sore', 'tan', 'no2', 'salinitas', 'alkalinitas',
    'turbidity', 'tss', 'rasio_vibrio', 'plankton_neg', 'fcr', 'mbw', 'populasi', 'biomassa', 'pakan'
  ];
  parsedData = [];
  for (let i = 1; i <= 5; i++) {
    const row = {};
    defaultKeys.forEach(k => {
      row[k] = k === 'doc' ? i.toString() : '';
    });
    parsedData.push(row);
  }
  headers = defaultKeys.map(k => k.toUpperCase());
}

// Startup Initialization Sequence
(function() {
  // 1. Muat parameter kustom yang tersimpan di LocalStorage
  let customParams = [];
  try {
    customParams = JSON.parse(localStorage.getItem('ra_custom_params')) || [];
  } catch (e) {
    customParams = [];
  }
  customParams.forEach(p => {
    registerCustomParameter(p.canonical, p.label, p.min, p.max, p.unit, p.dec);
  });

  // 2. Muat data tabel dari LocalStorage atau jalankan default
  let loadedData = null;
  try {
    const saved = localStorage.getItem('ra_parsed_data');
    if (saved) {
      loadedData = JSON.parse(saved);
    }
  } catch (e) {
    console.error("Gagal memuat data sebelumnya dari LocalStorage:", e);
  }

  if (Array.isArray(loadedData) && loadedData.length > 0) {
    parsedData = loadedData;
    // Pastikan jika ada parameter kustom baru ditambahkan, ia terdaftar di baris lama
    customParams.forEach(p => {
      parsedData.forEach(row => {
        if (!row.hasOwnProperty(p.canonical)) {
          row[p.canonical] = '';
        }
      });
    });
  } else {
    initDefaultTable();
  }

  // 3. Render lembar kerja awal dan dashboard berdasarkan ketersediaan data riil
  if (hasRealData()) {
    onDataLoaded();
  } else {
    // Sembunyikan status bar dan slider panel
    document.getElementById('ra-status-bar').style.display = 'none';
    const docSliderPanel = document.getElementById('doc-slider-panel');
    if (docSliderPanel) docSliderPanel.style.display = 'none';
    
    // Disable run button and export/print buttons since there is no data analyzed yet
    document.getElementById('run-btn').disabled = true;
    document.getElementById('export-excel-btn').disabled = true;
    document.getElementById('print-pdf-btn').disabled = true;
  }

  // 4. Secara default, buka Editor Tab agar pengguna dapat melihat tabel input langsung
  setTimeout(() => {
    const inputBtn = document.getElementById('btn-tab-input');
    if (inputBtn) {
      switchRiskTab('input-tab', inputBtn);
    }
  }, 100);
})();
