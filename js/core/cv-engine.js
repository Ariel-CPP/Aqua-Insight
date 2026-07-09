/* =========================================================
   Computer Vision Engine (CV Engine) - Aqua Insight
   Menyediakan fungsi matematika untuk ekstraksi fitur citra:
   Bentuk, Momen, Warna, Tekstur (GLCM) secara Scale-Invariant.
   ========================================================= */

window.CVEngine = {

  /**
   * Mengekstrak seluruh metrik Computer Vision dari sekumpulan piksel
   * @param {Array} pixels - Array of 1D pixel indices `(y * width + x)`
   * @param {number} imageWidth 
   * @param {number} imageHeight 
   * @param {Uint8ClampedArray} imgDataRaw - RGBA array dari canvas
   */
  extractFeatures(pixels, imageWidth, imageHeight, imgDataRaw) {
    if (!pixels || pixels.length === 0) return null;
    
    let minX = imageWidth, maxX = 0;
    let minY = imageHeight, maxY = 0;
    
    let sumR = 0, sumG = 0, sumB = 0;
    let sumX = 0, sumY = 0;
    
    // Convert to points for geometric math
    let points = [];
    let pixelSet = new Set(pixels); // for fast lookup in perimeter/GLCM
    
    pixels.forEach(p => {
      let x = p % imageWidth;
      let y = Math.floor(p / imageWidth);
      
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      
      sumX += x;
      sumY += y;
      
      let idx = (y * imageWidth + x) * 4;
      sumR += imgDataRaw[idx];
      sumG += imgDataRaw[idx+1];
      sumB += imgDataRaw[idx+2];
      
      points.push({x, y});
    });
    
    const area = pixels.length;
    const cx = sumX / area;
    const cy = sumY / area;
    
    const w = (maxX - minX + 1);
    const h = (maxY - minY + 1);
    const aspect_ratio = h === 0 ? 0 : w / h;
    
    const meanR = sumR / area;
    const meanG = sumG / area;
    const meanB = sumB / area;
    
    // Std Dev Warna
    let sumSqR = 0, sumSqG = 0, sumSqB = 0;
    pixels.forEach(p => {
      let idx = (Math.floor(p / imageWidth) * imageWidth + (p % imageWidth)) * 4;
      sumSqR += Math.pow(imgDataRaw[idx] - meanR, 2);
      sumSqG += Math.pow(imgDataRaw[idx+1] - meanG, 2);
      sumSqB += Math.pow(imgDataRaw[idx+2] - meanB, 2);
    });
    const stdR = Math.sqrt(sumSqR / area);
    const stdG = Math.sqrt(sumSqG / area);
    const stdB = Math.sqrt(sumSqB / area);
    
    // Convex Hull & Solidity
    const hull = this.getConvexHull(points);
    const hullArea = this.getPolygonArea(hull);
    const solidity = hullArea === 0 ? 1 : area / hullArea;
    
    // Perimeter & Circularity
    const perimeter = this.getPerimeter(pixels, pixelSet, imageWidth, imageHeight);
    const circularity = perimeter === 0 ? 0 : (4 * Math.PI * area) / (perimeter * perimeter);
    
    // Hu Moments
    const hu = this.getHuMoments(points, cx, cy);
    
    // Tekstur GLCM (Grayscale based)
    const glcm = this.getGLCM(pixels, pixelSet, imageWidth, imgDataRaw);
    
    return {
      area,
      cx: cx.toFixed(1), cy: cy.toFixed(1),
      width: w, height: h,
      aspect_ratio: aspect_ratio.toFixed(3),
      solidity: solidity.toFixed(3),
      circularity: circularity.toFixed(3),
      color: { 
        r: meanR.toFixed(1), g: meanG.toFixed(1), b: meanB.toFixed(1), 
        stdR: stdR.toFixed(1), stdG: stdG.toFixed(1), stdB: stdB.toFixed(1) 
      },
      hu_moments: hu,
      texture: glcm
    };
  },

  // --- Geometri & Bentuk ---

  /**
   * Monotone Chain Convex Hull algorithm
   */
  getConvexHull(points) {
    if (points.length <= 3) return points;
    if (points.length > 50000) {
      // Too massive to sort safely in real-time, return bounding box approx
      let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
      points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      return [{x:minX, y:minY}, {x:maxX, y:minY}, {x:maxX, y:maxY}, {x:minX, y:maxY}];
    }
    // Sort points by x, then by y
    let sorted = points.slice().sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    let lower = [];
    for (let i = 0; i < sorted.length; i++) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) {
        lower.pop();
      }
      lower.push(sorted[i]);
    }
    let upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) {
        upper.pop();
      }
      upper.push(sorted[i]);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  },

  /** Shoelace formula for polygon area */
  getPolygonArea(pts) {
    if (pts.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      let j = (i + 1) % pts.length;
      area += pts[i].x * pts[j].y;
      area -= pts[j].x * pts[i].y;
    }
    return Math.abs(area / 2.0);
  },

  /** Hitung perimeter berdasarkan jumlah piksel yang memiliki tetangga luar (background) */
  getPerimeter(pixels, pixelSet, w, h) {
    let p = 0;
    pixels.forEach(idx => {
      const cx = idx % w;
      const cy = Math.floor(idx / w);
      let isEdge = false;
      // Cek 4-connectivity
      const neighbors = [
        [0, -1], [0, 1], [-1, 0], [1, 0]
      ];
      for (let i=0; i<4; i++) {
        let nx = cx + neighbors[i][0];
        let ny = cy + neighbors[i][1];
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
          isEdge = true; break;
        }
        let nIdx = ny * w + nx;
        if (!pixelSet.has(nIdx)) {
          isEdge = true; break;
        }
      }
      if (isEdge) p++;
    });
    return p;
  },

  // --- Hu Moments (Invarian Skala, Rotasi, Translasi) ---
  
  getHuMoments(points, cx, cy) {
    // Spatial Moments
    const m = (p, q) => points.reduce((sum, pt) => sum + Math.pow(pt.x, p) * Math.pow(pt.y, q), 0);
    // Central Moments
    const mu = (p, q) => points.reduce((sum, pt) => sum + Math.pow(pt.x - cx, p) * Math.pow(pt.y - cy, q), 0);
    
    const mu00 = mu(0,0) || 1; // == Area
    // Normalized Central Moments
    const eta = (p, q) => mu(p, q) / Math.pow(mu00, (p + q) / 2 + 1);

    const eta20 = eta(2,0), eta02 = eta(0,2), eta11 = eta(1,1);
    const eta30 = eta(3,0), eta03 = eta(0,3), eta12 = eta(1,2), eta21 = eta(2,1);

    // Hitung 7 Hu Moments
    const h1 = eta20 + eta02;
    const h2 = Math.pow(eta20 - eta02, 2) + 4 * Math.pow(eta11, 2);
    const h3 = Math.pow(eta30 - 3 * eta12, 2) + Math.pow(3 * eta21 - eta03, 2);
    const h4 = Math.pow(eta30 + eta12, 2) + Math.pow(eta21 + eta03, 2);
    const h5 = (eta30 - 3 * eta12) * (eta30 + eta12) * (Math.pow(eta30 + eta12, 2) - 3 * Math.pow(eta21 + eta03, 2)) +
               (3 * eta21 - eta03) * (eta21 + eta03) * (3 * Math.pow(eta30 + eta12, 2) - Math.pow(eta21 + eta03, 2));
    const h6 = (eta20 - eta02) * (Math.pow(eta30 + eta12, 2) - Math.pow(eta21 + eta03, 2)) +
               4 * eta11 * (eta30 + eta12) * (eta21 + eta03);
    const h7 = (3 * eta21 - eta03) * (eta30 + eta12) * (Math.pow(eta30 + eta12, 2) - 3 * Math.pow(eta21 + eta03, 2)) -
               (eta30 - 3 * eta12) * (eta21 + eta03) * (3 * Math.pow(eta30 + eta12, 2) - Math.pow(eta21 + eta03, 2));

    // Log transform untuk memudahkan pembacaan numerik yang sangat kecil
    const logHu = (val) => {
      if (val === 0) return 0;
      return (-1 * Math.sign(val) * Math.log10(Math.abs(val))).toFixed(3);
    };

    return [logHu(h1), logHu(h2), logHu(h3), logHu(h4), logHu(h5), logHu(h6), logHu(h7)];
  },

  // --- Tekstur Citra (Gray-Level Co-occurrence Matrix / GLCM) ---
  
  getGLCM(pixels, pixelSet, w, imgDataRaw) {
    // Buat matriks 8x8 (grayscale di-bin ke 8 level)
    let glcm = Array(8).fill(0).map(() => Array(8).fill(0));
    let totalPairs = 0;
    
    pixels.forEach(idx => {
      let cx = idx % w;
      let cy = Math.floor(idx / w);
      
      // Hitung grayscale dari pixel aktif
      let i4 = idx * 4;
      let gray1 = 0.299 * imgDataRaw[i4] + 0.587 * imgDataRaw[i4+1] + 0.114 * imgDataRaw[i4+2];
      let b1 = Math.floor(gray1 / 32); // 0-7
      if (b1 > 7) b1 = 7;

      // Cek tetangga di sebelah KANAN (d=1, theta=0)
      let nIdx = cy * w + (cx + 1);
      if (pixelSet.has(nIdx)) {
        let n4 = nIdx * 4;
        let gray2 = 0.299 * imgDataRaw[n4] + 0.587 * imgDataRaw[n4+1] + 0.114 * imgDataRaw[n4+2];
        let b2 = Math.floor(gray2 / 32);
        if (b2 > 7) b2 = 7;
        
        glcm[b1][b2]++;
        glcm[b2][b1]++; // Symmetrize
        totalPairs += 2;
      }
    });

    if (totalPairs === 0) return { contrast: 0, homogeneity: 0, energy: 0 };

    let contrast = 0, homogeneity = 0, energy = 0;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        let p = glcm[i][j] / totalPairs;
        contrast += p * Math.pow(i - j, 2);
        homogeneity += p / (1 + Math.abs(i - j));
        energy += p * p;
      }
    }

    return { 
      contrast: contrast.toFixed(3), 
      homogeneity: homogeneity.toFixed(3), 
      energy: energy.toFixed(3) 
    };
  },

  // --- Klasifikasi Jarak KNN ---

  /**
   * Menghitung jarak multidimensional Euclidean antara dua fitur CV.
   * @param {Object} featA - Fitur objek yang terdeteksi
   * @param {Object} featB - Fitur dari database
   */
  calculateDistance(featA, featB) {
    let dist = 0;
    
    // Beda Warna (RGB) - Bobot 1.0
    dist += Math.pow(featA.color.r - featB.color.r, 2) * 1.0;
    dist += Math.pow(featA.color.g - featB.color.g, 2) * 1.0;
    dist += Math.pow(featA.color.b - featB.color.b, 2) * 1.0;
    
    // Beda Geometri - Bobot dikali faktor skala yang sesuai
    // Circularity & Solidity (skala 0-1) => kalikan 1000 agar setara dg RGB
    dist += Math.pow(featA.circularity - featB.circularity, 2) * 2000;
    dist += Math.pow(featA.solidity - featB.solidity, 2) * 2000;
    dist += Math.pow(featA.aspect_ratio - featB.aspect_ratio, 2) * 1000;
    
    // Beda Hu Moments (skala sudah dilog kan, biasanya belasan/puluhan)
    for(let i=0; i<7; i++) {
       dist += Math.pow(featA.hu_moments[i] - featB.hu_moments[i], 2) * 500;
    }

    // Beda Tekstur GLCM
    dist += Math.pow(featA.texture.contrast - featB.texture.contrast, 2) * 1000;
    dist += Math.pow(featA.texture.homogeneity - featB.texture.homogeneity, 2) * 1000;

    return Math.sqrt(dist);
  },

  /**
   * Mencari entri terdekat di array database
   */
  findNearestNeighbor(targetFeatures, databaseArray) {
    if (!databaseArray || databaseArray.length === 0) return null;
    
    let bestMatch = null;
    let minDistance = Infinity;

    databaseArray.forEach(dbItem => {
      // Pastikan item db memiliki format fitur CV (hasil training sistem baru)
      if (dbItem.features) {
        let dist = this.calculateDistance(targetFeatures, dbItem.features);
        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = { item: dbItem, distance: dist };
        }
      }
    });

    return bestMatch; // Mengembalikan null jika DB masih versi lama (belum dilatih ulang)
  },

  // --- YOLOv8 Edge Inference Loader ---
  YoloV8Engine: class {
    constructor(modelUrl) {
      this.modelUrl = modelUrl;
      this.model = null;
      this.labels = []; // Disesuaikan oleh modul masing-masing
      this.isLoaded = false;
    }

    async loadModel() {
      if (!window.tf) {
        console.warn("[YoloV8Engine] TensorFlow.js (tf) belum dimuat.");
        return false;
      }
      try {
        console.log(`[YoloV8Engine] Mencoba memuat model Graph dari: ${this.modelUrl}`);
        this.model = await tf.loadGraphModel(this.modelUrl);
        this.isLoaded = true;
        console.log("[YoloV8Engine] Model berhasil dimuat.");
        return true;
      } catch (err) {
        console.error(`[YoloV8Engine] Gagal memuat model. Menggunakan fallback simulasi.`, err);
        this.isLoaded = false;
        return false;
      }
    }

    async predict(imgElement) {
      if (!this.isLoaded || !this.model) {
        console.warn("[YoloV8Engine] Model belum dimuat. Mengembalikan array kosong (fallback).");
        return []; 
      }
      
      const inputSize = 640;
      
      // Pre-processing
      const tensor = tf.browser.fromPixels(imgElement)
        .resizeBilinear([inputSize, inputSize])
        .div(255.0)
        .expandDims(0);
        
      try {
        // Eksekusi model YOLO
        const predictions = await this.model.executeAsync(tensor);
        
        // Post-processing NMS sederhana (hanya mock up konversi NMS)
        // Format output YOLOv8 tensor adalah [1, num_classes + 4, 8400]
        // Di sini kita kembalikan prediksi mentah untuk ditangani modul
        const results = await predictions.array();
        
        tf.dispose([tensor, predictions]);
        return results;
      } catch (err) {
        console.error("[YoloV8Engine] Error saat inferensi:", err);
        tf.dispose(tensor);
        return [];
      }
    }
  }
};
