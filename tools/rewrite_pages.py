import os

pages_dir = os.path.join(os.path.dirname(__file__), 'pages')

# ====================================================
# NEW CLEAN VERSIONS OF ALL MODULE PAGES
# ====================================================

pages = {}

# -----------------------------------------------------------------------
# 1. particle-counter.html
# -----------------------------------------------------------------------
pages['particle-counter.html'] = r"""<!DOCTYPE html>
<html lang="id" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Particle Analyzer - Aqua Insight</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="../css/style.css">
  <link rel="stylesheet" href="../css/particle-counter.css">
</head>
<body class="subpage">
  <div id="app-layout">
    <div id="sidebar-container"></div>
    <main id="main-content">
      <div id="header-container" data-page-title="Particle Analyzer" data-page-category="Imaging &amp; Vision"></div>

      <div class="workspace-grid">

        <!-- Left Panel -->
        <section class="glass-panel workspace-control">
          <h3 class="panel-section-title"><i class="fa-solid fa-camera-retro"></i> <span data-i18n="pc_input_image">Input Citra</span></h3>

          <div class="tab-container" style="margin-bottom: 1rem;">
            <button class="tab-btn active" onclick="switchInputTab('tab-upload', this)" data-i18n="pc_tab_file">File</button>
            <button class="tab-btn" onclick="switchInputTab('tab-camera', this)" data-i18n="pc_tab_camera">Kamera Lab</button>
          </div>

          <div id="tab-upload" class="tab-pane active">
            <div class="dropzone" id="image-dropzone">
              <i class="fa-solid fa-cloud-arrow-up dropzone-icon"></i>
              <p class="dropzone-text" data-i18n="pc_dropzone">Seret gambar ke sini atau klik untuk unggah</p>
              <input type="file" id="image-upload-input" accept="image/*" style="display: none;">
            </div>
          </div>

          <div id="tab-camera" class="tab-pane">
            <div class="camera-viewport-container">
              <video id="camera-stream" autoplay playsinline muted></video>
              <div id="camera-placeholder" class="camera-placeholder">
                <i class="fa-solid fa-video-slash" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                <p style="font-size: 0.8rem; text-align: center;" data-i18n="pc_cam_inactive">Kamera belum diaktifkan</p>
              </div>
            </div>
            <div class="form-row" style="margin-top: 0.5rem; gap: 0.5rem;">
              <button class="header-btn" style="flex: 1;" onclick="startCamera()"><i class="fa-solid fa-video"></i> <span data-i18n="pc_btn_activate">Aktifkan</span></button>
              <button class="header-btn" style="flex: 1;" onclick="captureSnapshot()"><i class="fa-solid fa-camera"></i> <span data-i18n="pc_btn_snapshot">Snapshot</span></button>
            </div>
          </div>

          <div class="form-row" style="margin-bottom: 1rem;">
            <div class="form-group" style="flex: 1;">
              <label for="detection-method" data-i18n="pc_method">Metode Pendeteksian</label>
              <select id="detection-method" class="custom-select" onchange="updateDetectionMethod(this.value)">
                <option value="binary" data-i18n="pc_method_binary">Threshold Biner (Standar)</option>
                <option value="color_region" data-i18n="pc_method_color">Kemiripan Warna (Super Detail)</option>
              </select>
            </div>
          </div>

          <div id="binary-settings-group">
            <h3 class="panel-section-title"><i class="fa-solid fa-layer-group"></i> <span data-i18n="pc_channel">Pemilihan Kanal Warna (Channel)</span></h3>
            <div class="channel-selector" style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
              <button class="channel-btn active" style="flex: 1; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-hover); cursor: pointer;" data-channel="gray" onclick="setChannel('gray', this)" data-i18n="pc_ch_gray">Grayscale</button>
              <button class="channel-btn" style="flex: 1; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); background: none; cursor: pointer; color: #ef4444;" data-channel="red" onclick="setChannel('red', this)" data-i18n="pc_ch_red">Merah</button>
              <button class="channel-btn" style="flex: 1; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); background: none; cursor: pointer; color: #22c55e;" data-channel="green" onclick="setChannel('green', this)" data-i18n="pc_ch_green">Hijau</button>
              <button class="channel-btn" style="flex: 1; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); background: none; cursor: pointer; color: #3b82f6;" data-channel="blue" onclick="setChannel('blue', this)" data-i18n="pc_ch_blue">Biru</button>
            </div>
            <hr class="panel-divider">
            <h3 class="panel-section-title"><i class="fa-solid fa-sliders"></i> <span data-i18n="pc_param_seg">Parameter Segmentasi (Grayscale)</span></h3>

            <div class="switch-control">
              <label for="toggle-auto-threshold" data-i18n="pc_auto_thresh">Ambang Batas Otomatis (Otsu)</label>
              <button id="toggle-auto-threshold" class="toggle-switch-btn active" onclick="toggleAutoThreshold()"></button>
            </div>

            <div class="form-row" id="manual-thresh-group" style="display: none; margin-top: 1rem;">
              <div class="form-group" style="flex: 1;">
                <div style="display: flex; justify-content: space-between;">
                  <label for="manual-threshold" data-i18n="pc_manual_thresh">Ambang Batas (Threshold)</label>
                  <span id="manual-threshold-val" style="font-size: 0.8rem; font-weight: 700; color: var(--text-accent);">128</span>
                </div>
                <input type="range" id="manual-threshold" class="custom-slider" min="0" max="255" value="128" oninput="updateManualThreshold(this.value)">
              </div>
            </div>

            <div class="form-row" style="margin-top: 1rem;">
              <div class="form-group" style="flex: 1;">
                <div style="display: flex; justify-content: space-between;">
                  <label for="erosion-slider" data-i18n="pc_erosion">Iterasi Erosi (Pisahkan Objek Menyatu)</label>
                  <span id="erosion-val" style="font-size: 0.8rem; font-weight: 700; color: var(--text-accent);">0</span>
                </div>
                <input type="range" id="erosion-slider" class="custom-slider" min="0" max="5" value="0" oninput="updateErosion(this.value)">
                <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0;" data-i18n="pc_erosion_tip">Gunakan fitur ini untuk memisahkan partikel yang saling berdempetan.</p>
              </div>
            </div>
          </div>

          <div id="color-settings-group" style="display: none;">
            <hr class="panel-divider">
            <h3 class="panel-section-title"><i class="fa-solid fa-palette"></i> <span data-i18n="pc_color_tol">Toleransi Warna</span></h3>
            <div class="form-row" style="margin-top: 1rem;">
              <div class="form-group" style="flex: 1;">
                <div style="display: flex; justify-content: space-between;">
                  <label for="color-region-tolerance" data-i18n="pc_color_tol_label">Toleransi Perbedaan Warna</label>
                  <span id="color-region-val" style="font-size: 0.8rem; font-weight: 700; color: var(--text-accent);">20</span>
                </div>
                <input type="range" id="color-region-tolerance" class="custom-slider" min="1" max="100" value="20" oninput="updateColorRegionTolerance(this.value)">
                <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0;" data-i18n="pc_color_tol_tip">Semakin kecil nilai ini, semakin sensitif sistem membedakan setiap gradasi warna.</p>
              </div>
            </div>
          </div>

          <div class="switch-control">
            <label for="toggle-bg-correction" data-i18n="pc_bg_corr">Koreksi Latar Belakang Terang</label>
            <button id="toggle-bg-correction" class="toggle-switch-btn active" onclick="toggleBackgroundCorrection()"></button>
          </div>
          <div class="switch-control">
            <label for="toggle-edge-exclusion" data-i18n="pc_edge_exc">Eksklusi Partikel Menyentuh Tepi</label>
            <button id="toggle-edge-exclusion" class="toggle-switch-btn" onclick="toggleEdgeExclusion()"></button>
          </div>
          <div class="switch-control">
            <label for="toggle-fill-holes" data-i18n="pc_fill_holes">Isi Rongga Sel (Fill Holes)</label>
            <button id="toggle-fill-holes" class="toggle-switch-btn" onclick="toggleFillHoles()"></button>
          </div>

          <hr class="panel-divider">
          <h3 class="panel-section-title"><i class="fa-solid fa-filter"></i> <span data-i18n="pc_morph_filter">Penyaringan Morfometrik</span></h3>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between;">
              <label data-i18n="pc_min_size">Ukuran Partikel Minimum (pixel)</label>
              <span id="min-size-val" style="font-size: 0.8rem; font-weight: 700; color: var(--text-accent);">10 px</span>
            </div>
            <input type="range" id="min-size-slider" class="custom-slider" min="1" max="500" value="10" oninput="updateMinSizeFilter(this.value)">
          </div>
          <div class="form-group">
            <div style="display: flex; justify-content: space-between;">
              <label data-i18n="pc_max_size">Ukuran Partikel Maksimum (pixel)</label>
              <span id="max-size-val" style="font-size: 0.8rem; font-weight: 700; color: var(--text-accent);" data-i18n="pc_unlimited">Tanpa Batas</span>
            </div>
            <input type="range" id="max-size-slider" class="custom-slider" min="100" max="500000" value="500000" oninput="updateMaxSizeFilter(this.value)">
          </div>
          <div class="form-group">
            <div style="display: flex; justify-content: space-between;">
              <label data-i18n="pc_min_circ">Sirkularitas Minimum (0.0 - 1.0)</label>
              <span id="min-circ-val" style="font-size: 0.8rem; font-weight: 700; color: var(--text-accent);">0.00</span>
            </div>
            <input type="range" id="min-circ-slider" class="custom-slider" min="0" max="100" value="0" oninput="updateMinCircFilter(this.value)">
          </div>

          <hr class="panel-divider">
          <h3 class="panel-section-title"><i class="fa-solid fa-ruler-combined"></i> <span data-i18n="pc_scale_calib">Kalibrasi Skala Riil</span></h3>
          <div class="form-row">
            <div class="form-group" style="flex: 2;">
              <label for="scale-pixel" data-i18n="pc_pixel">Piksel</label>
              <input type="number" id="scale-pixel" class="form-control" value="100" onchange="updateScaleCalibration()">
            </div>
            <div class="form-group" style="flex: 2;">
              <label for="scale-unit-value" data-i18n="pc_real_val">Nilai Riil</label>
              <input type="number" id="scale-unit-value" class="form-control" value="100" onchange="updateScaleCalibration()">
            </div>
            <div class="form-group" style="flex: 2;">
              <label for="scale-unit" data-i18n="pc_unit">Unit</label>
              <select id="scale-unit" class="form-control" onchange="updateScaleCalibration()">
                <option value="px">px</option>
                <option value="µm">µm</option>
                <option value="mm">mm</option>
              </select>
            </div>
          </div>
          <p class="calibration-tip" id="calibration-summary" data-i18n="pc_ratio">Rasio: 1 px = 1.00 px</p>
        </section>

        <!-- Center Panel -->
        <section class="glass-panel workspace-view">
          <div class="viewport-header">
            <h3 class="viewport-title"><i class="fa-solid fa-object-group"></i> <span data-i18n="pc_canvas_title">Layar Pemantau Kanvas</span></h3>
            <div class="viewport-controls">
              <button class="header-btn compact-btn" onclick="resetZoom()"><i class="fa-solid fa-arrows-to-eye"></i> <span data-i18n="btn_fit">Fit</span></button>
              <button class="header-btn compact-btn" onclick="toggleOverlayOption('numbers')" id="btn-overlay-numbers"><i class="fa-solid fa-list-ol"></i></button>
              <button class="header-btn compact-btn" onclick="toggleOverlayOption('contours')" id="btn-overlay-contours"><i class="fa-solid fa-bezier-curve"></i></button>
              <button class="header-btn compact-btn" onclick="toggleOverlayOption('centroids')" id="btn-overlay-centroids"><i class="fa-solid fa-crosshairs"></i></button>
            </div>
          </div>
          <div class="canvas-viewport" id="viewport-canvas-wrapper" style="overflow: hidden; position: relative;">
            <canvas id="analysis-canvas" style="width: 100%; height: 100%; object-fit: contain;"></canvas>
            <div id="canvas-loading-spinner" class="canvas-loader" style="display: none;">
              <i class="fa-solid fa-spinner fa-spin" style="font-size: 2.5rem; color: var(--text-accent); margin-bottom: 0.5rem;"></i>
              <p style="font-size: 0.9rem;" data-i18n="txt_processing">Memproses gambar...</p>
            </div>
            <div class="canvas-hud">
              <span id="hud-zoom">Zoom: 100%</span>
              <span id="hud-status" data-i18n="txt_no_image">Tidak ada gambar</span>
            </div>
          </div>
        </section>

        <!-- Right Panel -->
        <section class="glass-panel workspace-summary">
          <h3 class="panel-section-title"><i class="fa-solid fa-square-poll-vertical"></i> <span data-i18n="pc_summary_title">Ringkasan Hasil</span></h3>
          <div class="summary-metric-card">
            <div class="metric-label" data-i18n="pc_sum_count">Jumlah Partikel Terdeteksi</div>
            <div class="metric-value" id="summary-count">0</div>
          </div>
          <div class="summary-grid">
            <div class="summary-mini-card">
              <div class="mini-label" data-i18n="pc_sum_cov">Area Coverage (%)</div>
              <div class="mini-value" id="summary-coverage">0.00 %</div>
            </div>
            <div class="summary-mini-card">
              <div class="mini-label" id="summary-size-label" data-i18n="pc_sum_avg">Rata-rata Ukuran</div>
              <div class="mini-value" id="summary-avg-size">0 px²</div>
            </div>
          </div>
          <hr class="panel-divider">
          <h3 class="panel-section-title"><i class="fa-solid fa-chart-area"></i> <span data-i18n="pc_size_dist">Distribusi Ukuran</span></h3>
          <div class="chart-container" style="position: relative; height: 180px;">
            <canvas id="particle-dist-chart"></canvas>
          </div>
          <div class="ai-hook-box">
            <div class="ai-hook-header">
              <span class="ai-hook-title"><i class="fa-solid fa-robot"></i> AI Deep Learning</span>
              <button class="toggle-switch-btn" id="btn-ai-mode" onclick="toggleAIMode()"></button>
            </div>
            <p class="ai-hook-desc">Activate AI segmentation model to identify larvae or plankton at species level directly in-browser (Future).</p>
          </div>
        </section>
      </div>

      <!-- Results Table -->
      <section class="glass-panel table-section" style="margin-top: 1.5rem;">
        <div class="table-header">
          <h3 class="viewport-title"><i class="fa-solid fa-table-list"></i> <span data-i18n="pc_table_title">Lembar Data Morfometri Partikel</span></h3>
          <div class="table-actions">
            <div class="sidebar-search" style="margin-bottom: 0; width: 220px;">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input type="text" id="table-search" data-i18n-placeholder="pc_search_idx" placeholder="Cari indeks partikel..." oninput="filterTable(this.value)">
            </div>
            <button class="header-btn" onclick="exportParticlePNG()"><i class="fa-solid fa-image"></i> <span data-i18n="btn_export_png">Ekspor PNG</span></button>
            <button class="header-btn" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #fff; border-color: transparent;" onclick="exportParticleExcel()"><i class="fa-solid fa-file-excel"></i> <span data-i18n="btn_export_excel">Ekspor Excel</span></button>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table" id="particle-table">
            <thead>
              <tr>
                <th onclick="sortTable(0)" data-i18n="pc_th_idx">Indeks <i class="fa-solid fa-sort"></i></th>
                <th onclick="sortTable(1)" data-i18n="pc_th_center">Titik Pusat (X, Y) <i class="fa-solid fa-sort"></i></th>
                <th onclick="sortTable(2)" id="th-area" data-i18n="pc_th_area">Luas (px²) <i class="fa-solid fa-sort"></i></th>
                <th onclick="sortTable(3)" id="th-perimeter" data-i18n="pc_th_perimeter">Keliling (px) <i class="fa-solid fa-sort"></i></th>
                <th onclick="sortTable(4)" data-i18n="pc_th_circ">Sirkularitas <i class="fa-solid fa-sort"></i></th>
                <th onclick="sortTable(5)" data-i18n="pc_th_aspect">Aspect Ratio <i class="fa-solid fa-sort"></i></th>
                <th onclick="sortTable(6)" data-i18n="pc_th_solidity">Solidity <i class="fa-solid fa-sort"></i></th>
                <th onclick="sortTable(7)" data-i18n="pc_th_glcm">Kontras GLCM <i class="fa-solid fa-sort"></i></th>
                <th onclick="sortTable(8)" data-i18n="pc_th_rgb">Profil Warna RGB <i class="fa-solid fa-sort"></i></th>
                <th onclick="sortTable(9)" data-i18n="pc_th_edge">Tepi <i class="fa-solid fa-sort"></i></th>
              </tr>
            </thead>
            <tbody id="particle-table-body">
              <tr><td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 2rem;" data-i18n="pc_empty_table">Silakan unggah citra untuk memulai analisis.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <footer class="app-footer">
        <div data-i18n="txt_footer_copy">© 2026 Technology Division, PT Central Proteina Prima Tbk. Hak Cipta Dilindungi.</div>
        <div class="footer-links">
          <a href="contact.html" data-i18n="sb_support">Bantuan</a>
          <a href="#" data-i18n="txt_privacy">Privasi</a>
          <a href="#" data-i18n="txt_terms">Syarat &amp; Ketentuan</a>
        </div>
      </footer>
    </main>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <script src="../js/core/cv-engine.js"></script>
  <script src="../js/core/i18n.js"></script>
  <script src="../js/core/modules.js"></script>
  <script src="../js/main.js"></script>
  <script src="../js/core/math-utils.js"></script>
  <script src="../js/core/file-utils.js"></script>
  <script src="../js/core/chart-utils.js"></script>
  <script src="../js/particle/zoom-pan.js"></script>
  <script src="../js/particle/detection.js"></script>
  <script src="../js/particle/export.js"></script>
  <script src="../js/particle/particle-analysis.js"></script>
</body>
</html>"""

# -----------------------------------------------------------------------
# 2. gene-expression.html
# -----------------------------------------------------------------------
pages['gene-expression.html'] = r"""<!DOCTYPE html>
<html lang="id" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gene Expression (qPCR) Analyzer - Aqua Insight</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="../css/style.css">
  <link rel="stylesheet" href="../css/gene-expression.css">
</head>
<body class="subpage">
  <div id="app-layout">
    <div id="sidebar-container"></div>
    <main id="main-content">
      <div id="header-container" data-page-title="Gene Expression (qPCR)" data-page-category="Biological Diagnostics"></div>
      <div class="workspace-grid">

        <!-- Left Panel: Parameters -->
        <section class="glass-panel workspace-control">
          <h3 class="panel-section-title"><i class="fa-solid fa-sliders"></i> <span data-i18n="ge_params">Parameter Analisis</span></h3>
          <div class="form-group">
            <label for="method-select" data-i18n="ge_method">Metode Kalkulasi</label>
            <select id="method-select" class="form-control" onchange="toggleEfficiencyInputs()">
              <option value="livak" data-i18n="ge_livak">2^-ΔΔCt (Livak &amp; Schmittgen, 2001)</option>
              <option value="pfaffl" data-i18n="ge_pfaffl">Koreksi Efisiensi (Pfaffl, 2001)</option>
            </select>
          </div>
          <div id="efficiency-params" style="display: none;">
            <hr class="panel-divider">
            <h4 style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;" data-i18n="ge_efficiency">Efisiensi Primer (E)</h4>
            <div class="form-group">
              <label for="e-target" data-i18n="ge_target_gene">Target Gene (Contoh: VP28)</label>
              <input type="number" id="e-target" class="form-control" value="2.0" step="0.01" min="1.0" max="2.0">
            </div>
            <div class="form-group">
              <label for="e-ref" data-i18n="ge_ref_gene">Reference Gene (Contoh: β-actin)</label>
              <input type="number" id="e-ref" class="form-control" value="2.0" step="0.01" min="1.0" max="2.0">
            </div>
            <p style="font-size: 0.75rem; color: var(--text-secondary);" data-i18n="ge_eff_note">Catatan: Nilai E = 10^(−1/slope). E=2.0 berarti efisiensi 100%.</p>
          </div>
          <hr class="panel-divider">
          <button class="header-btn" style="width: 100%; justify-content: center; background: linear-gradient(135deg, var(--text-accent) 0%, #4FACFE 100%); color: #070e1b; border-color: transparent;" onclick="calculateExpression()">
            <i class="fa-solid fa-calculator"></i> <span data-i18n="ge_calc_btn">Kalkulasi Fold Change</span>
          </button>
        </section>

        <!-- Right Panel: Data Grid & Results -->
        <section class="results-area">
          <div class="glass-panel" style="height: 100%; display: flex; flex-direction: column;">
            <div class="tab-container">
              <button class="tab-btn active" onclick="switchTab('input-tab', this)" data-i18n="ge_tab_input">1. Input Data Ct</button>
              <button class="tab-btn" onclick="switchTab('result-tab', this)" data-i18n="ge_tab_result">2. Hasil &amp; Visualisasi</button>
            </div>
            <div id="input-tab" class="tab-pane active" style="flex-grow: 1; display: flex; flex-direction: column;">
              <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                <button class="header-btn compact-btn" onclick="addSampleRow()"><i class="fa-solid fa-plus"></i> <span data-i18n="ge_add_sample">Tambah Sampel</span></button>
                <button class="header-btn compact-btn" onclick="addTargetGene()"><i class="fa-solid fa-dna"></i> <span data-i18n="ge_add_gene">Tambah Target Gene</span></button>
                <button class="header-btn compact-btn" onclick="addReplication()"><i class="fa-solid fa-copy"></i> <span data-i18n="ge_add_rep">Tambah Replikasi Ct</span></button>
              </div>
              <div style="overflow-x: auto; flex-grow: 1;" id="table-container"></div>
            </div>
            <div id="result-tab" class="tab-pane" style="flex-grow: 1; overflow-y: auto;">
              <div id="no-result-state" class="empty-state">
                <i class="fa-solid fa-chart-column"></i>
                <p data-i18n="ge_empty_result">Belum ada hasil kalkulasi. Silakan klik tombol 'Kalkulasi Fold Change'.</p>
              </div>
              <div id="result-content" style="display: none;">
                <div class="chart-container" style="height: 350px; margin-bottom: 2rem;">
                  <canvas id="fc-chart"></canvas>
                </div>
                <h4 style="margin-bottom: 1rem; color: var(--text-accent);" data-i18n="ge_result_title">Tabel Hasil Ekspresi Gen (Relative Quantification)</h4>
                <div style="overflow-x: auto;">
                  <table class="qpcr-table" id="result-table">
                    <thead>
                      <tr>
                        <th data-i18n="ge_th_sample">Sampel</th>
                        <th data-i18n="ge_th_ct_target">Mean Ct Target</th>
                        <th data-i18n="ge_th_ct_ref">Mean Ct Ref</th>
                        <th>ΔCt</th>
                        <th>ΔΔCt</th>
                        <th>Fold Change</th>
                        <th data-i18n="ge_th_interp">Interpretasi</th>
                      </tr>
                    </thead>
                    <tbody id="result-tbody"></tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer class="app-footer">
        <div data-i18n="txt_footer_copy">© 2026 Technology Division, PT Central Proteina Prima Tbk. Hak Cipta Dilindungi.</div>
      </footer>
    </main>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="../js/core/i18n.js"></script>
  <script src="../js/core/modules.js"></script>
  <script src="../js/main.js"></script>
  <script src="../js/gene/gene-expression.js"></script>
</body>
</html>"""

# -----------------------------------------------------------------------
# 3. electrophoresis.html
# -----------------------------------------------------------------------
pages['electrophoresis.html'] = r"""<!DOCTYPE html>
<html lang="id" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Electrophoresis Gel Analyzer - Aqua Insight</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="../css/style.css">
  <link rel="stylesheet" href="../css/electrophoresis.css">
</head>
<body class="subpage">
  <div id="app-layout">
    <div id="sidebar-container"></div>
    <main id="main-content">
      <div id="header-container" data-page-title="Electrophoresis Gel Analyzer" data-page-category="Imaging &amp; Vision"></div>
      <div class="workspace-grid" style="grid-template-columns: 250px 1fr 300px;">

        <!-- Left Panel: Controls -->
        <section class="glass-panel workspace-control">
          <h3 class="panel-section-title"><i class="fa-solid fa-sliders"></i> <span data-i18n="elec_settings">Pengaturan Gel</span></h3>
          <div class="form-group">
            <label for="ladder-type" data-i18n="elec_ladder">Standar DNA Marker</label>
            <select id="ladder-type" class="form-control" onchange="changeLadder()">
              <option value="100bp">100 bp Ladder</option>
              <option value="1kb">1 kb Ladder</option>
            </select>
          </div>
          <div class="form-group">
            <label for="lane-count" data-i18n="elec_lanes">Jumlah Sumur (Lanes)</label>
            <input type="number" id="lane-count" class="form-control" value="6" min="3" max="15" onchange="initGel()">
          </div>
          <hr class="panel-divider">
          <h3 class="panel-section-title"><i class="fa-solid fa-image"></i> <span data-i18n="elec_real_gel">Gambar Gel Sungguhan</span></h3>
          <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem;" data-i18n="elec_upload_hint">Unggah foto gel untuk dianalisis di atas kanvas.</p>
          <input type="file" id="gel-image-upload" style="display: none;" accept="image/*" onchange="handleGelImageUpload(event)">
          <button class="header-btn compact-btn" style="width: 100%; justify-content: center; margin-bottom: 5px; border-color: var(--text-accent); color: var(--text-accent);" onclick="document.getElementById('gel-image-upload').click()">
            <i class="fa-solid fa-upload"></i> <span data-i18n="elec_upload_btn">Unggah Foto Gel</span>
          </button>
          <hr class="panel-divider">
          <h3 class="panel-section-title"><i class="fa-solid fa-pen-nib"></i> <span data-i18n="elec_interact_mode">Mode Interaksi</span></h3>
          <div class="form-group">
            <div class="switch-control" style="margin-bottom: 0;">
              <label data-i18n="elec_add_band">Mode Tambah Pita</label>
              <button id="toggle-add-mode" class="toggle-switch-btn active" onclick="toggleAddMode(this)"></button>
            </div>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem;" data-i18n="elec_click_hint">Klik di area lajur sampel pada canvas untuk menambahkan pita (band) dan mengestimasi ukuran secara instan.</p>
          </div>
          <button class="header-btn compact-btn" style="width: 100%; justify-content: center; border-color: #F59E0B; color: #F59E0B; margin-bottom: 5px;" onclick="resetLadder()">
            <i class="fa-solid fa-rotate-left"></i> <span data-i18n="elec_reset_ladder">Reset Posisi Ladder</span>
          </button>
          <button class="header-btn" style="width: 100%; justify-content: center;" onclick="clearSamples()">
            <i class="fa-solid fa-trash-can"></i> <span data-i18n="elec_clear">Bersihkan Sampel</span>
          </button>
        </section>

        <!-- Center Panel: Gel Canvas -->
        <section class="canvas-area" style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 1rem;">
          <div class="gel-container" style="position: relative; background: #111; padding: 20px; border-radius: 12px; border: 2px solid #333;">
            <canvas id="gel-canvas" width="600" height="400" style="cursor: crosshair; background: #0a0a0a; border-radius: 4px; box-shadow: inset 0 0 20px rgba(0,0,0,0.8);"></canvas>
            <div style="position: absolute; left: 5px; top: 20px; bottom: 20px; width: 10px; border-right: 1px solid #555; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; padding-right: 2px; font-size: 10px; color: #888;">
              <span>0.0</span><span>0.2</span><span>0.4</span><span>0.6</span><span>0.8</span><span>1.0</span>
            </div>
          </div>
          <div class="glass-panel" style="width: 100%; height: 250px; padding: 1rem;">
            <canvas id="calibration-chart"></canvas>
          </div>
        </section>

        <!-- Right Panel: Results Table -->
        <section class="glass-panel workspace-control">
          <h3 class="panel-section-title"><i class="fa-solid fa-table"></i> <span data-i18n="elec_result_title">Hasil Estimasi bp</span></h3>
          <div style="flex-grow: 1; overflow-y: auto;">
            <table class="band-table" id="results-table">
              <thead>
                <tr>
                  <th data-i18n="elec_th_lane">Lajur</th>
                  <th>Rf</th>
                  <th data-i18n="elec_th_est">Estimasi</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="results-tbody"></tbody>
            </table>
            <div id="no-bands-state" class="empty-state" style="padding: 2rem 0;">
              <i class="fa-solid fa-mouse-pointer"></i>
              <p data-i18n="elec_empty">Klik pada canvas gel untuk menambahkan pita sampel.</p>
            </div>
          </div>
        </section>
      </div>

      <footer class="app-footer">
        <div data-i18n="txt_footer_copy">© 2026 Technology Division, PT Central Proteina Prima Tbk. Hak Cipta Dilindungi.</div>
      </footer>
    </main>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="../js/core/i18n.js"></script>
  <script src="../js/core/modules.js"></script>
  <script src="../js/main.js"></script>
  <script src="../js/core/math-utils.js"></script>
  <script src="../js/electrophoresis/electrophoresis.js"></script>
</body>
</html>"""

# -----------------------------------------------------------------------
# 4. colony-counter.html
# -----------------------------------------------------------------------
pages['colony-counter.html'] = r"""<!DOCTYPE html>
<html lang="id" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Microbiology Colony Counter - Aqua Insight</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="../css/style.css">
  <link rel="stylesheet" href="../css/colony-counter.css">
</head>
<body class="subpage">
  <div id="app-layout">
    <div id="sidebar-container"></div>
    <main id="main-content">
      <div id="header-container" data-page-title="Microbiology Colony Counter" data-page-category="Imaging &amp; Vision"></div>
      <div class="workspace-grid">

        <!-- Left Panel -->
        <section class="glass-panel workspace-control">
          <h3 class="panel-section-title"><i class="fa-solid fa-camera"></i> <span data-i18n="cc_petri_image">Citra Cawan Petri</span></h3>
          <div class="form-group" style="text-align: center; margin-bottom: 1rem;">
            <div id="image-dropzone" style="border: 2px dashed rgba(0, 242, 254, 0.5); padding: 1rem; border-radius: 8px; cursor: pointer; transition: all 0.3s; margin-bottom: 10px;" onclick="document.getElementById('image-upload-input').click()">
              <i class="fa-solid fa-cloud-arrow-up" style="font-size: 2rem; color: var(--text-accent); margin-bottom: 0.5rem;"></i>
              <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;" data-i18n="cc_click_upload">Klik untuk unggah foto cawan</p>
            </div>
            <input type="file" id="image-upload-input" style="display: none;" accept="image/*" onchange="handleImageUpload(event)">
            <button class="header-btn compact-btn" style="width: 100%; justify-content: center; margin-bottom: 5px;" onclick="startCamera()">
              <i class="fa-solid fa-camera"></i> <span data-i18n="cc_use_camera">Gunakan Kamera Ponsel</span>
            </button>
            <video id="camera-stream" style="width: 100%; display: none; border-radius: 8px; margin-bottom: 5px;" autoplay playsinline></video>
            <button id="snap-btn" class="header-btn compact-btn" style="width: 100%; justify-content: center; background: #10B981; color: white; border: none; display: none;" onclick="captureSnapshot()">
              <i class="fa-solid fa-camera-retro"></i> <span data-i18n="cc_take_photo">Ambil Foto</span>
            </button>
          </div>

          <div class="form-group">
            <label for="media-type" data-i18n="cc_media_type">Jenis Media Agar</label>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <select id="media-type" class="form-control" style="flex: 1;" onchange="updateMediaMode()">
                <option value="tcbs" data-i18n="cc_tcbs">TCBS (Vibrio spesifik)</option>
                <option value="tsa" data-i18n="cc_tsa">TSA / NA (Total Plate Count)</option>
                <option value="custom" data-i18n="cc_custom">Kustom (Pilih Warna Target)</option>
              </select>
              <button id="btn-colony-eyedropper" class="header-btn compact-btn" onclick="toggleColonyEyedropper()" style="display: none;"><i class="fa-solid fa-eye-dropper"></i></button>
            </div>
          </div>

          <div class="form-group" id="custom-color-group" style="display: none;">
            <label data-i18n="cc_target_color">Warna Target (Auto/Klik Kanvas)</label>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div id="target-color-preview" style="width: 30px; height: 30px; border-radius: 50%; background: #ffffff; border: 1px solid var(--border-color);"></div>
              <span id="target-color-text" style="font-size: 0.8rem; color: var(--text-accent);">RGB(255,255,255)</span>
            </div>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 5px;" data-i18n="cc_eyedropper_hint">*Klik pada bagian paling intens dari koloni samar agar sistem menyesuaikan deteksinya.</p>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="dilution-factor" data-i18n="cc_dilution">Faktor Pengenceran</label>
              <select id="dilution-factor" class="form-control">
                <option value="1">10^0</option><option value="10">10^1 (1:10)</option>
                <option value="100">10^2 (1:100)</option><option value="1000">10^3 (1:1,000)</option>
                <option value="10000">10^4 (1:10,000)</option><option value="100000">10^5 (1:100,000)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="plating-vol" data-i18n="cc_plating_vol">Volume Tanam (mL)</label>
              <input type="number" id="plating-vol" class="form-control" value="0.1" step="0.01">
            </div>
          </div>

          <button class="header-btn" style="width: 100%; justify-content: center; background: linear-gradient(135deg, var(--text-accent) 0%, #4FACFE 100%); color: #070e1b; border-color: transparent; margin-top: 1rem;" onclick="analyzeColonies()">
            <i class="fa-solid fa-brain"></i> <span data-i18n="cc_analyze_btn">Hitung Koloni Otomatis</span>
          </button>
        </section>

        <!-- Center/Right Panel -->
        <section class="results-area" style="display: flex; flex-direction: column; gap: 1rem;">
          <div class="canvas-container" style="background: #000; border-radius: 12px; border: 1px solid var(--border-color); overflow: hidden; display: flex; justify-content: center; align-items: center; min-height: 400px; padding: 10px;">
            <canvas id="colony-canvas" width="600" height="400" style="max-width: 100%; height: auto; border-radius: 8px;"></canvas>
          </div>
          <div class="glass-panel">
            <h3 class="panel-section-title"><i class="fa-solid fa-chart-pie"></i> <span data-i18n="cc_result_title">Hasil Kalkulasi (CFU/mL)</span></h3>
            <div id="results-placeholder" class="empty-state">
              <p data-i18n="cc_empty">Belum ada analisis dilakukan.</p>
            </div>
            <div id="results-content" style="display: none;">
              <div class="colony-stats">
                <div id="card-yellow" class="stat-card" style="border-left-color: #FBBF24;">
                  <h4 data-i18n="cc_yellow_col">Koloni Warna Kuning (TCBS)</h4>
                  <div class="stat-value" id="val-yellow">0</div>
                  <div class="stat-cfu" id="cfu-yellow">0 CFU/mL</div>
                </div>
                <div id="card-green" class="stat-card" style="border-left-color: #10B981;">
                  <h4 data-i18n="cc_green_col">Koloni Warna Hijau (TCBS)</h4>
                  <div class="stat-value" id="val-green">0</div>
                  <div class="stat-cfu" id="cfu-green">0 CFU/mL</div>
                </div>
                <div class="stat-card" style="border-left-color: #4FACFE;">
                  <h4 data-i18n="cc_total_col">Total Koloni Terdeteksi</h4>
                  <div class="stat-value" id="val-total">0</div>
                  <div class="stat-cfu" id="cfu-total">0 CFU/mL</div>
                </div>
              </div>
              <p id="tcbs-note" style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem; display: none;" data-i18n="cc_tcbs_note">* Diferensiasi warna hanya berlaku untuk media TCBS.</p>
            </div>
          </div>
        </section>
      </div>

      <footer class="app-footer">
        <div data-i18n="txt_footer_copy">© 2026 Technology Division, PT Central Proteina Prima Tbk. Hak Cipta Dilindungi.</div>
      </footer>
    </main>
  </div>
  <script src="../js/core/cv-engine.js"></script>
  <script src="../js/core/i18n.js"></script>
  <script src="../js/core/modules.js"></script>
  <script src="../js/main.js"></script>
  <script src="../js/colony/colony-counter.js"></script>
</body>
</html>"""

# -----------------------------------------------------------------------
# 5. chart-maker.html
# -----------------------------------------------------------------------
pages['chart-maker.html'] = r"""<!DOCTYPE html>
<html lang="id" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chart Maker - Aqua Insight</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="../css/style.css">
  <link rel="stylesheet" href="../css/chart-maker.css">
</head>
<body class="subpage">
  <div id="app-layout">
    <div id="sidebar-container"></div>
    <main id="main-content">
      <div id="header-container" data-page-title="Chart Maker" data-page-category="Data &amp; Analytics"></div>
      <div class="cm-workspace">

        <!-- Left Panel -->
        <section class="glass-panel cm-control-panel">
          <h3 class="panel-section-title"><i class="fa-solid fa-chart-pie"></i> <span data-i18n="cm_chart_type">Jenis Grafik</span></h3>
          <div class="form-group">
            <label for="chart-type" data-i18n="cm_chart_type_label">Pilih Tipe Visualisasi</label>
            <select id="chart-type" class="form-control">
              <option value="bar">Bar Chart</option><option value="line">Line Chart</option>
              <option value="pie">Pie Chart</option><option value="doughnut">Doughnut Chart</option>
              <option value="scatter">Scatter Plot</option><option value="bubble">Bubble Chart</option>
              <option value="radar">Radar Chart</option><option value="polarArea">Polar Area Chart</option>
              <option value="stacked-bar">Stacked Bar Chart</option><option value="area">Area Chart</option>
              <option value="pca">PCA Plot</option><option value="hca">HCA Dendrogram</option>
            </select>
          </div>
          <hr class="panel-divider">
          <h3 class="panel-section-title"><i class="fa-solid fa-palette"></i> <span data-i18n="cm_display_opts">Opsi Tampilan</span></h3>
          <div class="form-group">
            <label for="chart-title-input" data-i18n="cm_chart_title">Judul Grafik</label>
            <input type="text" id="chart-title-input" class="form-control" data-i18n-placeholder="cm_chart_title_ph" placeholder="Masukkan judul grafik...">
          </div>
          <div class="form-group">
            <label for="x-axis-label" data-i18n="cm_x_label">Label Sumbu X</label>
            <input type="text" id="x-axis-label" class="form-control" data-i18n-placeholder="cm_x_label_ph" placeholder="Contoh: Perlakuan">
          </div>
          <div class="form-group">
            <label for="y-axis-label" data-i18n="cm_y_label">Label Sumbu Y</label>
            <input type="text" id="y-axis-label" class="form-control" data-i18n-placeholder="cm_y_label_ph" placeholder="Contoh: Nilai">
          </div>
          <div class="form-group">
            <div class="switch-control">
              <label data-i18n="cm_show_legend">Tampilkan Legend</label>
              <button id="toggle-legend" class="toggle-switch-btn active" onclick="this.classList.toggle('active')"></button>
            </div>
          </div>
          <div class="form-group">
            <div class="switch-control">
              <label data-i18n="cm_show_grid">Tampilkan Grid</label>
              <button id="toggle-grid" class="toggle-switch-btn active" onclick="this.classList.toggle('active')"></button>
            </div>
          </div>
          <hr class="panel-divider">
          <h3 class="panel-section-title"><i class="fa-solid fa-table"></i> Data</h3>
          <div class="form-group">
            <label data-i18n="cm_import_data">Import Data</label>
            <div style="display: flex; gap: 0.5rem;">
              <input type="file" id="csv-upload" accept=".csv" style="display:none">
              <button class="header-btn compact-btn" onclick="document.getElementById('csv-upload').click()">
                <i class="fa-solid fa-file-csv"></i> <span data-i18n="cm_import_csv">Impor CSV</span>
              </button>
              <button class="header-btn compact-btn" onclick="clearTable()">
                <i class="fa-solid fa-trash-can"></i> <span data-i18n="cm_clear">Bersihkan</span>
              </button>
            </div>
          </div>
          <hr class="panel-divider">
          <button class="header-btn" style="width:100%; justify-content:center; background: linear-gradient(135deg, var(--text-accent) 0%, #4FACFE 100%); color: #070e1b; border-color: transparent;" id="render-btn">
            <i class="fa-solid fa-play"></i> <span data-i18n="cm_render_btn">Render Grafik</span>
          </button>
          <button class="header-btn" style="width:100%; justify-content:center; margin-top:0.5rem;" id="download-btn">
            <i class="fa-solid fa-download"></i> <span data-i18n="cm_download_btn">Download PNG</span>
          </button>
        </section>

        <!-- Right Panel -->
        <section class="cm-results-area">
          <div class="glass-panel cm-table-panel">
            <div class="cm-panel-header">
              <h3 class="panel-section-title" style="margin:0"><i class="fa-solid fa-table-cells"></i> <span data-i18n="cm_data_table">Tabel Data</span></h3>
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <button class="header-btn compact-btn" id="add-row"><i class="fa-solid fa-plus"></i> <span data-i18n="cm_row">Baris</span></button>
                <button class="header-btn compact-btn" id="add-col"><i class="fa-solid fa-plus"></i> <span data-i18n="cm_col">Kolom</span></button>
                <button class="header-btn compact-btn" id="del-col" style="border-color:#F43F5E; color:#F43F5E;"><i class="fa-solid fa-minus"></i> <span data-i18n="cm_col">Kolom</span></button>
                <button class="header-btn compact-btn" id="del-row" style="border-color:#F43F5E; color:#F43F5E;"><i class="fa-solid fa-minus"></i> <span data-i18n="cm_row">Baris</span></button>
              </div>
            </div>
            <div class="cm-table-scroll">
              <table id="data-table">
                <thead>
                  <tr>
                    <th contenteditable="true">Label</th>
                    <th contenteditable="true">Seri 1</th>
                    <th contenteditable="true">Seri 2</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td contenteditable="true">A</td><td contenteditable="true">10</td><td contenteditable="true">15</td></tr>
                  <tr><td contenteditable="true">B</td><td contenteditable="true">20</td><td contenteditable="true">25</td></tr>
                  <tr><td contenteditable="true">C</td><td contenteditable="true">30</td><td contenteditable="true">20</td></tr>
                  <tr><td contenteditable="true">D</td><td contenteditable="true">15</td><td contenteditable="true">35</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="glass-panel cm-chart-panel">
            <div class="cm-panel-header">
              <h3 class="panel-section-title" style="margin:0"><i class="fa-solid fa-chart-bar"></i> <span data-i18n="cm_visualization">Visualisasi</span></h3>
              <span id="chart-type-label" class="cm-type-badge">Bar Chart</span>
            </div>
            <div class="cm-canvas-wrap"><canvas id="chart-canvas"></canvas></div>
          </div>
        </section>
      </div>

      <footer class="app-footer">
        <div data-i18n="txt_footer_copy">© 2026 Technology Division, PT Central Proteina Prima Tbk. Hak Cipta Dilindungi.</div>
        <div class="footer-links">
          <a href="contact.html" data-i18n="sb_support">Bantuan</a>
          <a href="#" data-i18n="txt_privacy">Privasi</a>
          <a href="#" data-i18n="txt_terms">Syarat &amp; Ketentuan</a>
        </div>
      </footer>
    </main>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="../js/core/i18n.js"></script>
  <script src="../js/core/modules.js"></script>
  <script src="../js/main.js"></script>
  <script src="../js/charts/chart-maker.js"></script>
</body>
</html>"""

# -----------------------------------------------------------------------
# 6. statistics.html  (keep most UI in place, just add data-i18n to labels)
# -----------------------------------------------------------------------
pages['statistics.html'] = r"""<!DOCTYPE html>
<html lang="id" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Statistics Analyzer - Aqua Insight</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="../css/style.css">
  <link rel="stylesheet" href="../css/statistics.css">
  <style>
    .col-header-editable.col-selected, .editable-cell.col-selected { background-color: rgba(0, 242, 254, 0.12) !important; outline: 1px solid rgba(0, 242, 254, 0.4); }
    .col-header-editable.col-selected { outline: 2px solid rgba(0, 242, 254, 0.6); }
    td.row-num.row-selected { background-color: rgba(0, 242, 254, 0.12) !important; color: #00f2fe; font-weight: 700; }
    td.row-num { cursor: pointer; }
    td.row-num:hover { background: rgba(255,255,255,0.06); }
  </style>
</head>
<body class="subpage">
  <div id="app-layout">
    <div id="sidebar-container"></div>
    <main id="main-content">
      <div id="header-container" data-page-title="Statistics Analyzer" data-page-category="Data &amp; Analytics"></div>
      <div class="workspace-grid">

        <!-- Left Panel -->
        <section class="glass-panel workspace-control">
          <h3 class="panel-section-title"><i class="fa-solid fa-folder-open"></i> <span data-i18n="st_preset_data">Preset Data</span></h3>
          <div class="form-group">
            <label for="dataset-preset" data-i18n="st_choose_preset">Pilih Contoh Dataset (Berdasarkan Tujuan Analisa)</label>
            <select id="dataset-preset" class="form-control" onchange="loadPresetDataset(this.value)">
              <option value="" data-i18n="st_empty_table">-- Buat Tabel Kosong --</option>
              <option value="feed_trials" data-i18n="st_preset_anova1">Tujuan: Uji ANOVA 1-Way (Contoh Uji Pakan)</option>
              <option value="temp_salinity" data-i18n="st_preset_anova2">Tujuan: Uji ANOVA 2-Way (Suhu &amp; Salinitas)</option>
              <option value="growth_curve" data-i18n="st_preset_reg_exp">Tujuan: Regresi Eksponensial (Kurva Pertumbuhan)</option>
              <option value="salinity_survival" data-i18n="st_preset_reg_lin">Tujuan: Regresi Linear (Korelasi Survival)</option>
              <option value="ttest_paired_sample" data-i18n="st_preset_ttest">Tujuan: Uji-t Berpasangan (Sebelum vs Sesudah)</option>
            </select>
          </div>
          <hr class="panel-divider">
          <h3 class="panel-section-title"><i class="fa-solid fa-calculator"></i> <span data-i18n="st_stat_analysis">Analisis Statistik</span></h3>
          <div class="form-group">
            <label for="analysis-type" data-i18n="st_test_type">Jenis Pengujian</label>
            <select id="analysis-type" class="form-control" onchange="switchAnalysisSettings(this.value)">
              <option value="descriptive" data-i18n="st_descriptive">Statistik Deskriptif</option>
              <option value="ttest_1" data-i18n="st_ttest1">Uji-t Satu Sampel (One-Sample t-Test)</option>
              <option value="ttest_2" data-i18n="st_ttest2">Uji-t Dua Sampel Independen</option>
              <option value="ttest_paired" data-i18n="st_ttest_paired">Uji-t Berpasangan (Paired t-Test)</option>
              <option value="anova_1" data-i18n="st_anova1">ANOVA Satu Arah &amp; Tukey HSD</option>
              <option value="anova_2" data-i18n="st_anova2">ANOVA Dua Arah (Faktorial)</option>
              <option value="regression" data-i18n="st_regression">Analisis Regresi &amp; Korelasi</option>
              <option value="design_crd" data-i18n="st_design">Rancangan Percobaan (CRD/RCBD Layout)</option>
              <option value="sample_size" data-i18n="st_sample_size">Kalkulator Ukuran Sampel (Power)</option>
            </select>
          </div>
          <div id="param-ttest-1" class="form-group" style="display: none;">
            <label for="ttest-1-target" data-i18n="st_reference_mean">Rata-rata Acuan (H0)</label>
            <input type="number" id="ttest-1-target" class="form-control" value="50">
          </div>
          <div id="param-anova-2" class="form-group" style="display: none;">
            <div class="switch-control">
              <label for="toggle-anova-2-interaction" data-i18n="st_interaction">Hitung Interaksi Faktor</label>
              <button id="toggle-anova-2-interaction" class="toggle-switch-btn active" onclick="this.classList.toggle('active')"></button>
            </div>
          </div>
          <div id="param-regression" class="form-group" style="display: none;">
            <label for="regression-model-type" data-i18n="st_reg_model">Model Fitting Regresi</label>
            <select id="regression-model-type" class="form-control">
              <option value="linear" data-i18n="st_linear">Linear: y = mx + c</option>
              <option value="exponential" data-i18n="st_exponential">Eksponensial: y = a * e^(bx)</option>
              <option value="logarithmic" data-i18n="st_logarithmic">Logaritmik: y = a * ln(x) + b</option>
              <option value="quadratic" data-i18n="st_quadratic">Kuadratik (Orde 2): y = ax² + bx + c</option>
              <option value="power" data-i18n="st_power">Pangkat (Power): y = a * x^b</option>
            </select>
          </div>
          <div id="param-design" style="display: none;">
            <div class="form-group">
              <label for="design-mode" data-i18n="st_design_model">Model Rancangan</label>
              <select id="design-mode" class="form-control" onchange="switchDesignMode(this.value)">
                <option value="crd" data-i18n="st_crd">CRD (Acak Lengkap)</option>
                <option value="rcbd" data-i18n="st_rcbd">RCBD (Acak Kelompok)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="design-treatments" data-i18n="st_treatments">Nama Perlakuan (pisahkan koma)</label>
              <input type="text" id="design-treatments" class="form-control" value="Pakan_A, Pakan_B, Pakan_C">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label id="lbl-reps-blocks" data-i18n="st_reps">Ulangan (Reps)</label>
                <input type="number" id="design-reps" class="form-control" value="4" min="2">
              </div>
              <div class="form-group">
                <label data-i18n="st_grid_cols">Grid Kolom</label>
                <input type="number" id="design-cols" class="form-control" value="4" min="1">
              </div>
            </div>
          </div>
          <div id="param-sample-size" style="display: none;">
            <div class="form-group">
              <label for="sample-calc-type" data-i18n="st_calc_model">Model Kalkulasi</label>
              <select id="sample-calc-type" class="form-control" onchange="switchSampleCalc(this.value)">
                <option value="single" data-i18n="st_single_mean">Estimasi Rata-rata Satu Kelompok</option>
                <option value="double" data-i18n="st_two_group">Perbandingan Dua Kelompok (t-Test)</option>
              </select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="sample-alpha">Alpha (α)</label>
                <select id="sample-alpha" class="form-control">
                  <option value="0.05">0.05 (95%)</option>
                  <option value="0.01">0.01 (99%)</option>
                </select>
              </div>
              <div class="form-group">
                <label for="sample-power" data-i18n="st_power_test">Daya Uji (Power)</label>
                <select id="sample-power" class="form-control">
                  <option value="0.80">0.80 (80%)</option>
                  <option value="0.90">0.90 (90%)</option>
                </select>
              </div>
            </div>
            <div class="form-group" id="group-sample-sd">
              <label for="sample-sd" data-i18n="st_std_dev">Standar Deviasi (σ)</label>
              <input type="number" id="sample-sd" class="form-control" value="10" step="any">
            </div>
            <div class="form-group" id="group-sample-margin">
              <label for="sample-margin" data-i18n="st_error_margin">Batas Toleransi Error (E)</label>
              <input type="number" id="sample-margin" class="form-control" value="2" step="any">
            </div>
            <div class="form-group" id="group-sample-effect" style="display: none;">
              <label for="sample-effect" data-i18n="st_effect_size">Ukuran Efek (Cohen's d)</label>
              <input type="number" id="sample-effect" class="form-control" value="0.5" step="0.1">
            </div>
          </div>
          <hr class="panel-divider">
          <div id="general-stat-settings">
            <div class="switch-control">
              <label for="toggle-levene-assumption" data-i18n="st_levene">Cek Homogenitas (Uji Levene)</label>
              <button id="toggle-levene-assumption" class="toggle-switch-btn active" onclick="this.classList.toggle('active')"></button>
            </div>
          </div>
          <button class="header-btn" style="width: 100%; justify-content: center; background: linear-gradient(135deg, var(--text-accent) 0%, #4FACFE 100%); color: #070e1b; border-color: transparent;" onclick="executeAnalysis()">
            <i class="fa-solid fa-play"></i> <span data-i18n="st_run_analysis">Jalankan Uji Statistik</span>
          </button>
        </section>

        <!-- Right Panel -->
        <section class="results-area">
          <div class="spreadsheet-container" id="grid-box-container">
            <div class="spreadsheet-toolbar">
              <button class="header-btn compact-btn" onclick="addGridRow()"><i class="fa-solid fa-plus"></i> <span data-i18n="st_row">Baris</span></button>
              <button class="header-btn compact-btn" onclick="addGridCol()"><i class="fa-solid fa-plus"></i> <span data-i18n="st_col">Kolom</span></button>
              <button class="header-btn compact-btn" onclick="removeGridCol()"><i class="fa-solid fa-minus"></i> <span data-i18n="st_del_col">Hapus Kolom</span></button>
              <button class="header-btn compact-btn" onclick="clearSpreadsheet()"><i class="fa-solid fa-trash-can"></i> <span data-i18n="st_clear">Bersihkan</span></button>
              <button class="header-btn compact-btn" style="border-color: #F43F5E; color: #F43F5E;" onclick="deleteSelectedCols()"><i class="fa-solid fa-table-columns"></i> <span data-i18n="st_del_sel_col">Hapus Kolom Dipilih</span></button>
              <button class="header-btn compact-btn" style="border-color: #F43F5E; color: #F43F5E;" onclick="deleteSelectedRows()"><i class="fa-solid fa-trash-arrow-up"></i> <span data-i18n="st_del_sel_row">Hapus Baris Dipilih</span></button>
              <div style="flex-grow: 1;"></div>
              <button class="header-btn compact-btn" onclick="triggerCSVImport()"><i class="fa-solid fa-file-import"></i> <span data-i18n="st_import_csv">Impor CSV</span></button>
            </div>
            <div class="spreadsheet-scroll">
              <table class="spreadsheet-table" id="data-grid"></table>
            </div>
          </div>
          <div id="analysis-report-container">
            <div class="glass-panel" style="text-align: center; padding: 4rem; color: var(--text-secondary);">
              <i class="fa-solid fa-chart-line" style="font-size: 3rem; color: var(--text-accent); margin-bottom: 1.5rem;"></i>
              <h3>Aqua Insight Statistics Platform</h3>
              <p style="font-size: 0.85rem; max-width: 500px; margin: 0.5rem auto 0 auto; line-height: 1.5;" data-i18n="st_empty_hint">Silakan isi data ke dalam tabel di atas lalu klik tombol "Jalankan Uji Statistik" untuk memunculkan laporan ilmiah terstandarisasi.</p>
            </div>
          </div>
        </section>
      </div>

      <footer class="app-footer">
        <div data-i18n="txt_footer_copy">© 2026 Technology Division, PT Central Proteina Prima Tbk. Hak Cipta Dilindungi.</div>
        <div class="footer-links">
          <a href="contact.html" data-i18n="sb_support">Bantuan</a>
          <a href="#" data-i18n="txt_privacy">Privasi</a>
          <a href="#" data-i18n="txt_terms">Syarat &amp; Ketentuan</a>
        </div>
      </footer>
    </main>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <script src="../js/core/i18n.js"></script>
  <script src="../js/core/modules.js"></script>
  <script src="../js/main.js"></script>
  <script src="../js/core/math-utils.js"></script>
  <script src="../js/core/file-utils.js"></script>
  <script src="../js/core/chart-utils.js"></script>
  <script src="../js/statistics/anova.js"></script>
  <script src="../js/statistics/regression.js"></script>
  <script src="../js/statistics/design.js"></script>
  <script src="../js/statistics/statistics.js"></script>
</body>
</html>"""

# Now write all pages
for filename, content in pages.items():
    filepath = os.path.join(pages_dir, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content.strip())
    print(f"Rewritten: {filename}")
