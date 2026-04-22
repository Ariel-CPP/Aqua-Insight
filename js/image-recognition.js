const RecognitionState = {
  images: [],
  currentImageIndex: 0,
  categories: [],
  selectedCategoryId: null,
  currentImage: null,
  isSelectingSample: false,
  selectionStartX: 0,
  selectionStartY: 0,
  selectionEndX: 0,
  selectionEndY: 0,
  currentSelectionBox: null,
  results: []
};

document.addEventListener('DOMContentLoaded', () => {
  initializeRecognitionPage();
});

function initializeRecognitionPage() {
  bindRecognitionUpload();
  bindRecognitionControls();
  updateRecognitionStatus('Waiting for Image');
}

function bindRecognitionUpload() {
  const uploadButton = document.getElementById('uploadRecognitionImageButton');
  const fileInput = document.getElementById('recognitionImageInput');

  if (!uploadButton || !fileInput) return;

  uploadButton.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async event => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    RecognitionState.images = [];

    for (const file of files) {
      const image = await loadRecognitionImage(file);

      RecognitionState.images.push({
        id: generateRecognitionId('img'),
        file,
        image,
        name: file.name,
        categories: [],
        results: []
      });
    }

    RecognitionState.currentImageIndex = 0;
    RecognitionState.currentImage = RecognitionState.images[0];

    renderRecognitionCurrentImage();
    updateRecognitionImageCounter();
    updateRecognitionStatus('Ready for Category Creation');
  });
}

function bindRecognitionControls() {
const previousButton = document.getElementById('previousRecognitionImageButton');
const nextButton = document.getElementById('nextRecognitionImageButton');

if (previousButton) {
  previousButton.addEventListener('click', () => {
    if (RecognitionState.images.length === 0) return;

    RecognitionState.currentImageIndex -= 1;

    if (RecognitionState.currentImageIndex < 0) {
      RecognitionState.currentImageIndex =
        RecognitionState.images.length - 1;
    }

    RecognitionState.currentImage =
      RecognitionState.images[RecognitionState.currentImageIndex];

    renderRecognitionCurrentImage();
    updateRecognitionImageCounter();
  });
}

if (nextButton) {
  nextButton.addEventListener('click', () => {
    if (RecognitionState.images.length === 0) return;

    RecognitionState.currentImageIndex += 1;

    if (
      RecognitionState.currentImageIndex >=
      RecognitionState.images.length
    ) {
      RecognitionState.currentImageIndex = 0;
    }

    RecognitionState.currentImage =
      RecognitionState.images[RecognitionState.currentImageIndex];

    renderRecognitionCurrentImage();
    updateRecognitionImageCounter();
  });
}

  bindRecognitionRangeValue('similarityThreshold', 'similarityThresholdValue');
  bindRecognitionRangeValue('overlapTolerance', 'overlapToleranceValue');
  bindRecognitionRangeValue('colorWeight', 'colorWeightValue');
  bindRecognitionRangeValue('shapeWeight', 'shapeWeightValue');
  bindRecognitionRangeValue('textureWeight', 'textureWeightValue');
}

function bindRecognitionRangeValue(inputId, outputId) {
  const input = document.getElementById(inputId);
  const output = document.getElementById(outputId);

  if (!input || !output) return;

  output.textContent = input.value;

  input.addEventListener('input', () => {
    output.textContent = input.value;
  });
}
function createRecognitionCategory() {
  if (RecognitionState.categories.length >= 3) {
    alert('Maximum 3 categories allowed.');
    return;
  }

  const categoryId = generateRecognitionId('cat');

  const category = {
    id: categoryId,
    name: `Category ${RecognitionState.categories.length + 1}`,
    color: getRecognitionDefaultColor(RecognitionState.categories.length),
    samples: [],
    results: []
  };

  RecognitionState.categories.push(category);
  RecognitionState.selectedCategoryId = categoryId;

  renderRecognitionCategoryList();
  updateRecognitionSummary();
}

function renderRecognitionCategoryList() {
  const container = document.getElementById('recognitionCategoryList');

  if (!container) return;

  if (RecognitionState.categories.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">
        No category created
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  RecognitionState.categories.forEach(category => {
    const card = document.createElement('div');
    card.className = 'recognition-category-card';

    card.innerHTML = `
      <div class="recognition-category-header">
        <div
          class="recognition-category-color"
          style="background:${category.color};"
        ></div>

        <div class="recognition-category-name">
          ${category.name}
        </div>

        <div class="recognition-category-count">
          ${category.samples.length} Samples
        </div>
      </div>

      <input
        type="text"
        class="recognition-category-input"
        value="${category.name}"
        data-category-id="${category.id}"
      >

      <div class="recognition-category-actions">
        <button
          class="recognition-category-button"
          data-action="select"
          data-category-id="${category.id}"
        >
          Select Samples
        </button>

        <button
          class="recognition-category-button delete-button"
          data-action="delete"
          data-category-id="${category.id}"
        >
          Delete
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  bindRecognitionCategoryEvents();
}
function bindRecognitionCategoryEvents() {
  const nameInputs = document.querySelectorAll('.recognition-category-input');

  nameInputs.forEach(input => {
    input.addEventListener('input', event => {
      const categoryId = event.target.dataset.categoryId;

      const category = RecognitionState.categories.find(
        item => item.id === categoryId
      );

      if (!category) return;

      category.name = event.target.value.trim() || 'Unnamed Category';

      renderRecognitionCategoryList();
    });
  });

  const actionButtons = document.querySelectorAll(
    '.recognition-category-button'
  );

  actionButtons.forEach(button => {
    button.addEventListener('click', event => {
      const categoryId = event.target.dataset.categoryId;
      const action = event.target.dataset.action;

      const category = RecognitionState.categories.find(
        item => item.id === categoryId
      );

      if (!category) return;

      if (action === 'select') {
        RecognitionState.selectedCategoryId = categoryId;

        openRecognitionSampleModal(category);
      }

      if (action === 'delete') {
        RecognitionState.categories = RecognitionState.categories.filter(
          item => item.id !== categoryId
        );

        if (RecognitionState.selectedCategoryId === categoryId) {
          RecognitionState.selectedCategoryId = null;
        }

        renderRecognitionCategoryList();
        updateRecognitionSummary();
      }
    });
  });
}

function openRecognitionSampleModal(category) {
  const modal = document.getElementById('recognitionSampleModal');
  const categoryName = document.getElementById('recognitionCurrentCategoryName');

  if (!modal || !categoryName || !RecognitionState.currentImage) return;

  categoryName.textContent = category.name;

  modal.classList.add('active');

  renderRecognitionSampleSelectionCanvas();
  updateRecognitionSampleCount(category.samples.length);
  renderRecognitionSamplePreview(category.samples);
}
function renderRecognitionSampleSelectionCanvas() {
  const canvas = document.getElementById('recognitionSampleSelectionCanvas');
  const context = canvas.getContext('2d');

  const image = RecognitionState.currentImage.image;

  canvas.width = image.width;
  canvas.height = image.height;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);

  const category = RecognitionState.categories.find(
    item => item.id === RecognitionState.selectedCategoryId
  );

  if (category && category.samples.length > 0) {
    category.samples.forEach(sample => {
      context.strokeStyle = category.color;
      context.lineWidth = 2;
      context.strokeRect(
        sample.x,
        sample.y,
        sample.width,
        sample.height
      );
    });
  }

  bindRecognitionSampleCanvasEvents(canvas);
}

function bindRecognitionSampleCanvasEvents(canvas) {
  let isDragging = false;

  canvas.onmousedown = event => {
    const rect = canvas.getBoundingClientRect();

    RecognitionState.selectionStartX = Math.round(
      ((event.clientX - rect.left) / rect.width) * canvas.width
    );

    RecognitionState.selectionStartY = Math.round(
      ((event.clientY - rect.top) / rect.height) * canvas.height
    );

    isDragging = true;
  };

  canvas.onmousemove = event => {
    if (!isDragging) return;

    const rect = canvas.getBoundingClientRect();

    RecognitionState.selectionEndX = Math.round(
      ((event.clientX - rect.left) / rect.width) * canvas.width
    );

    RecognitionState.selectionEndY = Math.round(
      ((event.clientY - rect.top) / rect.height) * canvas.height
    );

    renderRecognitionSelectionPreview(canvas);
  };
    canvas.onmouseup = () => {
    isDragging = false;

    const x = Math.min(
      RecognitionState.selectionStartX,
      RecognitionState.selectionEndX
    );

    const y = Math.min(
      RecognitionState.selectionStartY,
      RecognitionState.selectionEndY
    );

    const width = Math.abs(
      RecognitionState.selectionEndX - RecognitionState.selectionStartX
    );

    const height = Math.abs(
      RecognitionState.selectionEndY - RecognitionState.selectionStartY
    );

    RecognitionState.currentSelectionBox = {
      x,
      y,
      width,
      height
    };
  };
}

function renderRecognitionSelectionPreview(canvas) {
  const context = canvas.getContext('2d');
  const image = RecognitionState.currentImage.image;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);

  const category = RecognitionState.categories.find(
    item => item.id === RecognitionState.selectedCategoryId
  );

  if (category) {
    category.samples.forEach(sample => {
      context.strokeStyle = category.color;
      context.lineWidth = 2;
      context.strokeRect(
        sample.x,
        sample.y,
        sample.width,
        sample.height
      );
    });
  }

  const x = Math.min(
    RecognitionState.selectionStartX,
    RecognitionState.selectionEndX
  );

  const y = Math.min(
    RecognitionState.selectionStartY,
    RecognitionState.selectionEndY
  );

  const width = Math.abs(
    RecognitionState.selectionEndX - RecognitionState.selectionStartX
  );

  const height = Math.abs(
    RecognitionState.selectionEndY - RecognitionState.selectionStartY
  );

  context.strokeStyle = '#49d6ff';
  context.lineWidth = 2;
  context.setLineDash([8, 6]);
  context.strokeRect(x, y, width, height);

  context.fillStyle = 'rgba(73, 214, 255, 0.15)';
  context.fillRect(x, y, width, height);

  context.setLineDash([]);
}
function updateRecognitionSampleCount(count) {
  const element = document.getElementById('recognitionSampleCount');

  if (!element) return;

  element.textContent = `${count} / 10 Samples`;
}

function renderRecognitionSamplePreview(samples) {
  const container = document.getElementById('recognitionSamplePreviewList');

  if (!container) return;

  if (!samples || samples.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">
        No sample selected
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  samples.forEach(sample => {
    const item = document.createElement('div');
    item.className = 'sample-preview-item';

    item.innerHTML = `
      <img src="${sample.preview}" alt="Sample Preview">
    `;

    container.appendChild(item);
  });
}

function bindRecognitionSampleModalButtons() {
  const saveButton = document.getElementById('saveRecognitionSampleButton');
  const clearButton = document.getElementById('clearRecognitionSampleButton');
  const closeButton = document.getElementById('closeRecognitionSampleModalButton');

  if (saveButton) {
    saveButton.addEventListener('click', () => {
      saveRecognitionSample();
    });
  }

  if (clearButton) {
    clearButton.addEventListener('click', () => {
      RecognitionState.currentSelectionBox = null;
      renderRecognitionSampleSelectionCanvas();
    });
  }

  if (closeButton) {
    closeButton.addEventListener('click', () => {
      const modal = document.getElementById('recognitionSampleModal');

      if (modal) {
        modal.classList.remove('active');
      }
    });
  }
}
function saveRecognitionSample() {
  const category = RecognitionState.categories.find(
    item => item.id === RecognitionState.selectedCategoryId
  );

  if (!category) return;

  if (!RecognitionState.currentSelectionBox) {
    alert('Please select an area first.');
    return;
  }

  if (category.samples.length >= 10) {
    alert('Maximum 10 samples allowed.');
    return;
  }

  const box = RecognitionState.currentSelectionBox;
  const image = RecognitionState.currentImage.image;

  const tempCanvas = document.createElement('canvas');
  const tempContext = tempCanvas.getContext('2d');

  tempCanvas.width = box.width;
  tempCanvas.height = box.height;

  tempContext.drawImage(
    image,
    box.x,
    box.y,
    box.width,
    box.height,
    0,
    0,
    box.width,
    box.height
  );

  const preview = tempCanvas.toDataURL('image/png');

  category.samples.push({
    id: generateRecognitionId('sample'),
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    preview
  });

  RecognitionState.currentSelectionBox = null;

  updateRecognitionSampleCount(category.samples.length);
  renderRecognitionSamplePreview(category.samples);
  renderRecognitionSampleSelectionCanvas();
  renderRecognitionCategoryList();
  updateRecognitionSummary();
}
function renderRecognitionCurrentImage() {
  if (!RecognitionState.currentImage) return;

  const image = RecognitionState.currentImage.image;

  const originalCanvas = document.getElementById('recognitionOriginalCanvas');
  const sampleCanvas = document.getElementById('recognitionSampleCanvas');
  const heatmapCanvas = document.getElementById('recognitionHeatmapCanvas');
  const overlayCanvas = document.getElementById('recognitionOverlayCanvas');

  const canvasList = [
    originalCanvas,
    sampleCanvas,
    heatmapCanvas,
    overlayCanvas
  ];

  canvasList.forEach(canvas => {
    if (!canvas) return;

    const context = canvas.getContext('2d');

    canvas.width = image.width;
    canvas.height = image.height;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
  });

  document.getElementById('recognitionCurrentImageName').textContent =
    RecognitionState.currentImage.name;

  updateRecognitionCanvasStatus(
    'recognitionOriginalCanvasStatus',
    'Image Loaded'
  );

  updateRecognitionCanvasStatus(
    'recognitionSampleCanvasStatus',
    'Ready for Sample Selection'
  );

  updateRecognitionCanvasStatus(
    'recognitionHeatmapCanvasStatus',
    'Waiting for Recognition'
  );

  updateRecognitionCanvasStatus(
    'recognitionOverlayCanvasStatus',
    'Waiting for Recognition'
  );
}

function updateRecognitionCanvasStatus(elementId, text) {
  const element = document.getElementById(elementId);

  if (!element) return;

  element.textContent = text;
}
function updateRecognitionImageCounter() {
  const element = document.getElementById('recognitionImageCounter');

  if (!element) return;

  const total = RecognitionState.images.length;
  const current = RecognitionState.currentImageIndex + 1;

  element.textContent = `${current} / ${total} Images`;
}

function updateRecognitionStatus(text) {
  const element = document.getElementById('recognitionStatusChip');

  if (!element) return;

  element.textContent = text;
}

function updateRecognitionSummary() {
  const totalObjects = RecognitionState.results.length;

  const totalCategories = RecognitionState.categories.length;

  const averageConfidence =
    totalObjects === 0
      ? 0
      : RecognitionState.results.reduce(
          (sum, item) => sum + item.confidence,
          0
        ) / totalObjects;

  let dominantCategory = '-';

  if (RecognitionState.categories.length > 0) {
    const sorted = [...RecognitionState.categories].sort(
      (a, b) => b.results.length - a.results.length
    );

    dominantCategory = sorted[0]?.name || '-';
  }

  document.getElementById('recognitionTotalObjects').textContent =
    totalObjects;

  document.getElementById('recognitionTotalCategories').textContent =
    totalCategories;

  document.getElementById('recognitionAverageConfidence').textContent =
    `${Math.round(averageConfidence * 100)}%`;

  document.getElementById('recognitionDominantCategory').textContent =
    dominantCategory;
}
function loadRecognitionImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve(image);
    };

    image.onerror = error => {
      reject(error);
    };

    image.src = URL.createObjectURL(file);
  });
}

function generateRecognitionId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function getRecognitionDefaultColor(index) {
  const colors = [
    '#49d6ff',
    '#7CFF8A',
    '#FFB84D'
  ];

  return colors[index] || '#49d6ff';
}
function runRecognition() {
  if (!RecognitionState.currentImage) {
    alert('Please upload an image first.');
    return;
  }

  if (RecognitionState.categories.length === 0) {
    alert('Please create at least one category.');
    return;
  }

  const invalidCategory = RecognitionState.categories.find(
    category => category.samples.length < 3
  );

  if (invalidCategory) {
    alert(
      `${invalidCategory.name} requires at least 3 samples before recognition can run.`
    );
    return;
  }

  RecognitionState.results = [];

  RecognitionState.categories.forEach(category => {
    const fakeResultCount = Math.floor(Math.random() * 8) + 3;

    category.results = [];

    for (let i = 0; i < fakeResultCount; i++) {
      const result = {
        id: generateRecognitionId('obj'),
        categoryId: category.id,
        categoryName: category.name,
        color: category.color,
        confidence: Number((Math.random() * 0.3 + 0.7).toFixed(2)),
        similarity: Number((Math.random() * 0.3 + 0.7).toFixed(2)),
        area: Math.floor(Math.random() * 5000) + 500,
        width: Math.floor(Math.random() * 80) + 20,
        height: Math.floor(Math.random() * 80) + 20,
        x: Math.floor(Math.random() * 500),
        y: Math.floor(Math.random() * 500)
      };

      category.results.push(result);
      RecognitionState.results.push(result);
    }
  });

  renderRecognitionOverlay();
  renderRecognitionTable();
  renderRecognitionSummary();
  updateRecognitionSummary();
  updateRecognitionStatus('Recognition Complete');
  
bindRecognitionSampleModalButtons();

function renderRecognitionOverlay() {
  const canvas = document.getElementById('recognitionOverlayCanvas');

  if (!canvas || !RecognitionState.currentImage) return;

  const image = RecognitionState.currentImage.image;
  const context = canvas.getContext('2d');

  canvas.width = image.width;
  canvas.height = image.height;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);

  RecognitionState.results.forEach(result => {
    context.strokeStyle = result.color;
    context.lineWidth = 3;

    context.strokeRect(
      result.x,
      result.y,
      result.width,
      result.height
    );

    context.fillStyle = result.color;
    context.fillRect(
      result.x,
      result.y - 24,
      120,
      20
    );

    context.fillStyle = '#041018';
    context.font = '12px Inter';
    context.fillText(
      `${result.categoryName} (${Math.round(result.confidence * 100)}%)`,
      result.x + 6,
      result.y - 10
    );
  });

  updateRecognitionCanvasStatus(
    'recognitionOverlayCanvasStatus',
    `${RecognitionState.results.length} Objects Detected`
  );
}

function renderRecognitionSummary() {
  const container = document.getElementById('recognitionSummaryContainer');

  if (!container) return;

  if (RecognitionState.categories.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">
        No recognition result
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  RecognitionState.categories.forEach(category => {
    const item = document.createElement('div');
    item.className = 'summary-list-item';

    item.innerHTML = `
      <div class="summary-list-label">
        <div
          class="summary-color-dot"
          style="background:${category.color};"
        ></div>

        <span>${category.name}</span>
      </div>

      <div class="summary-list-value">
        <strong>${category.results.length}</strong>
        <p>Detected Objects</p>
      </div>
    `;

    container.appendChild(item);
  });
}
  function renderRecognitionTable() {
  const tableBody = document.getElementById('recognitionResultsTableBody');

  if (!tableBody) return;

  if (RecognitionState.results.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state-small">
            No recognition result
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = '';

  RecognitionState.results.forEach(result => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${result.id}</td>
      <td>
        <span
          class="recognition-result-badge"
          style="background:${result.color};"
        >
          ${result.categoryName}
        </span>
      </td>
      <td>${Math.round(result.confidence * 100)}%</td>
      <td>${Math.round(result.similarity * 100)}%</td>
      <td>${result.area}</td>
      <td>${result.width}</td>
      <td>${result.height}</td>
      <td>${result.x}</td>
      <td>${result.y}</td>
    `;

    tableBody.appendChild(row);
  });
}

function resetRecognition() {
  RecognitionState.results = [];

  RecognitionState.categories.forEach(category => {
    category.results = [];
  });

  renderRecognitionOverlay();
  renderRecognitionTable();
  renderRecognitionSummary();
  updateRecognitionSummary();
  updateRecognitionStatus('Recognition Reset');
}
  
