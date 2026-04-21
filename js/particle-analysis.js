function analyzeSingleImage(imageItem, imageIndex) {
  const tempCanvas =
    document.createElement('canvas');

  const tempCtx =
    tempCanvas.getContext('2d');

  tempCanvas.width =
    imageItem.image.width;

  tempCanvas.height =
    imageItem.image.height;

  tempCtx.drawImage(imageItem.image, 0, 0);

  const settings = getCurrentAnalysisSettings();

  const detectionResult = runDetectionPipeline(
    tempCanvas,
    settings
  );

  const imageData = tempCtx.getImageData(
    0,
    0,
    tempCanvas.width,
    tempCanvas.height
  );

  const extractedParticles =
    detectionResult.particles.map(particle => {
      return extractParticleFeatures(
        particle,
        imageData,
        tempCanvas.width,
        tempCanvas.height
      );
    });

  const filteredParticles = extractedParticles.filter(particle => {
    const validArea =
      particle.area >= settings.minParticleSize &&
      particle.area <= settings.maxParticleSize;

    const validCircularity =
      particle.circularity >= settings.circularityMin &&
      particle.circularity <= settings.circularityMax;

    const validEdge =
      settings.excludeEdgeParticles
        ? !particle.touchesEdge
        : true;

    return (
      validArea &&
      validCircularity &&
      particle.area >= 1 &&
      validEdge
    );
  });

  const totalArea = filteredParticles.reduce(
    (sum, particle) => sum + particle.area,
    0
  );

  const coveragePercent =
    tempCanvas.width * tempCanvas.height > 0
      ? (
          (totalArea /
            (tempCanvas.width * tempCanvas.height)) *
          100
        ).toFixed(2)
      : '0.00';

  return {
    imageIndex,
    filename: imageItem.name,
    image: imageItem.image,
    width: tempCanvas.width,
    height: tempCanvas.height,
    thresholdMode: settings.thresholdMode,
    thresholdValue: detectionResult.thresholdValue,
    channelMode: settings.channelMode,
    binaryMask: detectionResult.binaryMask,
    particles: filteredParticles,
    coveragePixels: totalArea,
    coveragePercent
  };
}

// ==============================
// ACTIVE IMAGE RENDER
// ==============================

function renderStoredAnalysisForCurrentImage() {
  if (!allAnalysisResults.length) return;

  const result =
    allAnalysisResults[currentImageIndex];

  if (!result) return;

  renderCurrentImage();

  renderSelectedChannelPreview(
    result.channelMode
  );

  renderBinaryMaskToCanvas(
    result.binaryMask,
    result.width,
    result.height,
    thresholdCanvas
  );

  drawParticleOverlay(
    result.particles,
    result.width,
    result.height
  );

  populateResultsTable(result.particles);

  updateSummaryDisplay(result);
}

// ==============================
// BACKGROUND PICKER
// ==============================

function initializeBackgroundPicker() {
  const container =
    document.getElementById('originalCanvasContainer');

  const resetButton =
    document.getElementById('resetBackgroundButton');

  const indicator =
    document.getElementById('backgroundColorIndicator');

  const label =
    document.getElementById('backgroundPixelValue');

  const marker =
    document.getElementById('backgroundSelectionMarker');

  if (!container) return;

  container.addEventListener('click', event => {
    const usePicker =
      document.getElementById('useBackgroundPicker')?.checked;

    if (!usePicker) return;

    const rect =
      originalCanvas.getBoundingClientRect();

    const scaleX =
      originalCanvas.width / rect.width;

    const scaleY =
      originalCanvas.height / rect.height;

    const x = Math.floor(
      (event.clientX - rect.left) * scaleX
    );

    const y = Math.floor(
      (event.clientY - rect.top) * scaleY
    );

    const pixel = originalCtx.getImageData(
      x,
      y,
      1,
      1
    ).data;

    const gray = Math.round(
      pixel[0] * 0.299 +
      pixel[1] * 0.587 +
      pixel[2] * 0.114
    );

    selectedBackgroundPixel = gray;
    selectedBackgroundPosition = { x, y };

    if (indicator) {
      indicator.style.background =
        `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
    }

    if (label) {
      label.textContent =
        `RGB(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
    }

    if (marker) {
      marker.style.display = 'block';
      marker.style.left =
        `${event.clientX - rect.left}px`;
      marker.style.top =
        `${event.clientY - rect.top}px`;
    }
  });

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      selectedBackgroundPixel = null;
      selectedBackgroundPosition = null;

      if (indicator) {
        indicator.style.background = 'transparent';
      }

      if (label) {
        label.textContent = 'No pixel selected';
      }

      if (marker) {
        marker.style.display = 'none';
      }
    });
  }
}

// ==============================
// ANALYSIS CONTROL
// ==============================

function initializeAnalysisControls() {
  const runButton =
    document.getElementById('runAnalysisButton');

  if (!runButton) return;

  runButton.addEventListener('click', () => {
    if (!uploadedImages.length) {
      alert('Upload image first.');
      return;
    }

    runFullAnalysis();
  });
}

function runFullAnalysis() {
  const settings = getCurrentSettings();

  allAnalysisResults = [];

  uploadedImages.forEach((item, index) => {
    const tempCanvas =
      document.createElement('canvas');

    tempCanvas.width = item.image.width;
    tempCanvas.height = item.image.height;

    const tempCtx =
      tempCanvas.getContext('2d');

    tempCtx.drawImage(item.image, 0, 0);

    const result = runDetectionPipeline(
      tempCanvas,
      {
        ...settings,
        backgroundPixel: selectedBackgroundPixel
      }
    );

    const features =
      extractParticlesWithFeatures(
        result.particles,
        tempCanvas
      );

    const filtered =
      filterParticles(features, settings);

    const totalArea =
      filtered.reduce(
        (sum, p) => sum + p.area,
        0
      );

    const totalPixels =
      tempCanvas.width * tempCanvas.height;

    const coveragePercent =
      ((totalArea / totalPixels) * 100).toFixed(2);

    allAnalysisResults.push({
      filename: item.name,
      particles: filtered,
      thresholdMode: settings.thresholdMode,
      thresholdValue: result.thresholdValue,
      channelMode: settings.channelMode,
      coveragePixels: totalArea,
      coveragePercent
    });
  });

  storeMultiAnalysisResults(
    allAnalysisResults,
    {}
  );

  displayCurrentAnalysis();
}

// ==============================
// DISPLAY CURRENT RESULT
// ==============================

function displayCurrentAnalysis() {
  if (!allAnalysisResults.length) return;

  const result =
    allAnalysisResults[currentImageIndex];

  const imageData =
    uploadedImages[currentImageIndex];

  renderCurrentImage();

  renderSelectedChannelPreview();

  renderBinaryPreview();

  drawOverlay(result.particles);

  updateSummaryValue(
    'activeImageSummary',
    imageData.name
  );

  updateSummaryValue(
    'particleCount',
    result.particles.length
  );

  updateSummaryValue(
    'coverageArea',
    `${result.coveragePercent}%`
  );

  updateSummaryValue(
    'coveragePixelArea',
    `${result.coveragePixels} px`
  );

  updateSummaryValue(
    'thresholdMethodLabel',
    result.thresholdMode
  );

  updateSummaryValue(
    'channelModeLabel',
    result.channelMode
  );

  updateSummaryValue(
    'thresholdValueLabel',
    result.thresholdValue
  );

  updateSummaryValue(
    'imageSizeLabel',
    `${overlayCanvas.width} x ${overlayCanvas.height}`
  );

  populateResultsTable(result.particles);
}

// ==============================
// PREVIEW RENDER
// ==============================

function renderSelectedChannelPreview() {
  const settings = getCurrentSettings();

  const image =
    uploadedImages[currentImageIndex].image;

  channelCtx.drawImage(image, 0, 0);

  const imageData =
    channelCtx.getImageData(
      0,
      0,
      channelCanvas.width,
      channelCanvas.height
    );

  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (settings.channelMode === 'red') {
      data[i + 1] = 0;
      data[i + 2] = 0;
    } else if (settings.channelMode === 'green') {
      data[i] = 0;
      data[i + 2] = 0;
    } else if (settings.channelMode === 'blue') {
      data[i] = 0;
      data[i + 1] = 0;
    } else {
      const gray =
        0.299 * r +
        0.587 * g +
        0.114 * b;

      data[i] = data[i + 1] = data[i + 2] = gray;
    }
  }

  channelCtx.putImageData(imageData, 0, 0);
}

function renderBinaryPreview() {
  const settings = getCurrentSettings();

  const tempCanvas =
    document.createElement('canvas');

  const img =
    uploadedImages[currentImageIndex].image;

  tempCanvas.width = img.width;
  tempCanvas.height = img.height;

  const ctx =
    tempCanvas.getContext('2d');

  ctx.drawImage(img, 0, 0);

  const result = runDetectionPipeline(
    tempCanvas,
    {
      ...settings,
      backgroundPixel: selectedBackgroundPixel
    }
  );

  renderBinaryMaskToCanvas(
    result.binaryMask,
    tempCanvas.width,
    tempCanvas.height,
    thresholdCanvas
  );
}

// ==============================
// OVERLAY DRAWING
// ==============================

function drawOverlay(particles) {
  const svg =
    document.getElementById('overlaySvg');

  if (!svg) return;

  svg.innerHTML = '';

  svg.setAttribute(
    'viewBox',
    `0 0 ${overlayCanvas.width} ${overlayCanvas.height}`
  );

  particles.forEach((particle, index) => {
    if (!particle.pixels || particle.pixels.length < 5) {
      return;
    }

    const boundary =
      extractBoundaryPoints(particle.pixels);

    if (!boundary.length) return;

    const polygon =
      document.createElementNS(
        'http://www.w3.org/2000/svg',
        'polygon'
      );

    polygon.setAttribute(
      'points',
      boundary
        .map(p => `${p.x},${p.y}`)
        .join(' ')
    );

    polygon.setAttribute('fill', 'none');
    polygon.setAttribute('stroke', '#00ffff');
    polygon.setAttribute('stroke-width', '1');

    svg.appendChild(polygon);

    const settings = getCurrentSettings();

    if (particle.area >= settings.minimumOverlayArea) {
      const text =
        document.createElementNS(
          'http://www.w3.org/2000/svg',
          'text'
        );

      text.setAttribute('x', particle.centroidX);
      text.setAttribute('y', particle.centroidY);
      text.textContent = index + 1;

      svg.appendChild(text);
    }
  });
}

// ==============================
// PARTICLE FEATURE EXTRACTION
// ==============================

function extractParticlesWithFeatures(
  particles,
  canvas
) {
  const ctx = canvas.getContext('2d');

  const width = canvas.width;
  const height = canvas.height;

  const imageData =
    ctx.getImageData(0, 0, width, height).data;

  return particles.map(particle => {
    let area = particle.pixels.length;

    let sumX = 0;
    let sumY = 0;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;

    let rMin = 255;
    let gMin = 255;
    let bMin = 255;

    let rMax = 0;
    let gMax = 0;
    let bMax = 0;

    particle.pixels.forEach(p => {
      const idx = (p.y * width + p.x) * 4;

      const r = imageData[idx];
      const g = imageData[idx + 1];
      const b = imageData[idx + 2];

      rSum += r;
      gSum += g;
      bSum += b;

      rMin = Math.min(rMin, r);
      gMin = Math.min(gMin, g);
      bMin = Math.min(bMin, b);

      rMax = Math.max(rMax, r);
      gMax = Math.max(gMax, g);
      bMax = Math.max(bMax, b);

      sumX += p.x;
      sumY += p.y;

      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    const centroidX = sumX / area;
    const centroidY = sumY / area;

    const widthBox = maxX - minX + 1;
    const heightBox = maxY - minY + 1;

    const aspectRatio =
      widthBox / heightBox;

    const perimeter =
      estimatePerimeter(particle.pixels);

    const circularity =
      (4 * Math.PI * area) /
      (perimeter * perimeter || 1);

    const feretDiameter =
      Math.max(widthBox, heightBox);

    const touchesEdge =
      particle.pixels.some(p =>
        p.x === 0 ||
        p.y === 0 ||
        p.x === width - 1 ||
        p.y === height - 1
      );

    return {
      ...particle,
      area,
      perimeter,
      circularity,
      feretDiameter,
      aspectRatio,
      meanRGB: `(${Math.round(rSum / area)}, ${Math.round(gSum / area)}, ${Math.round(bSum / area)})`,
      minRGB: `(${rMin}, ${gMin}, ${bMin})`,
      maxRGB: `(${rMax}, ${gMax}, ${bMax})`,
      centroidX,
      centroidY,
      touchesEdge
    };
  });
}

// ==============================
// PARTICLE FILTERING
// ==============================

function filterParticles(particles, settings) {
  return particles.filter(p => {
    const sizeValid =
      p.area >= settings.minParticleSize &&
      p.area <= settings.maxParticleSize;

    const circularityValid =
      p.circularity >= settings.circularityMin &&
      p.circularity <= settings.circularityMax;

    const edgeValid =
      settings.excludeEdgeParticles
        ? !p.touchesEdge
        : true;

    return sizeValid && circularityValid && edgeValid;
  });
}

// ==============================
// PERIMETER ESTIMATION
// ==============================

function estimatePerimeter(pixels) {
  const pixelSet = new Set(
    pixels.map(p => `${p.x},${p.y}`)
  );

  let perimeter = 0;

  pixels.forEach(p => {
    const neighbors = [
      [p.x - 1, p.y],
      [p.x + 1, p.y],
      [p.x, p.y - 1],
      [p.x, p.y + 1]
    ];

    neighbors.forEach(([nx, ny]) => {
      if (!pixelSet.has(`${nx},${ny}`)) {
        perimeter++;
      }
    });
  });

  return perimeter;
}

// ==============================
// NAVIGATION
// ==============================

function initializeNavigationButtons() {
  const prev =
    document.getElementById('previousBatchImageButton');

  const next =
    document.getElementById('nextBatchImageButton');

  if (prev) {
    prev.addEventListener('click', () => {
      if (!uploadedImages.length) return;

      currentImageIndex--;

      if (currentImageIndex < 0) {
        currentImageIndex =
          uploadedImages.length - 1;
      }

      displayCurrentAnalysis();
      updateImageNavigationLabel();
    });
  }

  if (next) {
    next.addEventListener('click', () => {
      if (!uploadedImages.length) return;

      currentImageIndex++;

      if (currentImageIndex >= uploadedImages.length) {
        currentImageIndex = 0;
      }

      displayCurrentAnalysis();
      updateImageNavigationLabel();
    });
  }
}

// ==============================
// LABEL UPDATE
// ==============================

function updateImageNavigationLabel() {
  const label =
    document.getElementById('activeImageLabel');

  if (!label || !uploadedImages.length) return;

  label.textContent =
    `${uploadedImages[currentImageIndex].name} ` +
    `(${currentImageIndex + 1}/${uploadedImages.length})`;
}

// ==============================
// SETTINGS
// ==============================

function initializeSettingPersistence() {
  const ids = [
    'channelMode',
    'thresholdMode',
    'manualThresholdValue',
    'minimumOverlayArea',
    'minParticleSize',
    'maxParticleSize',
    'circularityMin',
    'circularityMax',
    'invertThreshold',
    'excludeEdgeParticles',
    'useBackgroundPicker'
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);

    if (!el) return;

    const saved = getSetting(id);

    if (saved !== undefined) {
      if (el.type === 'checkbox') {
        el.checked = saved;
      } else {
        el.value = saved;
      }
    }

    el.addEventListener('change', () => {
      const val =
        el.type === 'checkbox'
          ? el.checked
          : el.value;

      saveSetting(id, val);
    });
  });
}
