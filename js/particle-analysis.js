const ParticleAnalysis = (() => {
  function calculateParticleArea(particle) {
    return particle.pixels.length;
  }

  function calculateParticlePerimeter(particle, width, height) {
    const pixelSet = new Set(
      particle.pixels.map(pixel => `${pixel.x},${pixel.y}`)
    );

    let perimeter = 0;

    const directions = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0]
    ];

    particle.pixels.forEach(pixel => {
      directions.forEach(([dx, dy]) => {
        const nx = pixel.x + dx;
        const ny = pixel.y + dy;

        const isOutside =
          nx < 0 ||
          ny < 0 ||
          nx >= width ||
          ny >= height;

        const isEmptyNeighbor =
          !pixelSet.has(`${nx},${ny}`);

        if (isOutside || isEmptyNeighbor) {
          perimeter++;
        }
      });
    });

    return perimeter;
  }

  function calculateCircularity(area, perimeter) {
    if (perimeter <= 0) {
      return 0;
    }

    return Utils.roundTo(
      (4 * Math.PI * area) / (perimeter * perimeter),
      2
    );
  }

  function calculateCentroid(particle) {
    let totalX = 0;
    let totalY = 0;

    particle.pixels.forEach(pixel => {
      totalX += pixel.x;
      totalY += pixel.y;
    });

    return {
      x: Utils.roundTo(totalX / particle.pixels.length, 2),
      y: Utils.roundTo(totalY / particle.pixels.length, 2)
    };
  }

  function touchesImageEdge(particle, width, height) {
    return particle.pixels.some(pixel => {
      return (
        pixel.x === 0 ||
        pixel.y === 0 ||
        pixel.x === width - 1 ||
        pixel.y === height - 1
      );
    });
  }

  function extractParticleRgbValues(particle, originalImageData) {
    const pixels = [];

    particle.pixels.forEach(pixel => {
      const rgbaIndex = (pixel.y * originalImageData.width + pixel.x) * 4;

      pixels.push({
        r: originalImageData.data[rgbaIndex],
        g: originalImageData.data[rgbaIndex + 1],
        b: originalImageData.data[rgbaIndex + 2]
      });
    });

    return pixels;
  }

  function createParticlePolygon(particle) {
    const points = particle.pixels.map(pixel => ({
      x: pixel.x,
      y: pixel.y
    }));

    const boundingBox = Utils.getBoundingBox(points);

    if (!boundingBox) {
      return [];
    }

    return [
      { x: boundingBox.minX, y: boundingBox.minY },
      { x: boundingBox.maxX, y: boundingBox.minY },
      { x: boundingBox.maxX, y: boundingBox.maxY },
      { x: boundingBox.minX, y: boundingBox.maxY }
    ];
  }

  function calculateParticleCoverage(area, totalNonBackgroundArea) {
    return Utils.roundTo(
      Utils.calculateCoveragePercent(area, totalNonBackgroundArea),
      2
    );
  }

  function classifyParticleByIntensity(meanRgb) {
    const intensity = Utils.getRgbIntensity(
      meanRgb.r,
      meanRgb.g,
      meanRgb.b
    );

    if (intensity >= 200) {
      return {
        name: 'Very Light',
        color: '#d8b38a'
      };
    }

    if (intensity >= 150) {
      return {
        name: 'Light Brown',
        color: '#b8845f'
      };
    }

    if (intensity >= 100) {
      return {
        name: 'Medium Brown',
        color: '#8d5f42'
      };
    }

    if (intensity >= 50) {
      return {
        name: 'Dark Brown',
        color: '#5a3b29'
      };
    }

    return {
      name: 'Very Dark',
      color: '#1d1d1d'
    };
  }

  function classifyParticleByColorCluster(meanRgb) {
    const { r, g, b } = meanRgb;

    if (r > g && r > b) {
      return {
        name: 'Red Dominant',
        color: '#d95c5c'
      };
    }

    if (g > r && g > b) {
      return {
        name: 'Green Dominant',
        color: '#4caf7a'
      };
    }

    if (b > r && b > g) {
      return {
        name: 'Blue Dominant',
        color: '#5a8dee'
      };
    }

    if (r > 150 && g > 100 && b < 100) {
      return {
        name: 'Brown Dominant',
        color: '#8d5f42'
      };
    }

    return {
      name: 'Mixed Tone',
      color: '#8f8f8f'
    };
  }

  function detectClassificationMode(particles) {
    if (!particles.length) {
      return 'intensity';
    }

    let totalVariance = 0;

    particles.forEach(particle => {
      const mean = (
        particle.meanR +
        particle.meanG +
        particle.meanB
      ) / 3;

      const variance =
        Math.abs(particle.meanR - mean) +
        Math.abs(particle.meanG - mean) +
        Math.abs(particle.meanB - mean);

      totalVariance += variance;
    });

    const averageVariance = totalVariance / particles.length;

    return averageVariance > 45
      ? 'color-cluster'
      : 'intensity';
  }

  function analyzeParticles(
    labeledResult,
    originalImageData,
    totalNonBackgroundArea,
    classificationMode = 'auto'
  ) {
    const analyzedParticles = [];

    labeledResult.particles.forEach((particle, index) => {
      const area = calculateParticleArea(particle);
      const perimeter = calculateParticlePerimeter(
        particle,
        labeledResult.width,
        labeledResult.height
      );

      const circularity = calculateCircularity(area, perimeter);
      const centroid = calculateCentroid(particle);
      const polygon = createParticlePolygon(particle);
      const touchesEdge = touchesImageEdge(
        particle,
        labeledResult.width,
        labeledResult.height
      );

      const rgbPixels = extractParticleRgbValues(
        particle,
        originalImageData
      );

      const meanRgb = Utils.getMeanRgb(rgbPixels);
      const coverageArea = calculateParticleCoverage(
        area,
        totalNonBackgroundArea
      );

      analyzedParticles.push({
        id: index + 1,
        label: particle.label,
        area,
        perimeter,
        circularity,
        centroid,
        polygon,
        touchesEdge,
        meanR: meanRgb.r,
        meanG: meanRgb.g,
        meanB: meanRgb.b,
        coverageArea
      });
    });

    const finalMode =
      classificationMode === 'auto'
        ? detectClassificationMode(analyzedParticles)
        : classificationMode;

    analyzedParticles.forEach(particle => {
      const classification =
        finalMode === 'color-cluster'
          ? classifyParticleByColorCluster({
              r: particle.meanR,
              g: particle.meanG,
              b: particle.meanB
            })
          : classifyParticleByIntensity({
              r: particle.meanR,
              g: particle.meanG,
              b: particle.meanB
            });

      particle.className = classification.name;
      particle.classColor = classification.color;
    });

    return {
      classificationMode: finalMode,
      particles: analyzedParticles
    };
  }

  function generateClassificationSummary(particles) {
    const summaryMap = {};

    particles.forEach(particle => {
      const key = particle.className;

      if (!summaryMap[key]) {
        summaryMap[key] = {
          name: particle.className,
          color: particle.classColor,
          count: 0,
          coverage: 0
        };
      }

      summaryMap[key].count += 1;
      summaryMap[key].coverage += particle.coverageArea;
    });

    return Object.values(summaryMap).map(item => ({
      ...item,
      coverage: Utils.roundTo(item.coverage, 2)
    }));
  }

  function calculateTotalCoverage(particles) {
    const totalCoverage = particles.reduce((sum, particle) => {
      return sum + particle.coverageArea;
    }, 0);

    return Utils.roundTo(totalCoverage, 2);
  }

  function renderParticleOverlay(
    canvas,
    image,
    particles,
    highlightedParticleId = null
  ) {
    const context = canvas.getContext('2d');

    canvas.width = image.width;
    canvas.height = image.height;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);

    particles.forEach(particle => {
      const isHighlighted =
        String(particle.id) === String(highlightedParticleId);

      context.beginPath();

      particle.polygon.forEach((point, index) => {
        if (index === 0) {
          context.moveTo(point.x, point.y);
        } else {
          context.lineTo(point.x, point.y);
        }
      });

      context.closePath();

      context.fillStyle = isHighlighted
        ? 'rgba(255, 184, 77, 0.28)'
        : 'rgba(73, 214, 255, 0.18)';

      context.strokeStyle = isHighlighted
        ? '#ffb84d'
        : '#49d6ff';

      context.lineWidth = isHighlighted ? 3 : 1.5;

      context.fill();
      context.stroke();

      context.fillStyle = isHighlighted
        ? '#ffb84d'
        : '#49d6ff';

      context.font = 'bold 12px Inter';
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      context.fillText(
        particle.id,
        particle.centroid.x,
        particle.centroid.y
      );
    });
  }

  return {
    calculateParticleArea,
    calculateParticlePerimeter,
    calculateCircularity,
    calculateCentroid,
    touchesImageEdge,
    extractParticleRgbValues,
    createParticlePolygon,
    calculateParticleCoverage,
    classifyParticleByIntensity,
    classifyParticleByColorCluster,
    detectClassificationMode,
    analyzeParticles,
    generateClassificationSummary,
    calculateTotalCoverage,
    renderParticleOverlay
  };
})();
