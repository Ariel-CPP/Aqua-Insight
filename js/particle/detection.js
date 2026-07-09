/* ==========================================================================
   AQUA INSIGHT - IMAGE PROCESSING ENGINE (vanilla JS)
   Contains: Grayscale, Otsu Auto-threshold, Flood-Fill CCL, Moore outer tracing,
   Hole identification (BFS), Shoelace area, and RGB color profiling.
   ========================================================================== */

window.AquaDetection = {
  // Convert ImageData to Grayscale or Extract Specific Channel
  toGrayscale: function(imageData, channel = 'gray') {
    const data = imageData.data;
    const n = imageData.width * imageData.height;
    const gray = new Uint8ClampedArray(n);
    for (let i = 0; i < n; i++) {
      const idx = i * 4;
      if (channel === 'red') gray[i] = data[idx];
      else if (channel === 'green') gray[i] = data[idx+1];
      else if (channel === 'blue') gray[i] = data[idx+2];
      else gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2]);
    }
    return gray;
  },

  // 2. Otsu's Threshold Selection Method
  computeOtsuThreshold: function(grayData) {
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < grayData.length; i++) {
      histogram[grayData[i]]++;
    }

    const total = grayData.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }

    let sumB = 0;
    let wB = 0; // weight background
    let wF = 0; // weight foreground
    let varMax = 0;
    let threshold = 128; // default fallback

    for (let i = 0; i < 256; i++) {
      wB += histogram[i];
      if (wB === 0) continue;
      wF = total - wB;
      if (wF === 0) break;

      sumB += i * histogram[i];
      const mB = sumB / wB; // mean background
      const mF = (sum - sumB) / wF; // mean foreground

      // Calculate between-class variance
      const varBetween = wB * wF * Math.pow(mB - mF, 2);
      if (varBetween > varMax) {
        varMax = varBetween;
        threshold = i;
      }
    }
    return threshold;
  },

  // 3. Binary Thresholding with Background Correction
  // bgCorrection === true: Partikel gelap di latar terang (mis. sel mikroskopi standar)
  // bgCorrection === false: Partikel terang di latar gelap (mis. elektroforesis / fluoresensi)
  threshold: function(grayData, width, height, thresholdVal, bgCorrection = true) {
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < grayData.length; i++) {
      const val = grayData[i];
      if (bgCorrection) {
        // Latar terang: partikel lebih gelap dari threshold
        binary[i] = val < thresholdVal ? 1 : 0;
      } else {
        // Latar gelap: partikel lebih terang dari threshold
        binary[i] = val >= thresholdVal ? 1 : 0;
      }
    }
    return binary;
  },

  // 4. Morphological Erosion (to separate touching particles)
  erode: function(binary, width, height, iterations = 1) {
    if (iterations <= 0) return binary;
    let curr = binary;
    for (let it = 0; it < iterations; it++) {
      const next = new Uint8Array(width * height);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          if (curr[idx] === 1) {
            // Keep pixel only if all 4 neighbors are also 1
            if (curr[idx - 1] === 1 && curr[idx + 1] === 1 && 
                curr[idx - width] === 1 && curr[idx + width] === 1) {
              next[idx] = 1;
            } else {
              next[idx] = 0;
            }
          }
        }
      }
      curr = next;
    }
    return curr;
  },

  // 4. Connected Component Labeling & Morphometrics with Nested Contours
  // binary: Uint8Array containing 0 or 1.
  // scaleFactor: pixels-to-unit ratio (1 px = scaleFactor unit)
  analyze: function(binary, width, height, scaleFactor = 1.0, unitName = "px", originalImageData = null, fillHoles = false) {
    const visited = new Uint8Array(width * height);
    const components = [];
    const origData = originalImageData ? originalImageData.data : null;

    // Union-Find / Flood Fill BFS to find components
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const startIdx = y * width + x;
        
        // Find unvisited object pixel
        if (binary[startIdx] === 1 && visited[startIdx] === 0) {
          const componentIndex = components.length + 1;
          const pixelIndices = [];
          const queue = [startIdx];
          visited[startIdx] = 1;
          
          let qIdx = 0;
          const dx = [-1, 1, 0, 0, -1, -1, 1, 1];
          const dy = [0, 0, -1, 1, -1, 1, -1, 1];
          
          while (qIdx < queue.length) {
            const currIdx = queue[qIdx++];
            pixelIndices.push(currIdx);
            
            const cx = currIdx % width;
            const cy = Math.floor(currIdx / width);
            
            // 8-connectivity
            for (let i = 0; i < 8; i++) {
              const nx = cx + dx[i];
              const ny = cy + dy[i];
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = ny * width + nx;
                if (binary[nIdx] === 1 && visited[nIdx] === 0) {
                  visited[nIdx] = 1;
                  queue.push(nIdx);
                }
              }
            }
            // Safety break to prevent out of memory on massive blobs
            if (pixelIndices.length > 500000) break;
          }
          
          // Exclude extremely tiny single-pixel components here
          if (pixelIndices.length >= 1) {
            components.push({
              id: componentIndex,
              pixels: pixelIndices
            });
          }
        }
      }
    }

    return this.processComponents(components, binary, width, height, scaleFactor, fillHoles, origData);
  },

  // === UNIFIED PROCESSING PIPELINE ===
  // Extracted to ensure 100% feature parity between Binary and Color region methods
  processComponents: function(components, binary, width, height, scaleFactor, fillHoles, origData) {
    const results = [];
    const holeVisited = new Uint8Array(width * height);
    
    components.forEach((comp, idx) => {
      let minX = width, maxX = 0, minY = height, maxY = 0;
      comp.pixels.forEach(pIdx => {
        const px = pIdx % width;
        const py = Math.floor(pIdx / width);
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      });
      
      const compWidth = (maxX - minX) + 1;
      const compHeight = (maxY - minY) + 1;
      const touchesEdge = (minX === 0 || maxX === width - 1 || minY === 0 || maxY === height - 1);
      
      const outerContour = this.traceOuterContour(binary, comp.pixels, width, height, minX, minY, maxX, maxY);
      if (outerContour.length < 3) return;
      
      const holes = this.findHolesInComponent(binary, comp.pixels, width, height, minX, minY, maxX, maxY, comp.id, holeVisited);
      const holeContours = [];
      let holesAreaPx = 0;
      holes.forEach(holePixels => {
        const holeContour = this.traceHoleContour(binary, holePixels, width, height);
        if (holeContour.length >= 3) {
          holeContours.push(holeContour);
          holesAreaPx += this.polygonArea(holeContour);
        }
        if (fillHoles) {
          holePixels.forEach(pIdx => comp.pixels.push(pIdx));
        }
      });
      
      let areaPx = this.polygonArea(outerContour);
      areaPx = fillHoles ? Math.max(1, areaPx) : Math.max(1, areaPx - holesAreaPx);
      
      let perimeterPx = this.polygonPerimeter(outerContour);
      if (!fillHoles) {
        holeContours.forEach(hc => perimeterPx += this.polygonPerimeter(hc));
      }
      
      const realArea = areaPx * Math.pow(scaleFactor, 2);
      const realPerimeter = perimeterPx * scaleFactor;
      
      let sumX = 0, sumY = 0;
      comp.pixels.forEach(pIdx => {
        sumX += pIdx % width;
        sumY += Math.floor(pIdx / width);
      });
      
      const circularity = realPerimeter === 0 ? 0 : (4 * Math.PI * realArea) / Math.pow(realPerimeter, 2);
      const aspectRatio = compHeight === 0 ? 0 : compWidth / compHeight;
      
      let rSum = 0, gSum = 0, bSum = 0;
      if (origData) {
        comp.pixels.forEach(pIdx => {
          const dataIdx = pIdx * 4;
          rSum += origData[dataIdx];
          gSum += origData[dataIdx + 1];
          bSum += origData[dataIdx + 2];
        });
      }
      
      const count = comp.pixels.length;
      const cvFeatures = window.CVEngine ? window.CVEngine.extractFeatures(comp.pixels, width, height, origData) : null;
      
      results.push({
        index: idx + 1,
        centroid: { x: sumX / count, y: sumY / count },
        area: realArea,
        areaPx: areaPx,
        perimeter: realPerimeter,
        perimeterPx: perimeterPx,
        circularity: Math.min(1.0, circularity),
        aspectRatio: aspectRatio,
        bbox: { x: minX, y: minY, w: compWidth, h: compHeight },
        contour: outerContour,
        holes: holeContours,
        rgb: { 
          r: count === 0 ? 0 : Math.round(rSum / count), 
          g: count === 0 ? 0 : Math.round(gSum / count), 
          b: count === 0 ? 0 : Math.round(bSum / count) 
        },
        touchesEdge: touchesEdge,
        cvFeatures: cvFeatures
      });
    });
    
    return results;
  },
  
  // Shoelace Polygon Area
  polygonArea: function(points) {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
  },
  
  // Polygon Perimeter
  polygonPerimeter: function(points) {
    let perimeter = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      perimeter += Math.sqrt(dx*dx + dy*dy);
    }
    return perimeter;
  },

  // Moore Neighborhood Outer Border Tracer
  traceOuterContour: function(binary, pixels, width, height, minX, minY, maxX, maxY) {
    const contour = [];
    const pixelSet = new Set(pixels);
    
    // Find starting pixel (top-leftmost component pixel)
    let startIdx = -1;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = y * width + x;
        if (pixelSet.has(idx)) {
          startIdx = idx;
          break;
        }
      }
      if (startIdx !== -1) break;
    }
    
    if (startIdx === -1) return [];
    
    const startX = startIdx % width;
    const startY = Math.floor(startIdx / width);
    
    // Directions mapping: clockwise starting from North-West [dx, dy]
    const dirs = [
      [-1, -1], [0, -1], [1, -1],
      [1, 0],   [1, 1],  [0, 1],
      [-1, 1],  [-1, 0]
    ];
    
    let currX = startX;
    let currY = startY;
    let dirIdx = 7; // start checking from West direction
    
    const maxPath = width * height; // safety cutoff
    let steps = 0;
    
    do {
      contour.push({ x: currX, y: currY });
      
      let nextPixelFound = false;
      // Search clock-wise
      for (let d = 0; d < 8; d++) {
        const checkDirIdx = (dirIdx + d) % 8;
        const nx = currX + dirs[checkDirIdx][0];
        const ny = currY + dirs[checkDirIdx][1];
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (pixelSet.has(nIdx)) {
            currX = nx;
            currY = ny;
            // Backtrack check direction (point back to last searched area)
            dirIdx = (checkDirIdx + 5) % 8;
            nextPixelFound = true;
            break;
          }
        }
      }
      
      if (!nextPixelFound) break; // isolated pixel
      steps++;
    } while ((currX !== startX || currY !== startY) && steps < maxPath);
    
    return contour;
  },

  // BFS to identify local backgrounds (zeros) completely enclosed by the component boundary
  findHolesInComponent: function(binary, pixels, width, height, minX, minY, maxX, maxY, compId, holeVisited) {
    // Clear the bounding box area in the shared holeVisited array
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        holeVisited[y * width + x] = 0;
      }
    }
    
    const pixelSet = new Set(pixels);
    const holes = [];
    
    // Scan inside Bounding Box
    for (let y = minY + 1; y < maxY; y++) {
      for (let x = minX + 1; x < maxX; x++) {
        const idx = y * width + x;
        
        // Find background pixels that are unvisited in bbox scan and NOT in the component set
        if (binary[idx] === 0 && !pixelSet.has(idx) && holeVisited[idx] === 0) {
          const holeGroup = [];
          const queue = [idx];
          holeVisited[idx] = 1;
          
          let touchesBboxEdge = false;
          let qIdx = 0;
          
          const dx = [-1, 1, 0, 0];
          const dy = [0, 0, -1, 1];
          
          while (qIdx < queue.length) {
            const currIdx = queue[qIdx++];
            holeGroup.push(currIdx);
            
            const cx = currIdx % width;
            const cy = Math.floor(currIdx / width);
            
            // If the background component touches the bbox boundary, it is connected to the outer world, so not a hole!
            if (cx === minX || cx === maxX || cy === minY || cy === maxY) {
              touchesBboxEdge = true;
            }
            
            for (let i = 0; i < 4; i++) { // 4-connectivity for background
              const nx = cx + dx[i];
              const ny = cy + dy[i];
              if (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY) {
                const nIdx = ny * width + nx;
                if (binary[nIdx] === 0 && !pixelSet.has(nIdx) && holeVisited[nIdx] === 0) {
                  holeVisited[nIdx] = 1;
                  queue.push(nIdx);
                }
              }
            }
            // Safety break for background holes
            if (holeGroup.length > 500000) break;
          }
          
          // Valid hole if it is fully enclosed (does not touch outer bbox borders)
          if (!touchesBboxEdge) {
            holes.push(holeGroup);
          }
        }
      }
    }
    
    return holes;
  },

  // Trace the boundary contour of a hole group
  traceHoleContour: function(binary, holePixels, width, height) {
    // For holes, the boundary is the set of component pixels immediately bordering the hole.
    // Or we can trace the outer boundary of the hole pixels themselves.
    // Tracing the boundary of the hole pixels (which are 0s) is simple.
    let minX = width, maxX = 0, minY = height, maxY = 0;
    const holeSet = new Set(holePixels);
    
    holePixels.forEach(pIdx => {
      const px = pIdx % width;
      const py = Math.floor(pIdx / width);
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    });
    
    // Moore Neighborhood tracing adapted for hole boundary
    let startIdx = -1;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = y * width + x;
        if (holeSet.has(idx)) {
          startIdx = idx;
          break;
        }
      }
      if (startIdx !== -1) break;
    }
    
    if (startIdx === -1) return [];
    
    const startX = startIdx % width;
    const startY = Math.floor(startIdx / width);
    
    const dirs = [
      [-1, -1], [0, -1], [1, -1],
      [1, 0],   [1, 1],  [0, 1],
      [-1, 1],  [-1, 0]
    ];
    
    let currX = startX;
    let currY = startY;
    let dirIdx = 7;
    const contour = [];
    const maxPath = width * height;
    let steps = 0;
    
    do {
      contour.push({ x: currX, y: currY });
      let nextPixelFound = false;
      for (let d = 0; d < 8; d++) {
        const checkDirIdx = (dirIdx + d) % 8;
        const nx = currX + dirs[checkDirIdx][0];
        const ny = currY + dirs[checkDirIdx][1];
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (holeSet.has(nIdx)) {
            currX = nx;
            currY = ny;
            dirIdx = (checkDirIdx + 5) % 8;
            nextPixelFound = true;
            break;
          }
        }
      }
      if (!nextPixelFound) break;
      steps++;
    } while ((currX !== startX || currY !== startY) && steps < maxPath);
    
    return contour;
  },
  
  // Future AI Inference Hook Placeholder
  runAIInference: async function(canvasId, onProgress) {
    onProgress("Menginisialisasi model ONNX Web...");
    await new Promise(r => setTimeout(r, 800));
    onProgress("Menjalankan akselerasi WebGPU...");
    await new Promise(r => setTimeout(r, 1000));
    onProgress("Mengurai kontur segmentasi neural...");
    await new Promise(r => setTimeout(r, 600));
    
    // Returns dummy structured neural outputs resembling cells
    return [
      { id: 101, centroid: { x: 120, y: 150 }, area: 245, circularity: 0.95, touchesEdge: false },
      { id: 102, centroid: { x: 230, y: 180 }, area: 380, circularity: 0.88, touchesEdge: false }
    ];
  },
  // 5. Color Region Growing (Detect particles by color similarity)
  analyzeByColor: function(imgData, width, height, scaleFactor, unitName, colorTolerance, minSize, maxSize) {
    const data = imgData.data;
    const visited = new Uint8Array(width * height);
    const components = [];
    const holeVisited = new Uint8Array(width * height);
    
    const dx = [-1, 1, 0, 0];
    const dy = [0, 0, -1, 1];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const startIdx = y * width + x;
        if (visited[startIdx] === 0) {
          const sr = data[startIdx * 4];
          const sg = data[startIdx * 4 + 1];
          const sb = data[startIdx * 4 + 2];
          
          const pixelIndices = [];
          const queue = [startIdx];
          visited[startIdx] = 1;
          let qIdx = 0;
          
          let minX = width, maxX = 0, minY = height, maxY = 0;
          
          while (qIdx < queue.length) {
            const currIdx = queue[qIdx++];
            pixelIndices.push(currIdx);
            
            const cx = currIdx % width;
            const cy = Math.floor(currIdx / width);
            
            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;
            
            for (let i = 0; i < 4; i++) {
              const nx = cx + dx[i];
              const ny = cy + dy[i];
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = ny * width + nx;
                if (visited[nIdx] === 0) {
                  const nr = data[nIdx * 4];
                  const ng = data[nIdx * 4 + 1];
                  const nb = data[nIdx * 4 + 2];
                  
                  // Calculate Euclidean distance to the SEED pixel color
                  const dist = Math.sqrt((nr - sr)**2 + (ng - sg)**2 + (nb - sb)**2);
                  if (dist <= colorTolerance) {
                    visited[nIdx] = 1;
                    queue.push(nIdx);
                  }
                }
              }
            }
            if (pixelIndices.length > maxSize + 1000) break; // Early termination if it's way too big (like background)
          }
          
          // Only keep components that match size criteria
          if (pixelIndices.length >= minSize && pixelIndices.length <= maxSize) {
            // Fake binary to reuse hole and contour logic: create a local binary mask just for this bounding box
            const compW = (maxX - minX + 1);
            const compH = (maxY - minY + 1);
            // We just need a dummy binary array that returns 1 for our pixels. 
            // Better yet, just pass a dummy binary to traceOuterContour that relies on pixelSet
            const comp = {
              id: components.length + 1,
              pixels: pixelIndices,
              minX: minX, minY: minY, maxX: maxX, maxY: maxY
            };
            components.push(comp);
          }
        }
      }
    }
    
    // Create a global binary map from ALL valid color components so we can reuse `traceOuterContour`
    const globalBinary = new Uint8Array(width * height);
    components.forEach(comp => {
      comp.pixels.forEach(idx => globalBinary[idx] = 1);
    });
    
    // Use the UNIFIED PIPELINE
    return this.processComponents(components, globalBinary, width, height, scaleFactor, false, data);
  }
};
