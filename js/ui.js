const UI = (() => {
  const thresholdDescriptions = {
    otsu: 'Otsu is suitable for images with clear separation between object and background intensity.',
    mean: 'Mean uses average pixel intensity as threshold and works well for balanced images.',
    triangle: 'Triangle is useful for images with dominant background and small object regions.',
    'minimum-error': 'Minimum Error is suitable for complex intensity distributions.',
    manual: 'Manual threshold allows you to define minimum and maximum threshold values.'
  };

  function updateThresholdDescription(method) {
    const descriptionElement = document.getElementById('thresholdDescription');

    if (!descriptionElement) return;

    descriptionElement.textContent =
      thresholdDescriptions[method] || thresholdDescriptions.otsu;
  }

  function updateImageCounter(currentIndex, totalImages) {
    const imageCounter = document.getElementById('imageCounter');

    if (!imageCounter) return;

    if (totalImages === 0) {
      imageCounter.textContent = '0 / 0';
      return;
    }

    imageCounter.textContent = `${currentIndex + 1} / ${totalImages}`;
  }

  function updateCurrentImageName(fileName) {
    const currentImageName = document.getElementById('currentImageName');

    if (!currentImageName) return;

    currentImageName.textContent = fileName || 'No image selected';
  }

  function showLoading(text = 'Processing image...') {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');

    if (!loadingOverlay || !loadingText) return;

    loadingText.textContent = text;
    loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');

    if (!loadingOverlay) return;

    loadingOverlay.classList.add('hidden');
  }

  function showNotification(type = 'success', title = '', message = '') {
    const container = document.getElementById('notificationContainer');

    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    notification.innerHTML = `
      <div class="notification-title">${title}</div>
      <div class="notification-text">${message}</div>
    `;

    container.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(-8px)';

      setTimeout(() => {
        notification.remove();
      }, 200);
    }, 3500);
  }

  function openBackgroundModal() {
    const modal = document.getElementById('backgroundModal');

    if (!modal) return;

    modal.classList.remove('hidden');
  }

  function closeBackgroundModal() {
    const modal = document.getElementById('backgroundModal');

    if (!modal) return;

    modal.classList.add('hidden');
  }

  function updateBackgroundPointCount(currentCount, maxCount = 5) {
    const counter = document.getElementById('backgroundPointCount');

    if (!counter) return;

    counter.textContent = `${currentCount} / ${maxCount}`;
  }

  function updateSharedBackgroundStatus(enabled) {
    const status = document.getElementById('sharedBackgroundStatus');

    if (!status) return;

    status.textContent = enabled ? 'Enabled' : 'Disabled';
  }

  function renderBackgroundColorPreview(points) {
    const container = document.getElementById('backgroundColorPreviewList');

    if (!container) return;

    if (!points || points.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          No background point selected
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    points.forEach((point, index) => {
      const item = document.createElement('div');
      item.className = 'background-color-item';

      item.innerHTML = `
        <div 
          class="background-color-swatch"
          style="background: rgb(${point.r}, ${point.g}, ${point.b});">
        </div>

        <div class="background-color-text">
          <div class="background-color-title">
            Point ${index + 1}
          </div>

          <div class="background-color-value">
            R: ${point.r}, G: ${point.g}, B: ${point.b}
          </div>
        </div>
      `;

      container.appendChild(item);
    });
  }

     function updateSummary(summary = {}) {
    const mappings = {
      summaryImageName: summary.imageName || '-',
      summaryParticleCount: summary.particleCount || 0,
      summaryCoverage: Utils.formatPercent(summary.coverageArea || 0),
      summaryThresholdMethod: summary.thresholdMethod || '-',
      summaryThresholdValue: summary.thresholdValue || '-',
      summaryChannelMode: summary.channelMode || '-',
      summaryClassificationMode: summary.classificationMode || '-',
      summaryImageSize: summary.imageSize || '-'
    };

    Object.entries(mappings).forEach(([id, value]) => {
      const element = document.getElementById(id);

      if (element) {
        element.textContent = value;
      }
    });
  }

  function resetSummary() {
    updateSummary({
      imageName: '-',
      particleCount: 0,
      coverageArea: 0,
      thresholdMethod: '-',
      thresholdValue: '-',
      channelMode: '-',
      classificationMode: '-',
      imageSize: '-'
    });
  }

  function renderClassificationSummary(classes = []) {
    const container = document.getElementById('classificationSummaryList');

    if (!container) return;

    if (!classes.length) {
      container.innerHTML = `
        <div class="empty-state">
          No classification result available
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    classes.forEach(classItem => {
      const item = document.createElement('div');
      item.className = 'classification-item';

      item.innerHTML = `
        <div
          class="classification-color"
          style="background:${classItem.color || '#49d6ff'}">
        </div>

        <div class="classification-details">
          <div class="classification-name">
            ${classItem.name}
          </div>

          <div class="classification-meta">
            ${classItem.count} particles ·
            ${Utils.formatPercent(classItem.coverage || 0)} coverage
          </div>
        </div>
      `;

      container.appendChild(item);
    });
  }

  function resetClassificationSummary() {
    renderClassificationSummary([]);
  }

  function populateResultTable(results = []) {
    const tableBody = document.getElementById('resultTableBody');

    if (!tableBody) return;

    if (!results.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              No particle analysis result available
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = '';

    results.forEach(result => {
      const row = document.createElement('tr');
      row.dataset.particleId = result.id;

      row.innerHTML = `
        <td>${result.id}</td>
        <td>${result.className || '-'}</td>
        <td>${Utils.formatNumber(result.area, 2)}</td>
        <td>${Utils.formatPercent(result.coverageArea, 2)}</td>
        <td>${Utils.formatNumber(result.meanR, 2)}</td>
        <td>${Utils.formatNumber(result.meanG, 2)}</td>
        <td>${Utils.formatNumber(result.meanB, 2)}</td>
        <td>${Utils.formatNumber(result.circularity, 2)}</td>
      `;

      tableBody.appendChild(row);
    });
  }

  function resetResultTable() {
    populateResultTable([]);
  }

  function getResultSearchKeyword() {
    const input = document.getElementById('resultSearchInput');

    return input ? input.value.trim() : '';
  }

  function getResultSortValue() {
    const select = document.getElementById('resultSortSelect');

    return select ? select.value : 'id-asc';
  }

  function clearTableRowHighlights() {
    const rows = document.querySelectorAll('#resultTableBody tr');

    rows.forEach(row => {
      row.classList.remove('active-row');
      row.classList.remove('highlighted-particle-row');
    });
  }

       function highlightTableRowByParticleId(particleId) {
    clearTableRowHighlights();

    const row = document.querySelector(
      `#resultTableBody tr[data-particle-id="${particleId}"]`
    );

    if (!row) return;

    row.classList.add('active-row');
    row.classList.add('highlighted-particle-row');

    row.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });
  }

  function bindResultTableRowClick(onRowClick) {
    const tableBody = document.getElementById('resultTableBody');

    if (!tableBody) return;

    tableBody.addEventListener('click', event => {
      const row = event.target.closest('tr[data-particle-id]');

      if (!row) return;

      const particleId = row.dataset.particleId;

      clearTableRowHighlights();
      row.classList.add('active-row');

      if (typeof onRowClick === 'function') {
        onRowClick(particleId);
      }
    });
  }

  function resetAllUi() {
    resetSummary();
    resetClassificationSummary();
    resetResultTable();
    updateImageCounter(0, 0);
    updateCurrentImageName('No image selected');
    updateBackgroundPointCount(0);
    renderBackgroundColorPreview([]);
  }

  function updateCanvasStatus(wrapperId, text, coordinates = '-') {
    const wrapper = document.getElementById(wrapperId);

    if (!wrapper) return;

    let statusBar = wrapper.parentElement.querySelector('.canvas-status-bar');

    if (!statusBar) {
      statusBar = document.createElement('div');
      statusBar.className = 'canvas-status-bar';

      statusBar.innerHTML = `
        <div class="canvas-status-text"></div>
        <div class="canvas-status-coordinates"></div>
      `;

      wrapper.parentElement.appendChild(statusBar);
    }

    const textElement = statusBar.querySelector('.canvas-status-text');
    const coordinateElement = statusBar.querySelector('.canvas-status-coordinates');

    textElement.textContent = text;
    coordinateElement.textContent = coordinates;
  }

  function createCanvasCrosshair(wrapperId) {
    const wrapper = document.getElementById(wrapperId);

    if (!wrapper) return;

    const existingCrosshair = wrapper.querySelector('.canvas-crosshair');

    if (existingCrosshair) return;

    const crosshair = document.createElement('div');
    crosshair.className = 'canvas-crosshair';

    wrapper.appendChild(crosshair);
  }

  function removeCanvasCrosshair(wrapperId) {
    const wrapper = document.getElementById(wrapperId);

    if (!wrapper) return;

    const crosshair = wrapper.querySelector('.canvas-crosshair');

    if (crosshair) {
      crosshair.remove();
    }
  }

  return {
    updateThresholdDescription,
    updateImageCounter,
    updateCurrentImageName,
    showLoading,
    hideLoading,
    showNotification,
    openBackgroundModal,
    closeBackgroundModal,
    updateBackgroundPointCount,
    updateSharedBackgroundStatus,
    renderBackgroundColorPreview,
    updateSummary,
    resetSummary,
    renderClassificationSummary,
    resetClassificationSummary,
    populateResultTable,
    resetResultTable,
    getResultSearchKeyword,
    getResultSortValue,
    clearTableRowHighlights,
    highlightTableRowByParticleId,
    bindResultTableRowClick,
    resetAllUi,
    updateCanvasStatus,
    createCanvasCrosshair,
    removeCanvasCrosshair
  };
})();

