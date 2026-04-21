const Utils = (() => {
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function roundTo(value, decimals = 2) {
    if (isNaN(value)) return 0;
    return Number(value.toFixed(decimals));
  }

  function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) {
      return '-';
    }

    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function formatPercent(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) {
      return '-';
    }

    return `${roundTo(value, decimals)}%`;
  }

  function debounce(callback, delay = 300) {
    let timeoutId;

    return (...args) => {
      clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        callback(...args);
      }, delay);
    };
  }

  function generateId(prefix = 'id') {
    const randomPart = Math.random().toString(36).substring(2, 8);
    const timePart = Date.now().toString(36);

    return `${prefix}-${timePart}-${randomPart}`;
  }

  function getFileNameWithoutExtension(fileName) {
    if (!fileName) return '';

    const lastDotIndex = fileName.lastIndexOf('.');

    if (lastDotIndex === -1) {
      return fileName;
    }

    return fileName.substring(0, lastDotIndex);
  }

  function getImageDimensions(image) {
    return {
      width: image.width,
      height: image.height
    };
  }

  function calculateImageArea(width, height) {
    return width * height;
  }

  function calculateCoveragePercent(area, totalArea) {
    if (!totalArea || totalArea <= 0) {
      return 0;
    }

    return (area / totalArea) * 100;
  }

  function rgbToString(r, g, b) {
    return `rgb(${r}, ${g}, ${b})`;
  }

  function rgbToHex(r, g, b) {
    const red = clamp(r, 0, 255).toString(16).padStart(2, '0');
    const green = clamp(g, 0, 255).toString(16).padStart(2, '0');
    const blue = clamp(b, 0, 255).toString(16).padStart(2, '0');

    return `#${red}${green}${blue}`;
  }

  function getMeanRgb(pixels) {
    if (!pixels || pixels.length === 0) {
      return { r: 0, g: 0, b: 0 };
    }

    let totalR = 0;
    let totalG = 0;
    let totalB = 0;

    pixels.forEach(pixel => {
      totalR += pixel.r;
      totalG += pixel.g;
      totalB += pixel.b;
    });

    return {
      r: roundTo(totalR / pixels.length, 2),
      g: roundTo(totalG / pixels.length, 2),
      b: roundTo(totalB / pixels.length, 2)
    };
  }

  function getRgbIntensity(r, g, b) {
    return roundTo((r + g + b) / 3, 2);
  }

  function calculateDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    return Math.sqrt((dx * dx) + (dy * dy));
  }

  function createOffscreenCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    return canvas;
  }

  function clearCanvas(canvas, context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawCenteredImage(context, image, canvasWidth, canvasHeight) {
    const scale = Math.min(
      canvasWidth / image.width,
      canvasHeight / image.height
    );

    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;

    const offsetX = (canvasWidth - drawWidth) / 2;
    const offsetY = (canvasHeight - drawHeight) / 2;

    context.drawImage(
      image,
      offsetX,
      offsetY,
      drawWidth,
      drawHeight
    );

    return {
      scale,
      offsetX,
      offsetY,
      drawWidth,
      drawHeight
    };
  }

         function resizeImageToMaxSide(image, maxSide = 1000) {
    const originalWidth = image.width;
    const originalHeight = image.height;

    const longestSide = Math.max(originalWidth, originalHeight);

    if (longestSide <= maxSide) {
      return {
        width: originalWidth,
        height: originalHeight,
        scale: 1
      };
    }

    const scale = maxSide / longestSide;

    return {
      width: Math.round(originalWidth * scale),
      height: Math.round(originalHeight * scale),
      scale
    };
  }

  function imageToCanvas(image, maxSide = 1000) {
    const resized = resizeImageToMaxSide(image, maxSide);

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = resized.width;
    canvas.height = resized.height;

    context.drawImage(image, 0, 0, resized.width, resized.height);

    return {
      canvas,
      context,
      width: resized.width,
      height: resized.height,
      scale: resized.scale
    };
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = event => {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = event.target.result;
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    URL.revokeObjectURL(url);
  }

  function downloadCanvasAsPng(canvas, fileName = 'overlay.png') {
    canvas.toBlob(blob => {
      if (blob) {
        downloadBlob(blob, fileName);
      }
    }, 'image/png');
  }

  function sortArrayByKey(array, key, direction = 'asc') {
    const sorted = [...array];

    sorted.sort((a, b) => {
      const valueA = a[key];
      const valueB = b[key];

      if (typeof valueA === 'string') {
        return direction === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }

      return direction === 'asc'
        ? valueA - valueB
        : valueB - valueA;
    });

    return sorted;
  }

  function filterParticles(particles, keyword) {
    if (!keyword) {
      return particles;
    }

    const search = keyword.toLowerCase();

    return particles.filter(particle => {
      return (
        String(particle.id).toLowerCase().includes(search) ||
        String(particle.className || '').toLowerCase().includes(search)
      );
    });
  }

  function getBoundingBox(points) {
    if (!points || points.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    points.forEach(point => {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    });

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  function getPolygonCentroid(points) {
    if (!points || points.length === 0) {
      return { x: 0, y: 0 };
    }

    let totalX = 0;
    let totalY = 0;

    points.forEach(point => {
      totalX += point.x;
      totalY += point.y;
    });

    return {
      x: roundTo(totalX / points.length, 2),
      y: roundTo(totalY / points.length, 2)
    };
  }

          function getMinMaxRgbRange(points) {
    if (!points || points.length === 0) {
      return null;
    }

    const range = {
      minR: 255,
      maxR: 0,
      minG: 255,
      maxG: 0,
      minB: 255,
      maxB: 0
    };

    points.forEach(point => {
      if (point.r < range.minR) range.minR = point.r;
      if (point.r > range.maxR) range.maxR = point.r;

      if (point.g < range.minG) range.minG = point.g;
      if (point.g > range.maxG) range.maxG = point.g;

      if (point.b < range.minB) range.minB = point.b;
      if (point.b > range.maxB) range.maxB = point.b;
    });

    return range;
  }

  function isPixelInsideRgbRange(pixel, range) {
    return (
      pixel.r >= range.minR &&
      pixel.r <= range.maxR &&
      pixel.g >= range.minG &&
      pixel.g <= range.maxG &&
      pixel.b >= range.minB &&
      pixel.b <= range.maxB
    );
  }

  function getPixelFromImageData(imageData, x, y) {
    const index = (y * imageData.width + x) * 4;
    const data = imageData.data;

    return {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      a: data[index + 3]
    };
  }

  function setPixelToImageData(imageData, x, y, r, g, b, a = 255) {
    const index = (y * imageData.width + x) * 4;
    const data = imageData.data;

    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = a;
  }

  function create2DArray(width, height, fillValue = 0) {
    return Array.from({ length: height }, () =>
      Array(width).fill(fillValue)
    );
  }

  function isInsideBounds(x, y, width, height) {
    return (
      x >= 0 &&
      y >= 0 &&
      x < width &&
      y < height
    );
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  return {
    clamp,
    roundTo,
    formatNumber,
    formatPercent,
    debounce,
    generateId,
    getFileNameWithoutExtension,
    getImageDimensions,
    calculateImageArea,
    calculateCoveragePercent,
    rgbToString,
    rgbToHex,
    getMeanRgb,
    getRgbIntensity,
    calculateDistance,
    createOffscreenCanvas,
    clearCanvas,
    drawCenteredImage,
    resizeImageToMaxSide,
    imageToCanvas,
    loadImageFromFile,
    downloadBlob,
    downloadCanvasAsPng,
    sortArrayByKey,
    filterParticles,
    getBoundingBox,
    getPolygonCentroid,
    getMinMaxRgbRange,
    isPixelInsideRgbRange,
    getPixelFromImageData,
    setPixelToImageData,
    create2DArray,
    isInsideBounds,
    sleep
  };
})();

