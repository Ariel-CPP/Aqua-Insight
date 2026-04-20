// ==============================
// DETECTION ENGINE
// Aqua Insight Version 0.1
// ==============================

function runDetectionPipeline(sourceCanvas, settings) {
  const ctx = sourceCanvas.getContext('2d');

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  const imageData = ctx.getImageData(0, 0, width, height);
  const grayscale = extractChannelData(imageData, settings.channelMode);

  const thresholdValue = calculateOtsuThreshold(grayscale);

  let binaryMask = applyThreshold(
    grayscale,
    width,
    height,
    thresholdValue,
    settings.invertThreshold
  );

  binaryMask = morphologicalOpening(binaryMask, width, height);

  const particles = connectedComponentLabeling(binaryMask, width, height);

  return {
    binaryMask,
    thresholdValue,
    particles
  };
}

// ==============================
// CHANNEL EXTRACTION
// ==============================

function extractChannelData(imageData, channelMode) {
  const data = imageData.data;
  const grayscale = new Uint8ClampedArray(data.length / 4);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];

    switch (channelMode) {
      case 'red':
        grayscale[j] = red;
        break;

      case 'green':
        grayscale[j] = green;
        break;

      case 'blue':
        grayscale[j] = blue;
        break;

      case 'grayscale':
      default:
        grayscale[j] = Math.round((red + green + blue) / 3);
        break;
    }
  }

  return grayscale;
}

// ==============================
// OTSU THRESHOLD
// ==============================

function calculateOtsuThreshold(grayscale) {
  const histogram = new Array(256).fill(0);

  for (let i = 0; i < grayscale.length; i++) {
    histogram[grayscale[i]]++;
  }

  const total = grayscale.length;

  let sum = 0;

  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let weightForeground = 0;

  let maxVariance = 0;
  let threshold = 0;

  for (let i = 0; i < 256; i++) {
    weightBackground += histogram[i];

    if (weightBackground === 0) continue;

    weightForeground = total - weightBackground;

    if (weightForeground === 0) break;

    sumBackground += i * histogram[i];

    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;

    const betweenClassVariance =
      weightBackground *
      weightForeground *
      Math.pow(meanBackground - meanForeground, 2);

    if (betweenClassVariance > maxVariance) {
      maxVariance = betweenClassVariance;
      threshold = i;
    }
  }

  return threshold;
}

// ==============================
// THRESHOLD APPLICATION
// ==============================

function applyThreshold(grayscale, width, height, thresholdValue, invert) {
  const binaryMask = new Uint8Array(width * height);

  for (let i = 0; i < grayscale.length; i++) {
    const isForeground = invert
      ? grayscale[i] < thresholdValue
      : grayscale[i] >= thresholdValue;

    binaryMask[i] = isForeground ? 1 : 0;
  }

  return binaryMask;
}

// ==============================
// MORPHOLOGICAL OPENING
// Opening = Erosion + Dilation
// ==============================

function morphologicalOpening(binaryMask, width, height) {
  const eroded = erosion(binaryMask, width, height);
  const dilated = dilation(eroded, width, height);

  return dilated;
}

function erosion(binaryMask, width, height) {
  const output = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let keepPixel = 1;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const index = (y + ky) * width + (x + kx);

          if (binaryMask[index] === 0) {
            keepPixel = 0;
          }
        }
      }

      output[y * width + x] = keepPixel;
    }
  }

  return output;
}

function dilation(binaryMask, width, height) {
  const output = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let fillPixel = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const index = (y + ky) * width + (x + kx);

          if (binaryMask[index] === 1) {
            fillPixel = 1;
          }
        }
      }

      output[y * width + x] = fillPixel;
    }
  }

  return output;
}

// ==============================
// CONNECTED COMPONENT LABELING
// 8-CONNECTIVITY
// ==============================

function connectedComponentLabeling(binaryMask, width, height) {
  const visited = new Uint8Array(width * height);
  const particles = [];

  let particleId = 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;

      if (binaryMask[index] === 1 && visited[index] === 0) {
        const particle = floodFillParticle(
          binaryMask,
          visited,
          width,
          height,
          x,
          y,
          particleId
        );

        particles.push(particle);
        particleId++;
      }
    }
  }

  return particles;
}

function floodFillParticle(binaryMask, visited, width, height, startX, startY, particleId) {
  const stack = [[startX, startY]];
  const pixels = [];

  visited[startY * width + startX] = 1;

  while (stack.length > 0) {
    const [x, y] = stack.pop();

    pixels.push({ x, y });

    for (let ny = y - 1; ny <= y + 1; ny++) {
      for (let nx = x - 1; nx <= x + 1; nx++) {
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < width &&
          ny < height
        ) {
          const neighborIndex = ny * width + nx;

          if (
            binaryMask[neighborIndex] === 1 &&
            visited[neighborIndex] === 0
          ) {
            visited[neighborIndex] = 1;
            stack.push([nx, ny]);
          }
        }
      }
    }
  }

  return {
    id: particleId,
    pixels
  };
}

// ==============================
// BINARY MASK RENDER
// ==============================

function renderBinaryMaskToCanvas(binaryMask, width, height, canvas) {
  const ctx = canvas.getContext('2d');

  canvas.width = width;
  canvas.height = height;

  const imageData = ctx.createImageData(width, height);

  for (let i = 0; i < binaryMask.length; i++) {
    const value = binaryMask[i] === 1 ? 255 : 0;

    imageData.data[i * 4] = value;
    imageData.data[i * 4 + 1] = value;
    imageData.data[i * 4 + 2] = value;
    imageData.data[i * 4 + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
}
