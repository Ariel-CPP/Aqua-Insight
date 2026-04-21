const ExportManager = (() => {
  function exportOverlayPng(canvas, imageName = 'overlay') {
    if (!canvas) {
      UI.showNotification(
        'warning',
        'Export Failed',
        'No overlay canvas available.'
      );
      return;
    }

    const safeName = Utils.getFileNameWithoutExtension(imageName);
    const fileName = `${safeName}_overlay.png`;

    Utils.downloadCanvasAsPng(canvas, fileName);

    UI.showNotification(
      'success',
      'Overlay Exported',
      `${fileName} has been downloaded successfully.`
    );
  }

  function createSummarySheet(results = []) {
    return results.map(item => ({
      Image_Name: item.imageName,
      Particle_Count: item.particleCount,
      Coverage_Percent: Utils.roundTo(item.coverageArea, 2),
      Threshold_Method: item.thresholdMethod,
      Threshold_Value: item.thresholdValue,
      Channel_Mode: item.channelMode,
      Classification_Mode: item.classificationMode
    }));
  }

  function createMetadataSheet(results = []) {
    return results.map(item => ({
      Image_Name: item.imageName,
      Image_Size: item.imageSize,
      Threshold_Method: item.thresholdMethod,
      Threshold_Min: item.thresholdMin,
      Threshold_Max: item.thresholdMax,
      Channel_Mode: item.channelMode,
      Classification_Mode: item.classificationMode,
      Minimum_Particle_Size: item.minimumParticleSize,
      Morphology_Strength: item.morphologyStrength,
      Invert_Threshold: item.invertThreshold ? 'Yes' : 'No',
      Background_Min_R: item.backgroundRange?.minR ?? '-',
      Background_Max_R: item.backgroundRange?.maxR ?? '-',
      Background_Min_G: item.backgroundRange?.minG ?? '-',
      Background_Max_G: item.backgroundRange?.maxG ?? '-',
      Background_Min_B: item.backgroundRange?.minB ?? '-',
      Background_Max_B: item.backgroundRange?.maxB ?? '-'
    }));
  }

  function createDetailSheet(results = []) {
    const detailRows = [];

    results.forEach(item => {
      item.particles.forEach(particle => {
        detailRows.push({
          Image_Name: item.imageName,
          Particle_ID: particle.id,
          Class: particle.className,
          Area: Utils.roundTo(particle.area, 2),
          Coverage_Percent: Utils.roundTo(particle.coverageArea, 2),
          Mean_R: Utils.roundTo(particle.meanR, 2),
          Mean_G: Utils.roundTo(particle.meanG, 2),
          Mean_B: Utils.roundTo(particle.meanB, 2),
          Circularity: Utils.roundTo(particle.circularity, 2)
        });
      });
    });

    return detailRows;
  }

  function exportResultsToXlsx(results = [], fileName = 'particle_analysis.xlsx') {
    if (!results.length) {
      UI.showNotification(
        'warning',
        'Export Failed',
        'No analysis results available.'
      );
      return;
    }

    const workbook = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.json_to_sheet(
      createSummarySheet(results)
    );

    const metadataSheet = XLSX.utils.json_to_sheet(
      createMetadataSheet(results)
    );

    const detailSheet = XLSX.utils.json_to_sheet(
      createDetailSheet(results)
    );

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
    XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detail');

    XLSX.writeFile(workbook, fileName);

    UI.showNotification(
      'success',
      'Export Complete',
      `${fileName} has been downloaded successfully.`
    );
  }
    return {
    exportOverlayPng,
    createSummarySheet,
    createMetadataSheet,
    createDetailSheet,
    exportResultsToXlsx
  };
})();
