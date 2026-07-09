import os
import re

pages_dir = os.path.join(os.path.dirname(__file__), 'pages')

translations = {
    # Particle Counter
    "Input Citra": "pc_input_image",
    "Seret gambar ke sini atau klik untuk unggah": "pc_dropzone",
    "Kamera belum diaktifkan": "pc_cam_inactive",
    "Aktifkan": "pc_btn_activate",
    "Snapshot": "pc_btn_snapshot",
    "Metode Pendeteksian": "pc_method",
    "Threshold Biner (Standar)": "pc_method_binary",
    "Kemiripan Warna (Super Detail)": "pc_method_color",
    "Pemilihan Kanal Warna (Channel)": "pc_channel",
    ">Grayscale<": ">pc_ch_gray<",
    ">Merah<": ">pc_ch_red<",
    ">Hijau<": ">pc_ch_green<",
    ">Biru<": ">pc_ch_blue<",
    "Parameter Segmentasi (Grayscale)": "pc_param_seg",
    "Ambang Batas Otomatis (Otsu)": "pc_auto_thresh",
    "Ambang Batas (Threshold)": "pc_manual_thresh",
    "Iterasi Erosi (Pisahkan Objek Menyatu)": "pc_erosion",
    "Gunakan fitur ini untuk memisahkan partikel yang saling berdempetan.": "pc_erosion_tip",
    "Toleransi Warna": "pc_color_tol",
    "Toleransi Perbedaan Warna": "pc_color_tol_label",
    "Semakin kecil nilai ini, semakin sensitif sistem membedakan setiap gradasi warna sekecil apapun menjadi partikel yang berbeda.": "pc_color_tol_tip",
    "Koreksi Latar Belakang Terang": "pc_bg_corr",
    "Eksklusi Partikel Menyentuh Tepi": "pc_edge_exc",
    "Isi Rongga Sel (Fill Holes)": "pc_fill_holes",
    "Penyaringan Morfometrik": "pc_morph_filter",
    "Ukuran Partikel Minimum (pixel)": "pc_min_size",
    "Ukuran Partikel Maksimum (pixel)": "pc_max_size",
    "Sirkularitas Minimum (0.0 - 1.0)": "pc_min_circ",
    "Kalibrasi Skala Riil": "pc_scale_calib",
    "Piksel": "pc_pixel",
    "Nilai Riil": "pc_real_val",
    "Unit": "pc_unit",
    "Rasio: 1 px = 1.00 px": "pc_ratio",
    "Layar Pemantau Kanvas": "pc_canvas_title",
    "Ringkasan Hasil": "pc_summary_title",
    "Jumlah Partikel Terdeteksi": "pc_sum_count",
    "Area Coverage (%)": "pc_sum_cov",
    "Rata-rata Ukuran": "pc_sum_avg",
    "Distribusi Ukuran": "pc_size_dist",
    "Lembar Data Morfometri Partikel": "pc_table_title",
    "Cari indeks partikel...": "pc_search_idx",
    "Indeks": "pc_th_idx",
    "Titik Pusat (X, Y)": "pc_th_center",
    "Luas (px²)": "pc_th_area",
    "Keliling (px)": "pc_th_perimeter",
    "Sirkularitas": "pc_th_circ",
    "Aspect Ratio": "pc_th_aspect",
    "Solidity": "pc_th_solidity",
    "Kontras GLCM": "pc_th_glcm",
    "Profil Warna RGB": "pc_th_rgb",
    "Tepi": "pc_th_edge",
    "Silakan unggah citra untuk memulai analisis.": "pc_empty_table",
    
    # Plankton Analysis
    "Tambah Pengamatan": "pl_add_obs",
    "Genus Spesies": "pl_genus",
    "Fitoplankton (Beneficial)": "pl_phytoplankton",
    "Harmful Algal Blooms (HABs)": "pl_habs",
    "Jumlah Sel Dihitung (N)": "pl_cell_count",
    "Faktor Pengenceran (D)": "pl_dilution",
    "Jumlah Kotak (n)": "pl_grid_count",
    "Volume Sampel (V) mL": "pl_volume",
    "Tanggal Sampel": "pl_date",
    "Tambahkan Data": "pl_btn_add",
    "Kepadatan & Klasifikasi": "pl_tab_density",
    "Indeks Keanekaragaman": "pl_tab_div",
    "Database Kolam": "pl_tab_db",
    "Rata-rata Kepadatan Sel/mL": "pl_sum_density",
    "Total HABs Terdeteksi": "pl_sum_habs",
    "Indeks Shannon-Wiener (H')": "pl_shannon",
    "Indeks Simpson (D)": "pl_simpson",
    "Indeks Evenness (J')": "pl_evenness",

    # Wet Mount
    "Kontrol Mikroskop": "wm_micro_ctrl",
    "Z-Focus (Kedalaman Lensa)": "wm_z_focus",
    "Magnifikasi Objektif": "wm_mag",
    "Jenis Sampel / Organ": "wm_sample_type",
    "Insang Udang": "wm_shrimp_gill",
    "Hepatopankreas Udang": "wm_shrimp_hp",
    "Insang/Kulit Ikan": "wm_fish_gill",
    "Checklist Temuan Patologi": "wm_findings",
    "Kartu Diagnosis Medis": "wm_diag_card",
    "Tingkat Keparahan (Severity)": "wm_severity",
    "Rekomendasi Tindakan": "wm_action",
    
    # Common
    "Ekspor PNG": "btn_export_png",
    "Ekspor Excel": "btn_export_excel",
    "Memproses gambar...": "txt_processing",
    "Tidak ada gambar": "txt_no_image",
    "Bantuan": "sb_support",
    "Privasi": "txt_privacy",
    "Syarat & Ketentuan": "txt_terms",
    "© 2026 Technology Division, PT Central Proteina Prima Tbk. Hak Cipta Dilindungi.": "txt_footer_copy",
    "Fit": "btn_fit"
}

for filename in os.listdir(pages_dir):
    if filename.endswith(".html"):
        filepath = os.path.join(pages_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        if "i18n.js" not in content:
            content = content.replace('<script src="../js/core/modules.js"></script>', '<script src="../js/core/i18n.js"></script>\n  <script src="../js/core/modules.js"></script>')

        for text, key in translations.items():
            if text.startswith(">"):
                bare_text = text[1:-1]
                content = re.sub(f'>\\s*{re.escape(bare_text)}\\s*<', f' data-i18n="{key}">{bare_text}<', content)
            else:
                # Handle placeholders
                content = re.sub(f'placeholder="{re.escape(text)}"', f'placeholder="{text}" data-i18n-placeholder="{key}"', content)
                # Handle standard tags that have > text <
                content = re.sub(f'>\\s*{re.escape(text)}\\s*<', f' data-i18n="{key}">{text}<', content)
                # Handle standard text right after an icon (common pattern in this project)
                content = re.sub(f'</i>\\s*{re.escape(text)}\\s*<', f'</i> <span data-i18n="{key}">{text}</span><', content)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Processed: {filename}")
