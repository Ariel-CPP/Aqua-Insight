// ==============================
// THRESHOLD DESCRIPTION
// ==============================

function initializeThresholdDescriptions() {
  const thresholdMode =
    document.getElementById('thresholdMode');

  const thresholdDescription =
    document.getElementById('thresholdDescription');

  if (!thresholdMode || !thresholdDescription) return;

  const descriptions = {
    otsu: 'Automatically separates foreground and background based on maximum between-class variance.',
    mean: 'Uses the average grayscale intensity of the image as the threshold value.',
    triangle: 'Applies the triangle algorithm for images with asymmetric histograms.',
    minerror: 'Uses minimum error thresholding based on separation between foreground and background.',
    manual: 'Allows manual threshold value adjustment using the threshold input field.'
  };

  function updateThresholdDescription() {
    const selectedMode = thresholdMode.value;

    thresholdDescription.textContent =
      descriptions[selectedMode] ||
      'Select a threshold mode to view its description.';
  }

  thresholdMode.addEventListener(
    'change',
    updateThresholdDescription
  );

  updateThresholdDescription();
}

// ==============================
// BATCH NAVIGATION BUTTONS
// ==============================

function initializeBatchNavigationButtons() {
  const previousButton =
    document.getElementById('previousBatchImageButton');

  const nextButton =
    document.getElementById('nextBatchImageButton');

  if (previousButton) {
    previousButton.addEventListener('click', () => {
      if (
        typeof batchResults === 'undefined' ||
        !batchResults.length
      ) {
        return;
      }

      currentBatchPreviewIndex--;

      if (currentBatchPreviewIndex < 0) {
        currentBatchPreviewIndex =
          batchResults.length - 1;
      }

      if (typeof renderBatchPreviewImage === 'function') {
        renderBatchPreviewImage();
      }
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => {
      if (
        typeof batchResults === 'undefined' ||
        !batchResults.length
      ) {
        return;
      }

      currentBatchPreviewIndex++;

      if (currentBatchPreviewIndex >= batchResults.length) {
        currentBatchPreviewIndex = 0;
      }

      if (typeof renderBatchPreviewImage === 'function') {
        renderBatchPreviewImage();
      }
    });
  }
}

// ==============================
// GLOBAL STORAGE HELPERS
// ==============================

function saveSetting(key, value) {
  const settings = JSON.parse(
    localStorage.getItem('aquaInsightSettings')
  ) || {};

  settings[key] = value;

  localStorage.setItem(
    'aquaInsightSettings',
    JSON.stringify(settings)
  );
}

function getSetting(key) {
  const settings = JSON.parse(
    localStorage.getItem('aquaInsightSettings')
  ) || {};

  return settings[key];
}

console.log('Aqua Insight initialized successfully.');
