/* ==========================================================================
   AQUA INSIGHT - PARTICLE COUNTER EXPORT SCRIPT
   Formats particle metrics and summaries into multi-sheet XLSX formats.
   ========================================================================== */

window.AquaParticleExport = {
  // exportResults: Array of particles data
  // calibration: { scalePixel, scaleUnitValue, unit }
  // settings: { autoThreshold, thresholdVal, bgCorrection, minSize, maxSize, minCirc }
  exportToExcel: function(particles, calibration, settings, filename = "aqua_insight_particles.xlsx") {
    // 1. Prepare Sheet 1: Summary Statistics
    const summaryData = [
      ["AQUA INSIGHT - DATA RINGKASAN PARTIKEL", ""],
      ["Tanggal Eksport", new Date().toLocaleString("id-ID")],
      ["", ""],
      ["PARAMETER ANALISIS", ""],
      ["Metode Ambang Batas", settings.autoThreshold ? "Otsu (Otomatis)" : "Manual"],
      ["Nilai Ambang Batas Biner", settings.thresholdVal],
      ["Koreksi Latar Belakang Terang", settings.bgCorrection ? "Aktif" : "Nonaktif"],
      ["Ukuran Partikel Filter (Min - Max)", `${settings.minSize} px - ${settings.maxSize === 10000 ? "Tanpa Batas" : settings.maxSize + " px"}`],
      ["Sirkularitas Minimum Filter", settings.minCirc.toFixed(2)],
      ["Eksklusi Partikel Tepi", settings.edgeExclusion ? "Aktif" : "Nonaktif"],
      ["Rasio Kalibrasi Skala", `100 px = ${calibration.scaleUnitValue} ${calibration.unit}`],
      ["", ""],
      ["HASIL KUANTITATIF", ""],
      ["Total Partikel Terhitung", particles.length],
      ["Total Luas Area Terdeteksi", particles.reduce((acc, p) => acc + p.area, 0).toFixed(2) + ` ${calibration.unit}²`],
      ["Kerapatan/Coverage Area (%)", this.calculateCoveragePercentage(particles, settings.imageWidth, settings.imageHeight, calibration).toFixed(2) + " %"]
    ];

    // 2. Prepare Sheet 2: Detailed Morphometrics
    const detailedHeaders = [
      "Indeks", 
      "Centroid X (pixel)", 
      "Centroid Y (pixel)", 
      `Luas (${calibration.unit}²)`, 
      `Keliling (${calibration.unit})`, 
      "Sirkularitas", 
      "Aspect Ratio", 
      "Solidity",
      "Tekstur Kontras",
      "Tekstur Homogenitas",
      "Rata-rata Saluran R", 
      "Rata-rata Saluran G", 
      "Rata-rata Saluran B",
      "Hu Moments 1",
      "Hu Moments 2",
      "Menyentuh Tepi Gambar"
    ];

    const detailedRows = particles.map(p => {
      const cv = p.cvFeatures || { solidity: 0, texture: {contrast: 0, homogeneity: 0}, hu_moments: [0,0] };
      return [
        p.index,
        Math.round(p.centroid.x * 100) / 100,
        Math.round(p.centroid.y * 100) / 100,
        Math.round(p.area * 100) / 100,
        Math.round(p.perimeter * 100) / 100,
        Math.round(p.circularity * 1000) / 1000,
        Math.round(p.aspectRatio * 100) / 100,
        cv.solidity,
        cv.texture.contrast,
        cv.texture.homogeneity,
        p.rgb.r,
        p.rgb.g,
        p.rgb.b,
        cv.hu_moments[0],
        cv.hu_moments[1],
        p.touchesEdge ? "Ya" : "Tidak"
      ];
    });

    const detailedData = [detailedHeaders, ...detailedRows];

    // 3. Package and trigger download via global exporter
    const sheets = [
      { name: "Ringkasan Analisis", data: summaryData },
      { name: "Morfometri Detail", data: detailedData }
    ];

    window.AquaFile.exportToExcel(sheets, filename);
  },

  calculateCoveragePercentage: function(particles, width, height, calibration) {
    if (!width || !height) return 0;
    const canvasArea = width * height;
    
    // Scale area back to pixel sum
    const totalAreaPx = particles.reduce((acc, p) => acc + p.areaPx, 0);
    return (totalAreaPx / canvasArea) * 100;
  }
};
